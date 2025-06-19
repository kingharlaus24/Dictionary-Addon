const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';

// Tab elements
const tabLookup        = document.getElementById('tab-lookup');
const tabHistory       = document.getElementById('tab-history');
const tabFavorites     = document.getElementById('tab-favorites');
const contentLookup    = document.getElementById('content-lookup');
const contentHistory   = document.getElementById('content-history');
const contentFavorites = document.getElementById('content-favorites');

// Lookup elements
const popupInput       = document.getElementById('popupInput');
const popupLookupBtn   = document.getElementById('popupLookupBtn');
const popupDefinition  = document.getElementById('popupDefinition');

// History elements
const popupHistoryList = document.getElementById('popupHistoryList');
const popupClearHistory= document.getElementById('popupClearHistory');
const popupFavoritesList = document.getElementById('popupFavoritesList');
const popupClearFavorites= document.getElementById('popupClearFavorites');

// Switch tabs
function showTab(tab) {
  tabLookup.classList.toggle('active', tab === 'lookup');
  tabHistory.classList.toggle('active', tab === 'history');
  tabFavorites.classList.toggle('active', tab === 'favorites');
  contentLookup.classList.toggle('hidden', tab !== 'lookup');
  contentHistory.classList.toggle('hidden', tab !== 'history');
  contentFavorites.classList.toggle('hidden', tab !== 'favorites');
  if (tab === 'history') {
    loadHistory();
  } else if (tab === 'favorites') {
    loadFavorites();
  }
}
tabLookup.addEventListener('click', () => showTab('lookup'));
tabHistory.addEventListener('click', () => showTab('history'));
tabFavorites.addEventListener('click', () => showTab('favorites'));

async function fetchDictionary(word) {
  try {
    const res = await fetch(`${DICT_API_BASE}/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json) && json[0].meanings) {
      return json[0];
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
      return {
        word: json.title || word,
        phonetics: [],
        meanings: [{ partOfSpeech: '', definitions: [{ definition: json.extract }] }]
      };
    }
  } catch {
    // ignore errors
  }
  return null;
}

async function lookupWord(word, save=true) {
  if (!word) return;
  popupDefinition.textContent = 'Loading…';
  let entry = await fetchDictionary(word);
  if (!entry) {
    entry = await fetchWikipedia(word);
  }
  if (entry) {
    renderEntry(entry, popupDefinition);
    if (save) await saveHistory(word, entry);
  } else {
    renderError(word, popupDefinition);
  }
}

// Enter key triggers lookup
popupInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupWord(popupInput.value.trim(), true);
});
// Button click triggers lookup and save
popupLookupBtn.addEventListener('click', () => lookupWord(popupInput.value.trim(), true));

// Render functions
function renderError(word, container) {
  container.textContent = '';
  const hdr = document.createElement('div');
  hdr.className = 'dict-header';
  hdr.textContent = word;
  const msg = document.createElement('div');
  msg.className = 'dict-def';
  msg.textContent = 'Error fetching definition.';
  container.append(hdr, msg);
}

function renderEntry(entry, container) {
  container.textContent = '';
  const header = document.createElement('div');
  header.className = 'dict-header';
  header.textContent = entry.word;
  const saveBtn = document.createElement('button');
  saveBtn.className = 'popup-save-btn';
  saveBtn.textContent = '⭐';
  saveBtn.title = 'Save word';
  saveBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'save-favorite', entry });
  });
  header.appendChild(saveBtn);
  container.appendChild(header);
  const phon = entry.phonetics?.find(p => p.text)?.text || '';
  const phonText = phon.match(/^\/.*\/$/) ? phon : phon ? `/${phon}/` : '';
  const pos   = entry.meanings[0]?.partOfSpeech || '';
  if (phonText || pos) {
    const infoLine = document.createElement('div');
    if (phonText) {
      const sp = document.createElement('span'); sp.className = 'dict-phonetic'; sp.textContent = phonText; infoLine.append(sp);
    }
    if (pos) {
      const sp2 = document.createElement('span'); sp2.className = 'dict-pos-inline'; sp2.textContent = pos; infoLine.append(sp2);
    }
    container.appendChild(infoLine);
  }
  entry.meanings.forEach(m => {
    m.definitions.forEach((d,i) => {
      const def = document.createElement('div');
      def.className = 'dict-def';
      const num = document.createElement('strong'); num.textContent = `${i+1}. `;
      def.append(num);
      def.append(document.createTextNode(d.definition));
      container.appendChild(def);
      if (d.example) {
        const ex = document.createElement('div'); ex.className = 'dict-ex'; ex.textContent = d.example; container.appendChild(ex);
      }
    });
  });
  const derivs = entry.derivatives || entry.derivativeOf || [];
  if (derivs.length) {
    const hdr = document.createElement('div'); hdr.className = 'dict-deriv-header'; hdr.textContent = 'Derivatives:';
    container.appendChild(hdr);
    derivs.forEach(w => {
      const dv = document.createElement('div'); dv.className = 'dict-deriv'; dv.textContent = `- ${w}`; container.appendChild(dv);
    });
  }
}

// History storage
async function saveHistory(word, entry) {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  history.unshift({ word, entry, ts: Date.now() });
  await browser.storage.local.set({ history });
}

// Load and render history items
async function loadHistory() {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  popupHistoryList.textContent = '';
  history.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${new Date(h.ts).toLocaleString()}: ${h.word}`;
    li.addEventListener('click', () => {
      showTab('lookup');
      popupInput.value = h.word;
      // Auto lookup without saving
      lookupWord(h.word, false);
    });
    popupHistoryList.appendChild(li);
  });
}

popupClearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  popupHistoryList.textContent = '';
});

async function loadFavorites() {
  const { favorites = [] } = await browser.storage.local.get({ favorites: [] });
  popupFavoritesList.textContent = '';
  favorites.forEach(f => {
    const li = document.createElement('li');
    li.textContent = `${new Date(f.ts).toLocaleString()}: ${f.word}`;
    li.addEventListener('click', () => {
      showTab('lookup');
      popupInput.value = f.word;
      lookupWord(f.word, false);
    });
    popupFavoritesList.appendChild(li);
  });
}

popupClearFavorites.addEventListener('click', async () => {
  await browser.storage.local.set({ favorites: [] });
  popupFavoritesList.textContent = '';
});

document.addEventListener('DOMContentLoaded', () => showTab('lookup'));
