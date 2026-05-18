// File: content_script.js

let shadowHost, shadow, tooltip;

// Throttle helper: ensure func runs at most once per wait ms
function throttle(fn, wait) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// Initialize Shadow DOM and inject CSS
function initShadow() {
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    Object.assign(shadowHost.style, {
      position: 'fixed', top: 0, left: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '2147483647'
    });
    document.body.appendChild(shadowHost);

    shadow = shadowHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      #dict-tooltip {
        position: absolute;
        width: min(360px, calc(100vw - 24px));
        max-height: 280px;
        overflow-y: auto;
        background: rgba(245, 245, 247, 0.88);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        backdrop-filter: blur(28px) saturate(180%);
        color: #1d1d1f;
        padding: 14px 16px 16px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.06);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
        font-size: 13px;
        line-height: 1.45;
        -webkit-font-smoothing: antialiased;
        pointer-events: auto;
      }
      .tooltip-content { padding-right: 80px; }
      .dict-header {
        font-family: "New York", Georgia, "Times New Roman", serif;
        font-size: 26px;
        font-weight: 700;
        line-height: 1.08;
        letter-spacing: -0.4px;
        margin-bottom: 4px;
      }
      .dict-phonetic { font-size: 12px; color: #6e6e73; margin-right: 6px; }
      .dict-pos-inline { color: #0071e3; font-size: 12px; font-style: italic; }
      .dict-source {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 999px;
        color: #6e6e73;
        display: inline-block;
        font-size: 10.5px;
        margin-top: 8px;
        padding: 2px 7px;
      }
      .dict-def {
        font-size: 13.5px;
        line-height: 1.5;
        margin: 7px 0 0;
        color: #1d1d1f;
      }
      .dict-def strong {
        color: #6e6e73;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        font-size: 12px;
        font-weight: 600;
      }
      .dict-ex {
        border-left: 2px solid rgba(0,0,0,0.14);
        color: #6e6e73;
        font-size: 12.5px;
        font-style: italic;
        margin: 5px 0 0 14px;
        padding-left: 8px;
      }
      .dict-deriv-header { color: #6e6e73; font-size: 11.5px; font-weight: 600; margin-top: 12px; letter-spacing: 0.02em; text-transform: uppercase; }
      .dict-deriv { color: #1d1d1f; font-size: 12px; margin-top: 3px; }

      .tooltip-buttons {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 4px;
      }
      .tooltip-button {
        align-items: center;
        background: rgba(0, 0, 0, 0.06);
        border: 0;
        border-radius: 999px;
        color: #3a3a3c;
        cursor: pointer;
        display: inline-flex;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        font-size: 11.5px;
        font-weight: 500;
        height: 24px;
        justify-content: center;
        min-width: 24px;
        padding: 0 8px;
        transition: background 0.1s;
      }
      .tooltip-button:hover { background: rgba(0,0,0,0.12); color: #000; }

      @media (prefers-color-scheme: dark) {
        #dict-tooltip {
          background: rgba(44, 44, 46, 0.88);
          color: #f5f5f7;
          border-color: rgba(255,255,255,0.1);
          box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.06);
        }
        .dict-phonetic { color: #98989d; }
        .dict-pos-inline { color: #2997ff; }
        .dict-source { border-color: rgba(255,255,255,0.14); color: #98989d; }
        .dict-def { color: #f5f5f7; }
        .dict-def strong { color: #98989d; }
        .dict-ex { color: #98989d; border-color: rgba(255,255,255,0.14); }
        .dict-deriv-header { color: #98989d; }
        .dict-deriv { color: #f5f5f7; }
        .tooltip-button { background: rgba(255,255,255,0.1); color: #e5e5e7; }
        .tooltip-button:hover { background: rgba(255,255,255,0.18); color: #fff; }
      }
    `;
    shadow.appendChild(style);
  }
}

// Render the tooltip UI
function renderTooltip(entry) {
  initShadow();
  if (tooltip) tooltip.remove();

  tooltip = document.createElement('div');
  tooltip.id = 'dict-tooltip';

  // Content container used for copying
  const content = document.createElement('div');
  content.className = 'tooltip-content';

  // Button row
  const btnBar = document.createElement('div');
  btnBar.className = 'tooltip-buttons';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'tooltip-button';
  copyBtn.textContent = 'Copy';
  copyBtn.title = 'Copy definition';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(content.innerText);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 800);
    } catch {
      copyBtn.textContent = 'Error';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 800);
    }
  });
  const saveBtn = document.createElement('button');
  saveBtn.className = 'tooltip-button';
  saveBtn.textContent = entry.saved ? '★' : '☆';
  saveBtn.title = entry.saved ? 'Saved word' : 'Save word';
  saveBtn.setAttribute('aria-label', entry.saved ? 'Saved word' : 'Save word');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const previousSaved = Boolean(entry.saved);
    try {
      const result = await browser.runtime.sendMessage({ type: 'toggle-favorite', entry });
      entry.saved = Boolean(result?.saved);
      updateFavoriteButton(saveBtn, entry.saved);
    } catch {
      saveBtn.textContent = '!';
      setTimeout(() => updateFavoriteButton(saveBtn, previousSaved), 800);
    } finally {
      setTimeout(() => { saveBtn.disabled = false; }, 600);
    }
  });
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tooltip-button';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', removeTooltip);
  btnBar.append(copyBtn, saveBtn, closeBtn);
  tooltip.appendChild(btnBar);
  tooltip.appendChild(content);

  // Header
  const header = document.createElement('div');
  header.className = 'dict-header';
  header.textContent = entry.word;
  content.appendChild(header);

  // Phonetic & part-of-speech
  if (entry.phonetic || entry.pos) {
    const infoLine = document.createElement('div');
    if (entry.phonetic) {
      const sp = document.createElement('span');
      sp.className = 'dict-phonetic';
      sp.textContent = entry.phonetic;
      infoLine.appendChild(sp);
    }
    if (entry.pos) {
      const sp2 = document.createElement('span');
      sp2.className = 'dict-pos-inline';
      sp2.textContent = entry.pos;
      infoLine.appendChild(sp2);
    }
    content.appendChild(infoLine);
  }

  if (entry.source) {
    const source = document.createElement('div');
    source.className = 'dict-source';
    source.textContent = entry.source;
    content.appendChild(source);
  }

  // Definitions or error message
  if (Array.isArray(entry.defs) && entry.defs.length) {
    entry.defs.forEach((d, i) => {
      const defDiv = document.createElement('div');
      defDiv.className = 'dict-def';
      const num = document.createElement('strong');
      num.textContent = `${i+1}. `;
      defDiv.appendChild(num);
      defDiv.appendChild(document.createTextNode(d.text));
      content.appendChild(defDiv);
      if (d.example) {
        const ex = document.createElement('div');
        ex.className = 'dict-ex';
        ex.textContent = d.example;
        content.appendChild(ex);
      }
    });
  } else {
    const msg = document.createElement('div');
    msg.className = 'dict-def';
    msg.textContent = entry.error || 'No definition found.';
    content.appendChild(msg);
  }

  // Derivatives
  if (Array.isArray(entry.derivs) && entry.derivs.length) {
    const dhdr = document.createElement('div');
    dhdr.className = 'dict-deriv-header';
    dhdr.textContent = 'Derivatives:';
    content.appendChild(dhdr);
    entry.derivs.forEach(w => {
      const dv = document.createElement('div');
      dv.className = 'dict-deriv';
      dv.textContent = `- ${w}`;
      content.appendChild(dv);
    });
  }

  shadow.appendChild(tooltip);
}

function updateFavoriteButton(button, saved) {
  button.textContent = saved ? '★' : '☆';
  button.title = saved ? 'Saved word' : 'Save word';
  button.setAttribute('aria-label', saved ? 'Saved word' : 'Save word');
}

// Position tooltip relative to selection; will appear above or below
// depending on available space
function positionTooltip() {
  if (!tooltip) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  let top = rect.top - tipRect.height - 8;
  if (top < 0) top = rect.bottom + 8;
  let left = rect.left + (rect.width - tipRect.width)/2;
  left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

// Remove tooltip and cleanup
function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
  window.removeEventListener('scroll', throttledScroll, true);
}

// Throttled scroll handler
const throttledScroll = throttle(() => {
  positionTooltip();
  const sel = window.getSelection();
  if (!sel.rangeCount) return removeTooltip();
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight ||
      rect.right < 0  || rect.left > window.innerWidth) {
    removeTooltip();
  }
}, 100);

// Listen for messages from background.js
browser.runtime.onMessage.addListener(msg => {
  if (msg.type === 'request-selection') {
    const word = window.getSelection().toString().trim();
    if (word) {
      browser.runtime.sendMessage({ type: 'lookup-selection', word });
    }
    return;
  }

  if (msg.type === 'show-definition' && msg.entry) {
    renderTooltip(msg.entry);
    positionTooltip();
    window.addEventListener('scroll', throttledScroll, true);
    // Prevent internal clicks from closing
    tooltip.addEventListener('mousedown', e => e.stopPropagation());
    document.addEventListener('mousedown', removeTooltip, { once: true });
  }
});
