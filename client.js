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
        /* Khung Live Terminal */
        .dsh-live-terminal-block {
          --dsl-terminal-radius: 12px;
          --dsl-terminal-line-height: 22px;
          --dsl-terminal-font: var(--dsw-font-markdown-code-block);
          --dsl-terminal-gutter: 30px;
          position: relative;
          margin: 6px 0 6px 4px;
          padding-left: var(--dsl-terminal-gutter);
          color: var(--dsw-alias-label-primary);
          background: var(--dsw-alias-markdown-code-block);
          border: 1px solid var(--dsw-alias-border-l1);
          border-radius: var(--dsl-terminal-radius);
          overflow: hidden;
          font: var(--dsw-font-markdown-code-block-small, var(--dsl-terminal-font));
        }

        /* Header cố định chứa prompt: cwd, command và nút Copy */
        .dsh-live-terminal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: calc(-1 * var(--dsl-terminal-gutter));
          padding: 8px 14px 8px var(--dsl-terminal-gutter);
          border-bottom: 1px solid var(--dsw-alias-border-l2);
          background-color: var(--dsw-alias-markdown-code-block);
          user-select: text;
        }

        .dsh-live-terminal-prompt-line {
          position: relative;
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
          line-height: var(--dsl-terminal-line-height);
          flex: 1;
          user-select: text;
        }

        /* Chấm xanh nhấp nháy trong Live Terminal Box */
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
          user-select: none;
          pointer-events: none;
        }

        .dsh-live-terminal-dot.settled {
          background: var(--dsw-alias-label-quaternary, #9ca3af);
          box-shadow: none;
          animation: none;
        }

        @keyframes dsh-live-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        .dsh-live-terminal-cwd {
          flex: none;
          color: var(--dsw-alias-label-tertiary);
          line-height: var(--dsl-terminal-line-height);
          font-size: 12px;
          user-select: text;
          cursor: text;
        }

        .dsh-live-terminal-command {
          min-width: 0;
          color: var(--dsw-alias-label-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: pre;
          font-family: inherit;
          line-height: var(--dsl-terminal-line-height);
          user-select: text;
          cursor: text;
        }

        /* Nút Copy lệnh */
        .dsh-live-copy-btn {
          flex: none;
          margin-left: auto;
          background: transparent;
          border: none;
          color: var(--dsw-alias-label-tertiary, #8b949e);
          font-family: inherit;
          font-size: 12px;
          line-height: var(--dsl-terminal-line-height, 22px);
          padding: 0 4px;
          cursor: pointer;
          user-select: none;
          border-radius: 4px;
          transition: color 0.15s ease;
        }

        .dsh-live-copy-btn:hover {
          color: var(--dsw-alias-label-primary, #ffffff);
        }

        .dsh-live-copy-btn:active {
          opacity: 0.7;
        }

        /* Vùng log output */
        .dsh-live-terminal-output {
          max-height: 260px;
          padding: 12px 14px 12px 0;
          overflow-x: auto;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: inherit;
          line-height: 20px;
          font-size: 12px;
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

        /* Chấm xanh nhấp nháy trên thanh header data-disclosure-row */
        .dsh-live-header-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 5px rgba(34, 197, 94, 0.7);
          animation: dsh-live-pulse 1.2s infinite ease-in-out;
          flex: none;
          margin-left: auto;
          margin-right: 6px;
        }

        /* Hàng footer chứa nút Inspect và nút Stop */
        .dsh-live-footer-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 4px 0 2px 4px;
          flex: none;
        }

        .dsh-live-footer-row [class*="inspectButton"] {
          margin: 0 !important;
          opacity: 1 !important;
        }

        /* Nút Stop đặt cạnh nút Inspect ở dưới cùng khi mở block */
        .dsh-live-stop-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 20px;
          padding: 2px 9px;
          border-radius: 999px;
          font-size: 11px;
          line-height: 16px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          font-family: inherit;
          font-weight: 500;
          letter-spacing: 0.01em;
          margin: 0;
        }

        .dsh-live-stop-btn:hover {
          background: rgba(239, 68, 68, 0.22);
          border-color: #ef4444;
          color: #f87171;
        }

        .dsh-live-stop-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dsh-live-stop-btn svg {
          width: 9px;
          height: 9px;
          fill: currentColor;
          flex: none;
        }
      `;
      document.head.appendChild(style);
    }

    // Active polling tracker
    let pollingTimer = null;
    const activeContainers = new Set();
    const knownJobStatuses = new Map(); // key -> boolean (active)

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    async function copyToClipboard(text) {
      if (!text) return false;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (e) {}
      }
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      } catch (e) {
        return false;
      }
    }

    function getActiveSessionId() {
      const currentCrumb = document.querySelector('[class*="crumbCurrent"]');
      if (currentCrumb && currentCrumb.textContent) {
        const text = currentCrumb.textContent.trim();
        if (text.startsWith('session-')) return text;
      }
      return null;
    }

    // CHỈ cho phép shell tool: pwsh (Windows) hoặc bash (Linux / macOS)
    function isAllowedShellCard(card) {
      if (!card) return false;

      // 1. Kiểm tra data-tool trực tiếp
      const toolAttr = (card.getAttribute('data-tool') || card.querySelector('[data-tool]')?.getAttribute('data-tool') || '').toLowerCase().trim();
      if (toolAttr === 'pwsh' || toolAttr === 'bash') {
        return true;
      }
      if (toolAttr && toolAttr !== 'pwsh' && toolAttr !== 'bash') {
        return false;
      }

      // 2. Kiểm tra data-variant
      const variantAttr = (card.getAttribute('data-variant') || card.querySelector('[data-variant]')?.getAttribute('data-variant') || '').toLowerCase().trim();
      if (variantAttr === 'bash') {
        const titleEl = card.querySelector('[class*="title"]');
        const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
        if (title.includes('think') || title.includes('read') || title.includes('job_') || title.includes('context')) {
          return false;
        }
        return true;
      }

      // 3. Kiểm tra title hiển thị
      const titleEl = card.querySelector('[class*="title"]');
      const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
      if (title === 'pwsh' || title === 'bash') {
        return true;
      }

      return false;
    }

    function extractCommandInfo(card) {
      let callId = card.getAttribute('data-chat-call-id');
      if (!callId) {
        const callRow = card.closest('[data-chat-call-id]');
        if (callRow) callId = callRow.getAttribute('data-chat-call-id');
      }
      if (!callId) {
        const anchor = card.getAttribute('data-chat-anchor-key') || card.closest('[data-chat-anchor-key]')?.getAttribute('data-chat-anchor-key');
        if (anchor && anchor.startsWith('call:')) {
          callId = anchor.slice(5);
        }
      }

      let jobId = null;
      let command = '';
      let cwd = '';

      // Chỉ tìm trong ioSection của ioCard để tránh đọc toàn bộ card (rất nhẹ, không lag)
      const ioSections = card.querySelectorAll('[class*="ioSection"]');
      for (const sec of ioSections) {
        const label = sec.querySelector('[class*="ioLabel"]')?.textContent?.trim();
        const textEl = sec.querySelector('[class*="ioText"]');
        const text = textEl ? textEl.textContent.trim() : '';
        if (!text) continue;

        if (label === 'IN' || label === '输入') {
          try {
            const parsed = JSON.parse(text);
            if (parsed.command) command = parsed.command;
            if (parsed.workdir) cwd = parsed.workdir;
          } catch (e) {
            const m = text.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (m) command = m[1];
            const w = text.match(/"workdir"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (w) cwd = w[1];
          }
        } else if (label === 'OUT' || label === '输出') {
          const match = text.match(/started background job\s+([a-zA-Z0-9_-]+)/i);
          if (match) jobId = match[1];
        }
      }

      if (!command) {
        const commandEl = card.querySelector('[class*="command"]');
        if (commandEl) {
          command = commandEl.textContent.trim();
        } else {
          const summaryEl = card.querySelector('[class*="summary"]');
          command = summaryEl ? summaryEl.textContent.trim() : '';
        }
      }

      if (!cwd) {
        const cwdEl = card.querySelector('[class*="cwd"]');
        if (cwdEl) cwd = cwdEl.textContent.trim();
      }

      return {
        callId: callId || null,
        jobId: jobId || null,
        sessionId: getActiveSessionId(),
        cwd: cwd || '',
        command: command || ''
      };
    }

    async function stopJob(jobId, callId, btn, card) {
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.innerHTML = `
          <svg viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="2"></rect>
          </svg>
          <span>Stopping...</span>
        `;
      }

      try {
        const params = new URLSearchParams();
        if (jobId) params.append('jobId', jobId);
        if (callId) params.append('id', callId);

        const res = await fetch('/api/live-terminal/stop?' + params.toString(), { method: 'POST' });
        if (res.ok) {
          const key = jobId || callId;
          if (key) knownJobStatuses.set(key, false);

          updateHeaderDot(card, false);

          if (btn) btn.remove();

          const liveBox = card.querySelector('.dsh-live-terminal-block');
          if (liveBox) {
            const dot = liveBox.querySelector('.dsh-live-terminal-dot');
            if (dot) dot.classList.add('settled');

            const badge = liveBox.querySelector('.dsh-live-terminal-badge');
            if (badge) {
              badge.textContent = 'STOPPED';
              badge.className = 'dsh-live-terminal-badge settled';
            }

            const outEl = liveBox.querySelector('.dsh-live-terminal-output');
            if (outEl && !outEl.textContent.includes('[Process stopped by user]')) {
              outEl.textContent += (outEl.textContent ? '\n' : '') + '[Process stopped by user]\n';
              outEl.scrollTop = outEl.scrollHeight;
            }

            liveBox.dataset.settled = 'true';
            activeContainers.delete(liveBox);
          }
        }
      } catch (e) {
        console.error('[dsh-plugin-live-terminal] Stop job failed:', e);
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      }
    }

    // Header dot indicator on data-disclosure-row
    function updateHeaderDot(card, isRunning) {
      const headerRow = card.querySelector('[data-disclosure-row="true"]') ||
                        card.querySelector('[class*="row"]');
      if (!headerRow) return;

      const oldActions = headerRow.querySelector('.dsh-live-header-actions');
      if (oldActions) oldActions.remove();

      let dotEl = headerRow.querySelector('.dsh-live-header-dot');

      if (isRunning) {
        if (!dotEl) {
          dotEl = document.createElement('span');
          dotEl.className = 'dsh-live-header-dot';
          dotEl.title = 'Command is running...';
          headerRow.appendChild(dotEl);
        }
      } else {
        if (dotEl) {
          dotEl.remove();
        }
      }
    }

    // Stop button positioned next to Inspect button in bodyWrap footer
    function updateStopButtonInBody(bodyWrap, card, info, isRunning) {
      if (!bodyWrap) return;

      let footerRow = bodyWrap.querySelector('.dsh-live-footer-row');
      const inspectBtn = bodyWrap.querySelector('[class*="inspectButton"]');

      if (isRunning) {
        if (!footerRow) {
          footerRow = document.createElement('div');
          footerRow.className = 'dsh-live-footer-row';

          if (inspectBtn) {
            bodyWrap.insertBefore(footerRow, inspectBtn);
            footerRow.appendChild(inspectBtn);
          } else {
            bodyWrap.appendChild(footerRow);
          }
        }

        let stopBtn = footerRow.querySelector('.dsh-live-stop-btn');
        if (!stopBtn) {
          stopBtn = document.createElement('button');
          stopBtn.type = 'button';
          stopBtn.className = 'dsh-live-stop-btn';
          stopBtn.title = 'Stop command';
          stopBtn.innerHTML = `
            <svg viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="2"></rect>
            </svg>
            <span>Stop</span>
          `;

          stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopJob(info.jobId, info.callId, stopBtn, card);
          });

          footerRow.appendChild(stopBtn);
        }
      } else {
        if (footerRow) {
          const stopBtn = footerRow.querySelector('.dsh-live-stop-btn');
          if (stopBtn) stopBtn.remove();
        }
      }
    }

    function startPolling() {
      if (pollingTimer) return;
      pollingTimer = setInterval(async () => {
        if (activeContainers.size === 0) return;

        activeContainers.forEach(async (el) => {
          try {
            if (!document.body.contains(el)) {
              activeContainers.delete(el);
              return;
            }

            if (el.dataset.settled === 'true') {
              activeContainers.delete(el);
              return;
            }

            const card = el.closest('[data-chat-call-id]') ||
                         el.closest('[class*="callRow"]') ||
                         el.closest('[class*="card"]') ||
                         el.parentElement;

            let jobId = el.dataset.jobId;
            let callId = el.dataset.callId;
            let command = el.dataset.command;
            const sessionId = el.dataset.sessionId || getActiveSessionId();

            if (!jobId && card) {
              const info = extractCommandInfo(card);
              if (info.jobId) {
                jobId = info.jobId;
                el.dataset.jobId = jobId;
                el.dataset.isBackground = 'true';
              }
            }

            let queryUrl = '/api/live-terminal/output';
            const params = new URLSearchParams();
            if (jobId) params.append('jobId', jobId);
            if (callId) params.append('id', callId);
            if (sessionId) params.append('sessionId', sessionId);
            if (command) params.append('command', command);

            const queryString = params.toString();
            if (queryString) queryUrl += '?' + queryString;

            const res = await fetch(queryUrl);
            if (!res.ok) return;
            const data = await res.json();

            const outEl = el.querySelector('.dsh-live-terminal-output');
            const dot = el.querySelector('.dsh-live-terminal-dot');
            const badge = el.querySelector('.dsh-live-terminal-badge');

            const isBackground = el.dataset.isBackground === 'true';
            const node = el.closest('[data-tool="pwsh"], [data-tool="bash"], [data-variant="bash"]');
            const stateAttr = (
              node?.getAttribute('data-state') ||
              card?.getAttribute('data-state') ||
              card?.querySelector?.('[data-state]')?.getAttribute('data-state') ||
              ''
            ).toLowerCase().trim();
            const isStateFinished = stateAttr === 'ok' || stateAttr === 'error' || (stateAttr && stateAttr !== 'running');

            // If foreground command has finished in DOM, remove liveBox immediately
            if (!isBackground && isStateFinished) {
              if (card) {
                updateHeaderDot(card, false);
                const bodyWrap = card.querySelector('[class*="bodyWrap"]');
                if (bodyWrap) updateStopButtonInBody(bodyWrap, card, { jobId, callId }, false);
                const defaultCard = card.querySelector('[data-terminal]');
                if (defaultCard) defaultCard.style.display = '';
              }
              activeContainers.delete(el);
              el.remove();
              stopPollingIfEmpty();
              const statusKey = jobId || callId;
              if (statusKey) knownJobStatuses.set(statusKey, false);
              return;
            }

            if (data.found) {
              const text = data.output || '';
              if (outEl) {
                if (text && outEl.textContent !== text) {
                  outEl.textContent = text;
                  outEl.scrollTop = outEl.scrollHeight;
                } else if (!text && (outEl.textContent.startsWith('Loading') || outEl.textContent.startsWith('Waiting') || outEl.textContent.startsWith('Đang'))) {
                  outEl.textContent = data.active ? '(Process is running, no output yet...)' : '(Process has completed, no output)';
                }
              }

              if (data.command && (!el.dataset.command || el.dataset.command.length < 5)) {
                el.dataset.command = data.command;
                const cmdEl = el.querySelector('.dsh-live-terminal-command');
                if (cmdEl) cmdEl.textContent = data.command;
              }
              if (data.cwd) {
                const cwdSpan = el.querySelector('.dsh-live-terminal-cwd');
                if (cwdSpan && !cwdSpan.textContent) cwdSpan.textContent = data.cwd;
              }

              const statusKey = jobId || callId;
              if (statusKey) knownJobStatuses.set(statusKey, data.active);

              if (data.active === false) {
                if (card) {
                  updateHeaderDot(card, false);
                  const bodyWrap = card.querySelector('[class*="bodyWrap"]');
                  if (bodyWrap) updateStopButtonInBody(bodyWrap, card, { jobId, callId }, false);
                  const defaultCard = card.querySelector('[data-terminal]');
                  if (defaultCard) defaultCard.style.display = '';
                }

                activeContainers.delete(el);
                el.remove();
                stopPollingIfEmpty();
              } else {
                if (card && !isStateFinished) {
                  updateHeaderDot(card, true);
                  const bodyWrap = card.querySelector('[class*="bodyWrap"]');
                  if (bodyWrap) updateStopButtonInBody(bodyWrap, card, { jobId, callId }, true);
                }
              }
            } else {
              if (isBackground && outEl && (outEl.textContent === 'Loading output...' || outEl.textContent === 'Đang tải output...')) {
                outEl.textContent = 'Waiting for background job output (' + (jobId || 'running') + ')...';
              }
            }
          } catch (e) {}
        });
        stopPollingIfEmpty();
      }, 200);
    }

    function stopPollingIfEmpty() {
      if (activeContainers.size === 0 && pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    }

    let isUpdating = false;
    let updateScheduled = false;

    function scheduleUpdate() {
      if (updateScheduled) return;
      updateScheduled = true;
      requestAnimationFrame(() => {
        updateScheduled = false;
        updateLiveBlocks();
      });
    }

    function updateLiveBlocks() {
      if (isUpdating) return;
      isUpdating = true;

      try {
        ensureStyles();

        // Dọn dẹp chấm xanh/button sót lại trên các block không phải shell
        const strayDots = document.querySelectorAll('.dsh-live-header-dot, .dsh-live-header-actions');
        strayDots.forEach((el) => {
          const card = el.closest('[data-tool], [data-variant], [class*="root"]');
          if (card && !isAllowedShellCard(card)) {
            el.remove();
          }
        });

        // CHỈ quét các block pwsh hoặc bash
        const candidates = document.querySelectorAll(
          '[data-tool="pwsh"], [data-tool="bash"], [data-variant="bash"]'
        );

        const seenCards = new Set();

        candidates.forEach((node) => {
          const card = node.closest('[data-chat-call-id]') ||
                       node.closest('[class*="callRow"]') ||
                       node.closest('[class*="card"]') ||
                       node;

          if (seenCards.has(card)) return;
          seenCards.add(card);

          if (!isAllowedShellCard(card)) return;

          const info = extractCommandInfo(card);
          const isBackground = !!info.jobId || (info.command && /"run_in_background"\s*:\s*true/.test(card.innerHTML));

          const stateAttr = (
            node.getAttribute('data-state') ||
            card.getAttribute('data-state') ||
            card.querySelector('[data-state]')?.getAttribute('data-state') ||
            ''
          ).toLowerCase().trim();

          const isStateRunning = stateAttr === 'running';
          const isStateFinished = stateAttr === 'ok' || stateAttr === 'error' || (stateAttr && stateAttr !== 'running');

          let isRunning = false;
          const statusKey = info.jobId || info.callId;

          if (isBackground) {
            const cachedActive = statusKey ? knownJobStatuses.get(statusKey) : undefined;
            if (cachedActive !== undefined) {
              isRunning = cachedActive;
            } else {
              isRunning = !isStateFinished;
            }
          } else {
            // Foreground command: strictly governed by data-state
            if (isStateFinished) {
              isRunning = false;
              if (statusKey) knownJobStatuses.set(statusKey, false);
            } else {
              isRunning = isStateRunning;
            }
          }

          // 1. Cập nhật CHẤM XANH trên header
          updateHeaderDot(card, isRunning);

          // 2. Kiểm tra mở rộng (expanded)
          const bodyWrap = card.querySelector('[class*="bodyWrap"]');
          const isExpanded = !!bodyWrap ||
                             card.getAttribute('aria-expanded') === 'true' ||
                             card.querySelector('[aria-expanded="true"]') !== null;

          let liveBox = card.querySelector('.dsh-live-terminal-block');

          if (isExpanded && bodyWrap) {
            // Nút Stop cạnh Inspect ở chân bodyWrap (chỉ hiển thị khi isRunning === true)
            updateStopButtonInBody(bodyWrap, card, info, isRunning);

            if (!isRunning) {
              // Khi state là OK / Finished: không hiển thị khung live-terminal nữa vì DSH tự hiển thị rồi
              if (liveBox) {
                activeContainers.delete(liveBox);
                liveBox.remove();
                stopPollingIfEmpty();
              }
              const defaultCard = card.querySelector('[data-terminal]');
              if (defaultCard) defaultCard.style.display = '';
            } else {
              // Chỉ hiển thị liveBox khi tiến trình đang chạy (isRunning === true)
              if (!liveBox) {
                liveBox = document.createElement('div');
                liveBox.className = 'dsh-live-terminal-block';
                if (info.callId) liveBox.dataset.callId = info.callId;
                if (info.jobId) liveBox.dataset.jobId = info.jobId;
                if (info.command) liveBox.dataset.command = info.command;
                if (info.sessionId) liveBox.dataset.sessionId = info.sessionId;
                liveBox.dataset.isBackground = isBackground ? 'true' : 'false';

                liveBox.innerHTML = `
                  <div class="dsh-live-terminal-header">
                    <div class="dsh-live-terminal-prompt-line">
                      <span class="dsh-live-terminal-dot"></span>
                      <span class="dsh-live-terminal-cwd">${escapeHtml(info.cwd)}</span>
                      <span class="dsh-live-terminal-command" title="${escapeHtml(info.command)}">${escapeHtml(info.command)}</span>
                    </div>
                    <button class="dsh-live-copy-btn" type="button" title="Copy command">Copy</button>
                  </div>
                  <div class="dsh-live-terminal-output">Loading output...</div>
                `;

                const copyBtn = liveBox.querySelector('.dsh-live-copy-btn');
                if (copyBtn) {
                  copyBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const cmd = liveBox.dataset.command ||
                                liveBox.querySelector('.dsh-live-terminal-command')?.textContent ||
                                info.command || '';
                    if (!cmd) return;
                    const ok = await copyToClipboard(cmd);
                    if (ok) {
                      copyBtn.textContent = 'Copied!';
                      setTimeout(() => {
                        if (document.body.contains(copyBtn)) {
                          copyBtn.textContent = 'Copy';
                        }
                      }, 1800);
                    }
                  });
                }

                const footerRow = bodyWrap.querySelector('.dsh-live-footer-row');
                const inspectBtn = bodyWrap.querySelector('[class*="inspectButton"]') || bodyWrap.querySelector('button');
                const targetBefore = footerRow || inspectBtn;

                if (targetBefore && targetBefore.parentNode === bodyWrap) {
                  bodyWrap.insertBefore(liveBox, targetBefore);
                } else {
                  bodyWrap.appendChild(liveBox);
                }

                if (!isBackground) {
                  const defaultCard = card.querySelector('[data-terminal]');
                  if (defaultCard) defaultCard.style.display = 'none';
                }
              }

              activeContainers.add(liveBox);
              startPolling();
            }
          } else {
            if (liveBox) {
              activeContainers.delete(liveBox);
              liveBox.remove();
              stopPollingIfEmpty();
            }
          }
        });

        // Dọn dẹp container không còn trong DOM
        activeContainers.forEach((box) => {
          if (!document.body.contains(box)) {
            activeContainers.delete(box);
          } else {
            const isBackground = box.dataset.isBackground === 'true';
            if (!isBackground) {
              const parentRow = box.closest('[data-state]');
              const sAttr = parentRow?.getAttribute('data-state')?.toLowerCase();
              if (sAttr && sAttr !== 'running') {
                box.dataset.settled = 'true';
                activeContainers.delete(box);
                const dot = box.querySelector('.dsh-live-terminal-dot');
                if (dot) dot.classList.add('settled');
              }
            }
          }
        });

        stopPollingIfEmpty();
      } finally {
        isUpdating = false;
      }
    }

    exports.inject = ['slots'];
    exports.apply = function(ctx) {
      console.log('[dsh-plugin-live-terminal] client plugin initialized live monitor');
      ensureStyles();

      const observer = new MutationObserver((mutations) => {
        let relevant = false;
        for (const m of mutations) {
          const target = m.target;
          if (target && target.nodeType === 1) {
            if (
              target.classList?.contains('dsh-live-terminal-block') ||
              target.classList?.contains('dsh-live-header-dot') ||
              target.classList?.contains('dsh-live-stop-btn') ||
              target.classList?.contains('dsh-live-copy-btn') ||
              target.classList?.contains('dsh-live-footer-row') ||
              target.closest?.('.dsh-live-terminal-block') ||
              target.closest?.('.dsh-live-footer-row')
            ) {
              continue;
            }
          }
          relevant = true;
          break;
        }
        if (relevant) {
          scheduleUpdate();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state', 'aria-expanded', 'data-open']
      });

      scheduleUpdate();
    };

    return module.exports;
  }
});
