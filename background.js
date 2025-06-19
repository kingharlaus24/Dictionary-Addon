const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';

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

// Listen for requests to save favorites
browser.runtime.onMessage.addListener(async msg => {
  if (msg.type === 'save-favorite' && msg.entry) {
    const { favorites = [] } = await browser.storage.local.get({ favorites: [] });
    if (!favorites.some(f => f.word === msg.entry.word)) {
      favorites.unshift({ word: msg.entry.word, entry: msg.entry, ts: Date.now() });
      await browser.storage.local.set({ favorites });
    }
  }
});

async function fetchDictionary(word) {
  try {
    const res = await fetch(`${DICT_API_BASE}/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json) && json[0].meanings) {
      return formatJson(json[0]);
    }
  } catch {
    // ignore errors
  }
  return null;
}

async function fetchWikipedia(word) {
  try {
    const res = await fetch(`${WIKI_API_BASE}/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.extract) {
      return { word: json.title || word, phonetic: '', pos: '', defs: [{ text: json.extract, example: null }], derivs: [] };
    }
  } catch {
    // ignore errors
  }
  return null;
}

async function handleLookup(info, tab) {
  const word = (info.selectionText || '').trim();
  if (!word || !tab.id) return;

  let entryObj = await fetchDictionary(word);
  if (!entryObj) {
    entryObj = await fetchWikipedia(word);
  }
  if (!entryObj) {
    entryObj = { word, defs: null, error: 'No definition found.' };
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

// Export for testing in Node environments
if (typeof module !== 'undefined') {
  module.exports = { formatJson, fetchDictionary, fetchWikipedia };
}
