export const name = 'dsh-plugin-live-terminal';
export const inject = ['webServer', 'subprocess'];

const terminal = (job) => ['completed', 'killed', 'failed'].includes(job.status);
const owner = (job) => typeof job.owner === 'string' ? job.owner : job.owner?.id;
const visible = (job, caller) => !!caller && owner(job) === caller;

export function apply(ctx) {
  // Derived observation state is local to this plugin instance, never registry truth.
  const processes = new Map();
  const waits = new Set();
  const timers = new Set();
  let disposed = false;
  let jobs;
  const effect = (scope, setup) => typeof scope.effect === 'function' ? scope.effect(setup) : setup();
  const registry = () => jobs || ctx.get?.('jobs') || ctx.jobs;
  const list = (service, caller) => (service?.list?.(caller) || []).filter(job => visible(job, caller));
  const get = (service, id, caller) => {
    if (!service || !id) return null;
    try {
      // The list fallback supports old test doubles, not private registry records.
      const job = typeof service.get === 'function' ? service.get(id, caller)
        : list(service, caller).find(job => String(job.id) === String(id));
      return job && visible(job, caller) ? job : null;
    } catch { return null; }
  };
  const output = (service, job, caller) => {
    // Each poll reads the retained head with an absolute observer offset. Neither
    // another browser nor the model's consuming cursor can steal these bytes.
    const slice = service.readAt(job.id, 0, caller);
    return {
      output: (slice.chunks || []).map(chunk => chunk.text).join(''),
      lossy: !!slice.lossy,
      nextOffset: slice.nextOffset ?? slice.next,
      spillPaths: job.output?.spillPaths
    };
  };
  const jobView = (service, job, caller) => ({
    found: true, active: !terminal(job), status: job.status, kind: job.kind,
    jobId: String(job.id), sessionId: owner(job) ?? null, command: job.label || '',
    startedAt: job.startedAt || 0, finishedAt: job.finishedAt || 0,
    ...output(service, job, caller)
  });

  effect(ctx, () => () => {
    disposed = true;
    for (const timer of timers) clearInterval(timer);
    timers.clear();
    for (const wait of waits) wait.controller.abort(new Error('Live Terminal disposed'));
    waits.clear();
    processes.clear();
  });

  ctx.inject(['jobs'], child => {
    effect(child, () => {
      jobs = child.jobs;
      return () => { if (jobs === child.jobs) jobs = undefined; };
    });
  });
  ctx.inject(['shellEnv'], child => {
    try {
      effect(child, () => child.shellEnv.register({
        name: 'live-terminal-call-id',
        variables: { DSH_CALL_ID: { description: 'Call ID for live stream correlation.' } },
        resolve: execution => execution?.callId ? { DSH_CALL_ID: String(execution.callId) } : {}
      }));
    } catch (error) { ctx.logger?.warn?.(`Live Terminal shellEnv: ${error.message}`); }
  });
  ctx.inject(['tools'], child => {
    child.on('tools/execute', async (exec, next) => {
      if (disposed || exec?.name !== 'job_output' || exec.arguments?.wait !== true) return next();
      const entry = {
        callId: String(exec.callId ?? ''), jobId: String(exec.arguments.job_id ?? ''),
        sessionId: exec.agent?.id, controller: new AbortController(), userStopped: false
      };
      waits.add(entry);
      const upstream = exec.signal;
      exec.signal = upstream ? AbortSignal.any([upstream, entry.controller.signal]) : entry.controller.signal;
      try {
        const result = await next();
        if (entry.userStopped && !upstream?.aborted && result?.isError &&
            ['wait aborted', 'tool call aborted'].includes(result.error?.message)) {
          const job = get(registry(), entry.jobId, entry.sessionId);
          if (job) {
            const snapshot = {
              id: String(job.id), kind: job.kind, label: job.label, status: job.status,
              startedAt: job.startedAt,
              ...(job.finishedAt === undefined ? {} : { finishedAt: job.finishedAt }),
              ...(job.detail === undefined ? {} : { detail: job.detail })
            };
            return { value: {
              text: terminal(job) ? `Wait stopped by user; job ${job.id} has already settled.`
                : `Wait stopped by user; job ${job.id} is still running — read it again with job_output, or stop it with job_kill.`,
              job: snapshot
            } };
          }
        }
        return result;
      } finally {
        exec.signal = upstream;
        waits.delete(entry);
      }
    });
  });

  // Subprocess has no observer-registration API. Own this reversible wrapper
  // as an effect, and restore only if no later plugin replaced our function.
  effect(ctx, () => {
    const service = ctx.subprocess;
    const original = service.spawn;
    const wrapped = function(spec) {
      const handle = original.call(this, spec);
      const collector = handle.collected?.stdout;
      if (!collector || disposed) return handle;
      const env = spec.env || {};
      if (!env.DSH_SESSION_ID || !env.DSH_CALL_ID) return handle;
      const id = env.DSH_CALL_ID || `proc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const argv = spec.argv || [];
      const commandIndex = Math.max(argv.indexOf('-Command'), argv.indexOf('-c'));
      const record = {
        id, callId: env.DSH_CALL_ID || null, sessionId: env.DSH_SESSION_ID || null,
        command: commandIndex >= 0 ? argv[commandIndex + 1] : argv.join(' '),
        cwd: spec.cwd, handle, output: '', active: true, startedAt: Date.now(), finishedAt: null
      };
      processes.set(id, record);
      let offset = 0;
      const pump = () => {
        if (disposed) return;
        try {
          const slice = collector.readFrom(offset);
          if (slice) {
            offset = slice.nextOffset ?? offset;
            const combined = record.output + (slice.text || '');
            record.lossy = !!record.lossy || !!slice.lossy || combined.length > 300000;
            record.output = combined.slice(-300000);
          }
        } catch { /* A failed collector does not break producer execution. */ }
      };
      const timer = setInterval(pump, 150);
      timers.add(timer);
      const finish = (status) => {
        clearInterval(timer);
        timers.delete(timer);
        pump();
        record.active = false;
        record.status = status;
        record.finishedAt = Date.now();
        const finished = [...processes.values()].filter(p => !p.active);
        for (const old of finished.slice(0, Math.max(0, finished.length - 50))) processes.delete(old.id);
      };
      // Use both settlement branches: finally alone creates an unhandled rejection.
      Promise.resolve(handle.done).then(
        outcome => finish(outcome?.signal ? 'killed' : outcome?.exitCode === 0 ? 'completed' : 'failed'),
        () => finish('failed')
      );
      return handle;
    };
    service.spawn = wrapped;
    return () => { if (service.spawn === wrapped) service.spawn = original; };
  });

  const register = (path, handler) => effect(ctx, () => ctx.webServer.register({
    kind: 'exact', path: `/api/live-terminal/${path}`,
    handler: async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== (path === 'stop' ? 'POST' : 'GET')) {
        res.statusCode = 405;
        res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        return;
      }
      if (path === 'stop' && req.headers?.['sec-fetch-site'] === 'cross-site') {
        res.statusCode = 403;
        res.end(JSON.stringify({ success: false, error: 'Cross-site stop request refused' }));
        return;
      }
      let query;
      try { query = new URL(req.url || '/', 'http://127.0.0.1').searchParams; }
      catch { query = new URLSearchParams(); }
      if (!query.get('sessionId')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'sessionId is required' }));
        return;
      }
      try { res.end(JSON.stringify(await handler(query))); }
      catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, found: false, error: error.message }));
      }
    }
  }));
  const callerOf = query => query.get('sessionId') || undefined;
  const processFor = query => {
    const caller = callerOf(query);
    const id = query.get('id') || query.get('callId');
    if (!caller || !id) return undefined;
    return [...processes.values()].find(p => p.sessionId === caller && (p.id === id || p.callId === id));
  };
  register('jobs', query => {
    const caller = callerOf(query);
    return {
      success: true,
      jobs: list(registry(), caller).map(job => ({
        id: String(job.id), kind: job.kind, command: job.label || '', status: job.status,
        active: !terminal(job), sessionId: owner(job),
        waiting: [...waits].some(wait => wait.sessionId === caller && wait.jobId === String(job.id)),
        startedAt: job.startedAt || 0, finishedAt: job.finishedAt ?? null
      })),
      processes: [...processes.values()].filter(proc => proc.sessionId === caller).map(({ handle, output, ...proc }) => ({
        ...proc, kind: 'shell', status: proc.status || (proc.active ? 'running' : 'completed')
      }))
    };
  });
  register('output', query => {
    const caller = callerOf(query);
    const service = registry();
    const id = query.get('jobId');
    const job = id ? get(service, id, caller) : null;
    if (job) return jobView(service, job, caller);
    if (id) return { found: false, active: false, output: '' };
    const proc = processFor(query);
    if (!proc) return { found: false, active: false, output: '' };
    const { handle, ...view } = proc;
    return { found: true, kind: 'shell', status: proc.status || (proc.active ? 'running' : 'completed'), ...view };
  });
  register('stop', async query => {
    const caller = callerOf(query);
    const jobId = query.get('jobId');
    const id = query.get('id') || query.get('callId');
    if (query.get('mode')?.toLowerCase() === 'wait') {
      // Legacy tests omit caller and expose no get(). Real contexts fail closed.
      const legacy = typeof ctx.effect !== 'function' && typeof registry()?.get !== 'function';
      const target = [...waits].find(wait => (wait.sessionId === caller || (!caller && legacy)) &&
        (id ? wait.callId === id && (!jobId || wait.jobId === jobId) : !!jobId && wait.jobId === jobId));
      if (target) { target.userStopped = true; target.controller.abort(new Error('wait stopped by user')); }
      return { success: true, mode: 'wait', stoppedWait: !!target, killed: false, jobId, id };
    }
    let killed = false;
    if (jobId) {
      const service = registry();
      const job = get(service, jobId, caller);
      if (job) {
        const result = service.kill(jobId, caller, 'Stopped by user from Live Terminal');
        killed = result !== 'already-finished';
      }
    } else {
      const proc = processFor(query);
      if (proc?.active && typeof proc.handle.terminate === 'function') {
        await proc.handle.terminate();
        killed = true;
        // Actual exit state belongs to handle.done, not the stop request.
      }
    }
    return { success: true, killed, jobId, id };
  });
  ctx.logger?.info?.('dsh-plugin-live-terminal public Host API ready');
}
