// Client-side logic test for the native background-job row mapping.
//
// Run with: node client-logic-test.mjs
//
// The native list renders `ordered(jobs)` from the session store and its rows
// carry no id, so a row is resolved by POSITION and verified by kind+label.
// Those two pure helpers are what this file pins down; the DOM half is a thin
// extraction layer around them.
//
// `client.js` is a plain module-loader script with no imports, so it is loaded
// here by stubbing `window.__ModuleLoader__` and calling the captured factory.
// `require` throws for every module, which also proves the plugin still builds
// its exports when the shell cannot provide react/primitives.

let failures = 0;
function check(label, condition, extra) {
  const ok = !!condition;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra === undefined ? '' : `  -> ${JSON.stringify(extra)}`}`);
}

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load(def) {
      captured = def;
    }
  }
};

await import('./client.js');

check('client module registered with the loader', !!captured && captured.id === 'dsh-plugin-live-terminal');

const moduleExports = captured.factory(() => {
  throw new Error('module not available in this test');
});

check('factory returns apply/inject', typeof moduleExports.apply === 'function' && Array.isArray(moduleExports.inject));
check('inject asks for slots', moduleExports.inject.includes('slots'));

const internals = moduleExports.__internals;
check('pure helpers are exposed', !!internals && typeof internals.resolveJobIdForRow === 'function');

const { orderedJobsLikeNative, resolveJobIdForRow, sameJobMeta, jobListRowMeta, isJobListRow } = internals;

// --- ordering mirrors the native list ---------------------------------------
const jobs = [
  { id: 'pwsh-1', kind: 'pwsh', label: 'a', status: 'running', startedAt: 300 },
  { id: 'pwsh-2', kind: 'pwsh', label: 'b', status: 'running', startedAt: 100 },
  { id: 'pwsh-3', kind: 'pwsh', label: 'c', status: 'completed', startedAt: 10, finishedAt: 500 },
  { id: 'pwsh-4', kind: 'pwsh', label: 'd', status: 'completed', startedAt: 20, finishedAt: 400 },
  { id: 'pwsh-5', kind: 'pwsh', label: 'e', status: 'killed', startedAt: 30, finishedAt: 400 }
];

check(
  'live rows first (start order), then settled newest-first',
  orderedJobsLikeNative(jobs).map((job) => job.id).join(',') === 'pwsh-2,pwsh-1,pwsh-3,pwsh-4,pwsh-5',
  orderedJobsLikeNative(jobs).map((job) => job.id)
);

check('order does not mutate the store array', jobs[0].id === 'pwsh-1');
check('empty input is safe', orderedJobsLikeNative(undefined).length === 0);

// --- row -> job id ----------------------------------------------------------
const rows = [
  { kind: 'pwsh', label: 'b' },
  { kind: 'pwsh', label: 'a' }
];

check('position resolves the row when kind+label agree', resolveJobIdForRow(rows, 0, jobs) === 'pwsh-2');
check('second row resolves to the second live job', resolveJobIdForRow(rows, 1, jobs) === 'pwsh-1');
check(
  'unreadable row metadata still resolves by position',
  resolveJobIdForRow([null, null], 1, jobs) === 'pwsh-1'
);

// Position is the exact signal; a label disagreeing with it must not silently
// return the wrong job when a unique match exists elsewhere.
const shiftedRows = [
  { kind: 'pwsh', label: 'a' },
  { kind: 'pwsh', label: 'b' }
];
check('mismatched position falls back to a unique label match', resolveJobIdForRow(shiftedRows, 0, jobs) === 'pwsh-1');

// Same command run twice: the position decides, and an ambiguous fallback
// refuses to guess.
const twins = [
  { id: 'pwsh-8', kind: 'pwsh', label: 'same', status: 'running', startedAt: 1 },
  { id: 'pwsh-9', kind: 'pwsh', label: 'same', status: 'running', startedAt: 2 }
];
check('identical labels resolve by position (first)', resolveJobIdForRow([{ kind: 'pwsh', label: 'same' }, { kind: 'pwsh', label: 'same' }], 0, twins) === 'pwsh-8');
check('identical labels resolve by position (second)', resolveJobIdForRow([{ kind: 'pwsh', label: 'same' }, { kind: 'pwsh', label: 'same' }], 1, twins) === 'pwsh-9');

// Two settled jobs share a label, and the row sits where the labels disagree:
// the position is rejected, the label is ambiguous, so nothing is returned.
const dupJobs = [
  { id: 'pwsh-6', kind: 'pwsh', label: 'dup', status: 'completed', startedAt: 1, finishedAt: 900 },
  { id: 'pwsh-7', kind: 'pwsh', label: 'dup', status: 'completed', startedAt: 2, finishedAt: 800 },
  { id: 'pwsh-8', kind: 'pwsh', label: 'other', status: 'running', startedAt: 3 }
];
check(
  'duplicate labels order settled rows newest-first',
  orderedJobsLikeNative(dupJobs).map((job) => job.id).join(',') === 'pwsh-8,pwsh-6,pwsh-7',
  orderedJobsLikeNative(dupJobs).map((job) => job.id)
);
check('ambiguous label with a mismatched position returns null', resolveJobIdForRow([{ kind: 'pwsh', label: 'dup' }], 0, dupJobs) === null);
check('the same label resolves when the position agrees', resolveJobIdForRow([{ kind: 'pwsh', label: 'dup' }], 1, dupJobs) === 'pwsh-6');
check('unknown label returns null', resolveJobIdForRow([{ kind: 'pwsh', label: 'nope' }], 0, jobs) === null);
check('missing jobs return null', resolveJobIdForRow(rows, 0, null) === null);
check('row beyond the list returns null', resolveJobIdForRow(rows, 7, jobs) === null);

check('sameJobMeta requires the label', sameJobMeta({ label: 'x', kind: 'pwsh' }, { label: 'x' }) === true);
check('sameJobMeta compares kind when present', sameJobMeta({ label: 'x', kind: 'pwsh' }, { label: 'x', kind: 'bash' }) === false);

// --- row extraction (minimal DOM stand-ins) ---------------------------------
function fakeRow({ label = 'cmd', kind = 'pwsh', tag = 'LI', parentTag = 'UL', children = 5 } = {}) {
  return {
    tagName: tag,
    parentElement: { tagName: parentTag },
    children: new Array(children),
    querySelector(selector) {
      if (selector.includes('_label')) return { getAttribute: () => label, textContent: label };
      if (selector.includes('_kind')) return { textContent: kind };
      if (selector.includes('_duration')) return {};
      return null;
    }
  };
}

check('a native row is recognised', isJobListRow(fakeRow()) === true);
check('a non-LI is rejected', isJobListRow(fakeRow({ tag: 'DIV' })) === false);
check('a row outside a list is rejected', isJobListRow(fakeRow({ parentTag: 'DIV' })) === false);
check('a row without duration is rejected', isJobListRow(fakeRow({ children: 3 })) === false);
check('a null node is rejected', isJobListRow(null) === false);

const meta = jobListRowMeta(fakeRow({ label: 'node long-task.js', kind: 'pwsh' }));
check('row metadata reads the label and kind', meta.label === 'node long-task.js' && meta.kind === 'pwsh', meta);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
