export const name = 'dsh-plugin-live-terminal';
export const inject = ['webServer', 'subprocess'];

// Map of active process outputs for foreground commands:
// id -> { id, callId, jobId, pid, handle, sessionId, cwd, command, output, active, startedAt, lastUpdated, finishedAt }
const activeProcesses = new Map();
let latestSpawnedProc = null;

// Map of background job buffers: jobId -> accumulated output string
const backgroundJobBuffers = new Map();
let jobsRegistry = null;

// Map of in-flight `job_output` calls waiting on a job (wait: true):
// callId -> { callId, jobId, sessionId, startedAt, controller }
// Aborting one of these controllers ends ONLY that waiting tool call; the
// background job it waits on keeps running (route `/api/live-terminal/stop?mode=wait`).
const pendingWaits = new Map();

/** Resolve one pending wait by tool call id first, then by awaited job id. */
function findPendingWait(callId, jobId) {
  if (callId) {
    const wanted = String(callId);
    const direct = pendingWaits.get(wanted);
    if (direct) return direct;
    for (const entry of pendingWaits.values()) {
      if (entry.callId === wanted) return entry;
    }
  }
  if (jobId) {
    const wanted = String(jobId);
    for (const entry of pendingWaits.values()) {
      if (entry.jobId === wanted) return entry;
    }
  }
  return null;
}

/** Public job snapshot shape accepted by the `job_output` output schema. */
function jobSnapshotForValue(jobId) {
  const store = jobsRegistry?.store;
  if (!store || !jobId) return null;

  let job = store.get(jobId);
  if (!job) {
    for (const [id, candidate] of store.entries()) {
      if (String(id) === String(jobId)) {
        job = candidate;
        break;
      }
    }
  }
  if (!job) return null;

  const snapshot = {
    id: String(job.id ?? jobId),
    kind: typeof job.kind === 'string' && job.kind ? job.kind : 'job',
    label: typeof job.label === 'string' ? job.label : '',
    // Constrained to the `job_output` schema enum: an unexpected producer value
    // must not fail output validation and turn this into an error result.
    status: ['running', 'stopping', 'completed', 'killed', 'failed'].includes(job.status) ? job.status : 'running',
    startedAt: Number.isSafeInteger(job.startedAt) ? job.startedAt : Date.now()
  };
  if (typeof job.detail === 'string') snapshot.detail = job.detail;
  if (Number.isSafeInteger(job.finishedAt)) snapshot.finishedAt = job.finishedAt;
  return snapshot;
}

/**
 * Replacement `job_output` value for a wait the user stopped.
 * Returned as the tool's own `value`, so the registered `render` and the
 * tool-jobs content finalizer shape the model-facing text exactly like a
 * normal read ("<text>\n[status: ...]"), and the tool call is NOT an error.
 * Returns null when the job record is unavailable, leaving the honest
 * core result ("Error: wait aborted") in place.
 */
function waitStoppedValue(jobId) {
  const job = jobSnapshotForValue(jobId);
  if (!job) return null;

  const settled = job.status === 'completed' || job.status === 'killed' || job.status === 'failed';
  return {
    text: settled
      ? `Wait stopped by user; job ${job.id} has already settled.`
      : `Wait stopped by user; job ${job.id} is still running — read it again with job_output, or stop it with job_kill.`,
    job
  };
}

function cleanCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return '';
  const cmdIdx = argv.indexOf('-Command');
  if (cmdIdx !== -1 && argv[cmdIdx + 1]) {
    let cmd = argv[cmdIdx + 1];
    // Remove PowerShell UTF-8 preamble injected by DSH:
    cmd = cmd.replace(/^\s*\[Console\]::OutputEncoding[^;]+;\s*\$OutputEncoding[^;]+;\s*/i, '');
    return cmd.trim();
  }
  const cIdx = argv.indexOf('-c');
  if (cIdx !== -1 && argv[cIdx + 1]) {
    return argv[cIdx + 1].trim();
  }
  return argv.slice(1).join(' ').trim() || argv[0];
}

