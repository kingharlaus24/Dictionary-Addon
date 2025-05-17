const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

async function init() {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: 'lookup-dictionary',
    title: 'Lookup in Dictionary',
    contexts: ['selection']
  });
}

browser.runtime.onInstalled.addListener(init);
browser.runtime.onStartup.addListener(init);

browser.contextMenus.onClicked.addListener(handleLookup);
browser.commands.onCommand.addListener((command) => {
  if (command !== 'lookup') return;
  browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab.id) browser.tabs.sendMessage(tab.id, { type: 'request-selection' });
  });
});

async function handleLookup(info, tab) {
  const word = (info.selectionText || '').trim();
  if (!word || !tab.id) return;

  let definition;
  try {
    const res = await fetch(`${DICT_API_BASE}/${encodeURIComponent(word)}`);
    const json = await res.json();
    definition = Array.isArray(json) && json[0].meanings
      ? formatJson(json[0])
      : `<div class="dict-header">${word}</div><div class="dict-def">No definition found.</div>`;
  } catch {
    definition = `<div class="dict-header">${word}</div><div class="dict-def">Error fetching definition.</div>`;
  }

  // Save history
  const { history = [] } = await browser.storage.local.get({ history: [] });
  history.unshift({ word, definition, ts: Date.now() });
  await browser.storage.local.set({ history });

  browser.tabs.sendMessage(tab.id, { type: 'show-definition', definition });
}

function formatJson(entry) {
  const parts = [];
  // Header line: word | phonetic | part of speech
  const phon = entry.phonetics?.find(p => p.text)?.text;
  const phonText = phon ? (/^\/.*\/$/.test(phon) ? phon : `/${phon}/`) : '';
  const pos = entry.meanings[0]?.partOfSpeech || '';
  parts.push(
    `<div class="dict-header">` +
      `${entry.word}` +
      `${phonText ? ` | <span class="dict-phonetic">${phonText}</span>` : ''}` +
      `${pos ? ` | <span class="dict-pos-inline">${pos}</span>` : ''}` +
    `</div>`
  );
  // Numbered definitions
  entry.meanings.forEach(m => {
    m.definitions.forEach((d, i) => {
      parts.push(
        `<div class="dict-def"><strong>${i + 1}</strong> ${d.definition}</div>`
      );
      if (d.example) parts.push(`<div class="dict-ex"><em>${d.example}</em></div>`);
    });
  });
  // Derivatives
  if (entry.derivatives || entry.derivativeOf) {
    parts.push(`<div class="dict-deriv-header">Derivatives:</div>`);
    const derivs = entry.derivatives || entry.derivativeOf;
    derivs.forEach(w => parts.push(`<div class="dict-deriv">- ${w}</div>`));
  }
  return parts.join('');
}