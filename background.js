const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const MAX_HISTORY_ITEMS = 100;
const MAX_FAVORITE_ITEMS = 100;
const MAX_SELECTION_WORDS = 3;

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
    .then(([tab]) => {
      if (Number.isInteger(tab?.id)) {
        return browser.tabs.sendMessage(tab.id, { type: 'request-selection' });
      }
    })
    .catch(() => {
      // Some internal browser pages do not accept content-script messages.
    });
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'save-favorite' && msg.entry) {
    return saveFavorite(msg.entry);
  }

  if (msg.type === 'toggle-favorite' && msg.entry) {
    return toggleFavorite(msg.entry);
  }

  if (msg.type === 'lookup-selection' && msg.word) {
    return lookupAndStore(msg.word, sender?.tab?.id);
  }

  if (msg.type === 'lookup-word' && msg.word) {
    return lookupWord(msg.word, { saveHistory: msg.saveHistory !== false });
  }

  if (msg.type === 'remove-history-item' && Number.isInteger(msg.ts)) {
    return removeStoredItem('history', msg.ts);
  }

  if (msg.type === 'remove-favorite-item' && Number.isInteger(msg.ts)) {
    return removeStoredItem('favorites', msg.ts);
  }

  if (msg.type === 'is-favorite' && msg.word) {
    return isFavorite(msg.word);
  }
});

async function saveFavorite(entry) {
  const { favorites = [] } = await browser.storage.local.get({ favorites: [] });
  const word = entry.word || '';
  const normalizedWord = normalizeWordKey(word);

  if (!favorites.some(f => normalizeWordKey(f.word) === normalizedWord)) {
    favorites.unshift({ word, entry, ts: Date.now() });
    await browser.storage.local.set({ favorites: favorites.slice(0, MAX_FAVORITE_ITEMS) });
  }

  return { ok: true, saved: true };
}

async function toggleFavorite(entry) {
  const { favorites = [] } = await browser.storage.local.get({ favorites: [] });
  const word = entry.word || '';
  const normalizedWord = normalizeWordKey(word);
  const existingIndex = favorites.findIndex(f => normalizeWordKey(f.word) === normalizedWord);

  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
    await browser.storage.local.set({ favorites });
    return { ok: true, saved: false };
  }

  favorites.unshift({ word, entry: { ...entry, saved: true }, ts: Date.now() });
  await browser.storage.local.set({ favorites: favorites.slice(0, MAX_FAVORITE_ITEMS) });
  return { ok: true, saved: true };
}

async function isFavorite(word) {
  const { favorites = [] } = await browser.storage.local.get({ favorites: [] });
  const normalizedWord = normalizeWordKey(word);
  return {
    saved: favorites.some(f => normalizeWordKey(f.word) === normalizedWord)
  };
}

async function removeStoredItem(key, ts) {
  const result = await browser.storage.local.get({ [key]: [] });
  const items = result[key].filter(item => item.ts !== ts);
  await browser.storage.local.set({ [key]: items });
  return { ok: true };
}

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
      return { word: json.title || word, phonetic: '', pos: '', defs: [{ text: json.extract, example: null }], derivs: [], source: 'Wikipedia' };
    }
  } catch {
    // ignore errors
  }
  return null;
}

async function handleLookup(info, tab) {
  await lookupAndStore(info.selectionText, tab?.id);
}

async function lookupAndStore(selectionText, tabId) {
  if (!Number.isInteger(tabId)) return;

  const entryObj = await lookupWord(selectionText);
  if (!entryObj) return;

  await browser.tabs.sendMessage(tabId, { type: 'show-definition', entry: entryObj });
}

async function lookupWord(selectionText, options = {}) {
  const { saveHistory = true } = options;
  const word = normalizeSelection(selectionText);
  if (!word) return null;

  const entryObj = await lookupEntry(word);
  entryObj.saved = (await isFavorite(entryObj.word)).saved;
  if (saveHistory) {
    await saveHistoryEntry(word, entryObj);
  }

  return entryObj;
}

async function lookupEntry(word) {
  if (!word) return null;

  let entryObj = await fetchDictionary(word);
  if (!entryObj) {
    entryObj = await fetchWikipedia(word);
  }
  if (!entryObj) {
    entryObj = { word, defs: null, error: 'No definition found.', source: 'Dictionary' };
  }

  return entryObj;
}

async function saveHistoryEntry(word, entryObj) {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  history.unshift({ word, entry: entryObj, ts: Date.now() });
  await browser.storage.local.set({ history: history.slice(0, MAX_HISTORY_ITEMS) });
}

function normalizeSelection(selectionText) {
  let text = (selectionText || '')
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ');
  if (!text) return '';

  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  if (!words.length) return '';

  if (words.length > MAX_SELECTION_WORDS) {
    return words[0];
  }

  if (words.length === 1) {
    return words[0].replace(/^'+|'+$/g, '');
  }

  return words.join(' ');
}

function normalizeWordKey(word) {
  return normalizeSelection(word).toLocaleLowerCase();
}

function formatJson(entry) {
  const phon = entry.phonetics?.find(p => p.text)?.text || '';
  const phonText = phon.match(/^\/.*\/$/) ? phon : phon ? `/${phon}/` : '';
  const pos     = entry.meanings[0]?.partOfSpeech || '';
  const defs    = entry.meanings.flatMap(m =>
    m.definitions.map(d => ({ text: d.definition, example: d.example || null }))
  );
  const derivs  = entry.derivatives || entry.derivativeOf || [];
  return { word: entry.word, phonetic: phonText, pos, defs, derivs, source: 'Dictionary' };
}

// Export for testing in Node environments
if (typeof module !== 'undefined') {
  module.exports = {
    formatJson,
    fetchDictionary,
    fetchWikipedia,
    isFavorite,
    lookupEntry,
    normalizeSelection,
    normalizeWordKey,
    removeStoredItem,
    saveHistoryEntry,
    toggleFavorite
  };
}