function normalizeCmd(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^\s*\[console\]::outputencoding[^;]+;\s*\$outputencoding[^;]+;\s*/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesCommand(procOrCmd, cmdText) {
  if (!procOrCmd || !cmdText) return false;
  const p = normalizeCmd(typeof procOrCmd === 'string' ? procOrCmd : (procOrCmd.command || procOrCmd.label || ''));
  const c = normalizeCmd(cmdText);
  if (!p || !c) return false;
  if (p === c) return true;

  const minLen = Math.min(p.length, c.length);
  const maxLen = Math.max(p.length, c.length);
  if (minLen > 30 && minLen / maxLen >= 0.75) {
    return p.includes(c) || c.includes(p);
  }
  return false;
}

function pruneCompletedProcesses() {
  const completed = [];
  for (const proc of activeProcesses.values()) {
    if (!proc.active) {
      completed.push(proc);
    }
  }
  if (completed.length > 50) {
    completed.sort((a, b) => (a.finishedAt || 0) - (b.finishedAt || 0));
    const toRemove = completed.slice(0, completed.length - 50);
    for (const p of toRemove) {
      activeProcesses.delete(p.id);
      if (p.callId) activeProcesses.delete(p.callId);
      if (p.jobId) activeProcesses.delete(p.jobId);
    }
  }

  // Keep up to 100 finished background job buffers
  if (backgroundJobBuffers.size > 100) {
    const keys = [...backgroundJobBuffers.keys()];
    for (let i = 0; i < keys.length - 100; i++) {
      backgroundJobBuffers.delete(keys[i]);
    }
  }
}

/**
 * Wraps job.readOutput to support multi-consumer streaming:
 * - Plugin gets full accumulated output from process start.
 * - Agent / tool-jobs (job_output) gets its incremental unread delta without missing anything.
 */
function setupJobOutputInterception(jobId, job) {
  if (!job || job.__liveTerminalIntercepted) return;
  job.__liveTerminalIntercepted = true;

  const origReadOutput = job.readOutput;
  let fullAccumulated = backgroundJobBuffers.get(jobId) || '';
  let modelUnreadBuffer = '';

  function pump() {
    if (typeof origReadOutput === 'function') {
      try {
        const chunk = origReadOutput();
        if (chunk) {
          fullAccumulated += chunk;
          modelUnreadBuffer += chunk;
          backgroundJobBuffers.set(jobId, fullAccumulated);
        }
      } catch (e) {}
    }
  }

  job.readOutput = function() {
    pump();
    const result = modelUnreadBuffer;
    modelUnreadBuffer = '';
    return result;
  };

  job.__getLiveOutput = function() {
    pump();
    return fullAccumulated;
  };

  if (job.settled && typeof job.settled.then === 'function') {
    job.settled.then(() => {
      pump();
      if (job.output && job.output.length > fullAccumulated.length) {
        fullAccumulated = job.output;
      }
      backgroundJobBuffers.set(jobId, fullAccumulated);
    }).catch(() => {});
  }

  if (!backgroundJobBuffers.has(jobId)) {
    backgroundJobBuffers.set(jobId, '');
  }
}

export function apply(ctx) {
  ctx.logger?.info?.('dsh-plugin-live-terminal host loaded, hooking subprocess and jobs...');

  // 1. Optional registration if shellEnv service is mounted
  ctx.inject(['shellEnv'], (envCtx) => {
    try {
      envCtx.shellEnv.register({
        name: 'live-terminal-call-id',
        variables: {
          DSH_CALL_ID: {
            description: 'Call ID of the current tool execution for live stream correlation.'
          }
        },
        resolve(execution) {
          if (execution && execution.callId) {
            return { DSH_CALL_ID: String(execution.callId) };
          }
          return {};
        }
      });
      ctx.logger?.info?.('dsh-plugin-live-terminal registered DSH_CALL_ID contributor');
    } catch (e) {
      ctx.logger?.warn?.(`dsh-plugin-live-terminal failed to register shellEnv contributor: ${e?.message || e}`);
    }
  });

  // 2. Hook background jobs registry to intercept output streaming
  ctx.inject(['jobs'], (jobsCtx) => {
    try {
      jobsRegistry = jobsCtx.jobs;

      // Intercept any pre-existing jobs
      if (jobsRegistry?.store) {
        for (const [id, job] of jobsRegistry.store.entries()) {
          setupJobOutputInterception(String(id), job);
        }
      }

      const origJobsStart = jobsCtx.jobs.start.bind(jobsCtx.jobs);
      jobsCtx.jobs.start = function(spec) {
        const jobId = origJobsStart(spec);
        if (jobId) {
          const jid = String(jobId);
          try {
            const job = jobsCtx.jobs.store?.get(jobId);
            if (job) {
              setupJobOutputInterception(jid, job);
              ctx.logger?.info?.(`[dsh-plugin-live-terminal] Intercepted background job ${jid}`);
            }
          } catch (e) {
            ctx.logger?.warn?.(`[dsh-plugin-live-terminal] Failed to intercept job ${jid}: ${e?.message || e}`);
          }
        }
        return jobId;
      };
      ctx.logger?.info?.('dsh-plugin-live-terminal hooked jobs.start for background job streaming');
    } catch (e) {
      ctx.logger?.warn?.(`dsh-plugin-live-terminal failed to hook jobs: ${e?.message || e}`);
    }
  });

  // 3. Track in-flight job_output(wait: true) calls so a Stop can end ONLY the
  // waiting tool call. DSH hands a tool body `exec.signal` fused from the caller
  // signal plus whatever an around-wrapper put there, so contributing our own
  // controller to `exec.signal` is the supported seam: aborting it cancels this
  // one call and leaves the turn (and the background job) alive.
  ctx.inject(['tools'], (toolsCtx) => {
    try {
      toolsCtx.on('tools/execute', async (exec, next) => {
        if (!exec || exec.name !== 'job_output' || exec.arguments?.wait !== true) {
          return next();
        }

        const callId = exec.callId === undefined || exec.callId === null ? '' : String(exec.callId);
        const jobId = exec.arguments?.job_id === undefined || exec.arguments?.job_id === null
          ? ''
          : String(exec.arguments.job_id);
        if (!callId && !jobId) return next();

        const entry = {
          callId,
          jobId,
          sessionId: exec.agent?.id ?? null,
          startedAt: Date.now(),
          controller: new AbortController()
        };
        if (callId) pendingWaits.set(callId, entry);

        const upstreamSignal = exec.signal;
        // Fuse instead of clobbering: another around-wrapper (e.g. the tool-call
        // timeout policy) may already have replaced `exec.signal`, and its
        // cancellation must keep reaching this body.
        exec.signal = upstreamSignal && typeof upstreamSignal.addEventListener === 'function'
          ? AbortSignal.any([upstreamSignal, entry.controller.signal])
          : entry.controller.signal;
        try {
          const result = await next();

          const stoppedByUs = entry.controller.signal.aborted;
          const message = result?.error?.message;
          if (stoppedByUs && result?.isError && (message === 'wait aborted' || message === 'tool call aborted')) {
            const replacement = waitStoppedValue(jobId);
            if (replacement) return { value: replacement };
          }
          return result;
        } finally {
          exec.signal = upstreamSignal;
          if (callId) pendingWaits.delete(callId);
        }
      });
      ctx.logger?.info?.('dsh-plugin-live-terminal hooked tools/execute for job_output wait tracking');
    } catch (e) {
      ctx.logger?.warn?.(`dsh-plugin-live-terminal failed to hook tools/execute: ${e?.message || e}`);
    }
  });

  // 4. Hook subprocess.spawn for foreground command output streaming
  const originalSpawn = ctx.subprocess.spawn.bind(ctx.subprocess);
  ctx.subprocess.spawn = function(spec) {
    const handle = originalSpawn(spec);

    const stdoutCollector = handle.collected?.stdout;
    if (stdoutCollector) {
      const env = spec.env || {};
      const callId = env.DSH_CALL_ID || null;
      const sessionId = env.DSH_SESSION_ID || null;
      const id = callId || (handle.pid > 0 ? String(handle.pid) : `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const command = cleanCommand(spec.argv);
      const cwd = spec.cwd || '';

      const procRecord = {
        id,
        callId,
        jobId: null,
        pid: handle.pid || 0,
        handle,
        sessionId,
        cwd,
        command,
        output: '',
        active: true,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
        finishedAt: null
      };

      latestSpawnedProc = procRecord;
      activeProcesses.set(id, procRecord);
      if (callId && id !== callId) {
        activeProcesses.set(callId, procRecord);
      }

      let readOffset = 0;
      const timer = setInterval(() => {
        try {
          const slice = stdoutCollector.readFrom(readOffset);
          if (slice && slice.text) {
            procRecord.output += slice.text;
            readOffset = slice.nextOffset;
            if (procRecord.output.length > 300000) {
              procRecord.output = procRecord.output.slice(-300000);
            }
            procRecord.lastUpdated = Date.now();
          }
        } catch (e) {}
      }, 150);

      handle.done.finally(() => {
        clearInterval(timer);
        try {
          const slice = stdoutCollector.readFrom(readOffset);
          if (slice && slice.text) {
            procRecord.output += slice.text;
          }
        } catch (e) {}
        procRecord.active = false;
        procRecord.finishedAt = Date.now();
        procRecord.lastUpdated = Date.now();

        pruneCompletedProcesses();
      });
    }

    return handle;
  };

  // 5. HTTP route to list all background jobs with their live status
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/live-terminal/jobs',
    handler: async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let reqUrl;
      try {
        reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      } catch (e) {
        reqUrl = { searchParams: new URLSearchParams() };
      }

      // Optional session filter: mirrors `ctx.jobs.list(session)` so the client
      // can line this list up with the session's own background-job popover.
      const qSessionId = reqUrl.searchParams.get('sessionId');

      const jobs = jobsRegistry || ctx.jobs || ctx.get?.('jobs');
      const jobList = [];

      if (jobs?.store) {
        for (const [id, job] of jobs.store.entries()) {
          const jid = String(id);
          if (!job.__liveTerminalIntercepted) {
            setupJobOutputInterception(jid, job);
          }
          const ownerSessionId = job.owner?.id ?? null;
          if (qSessionId && ownerSessionId !== null && ownerSessionId !== qSessionId) continue;

          const isTerminal = job.status === 'completed' || job.status === 'killed' || job.status === 'failed';
          jobList.push({
            id: jid,
            kind: job.kind || 'pwsh',
            command: job.label || '',
            status: job.status || (isTerminal ? 'completed' : 'running'),
            active: !isTerminal,
            sessionId: ownerSessionId,
            startedAt: job.startedAt || 0,
            finishedAt: job.finishedAt || null
          });
        }
      }

      for (const [jid, output] of backgroundJobBuffers.entries()) {
        if (!jobList.some(j => j.id === jid)) {
          jobList.push({
            id: jid,
            kind: 'pwsh',
            command: '',
            status: 'completed',
            active: false,
            hasOutput: !!output
          });
        }
      }

      res.end(JSON.stringify({
        success: true,
        jobs: jobList
      }));
    }
  });

  // 6. HTTP route for output retrieval (both background jobs and foreground processes)
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/live-terminal/output',
    handler: async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let reqUrl;
      try {
        reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      } catch (e) {
        reqUrl = { searchParams: new URLSearchParams() };
      }

      const qJobId = reqUrl.searchParams.get('jobId');
      const qId = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('callId');
      const qSessionId = reqUrl.searchParams.get('sessionId');
      const qCommand = reqUrl.searchParams.get('command');

      // --- A. Prioritize lookup via jobs registry (for background jobs) ---
      const jobs = jobsRegistry || ctx.jobs || ctx.get?.('jobs');

      if (qJobId) {
        let job = jobs?.store?.get(qJobId);
        if (!job && jobs?.store) {
          for (const [id, j] of jobs.store.entries()) {
            if (String(id) === qJobId) {
              job = j;
              break;
            }
          }
        }

        if (job) {
          if (!job.__liveTerminalIntercepted) {
            setupJobOutputInterception(qJobId, job);
          }
          const isTerminal = job.status === 'completed' || job.status === 'killed' || job.status === 'failed';
          let fullOutput = job.__getLiveOutput ? job.__getLiveOutput() : (backgroundJobBuffers.get(qJobId) || '');
          if (isTerminal && job.output && job.output.length > fullOutput.length) {
            fullOutput = job.output;
            backgroundJobBuffers.set(qJobId, fullOutput);
          }

          return res.end(JSON.stringify({
            found: true,
            active: !isTerminal,
            status: job.status,
            jobId: qJobId,
            command: job.label || '',
            output: fullOutput
          }));
        }

        if (backgroundJobBuffers.has(qJobId)) {
          return res.end(JSON.stringify({
            found: true,
            active: false,
            status: 'completed',
            jobId: qJobId,
            output: backgroundJobBuffers.get(qJobId)
          }));
        }
      }

      // --- B. activeProcesses (foreground commands and tracked processes) ---
      let matched = null;

      // 1. By jobId in activeProcesses
      if (qJobId) {
        if (activeProcesses.has(qJobId)) {
          matched = activeProcesses.get(qJobId);
        } else {
          for (const proc of activeProcesses.values()) {
            if (proc.jobId === qJobId) {
              matched = proc;
              break;
            }
          }
        }
      }

      // 2. By specific ID or callId
      if (!matched && qId) {
        if (activeProcesses.has(qId)) {
          matched = activeProcesses.get(qId);
        } else {
          for (const proc of activeProcesses.values()) {
            if (proc.id === qId || proc.callId === qId || proc.jobId === qId) {
              matched = proc;
              break;
            }
          }
        }
      }

      // 3. By sessionId and command
      if (!matched && qSessionId && qCommand) {
        for (const proc of activeProcesses.values()) {
          if (proc.sessionId === qSessionId && matchesCommand(proc, qCommand)) {
            if (proc.active) {
              matched = proc;
              break;
            }
            if (!matched || proc.lastUpdated > matched.lastUpdated) {
              matched = proc;
            }
          }
        }
      }

      // 4. By command only
      if (!matched && qCommand) {
        for (const proc of activeProcesses.values()) {
          if (matchesCommand(proc, qCommand)) {
            if (proc.active) {
              matched = proc;
              break;
            }
            if (!matched || proc.lastUpdated > matched.lastUpdated) {
              matched = proc;
            }
          }
        }
      }

      // 5. By sessionId only
      if (!matched && qSessionId) {
        for (const proc of activeProcesses.values()) {
          if (proc.sessionId === qSessionId) {
            if (proc.active) {
              matched = proc;
              break;
            }
            if (!matched || proc.lastUpdated > matched.lastUpdated) {
              matched = proc;
            }
          }
        }
      }

      // 6. Fallback if only 1 active process
      if (!matched) {
        const activeList = [];
        for (const proc of activeProcesses.values()) {
          if (proc.active && !activeList.some(p => p.id === proc.id)) {
            activeList.push(proc);
          }
        }
        if (activeList.length === 1) {
          matched = activeList[0];
        }
      }

      // 7. Fallback to background jobs by command only if no active process matched
      if (!matched && !qJobId && qCommand && jobs?.store) {
        for (const [id, job] of jobs.store.entries()) {
          if (matchesCommand(job.label, qCommand)) {
            const jid = String(id);
            if (!job.__liveTerminalIntercepted) {
              setupJobOutputInterception(jid, job);
            }
            const isTerminal = job.status === 'completed' || job.status === 'killed' || job.status === 'failed';
            let fullOutput = job.__getLiveOutput ? job.__getLiveOutput() : (backgroundJobBuffers.get(jid) || '');
            if (isTerminal && job.output && job.output.length > fullOutput.length) {
              fullOutput = job.output;
              backgroundJobBuffers.set(jid, fullOutput);
            }

            return res.end(JSON.stringify({
              found: true,
              active: !isTerminal,
              isBackground: true,
              status: job.status,
              jobId: jid,
              command: job.label || '',
              output: fullOutput
            }));
          }
        }
      }

      if (matched) {
        if (qJobId && !matched.jobId) {
          matched.jobId = qJobId;
          activeProcesses.set(qJobId, matched);
        }
        return res.end(JSON.stringify({
          found: true,
          active: matched.active,
          id: matched.id,
          jobId: matched.jobId,
          callId: matched.callId,
          sessionId: matched.sessionId,
          command: matched.command,
          cwd: matched.cwd,
          output: matched.output,
          finishedAt: matched.finishedAt
        }));
      }

      res.end(JSON.stringify({
        found: false,
        active: false,
        output: ''
      }));
    }
  });

  // 7. HTTP route to stop a running background job or foreground process
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/live-terminal/stop',
    handler: async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let reqUrl;
      try {
        reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      } catch (e) {
        reqUrl = { searchParams: new URLSearchParams() };
      }

      const qMode = (reqUrl.searchParams.get('mode') || '').toLowerCase();
      const qJobId = reqUrl.searchParams.get('jobId');
      const qId = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('callId');

      // 0. Wait-only stop: end the pending `job_output(wait: true)` call and
      // leave the background job running. Never falls through to a kill.
      if (qMode === 'wait') {
        const target = findPendingWait(qId, qJobId);
        let stoppedWait = false;

        if (target) {
          const reason = new Error('wait stopped by user from Live Terminal');
          reason.name = 'LiveTerminalWaitStopped';
          try {
            target.controller.abort(reason);
            stoppedWait = true;
            ctx.logger?.info?.(
              `[dsh-plugin-live-terminal] Stopped wait${target.callId ? ` ${target.callId}` : ''} on job ${target.jobId}; job left running`
            );
          } catch (e) {
            ctx.logger?.warn?.(`[dsh-plugin-live-terminal] Failed to stop wait: ${e?.message || e}`);
          }
        }

        return res.end(JSON.stringify({
          success: true,
          mode: 'wait',
          stoppedWait,
          killed: false,
          jobId: qJobId,
          id: qId
        }));
      }

      let killed = false;

      // 1. Kill background job via jobs registry
      if (qJobId) {
        const jobs = jobsRegistry || ctx.jobs || ctx.get?.('jobs');
        let job = jobs?.store?.get(qJobId);
        if (!job && jobs?.store) {
          for (const [id, j] of jobs.store.entries()) {
            if (String(id) === qJobId) {
              job = j;
              break;
            }
          }
        }

        if (job) {
          if (typeof job.cancel === 'function') {
            try {
              job.cancel('Stopped by user from Live Terminal');
              job.status = 'stopping';
              killed = true;
              ctx.logger?.info?.(`[dsh-plugin-live-terminal] Cancelled background job ${qJobId}`);
            } catch (e) {}
          }
        }

        if (!killed && jobs && typeof jobs.kill === 'function') {
          try {
            jobs.kill(qJobId, job?.owner, 'Stopped by user from Live Terminal');
            killed = true;
          } catch (e) {}
        }

        const prev = backgroundJobBuffers.get(qJobId) || '';
        if (!prev.includes('[Process stopped by user]')) {
          backgroundJobBuffers.set(qJobId, (prev ? prev + '\n' : '') + '[Process stopped by user]\n');
        }
      }

      // 2. Kill foreground process via activeProcesses handle
      let targetProc = null;
      if (!killed && qJobId) {
        targetProc = activeProcesses.get(qJobId);
      }
      if (!killed && !targetProc && qId) {
        targetProc = activeProcesses.get(qId);
        if (!targetProc) {
          for (const p of activeProcesses.values()) {
            if (p.id === qId || p.callId === qId || p.jobId === qId) {
              targetProc = p;
              break;
            }
          }
        }
      }

      if (targetProc && targetProc.handle) {
        try {
          if (typeof targetProc.handle.terminate === 'function') {
            targetProc.handle.terminate();
            killed = true;
          } else if (typeof targetProc.handle.kill === 'function') {
            targetProc.handle.kill('SIGTERM');
            killed = true;
          }
        } catch (e) {}
      }

      // 3. Fallback on Windows: taskkill tree by pid
      if (targetProc && targetProc.pid > 0 && process.platform === 'win32') {
        try {
          const { spawnSync } = await import('node:child_process');
          spawnSync('taskkill', ['/F', '/T', '/PID', String(targetProc.pid)]);
          killed = true;
        } catch (e) {}
      }

      if (targetProc) {
        targetProc.active = false;
        targetProc.finishedAt = Date.now();
        targetProc.lastUpdated = Date.now();
        if (!targetProc.output.includes('[Process stopped by user]')) {
          targetProc.output += (targetProc.output ? '\n' : '') + '[Process stopped by user]\n';
        }
      }

      // NOTE: no catch-all fallback here. A stop that failed to resolve a
      // specific target must never cancel an unrelated running job; a wait on a
      // job must go through `mode=wait` above.

      res.end(JSON.stringify({
        success: true,
        killed,
        jobId: qJobId,
        id: qId
      }));
    }
  });

  ctx.logger?.info?.('dsh-plugin-live-terminal endpoints /api/live-terminal/jobs, /api/live-terminal/output, and /api/live-terminal/stop (mode=wait stops a pending job_output wait only) ready');
}
