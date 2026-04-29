const tabLookup = document.getElementById('tab-lookup');
const tabHistory = document.getElementById('tab-history');
const tabFavorites = document.getElementById('tab-favorites');
const contentLookup = document.getElementById('content-lookup');
const contentHistory = document.getElementById('content-history');
const contentFavorites = document.getElementById('content-favorites');

const popupInput = document.getElementById('popupInput');
const popupLookupBtn = document.getElementById('popupLookupBtn');
const popupDefinition = document.getElementById('popupDefinition');

const popupHistoryList = document.getElementById('popupHistoryList');
const popupClearHistory = document.getElementById('popupClearHistory');
const popupFavoritesList = document.getElementById('popupFavoritesList');
const popupClearFavorites = document.getElementById('popupClearFavorites');

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

popupInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') lookupWord(popupInput.value, true);
});

popupLookupBtn.addEventListener('click', () => lookupWord(popupInput.value, true));

popupClearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  loadHistory();
});

popupClearFavorites.addEventListener('click', async () => {
  await browser.storage.local.set({ favorites: [] });
  loadFavorites();
});

async function lookupWord(rawWord, saveHistory) {
  const word = rawWord.trim();
  if (!word) return;

  setBusy(true);
  renderLoading(word);

  try {
    const entry = await browser.runtime.sendMessage({
      type: 'lookup-word',
      word,
      saveHistory
    });
    renderEntry(entry || { word, error: 'No definition found.' }, popupDefinition);
  } catch {
    renderEntry({ word, error: 'Unable to fetch definition.' }, popupDefinition);
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  popupLookupBtn.disabled = isBusy;
  popupInput.disabled = isBusy;
  popupLookupBtn.textContent = isBusy ? 'Looking Up' : 'Look Up';
}

function renderLoading(word) {
  popupDefinition.textContent = '';
  const article = document.createElement('article');
  article.className = 'dictionary-entry is-loading';
  const title = document.createElement('div');
  title.className = 'entry-word';
  title.textContent = word;
  const body = document.createElement('div');
  body.className = 'entry-definition';
  body.textContent = 'Searching dictionary...';
  article.append(title, body);
  popupDefinition.appendChild(article);
}

function renderEntry(entry, container) {
  entry = normalizeEntry(entry);
  container.textContent = '';

  const article = document.createElement('article');
  article.className = 'dictionary-entry';

  const header = document.createElement('header');
  header.className = 'entry-header';

  const titleBlock = document.createElement('div');
  const word = document.createElement('h1');
  word.className = 'entry-word';
  word.textContent = entry.word || '';
  titleBlock.appendChild(word);

  if (entry.phonetic || entry.pos) {
    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    if (entry.phonetic) {
      const phonetic = document.createElement('span');
      phonetic.textContent = entry.phonetic;
      meta.appendChild(phonetic);
    }
    if (entry.pos) {
      const pos = document.createElement('span');
      pos.textContent = entry.pos;
      meta.appendChild(pos);
    }
    titleBlock.appendChild(meta);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'icon-button';
  saveBtn.type = 'button';
  saveBtn.textContent = entry.saved ? '★' : '☆';
  saveBtn.title = entry.saved ? 'Saved word' : 'Save word';
  saveBtn.setAttribute('aria-label', entry.saved ? 'Saved word' : 'Save word');
  saveBtn.addEventListener('click', () => toggleFavorite(entry, saveBtn));

  header.append(titleBlock, saveBtn);
  article.appendChild(header);

  if (Array.isArray(entry.defs) && entry.defs.length) {
    const list = document.createElement('ol');
    list.className = 'definition-list';
    entry.defs.forEach(definition => {
      const item = document.createElement('li');
      const text = document.createElement('div');
      text.className = 'entry-definition';
      text.textContent = definition.text;
      item.appendChild(text);
      if (definition.example) {
        const example = document.createElement('div');
        example.className = 'entry-example';
        example.textContent = definition.example;
        item.appendChild(example);
      }
      list.appendChild(item);
    });
    article.appendChild(list);
  } else {
    const error = document.createElement('div');
    error.className = 'entry-definition entry-error';
    error.textContent = entry.error || 'No definition found.';
    article.appendChild(error);
  }

  if (entry.source) {
    const source = document.createElement('div');
    source.className = 'entry-source';
    source.textContent = entry.source;
    article.appendChild(source);
  }

  if (Array.isArray(entry.derivs) && entry.derivs.length) {
    const derivs = document.createElement('div');
    derivs.className = 'entry-derivatives';
    derivs.textContent = `Derivatives: ${entry.derivs.join(', ')}`;
    article.appendChild(derivs);
  }

  container.appendChild(article);
}

async function toggleFavorite(entry, button) {
  button.disabled = true;
  const previousSaved = Boolean(entry.saved);
  button.textContent = previousSaved ? 'Removing' : 'Saving';

  try {
    const result = await browser.runtime.sendMessage({ type: 'toggle-favorite', entry });
    entry.saved = Boolean(result?.saved);
    setTimeout(() => {
      button.disabled = false;
      updateFavoriteButton(button, entry.saved);
    }, 600);
  } catch {
    button.textContent = 'Error';
    setTimeout(() => {
      button.disabled = false;
      updateFavoriteButton(button, previousSaved);
    }, 900);
  }
}

function updateFavoriteButton(button, saved) {
  button.textContent = saved ? '★' : '☆';
  button.title = saved ? 'Saved word' : 'Save word';
  button.setAttribute('aria-label', saved ? 'Saved word' : 'Save word');
}

async function loadHistory() {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  renderStoredList(popupHistoryList, history, {
    emptyText: 'No recent lookups',
    removeMessage: 'remove-history-item',
    onRemove: loadHistory
  });
}

async function loadFavorites() {
  const { favorites = [] } = await browser.storage.local.get({ favorites: [] });
  renderStoredList(popupFavoritesList, favorites, {
    emptyText: 'No saved words',
    removeMessage: 'remove-favorite-item',
    onRemove: loadFavorites,
    markSaved: true
  });
}

function renderStoredList(container, items, options) {
  container.textContent = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = options.emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const itemEntry = options.markSaved ? { ...item.entry, saved: true } : item.entry;
    const li = document.createElement('li');
    li.className = 'stored-item';

    const lookupButton = document.createElement('button');
    lookupButton.className = 'stored-lookup';
    lookupButton.type = 'button';
    lookupButton.addEventListener('click', () => {
      showTab('lookup');
      popupInput.value = item.word;
      renderEntry(itemEntry, popupDefinition);
    });

    const word = document.createElement('span');
    word.className = 'stored-word';
    word.textContent = item.word;

    const summary = document.createElement('span');
    summary.className = 'stored-summary';
    summary.textContent = getSummary(itemEntry);

    const time = document.createElement('span');
    time.className = 'stored-time';
    time.textContent = formatTime(item.ts);

    lookupButton.append(word, summary, time);

    const sourceText = normalizeEntry(itemEntry).source;
    if (sourceText) {
      const source = document.createElement('span');
      source.className = 'stored-source';
      source.textContent = sourceText;
      lookupButton.appendChild(source);
    }

    const removeButton = document.createElement('button');
    removeButton.className = 'icon-button remove-button';
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.title = 'Remove';
    removeButton.setAttribute('aria-label', `Remove ${item.word}`);
    removeButton.addEventListener('click', async () => {
      removeButton.disabled = true;
      await browser.runtime.sendMessage({ type: options.removeMessage, ts: item.ts });
      options.onRemove();
    });

    li.append(lookupButton, removeButton);
    container.appendChild(li);
  });
}

function getSummary(entry) {
  entry = normalizeEntry(entry);
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
      source: entry.source || 'Dictionary',
      saved: Boolean(entry.saved)
    };
  }

  const phon = entry.phonetics?.find(item => item.text)?.text || '';
  const phonetic = phon.match(/^\/.*\/$/) ? phon : phon ? `/${phon}/` : '';
  const pos = entry.meanings?.[0]?.partOfSpeech || '';
  const defs = entry.meanings?.flatMap(meaning =>
    (meaning.definitions || []).map(definition => ({
      text: definition.definition,
      example: definition.example || null
    }))
  ) || [];
  const derivs = entry.derivatives || entry.derivativeOf || [];

  return {
    word: entry.word || '',
    phonetic,
    pos,
    defs,
    derivs,
    source: entry.source || 'Dictionary',
    saved: Boolean(entry.saved)
  };
}

function formatTime(ts) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(ts));
}

document.addEventListener('DOMContentLoaded', () => showTab('lookup'));
