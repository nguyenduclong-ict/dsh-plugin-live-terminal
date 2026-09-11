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
        /* Live Terminal Box Container */
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

        /* Fixed header with prompt: cwd, command, and Copy button */
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

        /* Pulsing green dot or gray settled dot inside liveBox */
        .dsh-live-terminal-dot {
          display: inline-block !important;
          position: absolute;
          left: calc(-1 * var(--dsl-terminal-gutter) + 8px);
          top: 7px;
          width: 8px !important;
          height: 8px !important;
          min-width: 8px !important;
          min-height: 8px !important;
          max-width: 8px !important;
          max-height: 8px !important;
          aspect-ratio: 1 / 1 !important;
          border-radius: 50% !important;
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
          animation: dsh-live-pulse 1.2s infinite ease-in-out;
          user-select: none;
          pointer-events: none;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 !important;
          line-height: 0 !important;
          font-size: 0 !important;
          flex-shrink: 0 !important;
        }

        .dsh-live-terminal-dot.settled {
          background: var(--dsw-alias-label-quaternary, #9ca3af);
          box-shadow: none;
          animation: none;
        }

        @keyframes dsh-live-pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.85);
            box-shadow: 0 0 2px rgba(34, 197, 94, 0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
            box-shadow: 0 0 7px rgba(34, 197, 94, 0.8);
          }
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

        /* Copy command button */
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

        /* Output text area */
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

        /* Green pulsing dot in disclosure header row - perfect circle */
        .dsh-live-header-dot {
          display: inline-block !important;
          width: 8px !important;
          height: 8px !important;
          min-width: 8px !important;
          min-height: 8px !important;
          max-width: 8px !important;
          max-height: 8px !important;
          aspect-ratio: 1 / 1 !important;
          border-radius: 50% !important;
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.7);
          animation: dsh-live-pulse 1.2s infinite ease-in-out;
          flex: none !important;
          flex-shrink: 0 !important;
          align-self: center !important;
          margin-left: auto !important;
          margin-right: 6px !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          line-height: 0 !important;
          font-size: 0 !important;
        }

        /* Footer row containing Stop and View Job buttons */
        .dsh-live-footer-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 4px 8px 4px 4px;
          flex: none;
          vertical-align: middle;
        }

        /* Stop button general styling */
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

        /* View Job button styling */
        .dsh-live-view-job-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 20px;
          padding: 2px 9px;
          border-radius: 999px;
          font-size: 11px;
          line-height: 16px;
          border: 1px solid rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.12);
          color: #3b82f6;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          font-family: inherit;
          font-weight: 500;
          letter-spacing: 0.01em;
          margin: 0;
        }

        .dsh-live-view-job-btn:hover {
          background: rgba(59, 130, 246, 0.22);
          border-color: #3b82f6;
          color: #60a5fa;
        }

        .dsh-live-view-job-btn:active {
          opacity: 0.7;
        }

        .dsh-live-view-job-btn svg {
          width: 10px;
          height: 10px;
          flex: none;
        }

        /* Target card pulse highlight when scrolled into view */
        @keyframes dsh-live-target-glow {
          0% {
            outline: 2px solid rgba(59, 130, 246, 0.9);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.35), 0 0 16px rgba(59, 130, 246, 0.4);
          }
          50% {
            outline: 2px solid rgba(59, 130, 246, 1);
            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.45), 0 0 24px rgba(59, 130, 246, 0.6);
          }
          100% {
            outline: 2px solid transparent;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0), 0 0 0 rgba(59, 130, 246, 0);
          }
        }

        .dsh-live-target-highlight {
          animation: dsh-live-target-glow 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
          border-radius: 8px !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Polling & Cache tracker
    let pollingTimer = null;
    let syncJobsTimer = null;
    const activeContainers = new Set();
    const knownJobStatuses = new Map(); // jobId or callId -> boolean (active)
    const jobOutputCache = new Map();   // jobId -> full output text

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function normalizeCmd(str) {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/^\s*\[console\]::outputencoding[^;]+;\s*\$outputencoding[^;]+;\s*/i, '')
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function matchesCommand(textA, textB) {
      if (!textA || !textB) return false;
      const a = normalizeCmd(textA);
      const b = normalizeCmd(textB);
      if (!a || !b) return false;
      if (a === b) return true;

      const minLen = Math.min(a.length, b.length);
      const maxLen = Math.max(a.length, b.length);
      if (minLen > 30 && minLen / maxLen >= 0.75) {
        return a.includes(b) || b.includes(a);
      }
      return false;
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

    // Only allow shell tools: pwsh or bash
    function isAllowedShellCard(card) {
      if (!card) return false;

      const toolAttr = (card.getAttribute('data-tool') || card.querySelector('[data-tool]')?.getAttribute('data-tool') || '').toLowerCase().trim();
      if (toolAttr === 'pwsh' || toolAttr === 'bash') {
        return true;
      }
      if (toolAttr && toolAttr !== 'pwsh' && toolAttr !== 'bash') {
        return false;
      }

      const variantAttr = (card.getAttribute('data-variant') || card.querySelector('[data-variant]')?.getAttribute('data-variant') || '').toLowerCase().trim();
      if (variantAttr === 'bash') {
        const titleEl = card.querySelector('[class*="title"]');
        const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
        if (title.includes('think') || title.includes('read') || title.includes('job_') || title.includes('context')) {
          return false;
        }
        return true;
      }

      const titleEl = card.querySelector('[class*="title"]');
      const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
      if (title === 'pwsh' || title === 'bash') {
        return true;
      }

      return false;
    }

    // Check if a card belongs to the tool_call group with "wait" parameter (e.g. job_output or any tool with wait: true)
    function isWaitToolCard(card) {
      if (!card) return false;
      if (isAllowedShellCard(card)) return false;

      const toolAttr = (card.getAttribute('data-tool') || card.querySelector('[data-tool]')?.getAttribute('data-tool') || '').toLowerCase().trim();
      if (toolAttr === 'job_output') {
        return true;
      }

      const titleEl = card.querySelector('[class*="title"]');
      const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
      if (
        title.includes('read output from background job') ||
        title.includes('job_output') ||
        title.includes('check job_output') ||
        title.includes('job output')
      ) {
        return true;
      }

      // Check ioSections for wait parameter or job_output
      const ioSections = card.querySelectorAll('[class*="ioSection"]');
      for (const sec of ioSections) {
        const label = sec.querySelector('[class*="ioLabel"]')?.textContent?.trim();
        if (label === 'IN' || label === '输入') {
          const text = sec.querySelector('[class*="ioText"]')?.textContent || '';
          if (/"wait"\s*:\s*true/i.test(text) || text.includes('job_output')) {
            return true;
          }
        }
      }

      const summaryEl = card.querySelector('[class*="summary"]');
      if (summaryEl && summaryEl.textContent.includes('job_output')) {
        return true;
      }

      return false;
    }

    function extractWaitInfo(card) {
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

      let jobId = card.dataset.jobId || null;

      const ioSections = card.querySelectorAll('[class*="ioSection"]');
      for (const sec of ioSections) {
        const label = sec.querySelector('[class*="ioLabel"]')?.textContent?.trim();
        const textEl = sec.querySelector('[class*="ioText"]');
        const text = textEl ? textEl.textContent.trim() : '';
        if (!text) continue;

        if (label === 'IN' || label === '输入') {
          try {
            const parsed = JSON.parse(text);
            if (parsed.job_id !== undefined && parsed.job_id !== null) jobId = String(parsed.job_id);
            if (parsed.jobId !== undefined && parsed.jobId !== null) jobId = String(parsed.jobId);
          } catch (e) {
            const m = text.match(/"job_id"\s*:\s*["']?([^"',}\s]+)/i) || text.match(/"jobId"\s*:\s*["']?([^"',}\s]+)/i);
            if (m) jobId = m[1];
          }
        }
      }

      if (!jobId) {
        const titleEl = card.querySelector('[class*="title"]');
        const title = titleEl ? titleEl.textContent : '';
        const mTitle = title.match(/background job\s+([a-zA-Z0-9_-]+)/i);
        if (mTitle) jobId = mTitle[1];
      }

      if (!jobId) {
        const summaryEl = card.querySelector('[class*="summary"]');
        const summaryText = summaryEl ? summaryEl.textContent : '';
        const mSum = summaryText.match(/"job_id"\s*:\s*["']?([^"',}\s]+)/i) ||
                     summaryText.match(/"jobId"\s*:\s*["']?([^"',}\s]+)/i) ||
                     summaryText.match(/background job\s+([a-zA-Z0-9_-]+)/i);
        if (mSum) jobId = mSum[1];
      }

      if (jobId) {
        card.dataset.jobId = jobId;
      }

      return {
        jobId: jobId || null,
        callId: callId || null
      };
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

      let jobId = card.dataset.jobId || null;
      let isBackground = card.dataset.isBackground === 'true';
      let command = '';
      let cwd = '';

      // Check ioSections first (very lightweight)
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
            if (parsed.run_in_background === true) isBackground = true;
          } catch (e) {
            const m = text.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (m) command = m[1];
            const w = text.match(/"workdir"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (w) cwd = w[1];
            if (/"run_in_background"\s*:\s*true/.test(text)) isBackground = true;
          }
        } else if (label === 'OUT' || label === '输出') {
          const match = text.match(/started background job\s+([a-zA-Z0-9_-]+)/i);
          if (match) {
            jobId = match[1];
            isBackground = true;
          }
        }
      }

      // Check lightweight ioSections/title fallback for background job markers (avoid card.textContent)
      if (!jobId || !isBackground) {
        for (const sec of ioSections) {
          const textEl = sec.querySelector('[class*="ioText"]');
          const text = textEl ? textEl.textContent : '';
          const match = text.match(/started background job\s+([a-zA-Z0-9_-]+)/i);
          if (match) {
            jobId = match[1];
            isBackground = true;
            break;
          }
          if (text.includes('"run_in_background"') && text.includes('true')) {
            isBackground = true;
          }
        }
        if (!jobId || !isBackground) {
          const summaryEl = card.querySelector('[class*="summary"], [class*="title"]');
          const sumText = summaryEl ? summaryEl.textContent : '';
          const match = sumText.match(/started background job\s+([a-zA-Z0-9_-]+)/i);
          if (match) {
            jobId = match[1];
            isBackground = true;
          }
        }
      }

      if (jobId) {
        card.dataset.jobId = jobId;
      }
      if (isBackground) {
        card.dataset.isBackground = 'true';
      }

      if (!command) {
        const promptLines = card.querySelectorAll('[class*="promptLine"]');
        if (promptLines.length > 0) {
          const lines = [];
          promptLines.forEach((pl) => {
            const cmdSpan = pl.querySelector('[class*="command"]');
            if (cmdSpan && cmdSpan.textContent.trim()) {
              lines.push(cmdSpan.textContent.trim());
            }
          });
          if (lines.length > 0) {
            command = lines.join('\n');
          }
        }
        if (!command) {
          const commandEls = card.querySelectorAll('[class*="command"]');
          if (commandEls.length > 0) {
            command = Array.from(commandEls).map(el => el.textContent.trim()).filter(Boolean).join('\n');
          } else {
            const summaryEl = card.querySelector('[class*="summary"]');
            command = summaryEl ? summaryEl.textContent.trim() : '';
          }
        }
      }

      if (!cwd) {
        const cwdEl = card.querySelector('[class*="cwd"]');
        if (cwdEl) cwd = cwdEl.textContent.trim();
      }

      return {
        callId: callId || null,
        jobId: jobId || null,
        isBackground,
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

            const outEl = liveBox.querySelector('.dsh-live-terminal-output');
            if (outEl && !outEl.textContent.includes('[Process stopped by user]')) {
              outEl.textContent += (outEl.textContent ? '\n' : '') + '[Process stopped by user]\n';
              outEl.scrollTop = outEl.scrollHeight;
              if (jobId) jobOutputCache.set(jobId, outEl.textContent);
            }

            liveBox.dataset.settled = 'true';
            activeContainers.delete(liveBox);
            stopPollingIfEmpty();
          }

          // If this was a wait block, also update any matching background pwsh cards on screen
          if (jobId) {
            document.querySelectorAll(`[data-job-id="${jobId}"]`).forEach((otherCard) => {
              updateHeaderDot(otherCard, false);
              const otherBox = otherCard.querySelector('.dsh-live-terminal-block');
              if (otherBox) {
                const dot = otherBox.querySelector('.dsh-live-terminal-dot');
                if (dot) dot.classList.add('settled');
                otherBox.dataset.settled = 'true';
                activeContainers.delete(otherBox);
              }
              const otherWrap = otherCard.querySelector('[class*="bodyWrap"]');
              if (otherWrap) updateStopButtonInBody(otherWrap, otherCard, { jobId }, false);
            });
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

    // Header dot indicator on data-disclosure-row (shows green dot even when collapsed!)
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
          dotEl.title = 'Running...';
          headerRow.appendChild(dotEl);
        }
      } else {
        if (dotEl) {
          dotEl.remove();
        }
      }
    }

    // Find the original shell card (pwsh/bash) that spawned the background job
    function findOriginalJobCard(jobId, currentCard) {
      if (!jobId) return null;

      const strJobId = String(jobId).trim();
      if (!strJobId) return null;

      const candidates = document.querySelectorAll(
        '[data-tool], [data-variant], [data-chat-call-id], [data-chat-anchor-key], [class*="callRow"], [class*="card"]'
      );

      const seen = new Set();
      const matched = [];

      for (const node of candidates) {
        const card = node.closest('[data-chat-call-id]') ||
                     node.closest('[data-chat-anchor-key]') ||
                     node.closest('[class*="callRow"]') ||
                     node.closest('[class*="card"]') ||
                     node;

        if (!card || seen.has(card)) continue;
        seen.add(card);

        if (card === currentCard) continue;
        if (isWaitToolCard(card)) continue;

        // A. Direct dataset match
        if (card.dataset.jobId === strJobId) {
          return card;
        }

        // B. Check extractCommandInfo
        const info = extractCommandInfo(card);
        if (info.jobId === strJobId) {
          card.dataset.jobId = strJobId;
          return card;
        }

        // C. Check ioSection text match (avoid large card.textContent)
        const textElements = card.querySelectorAll('[class*="ioText"], [class*="title"], [class*="summary"], [class*="promptLine"]');
        for (const el of textElements) {
          const text = el.textContent || '';
          if (text.includes(strJobId)) {
            if (
              text.toLowerCase().includes('started background job') ||
              text.toLowerCase().includes('background job') ||
              isAllowedShellCard(card)
            ) {
              matched.push(card);
              break;
            }
          }
        }
      }

      if (matched.length > 0) {
        return matched[0];
      }

      // Fallback: search any element with data-job-id attribute
      try {
        const selector = `[data-job-id="${CSS.escape ? CSS.escape(strJobId) : strJobId}"]`;
        const fallback = document.querySelectorAll(selector);
        for (const el of fallback) {
          const card = el.closest('[data-chat-call-id]') ||
                       el.closest('[class*="callRow"]') ||
                       el.closest('[class*="card"]') ||
                       el;
          if (card !== currentCard && !isWaitToolCard(card)) {
            return card;
          }
        }
      } catch (e) {}

      return null;
    }

    function isCardExpanded(card) {
      if (!card) return false;
      if (card.querySelector('[class*="bodyWrap"]')) return true;
      if (card.getAttribute('aria-expanded') === 'true') return true;
      if (card.querySelector('[aria-expanded="true"]')) return true;
      if (card.getAttribute('data-open') === 'true') return true;
      if (card.tagName === 'DETAILS' && card.open) return true;
      return false;
    }

    function openCard(card) {
      if (!card || isCardExpanded(card)) return;

      if (card.tagName === 'DETAILS') {
        card.open = true;
        card.dispatchEvent(new Event('toggle', { bubbles: true }));
        return;
      }
      const details = card.querySelector('details');
      if (details) {
        details.open = true;
        details.dispatchEvent(new Event('toggle', { bubbles: true }));
        return;
      }

      const ariaFalse = card.querySelector('[aria-expanded="false"]');
      if (ariaFalse) {
        ariaFalse.click();
        return;
      }

      const disclosureRow = card.querySelector('[data-disclosure-row="true"]');
      if (disclosureRow) {
        disclosureRow.click();
        return;
      }

      const header = card.querySelector('[class*="headerRow"]') ||
                     card.querySelector('[class*="header"]') ||
                     card.querySelector('[class*="row"]');
      if (header) {
        header.click();
        return;
      }

      card.click();
    }

    function scrollToCard(card) {
      if (!card) return;

      card.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });

      setTimeout(() => {
        if (document.body.contains(card)) {
          card.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 120);

      setTimeout(() => {
        if (document.body.contains(card)) {
          card.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 300);
    }

    function highlightCard(card) {
      if (!card) return;

      card.classList.remove('dsh-live-target-highlight');
      void card.offsetWidth;
      card.classList.add('dsh-live-target-highlight');

      setTimeout(() => {
        if (card) card.classList.remove('dsh-live-target-highlight');
      }, 2200);
    }

    function navigateToOriginalJob(jobId, currentCard, btn) {
      if (!jobId) {
        if (btn) {
          const span = btn.querySelector('span');
          const origText = span?.textContent || 'View Job';
          if (span) span.textContent = 'No Job ID';
          setTimeout(() => {
            if (btn && btn.querySelector('span')) {
              btn.querySelector('span').textContent = origText;
            }
          }, 1800);
        }
        return;
      }

      const targetCard = findOriginalJobCard(jobId, currentCard);
      if (!targetCard) {
        if (btn) {
          const span = btn.querySelector('span');
          const origText = span?.textContent || 'View Job';
          if (span) span.textContent = 'Job not found';
          setTimeout(() => {
            if (btn && btn.querySelector('span')) {
              btn.querySelector('span').textContent = origText;
            }
          }, 1800);
        }
        return;
      }

      openCard(targetCard);
      scrollToCard(targetCard);
      highlightCard(targetCard);
    }

    // Action buttons positioned next to Inspect button in bodyWrap footer
    function updateStopButtonInBody(bodyWrap, card, info, isRunning) {
      if (!bodyWrap) return;

      const isWait = isWaitToolCard(card);
      const jobId = info?.jobId || card?.dataset?.jobId || (isWait ? extractWaitInfo(card).jobId : null);

      const showStop = !!isRunning;
      const showViewJob = isWait && !!jobId;

      let footerRow = bodyWrap.querySelector('.dsh-live-footer-row');
      const inspectBtn = bodyWrap.querySelector('[class*="inspectButton"]');

      if (showStop || showViewJob) {
        if (!footerRow) {
          footerRow = document.createElement('div');
          footerRow.className = 'dsh-live-footer-row';

          if (inspectBtn && inspectBtn.parentNode === bodyWrap) {
            bodyWrap.insertBefore(footerRow, inspectBtn);
          } else {
            bodyWrap.appendChild(footerRow);
          }
        }
      }

      if (footerRow) {
        // 1. View Job button (only for job_output / wait tool cards)
        let viewJobBtn = footerRow.querySelector('.dsh-live-view-job-btn');
        if (showViewJob) {
          if (!viewJobBtn) {
            viewJobBtn = document.createElement('button');
            viewJobBtn.type = 'button';
            viewJobBtn.className = 'dsh-live-view-job-btn';
            viewJobBtn.title = 'Scroll to original job';
            viewJobBtn.innerHTML = `
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 11l6-6M5 5h6v6"></path>
              </svg>
              <span>View Job</span>
            `;

            viewJobBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              const curJobId = info?.jobId || card?.dataset?.jobId || extractWaitInfo(card).jobId;
              navigateToOriginalJob(curJobId, card, viewJobBtn);
            });

            const stopBtn = footerRow.querySelector('.dsh-live-stop-btn');
            if (stopBtn) {
              footerRow.insertBefore(viewJobBtn, stopBtn);
            } else {
              footerRow.appendChild(viewJobBtn);
            }
          }
        } else if (viewJobBtn) {
          viewJobBtn.remove();
        }

        // 2. Stop button
        let stopBtn = footerRow.querySelector('.dsh-live-stop-btn');
        if (showStop) {
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
              stopJob(info?.jobId, info?.callId, stopBtn, card);
            });

            footerRow.appendChild(stopBtn);
          }
        } else if (stopBtn) {
          stopBtn.remove();
        }

        if (!footerRow.querySelector('.dsh-live-view-job-btn') && !footerRow.querySelector('.dsh-live-stop-btn')) {
          footerRow.remove();
        }
      }
    }

    // Fetch output once for a settled job and cache it
    async function fetchSettledOutput(liveBox, info) {
      if (!liveBox) return;
      const outEl = liveBox.querySelector('.dsh-live-terminal-output');
      const jobId = info.jobId || liveBox.dataset.jobId;

      if (jobId && jobOutputCache.has(jobId)) {
        const cached = jobOutputCache.get(jobId);
        if (cached && outEl && outEl.textContent !== cached) {
          outEl.textContent = cached;
          outEl.scrollTop = outEl.scrollHeight;
        }
        return;
      }

      try {
        const params = new URLSearchParams();
        if (jobId) params.append('jobId', jobId);
        if (info.command) params.append('command', info.command);
        if (info.sessionId) params.append('sessionId', info.sessionId);

        const res = await fetch('/api/live-terminal/output?' + params.toString());
        if (!res.ok) return;
        const data = await res.json();

        if (outEl) {
          if (data.output) {
            outEl.textContent = data.output;
            outEl.scrollTop = outEl.scrollHeight;
            if (jobId) jobOutputCache.set(jobId, data.output);
          } else {
            if (outEl.textContent === 'Loading output...') {
              outEl.textContent = '(Process has completed, no output)';
            }
          }
        }
      } catch (e) {
        if (outEl && outEl.textContent === 'Loading output...') {
          outEl.textContent = '(Failed to load output)';
        }
      }
    }

    // Create or retrieve Live Terminal Block with immediate cached output if available
    function getOrCreateLiveBox(card, bodyWrap, info, isBackground) {
      let liveBox = bodyWrap.querySelector('.dsh-live-terminal-block');
      if (liveBox) return liveBox;

      liveBox = document.createElement('div');
      liveBox.className = 'dsh-live-terminal-block';
      if (info.callId) liveBox.dataset.callId = info.callId;
      if (info.jobId) liveBox.dataset.jobId = info.jobId;
      if (info.command) liveBox.dataset.command = info.command;
      if (info.sessionId) liveBox.dataset.sessionId = info.sessionId;
      liveBox.dataset.isBackground = isBackground ? 'true' : 'false';

      // Use cached output immediately if already available to avoid flashing "Loading output..."
      const cached = (info.jobId && jobOutputCache.get(info.jobId)) || '';
      const initialOutputText = cached || 'Loading output...';

      liveBox.innerHTML = `
        <div class="dsh-live-terminal-header">
          <div class="dsh-live-terminal-prompt-line">
            <span class="dsh-live-terminal-dot"></span>
            <span class="dsh-live-terminal-cwd">${escapeHtml(info.cwd)}</span>
            <span class="dsh-live-terminal-command" title="${escapeHtml(info.command)}">${escapeHtml(info.command)}</span>
          </div>
          <button class="dsh-live-copy-btn" type="button" title="Copy command">Copy</button>
        </div>
        <div class="dsh-live-terminal-output">${escapeHtml(initialOutputText)}</div>
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

      return liveBox;
    }

    let isPerformingPluginDomUpdates = false;

    function isPluginNode(node) {
      if (!node || node.nodeType !== 1) return false;
      const cls = node.className;
      if (typeof cls === 'string' && cls.includes('dsh-live-')) return true;
      if (node.classList && (
        node.classList.contains('dsh-live-terminal-block') ||
        node.classList.contains('dsh-live-header-dot') ||
        node.classList.contains('dsh-live-footer-row') ||
        node.classList.contains('dsh-live-stop-btn') ||
        node.classList.contains('dsh-live-view-job-btn') ||
        node.classList.contains('dsh-live-copy-btn') ||
        node.classList.contains('dsh-live-target-highlight')
      )) return true;
      return false;
    }

    function isPluginMutation(m) {
      const target = m.target;
      if (target && target.nodeType === 1) {
        if (isPluginNode(target) || target.closest?.('[class*="dsh-live-"]')) {
          return true;
        }
      }
      if (m.type === 'childList') {
        const hasAdded = m.addedNodes && m.addedNodes.length > 0;
        const hasRemoved = m.removedNodes && m.removedNodes.length > 0;
        if (hasAdded || hasRemoved) {
          const allAddedPlugin = !hasAdded || Array.from(m.addedNodes).every(n => isPluginNode(n));
          const allRemovedPlugin = !hasRemoved || Array.from(m.removedNodes).every(n => isPluginNode(n));
          if (allAddedPlugin && allRemovedPlugin) {
            return true;
          }
        }
      }
      return false;
    }

    // Periodic synchronization of all background jobs (runs globally even when blocks are collapsed)
    async function syncJobsStatus() {
      try {
        const res = await fetch('/api/live-terminal/jobs');
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data.jobs)) return;

        for (const j of data.jobs) {
          knownJobStatuses.set(j.id, j.active);
        }

        const candidates = document.querySelectorAll(
          '[data-tool], [data-variant], [data-chat-call-id], [class*="callRow"]'
        );
        const seenCards = new Set();

        isPerformingPluginDomUpdates = true;
        try {
          candidates.forEach((node) => {
            const card = node.closest('[data-chat-call-id]') ||
                         node.closest('[class*="callRow"]') ||
                         node.closest('[class*="card"]') ||
                         node;

            if (seenCards.has(card)) return;
            seenCards.add(card);

            // 1. Sync shell cards (pwsh / bash)
            if (isAllowedShellCard(card)) {
              const info = extractCommandInfo(card);
              let matchedJob = null;

              if (info.jobId) {
                matchedJob = data.jobs.find(j => j.id === info.jobId);
              } else if (info.isBackground) {
                if (info.command) {
                  matchedJob = data.jobs.find(j => {
                    if (!j.command) return false;
                    return matchesCommand(info.command, j.command);
                  });
                  if (matchedJob) {
                    card.dataset.jobId = matchedJob.id;
                    card.dataset.isBackground = 'true';
                    info.jobId = matchedJob.id;
                  }
                }
              }

              if (matchedJob) {
                updateHeaderDot(card, matchedJob.active);

                const bodyWrap = card.querySelector('[class*="bodyWrap"]');
                if (bodyWrap) {
                  updateStopButtonInBody(bodyWrap, card, info, matchedJob.active);
                  const liveBox = bodyWrap.querySelector('.dsh-live-terminal-block');
                  if (liveBox) {
                    const dot = liveBox.querySelector('.dsh-live-terminal-dot');
                    if (matchedJob.active) {
                      if (dot) dot.classList.remove('settled');
                      delete liveBox.dataset.settled;
                      activeContainers.add(liveBox);
                      startPolling();
                    } else {
                      if (dot) dot.classList.add('settled');
                      liveBox.dataset.settled = 'true';
                      activeContainers.delete(liveBox);
                      const outEl = liveBox.querySelector('.dsh-live-terminal-output');
                      if (outEl && (!jobOutputCache.has(matchedJob.id) || outEl.textContent === 'Loading output...')) {
                        fetchSettledOutput(liveBox, info);
                      }
                    }
                  }
                }
              } else if (info.isBackground && info.jobId) {
                const isActive = knownJobStatuses.get(info.jobId) ?? false;
                updateHeaderDot(card, isActive);
              }
            }

            // 2. Sync wait tool cards (job_output or tools with wait: true)
            if (isWaitToolCard(card)) {
              const waitInfo = extractWaitInfo(card);
              const stateAttr = (
                card.getAttribute('data-state') ||
                card.querySelector('[data-state]')?.getAttribute('data-state') ||
                ''
              ).toLowerCase().trim();
              const isRunning = stateAttr === 'running';

              updateHeaderDot(card, isRunning);

              const bodyWrap = card.querySelector('[class*="bodyWrap"]');
              const isExpanded = !!bodyWrap ||
                                 card.getAttribute('aria-expanded') === 'true' ||
                                 card.querySelector('[aria-expanded="true"]') !== null;
              if (isExpanded && bodyWrap) {
                updateStopButtonInBody(bodyWrap, card, waitInfo, isRunning);
              } else if (bodyWrap) {
                updateStopButtonInBody(bodyWrap, card, waitInfo, false);
              }
            }
          });
        } finally {
          Promise.resolve().then(() => {
            isPerformingPluginDomUpdates = false;
          });
        }
      } catch (e) {}
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

            isPerformingPluginDomUpdates = true;
            try {
              const outEl = el.querySelector('.dsh-live-terminal-output');
              const dot = el.querySelector('.dsh-live-terminal-dot');
              const bodyWrap = card ? card.querySelector('[class*="bodyWrap"]') : null;

              if (data.jobId && !el.dataset.jobId) {
                if (el.dataset.isBackground === 'true' || data.isBackground === true) {
                  el.dataset.jobId = data.jobId;
                  el.dataset.isBackground = 'true';
                  if (card) {
                    card.dataset.jobId = data.jobId;
                    card.dataset.isBackground = 'true';
                  }
                }
              }

              const isBackground = el.dataset.isBackground === 'true';
              const node = el.closest('[data-tool="pwsh"], [data-tool="bash"], [data-variant="bash"]');
              const stateAttr = (
                node?.getAttribute('data-state') ||
                card?.getAttribute('data-state') ||
                card?.querySelector?.('[data-state]')?.getAttribute('data-state') ||
                ''
              ).toLowerCase().trim();
              const isStateFinished = stateAttr === 'ok' || stateAttr === 'error' || (stateAttr && stateAttr !== 'running');

              // Foreground commands: remove liveBox immediately once DSH finishes and renders native terminal
              if (!isBackground && isStateFinished) {
                if (card) {
                  updateHeaderDot(card, false);
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
                if (text && jobId) {
                  jobOutputCache.set(jobId, text);
                }

                if (outEl) {
                  if (text && outEl.textContent !== text) {
                    outEl.textContent = text;
                    outEl.scrollTop = outEl.scrollHeight;
                  } else if (!text && (outEl.textContent === 'Loading output...' || outEl.textContent.startsWith('Waiting') || outEl.textContent.startsWith('Đang'))) {
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
                  // Process / Background job finished
                  if (card) {
                    updateHeaderDot(card, false);
                    if (bodyWrap) updateStopButtonInBody(bodyWrap, card, { jobId, callId }, false);
                  }

                  if (isBackground) {
                    // For background jobs: KEEP the liveBox visible in DOM with settled dot!
                    if (dot) dot.classList.add('settled');
                    el.dataset.settled = 'true';
                    activeContainers.delete(el);
                    stopPollingIfEmpty();
                  } else {
                    // For foreground commands: DSH will show its native terminal
                    const defaultCard = card?.querySelector('[data-terminal]');
                    if (defaultCard) defaultCard.style.display = '';
                    activeContainers.delete(el);
                    el.remove();
                    stopPollingIfEmpty();
                  }
                } else {
                  // Still running
                  if (dot) dot.classList.remove('settled');
                  if (card) {
                    updateHeaderDot(card, true);
                    if (bodyWrap) updateStopButtonInBody(bodyWrap, card, { jobId, callId }, true);
                  }
                }
              } else {
                // Not found on server
                if (isBackground) {
                  if (outEl && outEl.textContent === 'Loading output...') {
                    if (jobId && jobOutputCache.has(jobId)) {
                      outEl.textContent = jobOutputCache.get(jobId);
                    } else {
                      outEl.textContent = '(Background job completed or no output recorded)';
                    }
                  }
                  if (dot) dot.classList.add('settled');
                  el.dataset.settled = 'true';
                  activeContainers.delete(el);
                  stopPollingIfEmpty();
                }
              }
            } finally {
              Promise.resolve().then(() => {
                isPerformingPluginDomUpdates = false;
              });
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
    let updateTimer = null;
    let lastUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 120; // Rate limit DOM rescanning to prevent freezing

    function scheduleUpdate() {
      if (updateTimer) return;
      const now = Date.now();
      const elapsed = now - lastUpdateTime;
      const delay = elapsed >= MIN_UPDATE_INTERVAL ? 0 : (MIN_UPDATE_INTERVAL - elapsed);

      updateTimer = setTimeout(() => {
        updateTimer = null;
        lastUpdateTime = Date.now();
        requestAnimationFrame(() => {
          updateLiveBlocks();
        });
      }, delay);
    }

    function updateLiveBlocks() {
      if (isUpdating) return;
      isUpdating = true;
      isPerformingPluginDomUpdates = true;

      try {
        ensureStyles();

        // Clean up stray indicators on non-target cards and remove any legacy header stop buttons
        const strayDots = document.querySelectorAll('.dsh-live-header-dot, .dsh-live-header-actions, .dsh-live-header-stop-btn');
        strayDots.forEach((el) => {
          if (el.classList.contains('dsh-live-header-stop-btn')) {
            el.remove();
            return;
          }
          const card = el.closest('[data-tool], [data-variant], [class*="root"]');
          if (card && !isAllowedShellCard(card) && !isWaitToolCard(card)) {
            el.remove();
          }
        });

        // Scan all tool cards
        const candidates = document.querySelectorAll(
          '[data-tool], [data-variant], [data-chat-call-id], [class*="callRow"]'
        );

        const seenCards = new Set();

        candidates.forEach((node) => {
          const card = node.closest('[data-chat-call-id]') ||
                       node.closest('[class*="callRow"]') ||
                       node.closest('[class*="card"]') ||
                       node;

          if (seenCards.has(card)) return;
          seenCards.add(card);

          // ==========================================
          // A. WAIT TOOL BLOCK (job_output / wait: true)
          // ==========================================
          if (isWaitToolCard(card)) {
            const waitInfo = extractWaitInfo(card);
            const stateAttr = (
              node.getAttribute('data-state') ||
              card.getAttribute('data-state') ||
              card.querySelector('[data-state]')?.getAttribute('data-state') ||
              ''
            ).toLowerCase().trim();

            const isRunning = stateAttr === 'running';

            // 1. Header pulsing green dot (always visible even when collapsed if wait is running)
            updateHeaderDot(card, isRunning);

            // 2. Stop button positioned ONLY next to Inspect button when expanded
            const bodyWrap = card.querySelector('[class*="bodyWrap"]');
            const isExpanded = !!bodyWrap ||
                               card.getAttribute('aria-expanded') === 'true' ||
                               card.querySelector('[aria-expanded="true"]') !== null;

            if (isExpanded && bodyWrap) {
              updateStopButtonInBody(bodyWrap, card, waitInfo, isRunning);
            } else if (bodyWrap) {
              updateStopButtonInBody(bodyWrap, card, waitInfo, false);
            }
            return;
          }

          // ==========================================
          // B. SHELL BLOCK (pwsh / bash)
          // ==========================================
          if (!isAllowedShellCard(card)) return;

          const info = extractCommandInfo(card);
          const isBackground = info.isBackground || !!info.jobId;

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
              // If unknown, check if we have finished output cached
              if (info.jobId && jobOutputCache.has(info.jobId)) {
                isRunning = false;
              } else {
                isRunning = true;
              }
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

          // 1. Header pulsing green dot (always visible even when collapsed if job is running!)
          updateHeaderDot(card, isRunning);

          // 2. Check if card is expanded
          const bodyWrap = card.querySelector('[class*="bodyWrap"]');
          const isExpanded = !!bodyWrap ||
                             card.getAttribute('aria-expanded') === 'true' ||
                             card.querySelector('[aria-expanded="true"]') !== null;

          let liveBox = card.querySelector('.dsh-live-terminal-block');

          if (isExpanded && bodyWrap) {
            // Stop button next to Inspect in bodyWrap footer
            updateStopButtonInBody(bodyWrap, card, info, isRunning);

            if (isBackground) {
              // --- BACKGROUND JOB: ALWAYS INJECT liveBox ---
              liveBox = getOrCreateLiveBox(card, bodyWrap, info, true);

              const dot = liveBox.querySelector('.dsh-live-terminal-dot');
              const outEl = liveBox.querySelector('.dsh-live-terminal-output');

              if (isRunning) {
                if (dot) dot.classList.remove('settled');
                delete liveBox.dataset.settled;
                activeContainers.add(liveBox);
                startPolling();
              } else {
                if (dot) dot.classList.add('settled');
                liveBox.dataset.settled = 'true';
                activeContainers.delete(liveBox);

                // Fetch settled final output if not yet in cache or currently displaying "Loading output..."
                const curText = outEl ? outEl.textContent : '';
                if (!info.jobId || !jobOutputCache.has(info.jobId) || curText === 'Loading output...') {
                  fetchSettledOutput(liveBox, info);
                }
              }
            } else {
              // --- FOREGROUND COMMAND ---
              if (!isRunning) {
                // When foreground finishes, remove liveBox so native DSH terminal displays cleanly
                if (liveBox) {
                  activeContainers.delete(liveBox);
                  liveBox.remove();
                  stopPollingIfEmpty();
                }
                const defaultCard = card.querySelector('[data-terminal]');
                if (defaultCard) defaultCard.style.display = '';
              } else {
                // When foreground runs, show liveBox and hide native placeholder
                liveBox = getOrCreateLiveBox(card, bodyWrap, info, false);
                const defaultCard = card.querySelector('[data-terminal]');
                if (defaultCard) defaultCard.style.display = 'none';

                activeContainers.add(liveBox);
                startPolling();
              }
            }
          } else {
            // Collapsed: remove liveBox to save memory for foreground commands,
            // will re-inject and read from cache when re-expanded!
            if (liveBox && !isBackground) {
              activeContainers.delete(liveBox);
              liveBox.remove();
              stopPollingIfEmpty();
            }
          }
        });

        // Prune containers detached from DOM
        activeContainers.forEach((box) => {
          if (!document.body.contains(box)) {
            activeContainers.delete(box);
          }
        });

        stopPollingIfEmpty();
      } finally {
        Promise.resolve().then(() => {
          isPerformingPluginDomUpdates = false;
        });
        isUpdating = false;
      }
    }

    exports.inject = ['slots'];
    exports.apply = function(ctx) {
      console.log('[dsh-plugin-live-terminal] client plugin initialized live monitor');
      ensureStyles();

      const observer = new MutationObserver((mutations) => {
        if (isPerformingPluginDomUpdates) return;

        let relevant = false;
        for (const m of mutations) {
          if (isPluginMutation(m)) {
            continue;
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

      // Start global jobs status synchronization every 1 second
      syncJobsStatus();
      if (!syncJobsTimer) {
        syncJobsTimer = setInterval(syncJobsStatus, 1000);
      }

      scheduleUpdate();
    };

    return module.exports;
  }
});
