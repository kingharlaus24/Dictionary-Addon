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
        max-width: 300px;
        max-height: 200px;
        overflow-y: auto;
        background: #fff;
        color: #000;
        padding: 10px 12px;
        border: 1px solid #aaa;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        pointer-events: auto;
      }
      .dict-header { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
      .dict-phonetic { font-size: 13px; color: #555; margin-right: 8px; }
      .dict-pos-inline { font-style: italic; font-size: 13px; }
      .dict-def { font-size: 14px; margin-left: 6px; margin-bottom: 4px; }
      .dict-ex { font-size: 13px; margin-left: 12px; font-style: italic; color: #444; margin-bottom: 6px; }
      .dict-deriv-header { font-size: 13px; font-weight: bold; margin-top: 8px; }
      .dict-deriv { font-size: 13px; margin-left: 6px; }

      /* Buttons container */
      .tooltip-buttons {
        position: absolute;
        top: 6px;
        right: 8px;
        display: flex;
        gap: 4px;
      }
      .tooltip-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        color: #555;
        padding: 2px;
      }
      .tooltip-button:hover {
        color: #000;
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        #dict-tooltip {
          background: #2b2b2b;
          color: #eee;
          border-color: #555;
          box-shadow: 0 2px 8px rgba(0,0,0,0.7);
        }
        .tooltip-button { color: #ccc; }
        .tooltip-button:hover { color: #fff; }
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

  // Button row
  const btnBar = document.createElement('div');
  btnBar.className = 'tooltip-buttons';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'tooltip-button';
  copyBtn.textContent = '📋';
  copyBtn.title = 'Copy definition';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(tooltip.innerText);
  });
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tooltip-button';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', removeTooltip);
  btnBar.append(copyBtn, closeBtn);
  tooltip.appendChild(btnBar);

  // Header
  const header = document.createElement('div');
  header.className = 'dict-header';
  header.textContent = entry.word;
  tooltip.appendChild(header);

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
    tooltip.appendChild(infoLine);
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
      tooltip.appendChild(defDiv);
      if (d.example) {
        const ex = document.createElement('div');
        ex.className = 'dict-ex';
        ex.textContent = d.example;
        tooltip.appendChild(ex);
      }
    });
  } else {
    const msg = document.createElement('div');
    msg.className = 'dict-def';
    msg.textContent = entry.error || 'No definition found.';
    tooltip.appendChild(msg);
  }

  // Derivatives
  if (Array.isArray(entry.derivs) && entry.derivs.length) {
    const dhdr = document.createElement('div');
    dhdr.className = 'dict-deriv-header';
    dhdr.textContent = 'Derivatives:';
    tooltip.appendChild(dhdr);
    entry.derivs.forEach(w => {
      const dv = document.createElement('div');
      dv.className = 'dict-deriv';
      dv.textContent = `- ${w}`;
      tooltip.appendChild(dv);
    });
  }

  shadow.appendChild(tooltip);
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
  if (msg.type === 'show-definition' && msg.entry) {
    renderTooltip(msg.entry);
    positionTooltip();
    window.addEventListener('scroll', throttledScroll, true);
    // Prevent internal clicks from closing
    tooltip.addEventListener('mousedown', e => e.stopPropagation());
    document.addEventListener('mousedown', removeTooltip, { once: true });
  }
});