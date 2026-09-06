export const name = 'dsh-plugin-live-terminal';
export const inject = ['webServer', 'subprocess'];

// Map of active process outputs: id -> { id, callId, sessionId, cwd, command, output, active, lastUpdated }
const activeProcesses = new Map();

function cleanCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return '';
  const cmdIdx = argv.indexOf('-Command');
  if (cmdIdx !== -1 && argv[cmdIdx + 1]) {
    let cmd = argv[cmdIdx + 1];
    const splitIndex = cmd.indexOf('$OutputEncoding = [System.Text.UTF8Encoding]::new($false);');
    if (splitIndex !== -1) {
      cmd = cmd.slice(splitIndex + '$OutputEncoding = [System.Text.UTF8Encoding]::new($false);'.length);
    }
    return cmd.trim();
  }
  const cIdx = argv.indexOf('-c');
  if (cIdx !== -1 && argv[cIdx + 1]) {
    return argv[cIdx + 1].trim();
  }
  return argv.slice(1).join(' ').trim() || argv[0];
}

function matchesCommand(proc, cmdText) {
  if (!proc || !proc.command || !cmdText) return false;
  const p = proc.command.toLowerCase().trim();
  const c = cmdText.toLowerCase().trim();
  return p === c || p.includes(c) || c.includes(p);
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
        sessionId,
        cwd,
        command,
        output: '',
        active: true,
        lastUpdated: Date.now()
      };

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
        procRecord.lastUpdated = Date.now();

        // Keep record for 15 seconds so UI can capture final state, then remove
        setTimeout(() => {
          activeProcesses.delete(id);
          if (callId) activeProcesses.delete(callId);
        }, 15000);
      });
    }

    return handle;
  };

  // Register HTTP route on DSH WebServer
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

      const qId = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('callId');
      const qSessionId = reqUrl.searchParams.get('sessionId');
      const qCommand = reqUrl.searchParams.get('command');

      // 1. If querying by specific ID or callId
      if (qId && activeProcesses.has(qId)) {
        const proc = activeProcesses.get(qId);
        return res.end(JSON.stringify({
          found: true,
          active: proc.active,
          id: proc.id,
          callId: proc.callId,
          sessionId: proc.sessionId,
          command: proc.command,
          cwd: proc.cwd,
          output: proc.output
        }));
      }

      // 2. If querying with both sessionId and command
      if (qSessionId && qCommand) {
        let matched = null;
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
        if (matched) {
          return res.end(JSON.stringify({
            found: true,
            active: matched.active,
            id: matched.id,
            callId: matched.callId,
            sessionId: matched.sessionId,
            command: matched.command,
            cwd: matched.cwd,
            output: matched.output
          }));
        }
      }

      // 3. If querying by command only
      if (qCommand) {
        let matched = null;
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
        if (matched) {
          return res.end(JSON.stringify({
            found: true,
            active: matched.active,
            id: matched.id,
            callId: matched.callId,
            sessionId: matched.sessionId,
            command: matched.command,
            cwd: matched.cwd,
            output: matched.output
          }));
        }
      }

      // 4. If querying by sessionId only
      if (qSessionId) {
        let matched = null;
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
        if (matched) {
          return res.end(JSON.stringify({
            found: true,
            active: matched.active,
            id: matched.id,
            callId: matched.callId,
            sessionId: matched.sessionId,
            command: matched.command,
            cwd: matched.cwd,
            output: matched.output
          }));
        }
      }

      // 5. Fallback to latest active process if only 1 active process exists
      let activeList = [];
      for (const proc of activeProcesses.values()) {
        if (proc.active && !activeList.some(p => p.id === proc.id)) {
          activeList.push(proc);
        }
      }

      if (activeList.length === 1) {
        const target = activeList[0];
        return res.end(JSON.stringify({
          found: true,
          active: target.active,
          id: target.id,
          callId: target.callId,
          sessionId: target.sessionId,
          command: target.command,
          cwd: target.cwd,
          output: target.output
        }));
      }

      res.end(JSON.stringify({
        found: false,
        active: false,
        output: ''
      }));
    }
  });

  ctx.logger?.info?.('dsh-plugin-live-terminal endpoint /api/live-terminal/output ready');
}

