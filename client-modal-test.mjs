// Modal structure test for dsh-plugin-live-terminal.
//
// Run with: node client-modal-test.mjs
//
// No browser and no React renderer: `react`, the DSH primitives and
// `react-dom/client` are stubbed just enough to (a) prove `apply()` mounts the
// modal into its own body-level React root, and (b) render the component as a
// plain function call so its element tree and inline sizing can be asserted.
//
// The inline sizing is the point. The DSH Modal primitive portals a fixed,
// non-scrolling layer, so a pane without a height cap pushes the dialog title
// and footer outside the viewport — the failure this test pins down.

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
globalThis.document = {
  head: { appendChild() {} },
  body: { appendChild: (el) => { bodyElements.push(el); return el; } },
  createElement: (tag) => makeElement(tag),
  getElementById: (id) => bodyElements.find((el) => el.id === id) || null,
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

const React = {
  createElement(type, props, ...children) {
    const merged = { ...(props || {}) };
    if (children.length === 1) merged.children = children[0];
    else if (children.length > 1) merged.children = children;
    return { type, props: merged };
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial })
};

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

// --- closed modal renders nothing -----------------------------------------
check('closed modal renders null', internals.OutputModal() === null);

// --- open modal: element tree and, above all, sizing -----------------------
internals.openOutputModal({ jobId: 'pwsh-9', kind: 'pwsh', command: 'python backtest.py' });
const tree = internals.OutputModal();

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
check('output pane carries inline min-height', /vh/.test(paneStyle.minHeight || ''), paneStyle.minHeight);
check('output pane scrolls itself', paneStyle.overflow === 'auto');
check('output pane wraps long lines', paneStyle.whiteSpace === 'pre-wrap' && paneStyle.wordBreak === 'break-word');
check('output pane is monospaced', String(paneStyle.fontFamily || '').includes('monospace'), paneStyle.fontFamily);
check('output pane does not use the default pre margin', paneStyle.margin === 0);
check('inline styles match the stylesheet constants', paneStyle === internals.MODAL_OUTPUT_STYLE && bodyStyle === internals.MODAL_BODY_STYLE);

const footer = tree?.props?.footer;
const buttons = (footer?.props?.children || []).filter(Boolean);
const labels = buttons.map((button) => (Array.isArray(button.props.children) ? button.props.children.flat().filter((c) => typeof c === 'string').join('') : button.props.children));
check('footer offers View block, Copy and Stop job', labels.join('|') === 'View block|Copy|Stop job', labels);
check('Stop job is the danger action', labels.includes('Stop job') && buttons[buttons.length - 1].props.className.includes('dsh-live-modal-action-danger'));

const focusButton = buttons[0];
const copyButton = buttons[1];
const stopButton = buttons[2];
focusButton.props.onClick();
check('View block starts enabled for a job target', focusButton.props.disabled === false);
check('Copy is always available', copyButton.props.disabled === undefined);
check('Stop job is available while the job is live', stopButton.props.disabled === false);

// --- closing clears the target --------------------------------------------
internals.closeOutputModal();
check('closed modal renders null again', internals.OutputModal() === null);
check('target cleared', tree.props.open === true && internals.OutputModal() === null);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
