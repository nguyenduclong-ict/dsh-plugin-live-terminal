// Modal structure test for dsh-plugin-live-terminal.
//
// Run with: node client-modal-test.mjs
//
// No browser and no React renderer: `react`, the DSH primitives and
// `react-dom/client` are stubbed just enough to (a) prove `apply()` mounts the
// modal into its own body-level React root, and (b) render the component as a
// plain function call so its element tree, inline sizing and button states can
// be asserted. Hook state persists across calls and layout effects are flushed,
// so a second render reflects what the user actually sees after the first
// effect pass — that is where "Stop job" on a finished job would show through.

let failures = 0;
function check(label, condition, extra) {
  const ok = !!condition;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra === undefined ? '' : `  -> ${JSON.stringify(extra)}`}`);
}

// --- minimal DOM -----------------------------------------------------------
function makeElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    id: '',
    title: '',
    dataset: {},
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    contains: () => false
  };
}

const bodyElements = [];
const allElements = [];
const injectedStyles = [];
const injectedStyleElements = [];
globalThis.document = {
  head: {
    appendChild: (el) => {
      allElements.push(el);
      injectedStyleElements.push(el);
      injectedStyles.push(el.textContent || '');
      return el;
    }
  },
  body: {
    appendChild: (el) => {
      allElements.push(el);
      bodyElements.push(el);
      return el;
    }
  },
  createElement: (tag) => makeElement(tag),
  getElementById: (id) => allElements.find((el) => el.id === id) || null,
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });

// --- stubbed shell modules -------------------------------------------------
const mount = { container: null, element: null };
const reactDomRequests = [];

// Tiny hook runtime: state cells persist for one mounted instance, layout and
// passive effects are collected during the mount render and flushed by
// renderModal(), whose next call first runs the previous instance's cleanups.
const hookState = [];
let hookIndex = 0;
let pendingLayoutEffects = [];
let pendingEffects = [];
let mountedCleanups = [];

const React = {
  createElement(type, props, ...children) {
    const merged = { ...(props || {}) };
    if (children.length === 1) merged.children = children[0];
    else if (children.length > 1) merged.children = children;
    return { type, props: merged };
  },
  useState(initial) {
    const index = hookIndex++;
    if (!(index in hookState)) {
      hookState[index] = typeof initial === 'function' ? initial() : initial;
    }
    return [
      hookState[index],
      (next) => {
        hookState[index] = typeof next === 'function' ? next(hookState[index]) : next;
      }
    ];
  },
  useEffect(fn) {
    hookIndex += 1;
    pendingEffects.push(fn);
  },
  useLayoutEffect(fn) {
    hookIndex += 1;
    pendingLayoutEffects.push(fn);
    return undefined;
  },
  useRef(initial) {
    const index = hookIndex++;
    if (!(index in hookState)) hookState[index] = { current: initial };
    return hookState[index];
  }
};

function flushEffects(effects) {
  const cleanups = [];
  for (const fn of effects) {
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  return cleanups;
}

/**
 * Simulate a fresh mount of the modal: run the previous instance's cleanups,
 * mount-render, run the mount effects, then render again with the state those
 * effects wrote — which is what the user actually sees.
 */
function renderModal() {
  for (const cleanup of mountedCleanups) {
    try { cleanup(); } catch (e) { /* the harness only needs the unsubscribe */ }
  }
  mountedCleanups = [];

  hookState.length = 0;
  hookIndex = 0;
  pendingLayoutEffects = [];
  pendingEffects = [];
  internals.OutputModal();

  const layout = pendingLayoutEffects;
  const passive = pendingEffects;
  pendingLayoutEffects = [];
  pendingEffects = [];
  mountedCleanups = flushEffects(layout).concat(flushEffects(passive));

  hookIndex = 0;
  pendingLayoutEffects = [];
  pendingEffects = [];
  return internals.OutputModal();
}

/** Read the modal tree without re-running mount effects. */
function peekModal() {
  hookIndex = 0;
  return internals.OutputModal();
}

const ModalStub = (props) => ({ type: 'DSHModal', props });
const Primitives = { Modal: ModalStub };
const ReactDomClient = {
  createRoot(container) {
    mount.container = container;
    return { render: (element) => { mount.element = element; } };
  }
};

const requireStub = (name) => {
  if (name === 'react') return React;
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return Primitives;
  if (name === 'react-dom/client') {
    reactDomRequests.push(name);
    return ReactDomClient;
  }
  throw new Error(`unexpected module in test: ${name}`);
};

// --- load the plugin -------------------------------------------------------
let captured = null;
globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def; } } };
await import('./client.js');

const moduleExports = captured.factory(requireStub);
const internals = moduleExports.__internals;
check('modal support detected with react + primitives', internals.modalSupported === true);

// --- apply() must mount the modal into its own root ------------------------
const routes = new Map();
const injected = [];
const ctx = {
  logger: { info() {}, warn() {}, error() {} },
  get: () => undefined,
  on() {},
  inject: (names, callback) => { injected.push(names.join(',')); callback({ sessions: undefined }); },
  webServer: { register: (route) => routes.set(route.path, route.handler) },
  subprocess: { spawn: () => ({ pid: 1, done: Promise.resolve(), collected: null }) },
  slots: { inject() {}, register() {} }
};

moduleExports.apply(ctx);
await new Promise((resolve) => setTimeout(resolve, 10));

check('react-dom/client was requested', reactDomRequests.length === 1, reactDomRequests);
check('modal root appended to body', bodyElements.some((el) => el.id === internals.MODAL_ROOT_ID));
check('root container is the one created', mount.container?.id === internals.MODAL_ROOT_ID);
check('a component was rendered into that root', typeof mount.element?.type === 'function');
check('it is the output modal', mount.element?.type === internals.OutputModal);
check('closed modal renders null', renderModal() === null);

// --- live job --------------------------------------------------------------
internals.openOutputModal({ jobId: 'pwsh-9', kind: 'pwsh', command: 'python backtest.py' });
const tree = renderModal();

check('dialog is rendered through the DSH Modal primitive', tree?.type === Primitives.Modal);
check('dialog is open', tree?.props.open === true);
check('dialog closes on dismiss', typeof tree?.props.onClose === 'function');
check('dialog title names the target', tree?.props.title === 'Output — pwsh-9', tree?.props.title);
check('dialog keeps its own width class', tree?.props.className === 'dsh-live-modal');

const body = tree?.props.children;
check('dialog body is our wrapper', body?.props?.className === 'dsh-live-modal-body');

const bodyStyle = body?.props?.style || {};
check('body pane is height-capped inline (stale CSS cannot undo this)', /vh/.test(bodyStyle.maxHeight || ''), bodyStyle.maxHeight);
check('body pane clips overflow', bodyStyle.overflow === 'hidden');

const pane = Array.isArray(body?.props?.children)
  ? body.props.children.find((child) => child?.props?.className === 'dsh-live-modal-output')
  : null;
const paneStyle = pane?.props?.style || {};

check('output pane carries inline max-height', /vh/.test(paneStyle.maxHeight || ''), paneStyle.maxHeight);
check('output pane floor stays low for an empty job', paneStyle.minHeight === '8vh', paneStyle.minHeight);
check('output pane scrolls itself', paneStyle.overflow === 'auto');
check('output pane wraps long lines', paneStyle.whiteSpace === 'pre-wrap' && paneStyle.wordBreak === 'break-word');
check('output pane is monospaced', String(paneStyle.fontFamily || '').includes('monospace'), paneStyle.fontFamily);
check('output pane does not use the default pre margin', paneStyle.margin === 0);
check('inline styles match the stylesheet constants', paneStyle === internals.MODAL_OUTPUT_STYLE && bodyStyle === internals.MODAL_BODY_STYLE);

// --- meta row: command grows, status pill pinned right ---------------------
const meta = Array.isArray(body?.props?.children)
  ? body.props.children.find((child) => child?.props?.className === 'dsh-live-modal-meta')
  : null;
const metaChildren = (meta?.props?.children || []).filter(Boolean);
check('meta row has exactly two cells', metaChildren.length === 2, metaChildren.map((c) => c.props.className));
check('command comes first and carries the tooltip', metaChildren[0]?.props?.className === 'dsh-live-modal-command' && metaChildren[0].props.title === 'python backtest.py');
check('status pill is last so it cannot be clipped', metaChildren[1]?.props?.className === 'dsh-live-modal-status');
check('status pill starts on the live status', metaChildren[1]?.props?.children === 'running', metaChildren[1]?.props?.children);

// --- footer actions for a live job -----------------------------------------
function footerButtons(element) {
  const footer = element?.props?.footer;
  return (footer?.props?.children || []).filter(Boolean);
}
function buttonLabel(button) {
  const children = button.props.children;
  return Array.isArray(children) ? children.filter((c) => typeof c === 'string').join('') : children;
}

let buttons = footerButtons(tree);
let labels = buttons.map(buttonLabel);
check('footer offers View block, Copy and Stop job', labels.join('|') === 'View block|Copy|Stop job', labels);
check('Stop job is the danger action', buttons[2].props.className.includes('dsh-live-modal-action-danger'));
check('View block is enabled for a job target', buttons[0].props.disabled === false);
check('Copy is always available', buttons[1].props.disabled === undefined);
check('Stop job is enabled while the job is live', buttons[2].props.disabled === false);
check('Stop job invites the action that matches its state', buttons[2].props.title === 'Stop the background job', buttons[2].props.title);

// --- finished job: Stop job must not look available ------------------------
internals.closeOutputModal();
internals.openOutputModal({ jobId: 'pwsh-4', kind: 'pwsh', command: 'python mkvar.py', status: 'completed' });
const finishedTree = renderModal();
buttons = footerButtons(finishedTree);
check('Stop job is disabled once the job has finished', buttons[2].props.disabled === true);
check('Stop job explains why it is disabled', buttons[2].props.title === 'This job has already finished', buttons[2].props.title);
check('finished job reports its own status', (() => {
  const bodyChildren = finishedTree?.props?.children?.props?.children || [];
  const finishedMeta = bodyChildren.find((child) => child?.props?.className === 'dsh-live-modal-meta');
  return (finishedMeta?.props?.children || []).filter(Boolean)[1]?.props?.children === 'completed';
})());

// --- stylesheet regressions ------------------------------------------------
const css = injectedStyles.join('\n');
check('stylesheet has a command cell that grows and ellipsizes', /\.dsh-live-modal-command\s*\{[^}]*flex:\s*1 1 auto[^}]*text-overflow:\s*ellipsis/.test(css));
check('stylesheet pins the status pill', /\.dsh-live-modal-status\s*\{[^}]*flex:\s*none/.test(css));
check('stylesheet gives the danger button real contrast', /\.dsh-live-modal-action-danger\s*\{[^}]*color:\s*#f87171/.test(css));
check('stylesheet distinguishes disabled actions', /\.dsh-live-modal-action-danger:disabled/.test(css) && /\.dsh-live-modal-action:disabled/.test(css));
check(
  'stylesheet is injected once and carries the version stamp',
  injectedStyleElements.length === 1 && injectedStyleElements[0].dataset.version === internals.STYLE_VERSION,
  { elements: injectedStyleElements.length, version: injectedStyleElements[0]?.dataset?.version, expected: internals.STYLE_VERSION }
);
check(
  'an unchanged stylesheet is not re-injected by the hot path',
  injectedStyleElements.length === 1
);

internals.closeOutputModal();
check('closing clears the target', renderModal() === null);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
