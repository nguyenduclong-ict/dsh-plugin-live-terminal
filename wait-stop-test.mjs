// Host-side behaviour test for the Stop button split.
//
// Run with: node wait-stop-test.mjs
//
// Contract under test: a Stop on a wait tool card (`job_output` with
// `wait: true`) sends `mode=wait` and must end ONLY the pending tool call —
// the background job keeps running. A Stop on a shell/job card still kills.
//
// The fake context reproduces the two DSH seams the plugin relies on:
//   * `tools/execute` around-wrapper dispatch (exec.signal replacement),
//   * the `job_output` body awaiting `ctx.jobs.wait(...)`, which rejects with
//     "wait aborted" when its signal aborts.
import { apply } from './index.js';

const PLUGIN = 'dsh-plugin-live-terminal';
let failures = 0;
function check(label, condition, extra) {
  const ok = !!condition;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra === undefined ? '' : `  -> ${JSON.stringify(extra)}`}`);
}

const routes = new Map();
const listeners = [];
const logs = [];

function makeJob(id, label) {
  return {
    id,
    kind: 'pwsh',
    label,
    status: 'running',
    startedAt: 1_700_000_000_000,
    waitResolvers: new Set(),
    settled: new Promise(() => {}),
    readOutput: () => '',
    cancel: function () { this.cancelled = true; }
  };
}

const job = makeJob('pwsh-1', 'node long-task.js');
const otherJob = makeJob('pwsh-2', 'node other.js');
const store = new Map([[job.id, job], [otherJob.id, otherJob]]);

const jobs = {
  store,
  list: () => [job, otherJob],
  kill: (id) => { store.get(id).killed = true; return 'requested'; }
};

const ctx = {
  logger: { info: (m) => logs.push(['info', m]), warn: (m) => logs.push(['warn', m]) },
  jobs,
  get: (name) => (name === 'jobs' ? jobs : undefined),
  webServer: { register: (route) => routes.set(route.path, route.handler) },
  subprocess: { spawn: () => ({ pid: 4242, done: Promise.resolve(), collected: null }) },
  on: (event, fn) => listeners.push([event, fn]),
  inject: (names, cb) => {
    const child = { ...ctx, on: (event, fn) => listeners.push([event, fn]) };
    if (names.includes('shellEnv')) child.shellEnv = { register: () => {} };
    if (names.includes('jobs')) child.jobs = jobs;
    if (names.includes('tools')) child.tools = {};
    cb(child);
  }
};

apply(ctx);

const execListener = listeners.find(([event]) => event === 'tools/execute')?.[1];
check('registered tools/execute hook', typeof execListener === 'function');

function postStop(query) {
  return new Promise((resolve) => {
    const res = { setHeader() {}, end: (body) => resolve({ status: 200, body: JSON.parse(body) }) };
    routes.get('/api/live-terminal/stop')({ url: `/api/live-terminal/stop?${query}` }, res);
  });
}
const qs = (obj) => new URLSearchParams(obj).toString();

// Mimics dsh-agent-loop -> dsh-tools dispatch + the real job_output body.
function makeExec(callId, jobId) {
  const upstream = new AbortController();
  const exec = {
    name: 'job_output',
    callId,
    arguments: { job_id: jobId, wait: true, timeout_ms: 600000 },
    agent: { id: 'session-1' },
    signal: upstream.signal
  };
  const next = async () => {
    try {
      await new Promise((resolve, reject) => {
        const onAbort = () => reject(new Error('wait aborted'));
        if (exec.signal.aborted) return onAbort();
        const onSettled = () => { exec.signal.removeEventListener('abort', onAbort); resolve(); };
        exec.signal.addEventListener('abort', onAbort, { once: true });
        store.get(jobId).waitResolvers.add(onSettled);
      });
      return {
        isError: false,
        value: { text: '(no new output)', job: { id: jobId, kind: 'pwsh', label: 'x', status: 'running', startedAt: 1 } }
      };
    } catch (error) {
      return {
        isError: true,
        error: { message: error.message },
        content: [{ type: 'text', text: `Error: ${error.message}` }]
      };
    }
  };
  return { exec, next, upstream };
}

// --- 1. wait-only stop ends the call and keeps the job alive -----------------
const w1 = makeExec('call_wait_1', 'pwsh-1');
const pending1 = execListener(w1.exec, w1.next);
await new Promise((r) => setTimeout(r, 20));

check('exec.signal wrapped by the plugin', w1.exec.signal !== w1.upstream.signal);
check('wait registered while pending', job.waitResolvers.size === 1);

const stop1 = await postStop(qs({ mode: 'wait', jobId: 'pwsh-1', id: 'call_wait_1' }));
const result1 = await pending1;

check('stop answered stoppedWait=true', stop1.body.stoppedWait === true, stop1.body);
check('stop answered killed=false', stop1.body.killed === false, stop1.body);
check('job NOT cancelled', job.cancelled === undefined);
check('job NOT killed', job.killed === undefined);
check('job still running', job.status === 'running', job.status);
check('tool result is not an error', result1.isError !== true, result1);
check('tool result reports the running job', result1.value?.job?.id === 'pwsh-1' && result1.value?.job?.status === 'running', result1.value?.job);
check('tool result text explains the stop', /Wait stopped by user/.test(result1.value?.text ?? ''), result1.value?.text);
check('exec.signal restored after the call', w1.exec.signal === w1.upstream.signal);
check('caller signal never aborted', w1.upstream.signal.aborted === false);

// --- 1b. an earlier wrapper's signal keeps reaching the body ------------------
const w3 = makeExec('call_wait_3', 'pwsh-1');
const earlierWrapper = new AbortController();
w3.exec.signal = earlierWrapper.signal; // emulates dsh-tool-call-timeout-policy
const pending3 = execListener(w3.exec, w3.next);
await new Promise((r) => setTimeout(r, 20));
earlierWrapper.abort(new Error('wrapper timeout'));
const result3 = await pending3;
check('outer wrapper cancellation still reaches the wait', result3.isError === true, result3);
check('a foreign abort is not relabelled as a user stop', !/Wait stopped by user/.test(result3.content?.[0]?.text ?? ''), result3.content?.[0]?.text);
check('wrapper replacement restored after the call', w3.exec.signal === earlierWrapper.signal);

// --- 2. an unrelated wait is not affected ------------------------------------
const w2 = makeExec('call_wait_2', 'pwsh-2');
const pending2 = execListener(w2.exec, w2.next);
await new Promise((r) => setTimeout(r, 20));

const stop2 = await postStop(qs({ mode: 'wait', jobId: 'pwsh-1', id: 'call_wait_1' }));
check('second stop cannot resolve an already-finished wait', stop2.body.stoppedWait === false, stop2.body);
check('unrelated wait still pending', otherJob.waitResolvers.size === 1);

// resolve the unrelated wait through the normal settle path, then let it finish
for (const resolve of [...otherJob.waitResolvers]) resolve();
const result2 = await pending2;
check('unrelated wait resolves normally', result2.isError !== true, result2);

// --- 3. mode=wait never kills, even when nothing matches ---------------------
otherJob.status = 'running';
const stop3 = await postStop(qs({ mode: 'wait', jobId: 'pwsh-2', id: 'call_unknown' }));
check('unknown wait answered stoppedWait=false', stop3.body.stoppedWait === false, stop3.body);
check('unknown wait did not kill the job', otherJob.cancelled === undefined && otherJob.killed === undefined);

// --- 4. no catch-all kill for a targetless stop ------------------------------
const stop4 = await postStop(qs({ id: 'call_unknown_2' }));
check('targetless stop kills nothing', stop4.body.killed === false, stop4.body);
check('targetless stop left every job alive', !job.cancelled && !otherJob.cancelled);

// --- 5. shell-card stop still kills its job ---------------------------------
const stop5 = await postStop(qs({ jobId: 'pwsh-2' }));
check('plain stop still kills the named job', stop5.body.killed === true && otherJob.cancelled === true, stop5.body);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
console.log('plugin logs:', JSON.stringify(logs.filter(([, m]) => String(m).includes(PLUGIN)), null, 0));
process.exit(failures === 0 ? 0 : 1);
