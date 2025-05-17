let shadowHost, shadow, tooltip;

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
      #dict-tooltip { position: absolute; max-width: 300px; max-height: 200px; overflow-y: auto; background: #fff; color: #000; padding: 10px 12px; border: 1px solid #aaa; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, sans-serif; pointer-events: auto; }
      .dict-header { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
      .dict-phonetic { font-size: 13px; color: #555; }
      .dict-pos-inline { font-style: italic; font-size: 13px; }
      .dict-def { font-size: 14px; margin-left: 6px; margin-bottom: 4px; }
      .dict-ex { font-size: 13px; margin-left: 12px; font-style: italic; color: #444; margin-bottom: 6px; }
      .dict-deriv-header { font-size: 13px; font-weight: bold; margin-top: 8px; }
      .dict-deriv { font-size: 13px; margin-left: 6px; }
    `;
    shadow.appendChild(style);
  }
}

function positionTooltip() {
  if (!tooltip) return;
  const sel = window.getSelection(); if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  let top = rect.top - tipRect.height - 8;
  if (top < 0) top = rect.bottom + 8;
  let left = rect.left + (rect.width - tipRect.width) / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function removeTooltip() {
  if (tooltip) { tooltip.remove(); tooltip = null; }
  window.removeEventListener('scroll', onScroll, true);
}

function onScroll() {
  positionTooltip();
  const sel = window.getSelection(); if (!sel.rangeCount) { removeTooltip(); return; }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
    removeTooltip();
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'request-selection') {
    browser.runtime.sendMessage({ type: 'send-selection', word: window.getSelection().toString()});
  }
  if (msg.type === 'show-definition') {
    initShadow(); if (tooltip) removeTooltip();
    tooltip = document.createElement('div');
    tooltip.id = 'dict-tooltip'; tooltip.innerHTML = msg.definition;
    shadow.appendChild(tooltip);
    positionTooltip();
    window.addEventListener('scroll', onScroll, true);
    tooltip.addEventListener('mousedown', e => e.stopPropagation());
    document.addEventListener('mousedown', removeTooltip, { once: true });
  }
});