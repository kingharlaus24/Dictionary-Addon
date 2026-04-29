const historyList = document.getElementById('historyList');
const favoritesList = document.getElementById('favoritesList');
const clearHistory = document.getElementById('clearHistory');
const clearFavorites = document.getElementById('clearFavorites');
const librarySearch = document.getElementById('librarySearch');
const optionsTabHistory = document.getElementById('optionsTabHistory');
const optionsTabFavorites = document.getElementById('optionsTabFavorites');
const optionsHistoryPanel = document.getElementById('optionsHistoryPanel');
const optionsFavoritesPanel = document.getElementById('optionsFavoritesPanel');

let activeTab = 'history';
let state = {
  history: [],
  favorites: []
};

optionsTabHistory.addEventListener('click', () => showTab('history'));
optionsTabFavorites.addEventListener('click', () => showTab('favorites'));
librarySearch.addEventListener('input', renderLibrary);

clearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  state.history = [];
  renderLibrary();
});

clearFavorites.addEventListener('click', async () => {
  await browser.storage.local.set({ favorites: [] });
  state.favorites = [];
  renderLibrary();
});

async function loadOptions() {
  state = await browser.storage.local.get({ history: [], favorites: [] });
  renderLibrary();
}

function showTab(tab) {
  activeTab = tab;
  optionsTabHistory.classList.toggle('active', tab === 'history');
  optionsTabFavorites.classList.toggle('active', tab === 'favorites');
  optionsHistoryPanel.classList.toggle('hidden', tab !== 'history');
  optionsFavoritesPanel.classList.toggle('hidden', tab !== 'favorites');
  renderLibrary();
}

function renderLibrary() {
  const query = librarySearch.value.trim().toLocaleLowerCase();
  renderList(historyList, filterItems(state.history, query), 'No matching history');
  renderList(favoritesList, filterItems(state.favorites, query), 'No matching saved words');
}

function filterItems(items, query) {
  if (!query) return items;
  return items.filter(item => {
    const entry = normalizeEntry(item.entry);
    const haystack = [
      item.word,
      entry.word,
      entry.source,
      entry.pos,
      getSummary(entry)
    ].join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  });
}

function renderList(container, items, emptyText) {
  container.textContent = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const entry = normalizeEntry(item.entry);
    const li = document.createElement('li');
    li.className = 'library-item';

    const topLine = document.createElement('div');
    topLine.className = 'library-item-top';

    const word = document.createElement('strong');
    word.className = 'stored-word';
    word.textContent = item.word || entry.word;

    const date = document.createElement('span');
    date.className = 'stored-time';
    date.textContent = new Date(item.ts).toLocaleString();

    topLine.append(word, date);

    const summary = document.createElement('p');
    summary.className = 'library-summary';
    summary.textContent = getSummary(entry);

    li.append(topLine, summary);

    if (entry.source) {
      const source = document.createElement('span');
      source.className = 'stored-source';
      source.textContent = entry.source;
      li.appendChild(source);
    }

    container.appendChild(li);
  });
}

function getSummary(entry) {
  if (Array.isArray(entry?.defs) && entry.defs.length) {
    return entry.defs[0].text;
  }
  return entry?.error || 'No definition available';
}

function normalizeEntry(entry) {
  if (!entry) return {};
  if (Array.isArray(entry.defs) || entry.error) {
    return {
      ...entry,
      source: entry.source || 'Dictionary'
    };
  }

  const defs = entry.meanings?.flatMap(meaning =>
    (meaning.definitions || []).map(definition => ({
      text: definition.definition,
      example: definition.example || null
    }))
  ) || [];

  return {
    word: entry.word || '',
    pos: entry.meanings?.[0]?.partOfSpeech || '',
    defs,
    source: entry.source || 'Dictionary'
  };
}

document.addEventListener('DOMContentLoaded', loadOptions);
