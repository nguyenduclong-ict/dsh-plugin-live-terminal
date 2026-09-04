export const name = 'dsh-plugin-live-terminal';
export const inject = ['webServer', 'subprocess'];

let latestOutput = '';
let activeCount = 0;

export function apply(ctx) {
  ctx.logger?.info?.('dsh-plugin-live-terminal host loaded, hooking subprocess...');

  const originalSpawn = ctx.subprocess.spawn.bind(ctx.subprocess);
  ctx.subprocess.spawn = function(spec) {
    const handle = originalSpawn(spec);

    // Read live chunks from collector if available
    const stdoutCollector = handle.collected?.stdout;
    if (stdoutCollector) {
      activeCount++;
      latestOutput = '';
      let readOffset = 0;

      const timer = setInterval(() => {
        try {
          const slice = stdoutCollector.readFrom(readOffset);
          if (slice && slice.text) {
            latestOutput += slice.text;
            readOffset = slice.nextOffset;
            if (latestOutput.length > 200000) {
              latestOutput = latestOutput.slice(-200000);
            }
          }
        } catch (e) {}
      }, 200);

      handle.done.finally(() => {
        clearInterval(timer);
        try {
          const slice = stdoutCollector.readFrom(readOffset);
          if (slice && slice.text) {
            latestOutput += slice.text;
          }
        } catch (e) {}
        activeCount = Math.max(0, activeCount - 1);
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
      res.end(JSON.stringify({
        active: activeCount > 0,
        output: latestOutput
      }));
    }
  });

  ctx.logger?.info?.('dsh-plugin-live-terminal endpoint /api/live-terminal/output ready');
}
