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
browser.commands.onCommand.addListener(command => {
  if (command !== 'lookup') return;
  browser.tabs.query({ active: true, currentWindow: true })
    .then(([tab]) => tab.id && browser.tabs.sendMessage(tab.id, { type: 'request-selection' }));
});

async function handleLookup(info, tab) {
  const word = (info.selectionText || '').trim();
  if (!word || !tab.id) return;

  let entryObj;
  try {
    const res = await fetch(`${DICT_API_BASE}/${encodeURIComponent(word)}`);
    const json = await res.json();
    entryObj = Array.isArray(json) && json[0].meanings
      ? formatJson(json[0])
      : { word, defs: null, error: 'No definition found.' };
  } catch {
    entryObj = { word, defs: null, error: 'Error fetching definition.' };
  }

  // Save history
  const { history = [] } = await browser.storage.local.get({ history: [] });
  history.unshift({ word, entry: entryObj, ts: Date.now() });
  await browser.storage.local.set({ history });

  browser.tabs.sendMessage(tab.id, { type: 'show-definition', entry: entryObj });
}

function formatJson(entry) {
  const phon = entry.phonetics?.find(p => p.text)?.text || '';
  const phonText = phon.match(/^\/.*\/$/) ? phon : phon ? `/${phon}/` : '';
  const pos     = entry.meanings[0]?.partOfSpeech || '';
  const defs    = entry.meanings.flatMap(m =>
    m.definitions.map(d => ({ text: d.definition, example: d.example || null }))
  );
  const derivs  = entry.derivatives || entry.derivativeOf || [];
  return { word: entry.word, phonetic: phonText, pos, defs, derivs };
}