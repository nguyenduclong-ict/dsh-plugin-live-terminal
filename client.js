window.__ModuleLoader__.load({
  id: 'dsh-plugin-live-terminal',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    console.log('[dsh-plugin-live-terminal] client factory loaded!');

    const STYLE_ID = 'dsh-live-terminal-style';
    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        /* Khung Terminal đúng chuẩn phong cách DSH TerminalBlock */
        .dsh-live-terminal-block {
          --dsl-terminal-radius: 12px;
          --dsl-terminal-line-height: 22px;
          --dsl-terminal-font: var(--dsw-font-markdown-code-block);
          --dsl-terminal-gutter: 30px;
          position: relative;
          margin: 4px 0 4px 4px;
          padding-left: var(--dsl-terminal-gutter);
          color: var(--dsw-alias-label-primary);
          background: var(--dsw-alias-markdown-code-block);
          border: 1px solid var(--dsw-alias-border-l1);
          border-radius: var(--dsl-terminal-radius);
          overflow: hidden;
          font: var(--dsw-font-markdown-code-block-small, var(--dsl-terminal-font));
        }

        /* Header cố định chứa prompt: cwd và command */
        .dsh-live-terminal-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-left: calc(-1 * var(--dsl-terminal-gutter));
          padding: 9px 14px 9px var(--dsl-terminal-gutter);
          border-bottom: 1px solid var(--dsw-alias-border-l2);
          background-color: var(--dsw-alias-markdown-code-block);
          user-select: none;
        }

        .dsh-live-terminal-prompt-line {
          position: relative;
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
          line-height: var(--dsl-terminal-line-height);
          flex: 1;
        }

        /* Dot căn giữa chuẩn xác với gutter -30px + 8px = -22px */
        .dsh-live-terminal-dot {
          position: absolute;
          left: calc(-1 * var(--dsl-terminal-gutter) + 8px);
          top: 7px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
          animation: dsh-live-pulse 1.2s infinite ease-in-out;
        }

        @keyframes dsh-live-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        .dsh-live-terminal-cwd {
          flex: none;
          color: var(--dsw-alias-label-tertiary);
          line-height: var(--dsl-terminal-line-height);
        }

        .dsh-live-terminal-command {
          min-width: 0;
          color: var(--dsw-alias-label-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: pre;
          font-family: inherit;
          line-height: var(--dsl-terminal-line-height);
        }

        /* Phần Output: có thanh cuộn riêng, header KHÔNG bị cuộn theo */
        .dsh-live-terminal-output {
          max-height: 240px;
          padding: 12px 14px 12px 0;
          overflow-x: auto;
          overflow-y: auto;
          white-space: pre;
          font-family: inherit;
          line-height: 20px;
          color: var(--dsw-alias-label-secondary);
        }

        .dsh-live-terminal-output::-webkit-scrollbar-thumb {
          border: 2px solid transparent;
          background-clip: padding-box;
          border-radius: 6px;
          background-color: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.2));
        }

        .dsh-live-terminal-output::-webkit-scrollbar-track {
          margin: 6px;
        }
      `;
      document.head.appendChild(style);
    }

    // Active polling tracker
    let pollingTimer = null;
    let activeContainers = new Set();

    function getActiveSessionId() {
      // Find current active session id from conversation DOM or URL
      const currentCrumb = document.querySelector('[class*="crumbCurrent"]');
      if (currentCrumb && currentCrumb.textContent) {
        const text = currentCrumb.textContent.trim();
        if (text.startsWith('session-')) return text;
      }
      return null;
    }

    function extractCommandInfo(row) {
      // Find callId from DSH DOM convention
      let callId = row.getAttribute('data-chat-call-id');
      if (!callId) {
        const callRow = row.closest('[data-chat-call-id]');
        if (callRow) callId = callRow.getAttribute('data-chat-call-id');
      }
      if (!callId) {
        const anchor = row.getAttribute('data-chat-anchor-key') || row.closest('[data-chat-anchor-key]')?.getAttribute('data-chat-anchor-key');
        if (anchor && anchor.startsWith('call:')) {
          callId = anchor.slice(5);
        }
      }

      // Find actual command from tool call
      let command = '';
      const commandEl = row.querySelector('[class*="command"]');
      if (commandEl) {
        command = commandEl.textContent.trim();
      } else {
        const summaryEl = row.querySelector('[class*="summary"]');
        command = summaryEl ? summaryEl.textContent.trim() : '';
      }

      let cwd = '';
      const cwdEl = row.querySelector('[class*="cwd"]');
      if (cwdEl) {
        cwd = cwdEl.textContent.trim();
      }

      const sessionId = getActiveSessionId();

      return {
        callId: callId || null,
        sessionId: sessionId || null,
        cwd: cwd || '',
        command: command || ''
      };
    }

    function startPolling() {
      if (pollingTimer) return;
      pollingTimer = setInterval(async () => {
        if (activeContainers.size === 0) return;

        activeContainers.forEach(async (el) => {
          try {
            const callId = el.dataset.callId;
            const command = el.dataset.command;
            const sessionId = el.dataset.sessionId || getActiveSessionId();

            let queryUrl = '/api/live-terminal/output';
            const params = new URLSearchParams();
            if (callId) {
              params.append('id', callId);
            } else {
              if (sessionId) params.append('sessionId', sessionId);
              if (command) params.append('command', command);
            }

            const queryString = params.toString();
            if (queryString) {
              queryUrl += '?' + queryString;
            }

            const res = await fetch(queryUrl);
            if (!res.ok) return;
            const data = await res.json();
            const text = data.output || '';

            const outEl = el.querySelector('.dsh-live-terminal-output');
            if (outEl) {
              if (text && outEl.textContent !== text) {
                outEl.textContent = text;
                outEl.scrollTop = outEl.scrollHeight;
              } else if (!text && outEl.textContent === 'Đang tải output...' && data.found) {
                outEl.textContent = '';
              }
            }

            // Update header info if server returned more specific command or cwd
            if (data.command && !el.dataset.command) {
              el.dataset.command = data.command;
              const cmdEl = el.querySelector('.dsh-live-terminal-command');
              if (cmdEl && (!cmdEl.textContent || cmdEl.textContent === '')) {
                cmdEl.textContent = data.command;
              }
            }
            if (data.cwd) {
              const cwdSpan = el.querySelector('.dsh-live-terminal-cwd');
              if (cwdSpan && (!cwdSpan.textContent || cwdSpan.textContent === '')) {
                cwdSpan.textContent = data.cwd;
              }
            }
          } catch (e) {}
        });
      }, 200);
    }

    function stopPollingIfEmpty() {
      if (activeContainers.size === 0 && pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    }

    function updateLiveBlocks() {
      ensureStyles();

      const runningRows = document.querySelectorAll('[data-state="running"]');

      runningRows.forEach((row) => {
        // Hide the default empty static card while running
        const defaultCard = row.querySelector('[data-terminal]');
        if (defaultCard) {
          defaultCard.style.display = 'none';
        }

        // Check if the user clicked open the row
        const isExpanded = row.getAttribute('aria-expanded') === 'true' || 
                           row.querySelector('[aria-expanded="true"]') !== null;

        let liveBox = row.querySelector('.dsh-live-terminal-block');

        if (isExpanded) {
          if (!liveBox) {
            const info = extractCommandInfo(row);
            liveBox = document.createElement('div');
            liveBox.className = 'dsh-live-terminal-block';
            if (info.callId) liveBox.dataset.callId = info.callId;
            if (info.command) liveBox.dataset.command = info.command;
            if (info.sessionId) liveBox.dataset.sessionId = info.sessionId;

            liveBox.innerHTML = `
              <div class="dsh-live-terminal-header">
                <div class="dsh-live-terminal-prompt-line">
                  <span class="dsh-live-terminal-dot"></span>
                  <span class="dsh-live-terminal-cwd">${info.cwd}</span>
                  <span class="dsh-live-terminal-command">${info.command}</span>
                </div>
              </div>
              <div class="dsh-live-terminal-output">Đang tải output...</div>
            `;

            // Insert into row body
            const bodyWrap = row.querySelector('[class*="bodyWrap"]');
            if (bodyWrap) {
              bodyWrap.insertBefore(liveBox, bodyWrap.firstChild);
            } else {
              row.appendChild(liveBox);
            }
          }
          activeContainers.add(liveBox);
          startPolling();
        } else {
          if (liveBox) {
            activeContainers.delete(liveBox);
            liveBox.remove();
            stopPollingIfEmpty();
          }
        }
      });

      // Cleanup finished rows
      activeContainers.forEach((box) => {
        if (!document.body.contains(box)) {
          activeContainers.delete(box);
        } else {
          const parentRow = box.closest('[data-state]');
          if (parentRow && parentRow.getAttribute('data-state') !== 'running') {
            activeContainers.delete(box);
            box.remove();
            // Restore default card
            const defaultCard = parentRow.querySelector('[data-terminal]');
            if (defaultCard) {
              defaultCard.style.display = '';
            }
          }
        }
      });
      stopPollingIfEmpty();
    }

    exports.inject = ['slots'];
    exports.apply = function(ctx) {
      console.log('[dsh-plugin-live-terminal] client plugin initialized live monitor');
      ensureStyles();

      const observer = new MutationObserver(() => {
        updateLiveBlocks();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state', 'aria-expanded']
      });

      updateLiveBlocks();
    };

    return module.exports;
  }
});
