window.__ModuleLoader__.load({
  id: 'dsh-plugin-live-terminal',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ns = 'live-terminal';
    const dictionaries = {
      en: { title: 'Live Terminal', empty: 'No retained jobs or commands in this session.', loading: 'Waiting for output…', copy: 'Copy', copied: 'Copied', stop: 'Stop job / command', wait: 'Stop waiting', lossy: 'Earlier output was truncated by retention limits.', missing: 'Output is no longer available.', confirm: 'Stop this job or command? This terminates its producer.', error: 'Live Terminal request failed', refresh: 'Refresh', running: 'running', stopping: 'stopping', completed: 'completed', killed: 'cancelled', failed: 'failed' },
      'pt-BR': { title: 'Terminal ao vivo', empty: 'Nenhum job ou comando retido nesta sessão.', loading: 'Aguardando saída…', copy: 'Copiar', copied: 'Copiado', stop: 'Parar job / comando', wait: 'Parar espera', lossy: 'A saída anterior foi truncada pelos limites de retenção.', missing: 'A saída não está mais disponível.', confirm: 'Parar este job ou comando? Isso encerra seu produtor.', error: 'Falha na requisição do Terminal ao vivo', refresh: 'Atualizar', running: 'executando', stopping: 'parando', completed: 'concluído', killed: 'cancelado', failed: 'falhou' },
      zh: { title: '实时终端', empty: '此会话没有保留的任务或命令。', loading: '等待输出…', copy: '复制', copied: '已复制', stop: '停止任务 / 命令', wait: '停止等待', lossy: '较早的输出已被保留限制截断。', missing: '输出已不可用。', confirm: '停止此任务或命令？这将终止其执行。', error: '实时终端请求失败', refresh: '刷新', running: '运行中', stopping: '停止中', completed: '已完成', killed: '已取消', failed: '失败' }
    };
    const css = `
.dsh-lt{width:100%;min-width:0;color:var(--dsw-alias-label-primary);font-size:12px}
.dsh-lt summary{cursor:pointer;padding:6px 0;color:var(--dsw-alias-label-secondary)}
.dsh-lt-panel{padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.dsh-lt-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.dsh-lt button,.dsh-lt select{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 9px}
.dsh-lt button{cursor:pointer}.dsh-lt button:disabled{opacity:.5;cursor:default}
.dsh-lt button:focus-visible,.dsh-lt select:focus-visible,.dsh-lt pre:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-lt select{flex:1;min-width:100px;max-width:100%}
.dsh-lt pre{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;max-height:340px;margin:8px 0 0;padding:10px;border-radius:6px;background:var(--dsw-alias-bg-base)}
.dsh-lt-status{color:var(--dsw-alias-label-secondary)}.dsh-lt-error{color:var(--dsw-alias-state-error-primary)}
`;
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [language, dictionary] of Object.entries(dictionaries)) {
          ctx.effect(() => ctx.locale.register(ns, language, dictionary));
        }
        const t = ctx.locale.bind(ns);
        const subscribe = callback => ctx.locale.subscribe(callback);
        const snapshot = () => ctx.locale.getSnapshot();
        async function request(path, sessionId, parameters = {}, signal, method = 'GET') {
          if (!sessionId) throw new Error('Missing sessionId');
          const query = new URLSearchParams({ ...parameters, sessionId });
          const response = await fetch(`/api/live-terminal/${path}?${query}`, {
            credentials: 'same-origin', cache: 'no-store', signal, method
          });
          const data = await response.json();
          if (!response.ok || data.success === false) throw new Error(data.error || `${t('error')} (${response.status})`);
          return data;
        }
        function Panel({ sessionId }) {
          React.useSyncExternalStore(subscribe, snapshot, snapshot);
          const [open, setOpen] = React.useState(false);
          const [items, setItems] = React.useState([]);
          const [selected, setSelected] = React.useState('');
          const [output, setOutput] = React.useState(null);
          const [error, setError] = React.useState('');
          const [busy, setBusy] = React.useState(false);
          const [copied, setCopied] = React.useState(false);
          const [revision, refresh] = React.useReducer(n => n + 1, 0);
          const actions = React.useRef(new Set());
          React.useEffect(() => () => {
            for (const controller of actions.current) controller.abort();
            actions.current.clear();
          }, []);
          React.useEffect(() => {
            setItems([]); setSelected(''); setOutput(null); setError(''); setBusy(false); setCopied(false);
            for (const controller of actions.current) controller.abort();
          }, [sessionId]);
          React.useEffect(() => {
            if (!open || !sessionId) return;
            const controller = new AbortController();
            let timer;
            async function poll() {
              try {
                const data = await request('jobs', sessionId, {}, controller.signal);
                if (controller.signal.aborted) return;
                const next = [...(data.jobs || []).map(job => ({ ...job, key: `job:${job.id}`, parameters: { jobId: job.id } })),
                  ...(data.processes || []).map(proc => ({ ...proc, key: `proc:${proc.id}`, parameters: { id: proc.id } }))];
                setItems(next);
                setSelected(current => next.some(item => item.key === current) ? current : next[0]?.key || '');
                setError('');
              } catch (err) { if (!controller.signal.aborted) setError(err.message); }
              if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
            }
            poll();
            return () => { controller.abort(); clearTimeout(timer); };
          }, [open, sessionId, revision]);
          const item = items.find(entry => entry.key === selected);
          const identity = item?.id;
          const type = item?.key?.split(':')[0];
          React.useEffect(() => {
            setOutput(null); setCopied(false);
            if (!open || !identity || !sessionId) return;
            const controller = new AbortController();
            let timer;
            const parameters = type === 'job' ? { jobId: identity } : { id: identity };
            async function poll() {
              try {
                const data = await request('output', sessionId, parameters, controller.signal);
                if (controller.signal.aborted) return;
                setOutput(data); setError('');
                if (data.active) timer = setTimeout(poll, 250);
              } catch (err) {
                if (!controller.signal.aborted) { setError(err.message); timer = setTimeout(poll, 1500); }
              }
            }
            poll();
            return () => { controller.abort(); clearTimeout(timer); };
          }, [open, sessionId, identity, type, revision]);
          async function stop(mode) {
            if (!item || busy || (mode !== 'wait' && !window.confirm(t('confirm')))) return;
            const controller = new AbortController();
            actions.current.add(controller); setBusy(true); setError('');
            try {
              const data = await request('stop', sessionId, { ...item.parameters, ...(mode === 'wait' ? { mode } : {}) }, controller.signal, 'POST');
              if (!controller.signal.aborted) {
                if (mode === 'wait' ? !data.stoppedWait : !data.killed) setError(t('missing'));
                refresh();
              }
            } catch (err) { if (!controller.signal.aborted) setError(err.message); }
            finally { actions.current.delete(controller); if (!controller.signal.aborted) setBusy(false); }
          }
          async function copy() {
            try { await navigator.clipboard.writeText(output?.output || ''); setCopied(true); }
            catch (err) { setError(err.message); }
          }
          return h('details', { className: 'dsh-lt', open, onToggle: event => setOpen(event.currentTarget.open) },
            h('style', null, css), h('summary', null, t('title')),
            open && h('section', { className: 'dsh-lt-panel', 'aria-label': t('title') },
              h('div', { className: 'dsh-lt-row' },
                h('select', { value: selected, 'aria-label': t('title'), onChange: event => setSelected(event.target.value) },
                  items.length ? items.map(entry => h('option', { key: entry.key, value: entry.key }, `${entry.id} — ${entry.command || entry.kind}`)) : h('option', { value: '' }, t('empty'))),
                h('button', { type: 'button', onClick: refresh }, t('refresh'))),
              item && h('div', { className: 'dsh-lt-row' },
                h('span', { className: 'dsh-lt-status' }, t(output?.status || item.status)),
                h('button', { type: 'button', disabled: !output?.output, onClick: copy }, t(copied ? 'copied' : 'copy')),
                h('button', { type: 'button', disabled: busy || !(output?.active ?? item.active), onClick: () => stop('job') }, t('stop')),
                item.waiting && h('button', { type: 'button', disabled: busy, onClick: () => stop('wait') }, t('wait'))),
              error && h('div', { role: 'alert', className: 'dsh-lt-error' }, error),
              output?.lossy && h('div', { className: 'dsh-lt-status' }, t('lossy')),
              item && h('pre', { tabIndex: 0, 'aria-label': t('title') }, output ? (output.found ? output.output || (output.active ? t('loading') : '') : t('missing')) : t('loading'))));
        }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-live-terminal', order: 20
        }, props => h(Panel, { key: props.sessionId, sessionId: props.sessionId })));
      }
    };
  }
});
