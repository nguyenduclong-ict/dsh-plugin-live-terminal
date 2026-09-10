export const name = 'dsh-plugin-live-terminal';
export const inject = ['webServer', 'subprocess'];

// Map of active process outputs: id -> { id, callId, jobId, pid, handle, sessionId, cwd, command, output, active, startedAt, lastUpdated, finishedAt }
const activeProcesses = new Map();
let latestSpawnedProc = null;

function cleanCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return '';
  const cmdIdx = argv.indexOf('-Command');
  if (cmdIdx !== -1 && argv[cmdIdx + 1]) {
    let cmd = argv[cmdIdx + 1];
    // Remove PowerShell UTF-8 preamble injected by DSH:
    // [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false);
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
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesCommand(proc, cmdText) {
  if (!proc || !proc.command || !cmdText) return false;
  const p = normalizeCmd(proc.command);
  const c = normalizeCmd(cmdText);
  return p === c || p.includes(c) || c.includes(p);
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
}

export function apply(ctx) {
  ctx.logger?.info?.('dsh-plugin-live-terminal host loaded, hooking subprocess...');

  // Optional registration if shellEnv service is mounted
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

  // Optional hook for background jobs registry to link jobId directly
  ctx.inject(['jobs'], (jobsCtx) => {
    try {
      const origJobsStart = jobsCtx.jobs.start.bind(jobsCtx.jobs);
      jobsCtx.jobs.start = function(spec) {
        let capturedProc = null;
        const origRun = spec.run;
        if (typeof origRun === 'function') {
          spec.run = function() {
            const prev = latestSpawnedProc;
            const hooks = origRun.call(this);
            if (latestSpawnedProc && latestSpawnedProc !== prev) {
              capturedProc = latestSpawnedProc;
            }
            return hooks;
          };
        }
        const jobId = origJobsStart(spec);
        if (jobId) {
          const jid = String(jobId);
          if (!capturedProc && spec.label) {
            for (const p of activeProcesses.values()) {
              if (p.active && matchesCommand(p, spec.label)) {
                capturedProc = p;
                break;
              }
            }
          }
          if (capturedProc) {
            capturedProc.jobId = jid;
            activeProcesses.set(jid, capturedProc);
            ctx.logger?.info?.(`[dsh-plugin-live-terminal] Linked background jobId=${jid} to proc ${capturedProc.id}`);
          }
        }
        return jobId;
      };
      ctx.logger?.info?.('dsh-plugin-live-terminal hooked jobs.start for background job correlation');
    } catch (e) {
      ctx.logger?.warn?.(`dsh-plugin-live-terminal failed to hook jobs: ${e?.message || e}`);
    }
  });

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

        // Keep completed records in cache, pruning only when count exceeds 50
        pruneCompletedProcesses();
      });
    }

    return handle;
  };

  // Register HTTP route for output retrieval
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

      let matched = null;

      // 1. By jobId
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

  // Register HTTP route to stop a running process
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

      const qJobId = reqUrl.searchParams.get('jobId');
      const qId = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('callId');

      let targetProc = null;
      if (qJobId) {
        targetProc = activeProcesses.get(qJobId);
        if (!targetProc) {
          for (const p of activeProcesses.values()) {
            if (p.jobId === qJobId) {
              targetProc = p;
              break;
            }
          }
        }
      }

      if (!targetProc && qId) {
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

      let killed = false;

      // 1. Kill via ctx.jobs if available
      if (qJobId && ctx.jobs) {
        try {
          ctx.jobs.kill(qJobId, undefined, 'Stopped by user from Live Terminal');
          killed = true;
          ctx.logger?.info?.(`[dsh-plugin-live-terminal] Killed job ${qJobId} via ctx.jobs`);
        } catch (e) {
          ctx.logger?.warn?.(`[dsh-plugin-live-terminal] ctx.jobs.kill failed: ${e?.message || e}`);
        }
      }

      // 2. Kill via subprocess handle
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

      res.end(JSON.stringify({
        success: true,
        killed,
        jobId: qJobId,
        id: qId
      }));
    }
  });

  ctx.logger?.info?.('dsh-plugin-live-terminal endpoints /api/live-terminal/output and /api/live-terminal/stop ready');
}
