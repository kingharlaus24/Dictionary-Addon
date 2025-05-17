// Tab elements
const tabLookup        = document.getElementById('tab-lookup');
const tabHistory       = document.getElementById('tab-history');
const contentLookup    = document.getElementById('content-lookup');
const contentHistory   = document.getElementById('content-history');

// Lookup elements
const popupInput       = document.getElementById('popupInput');
const popupLookupBtn   = document.getElementById('popupLookupBtn');
const popupDefinition  = document.getElementById('popupDefinition');

// History elements
const popupHistoryList = document.getElementById('popupHistoryList');
const popupClearHistory= document.getElementById('popupClearHistory');

// Switch tabs
tabLookup.addEventListener('click',  () => showTab('lookup'));
tabHistory.addEventListener('click', () => showTab('history'));
function showTab(tab) {
  if (tab === 'lookup') {
    tabLookup.classList.add('active');
    tabHistory.classList.remove('active');
    contentLookup.classList.remove('hidden');
    contentHistory.classList.add('hidden');
  } else {
    tabHistory.classList.add('active');
    tabLookup.classList.remove('active');
    contentHistory.classList.remove('hidden');
    contentLookup.classList.add('hidden');
    loadHistory();
  }
}

// Perform lookup
popupLookupBtn.addEventListener('click', async () => {
  const word = popupInput.value.trim();
  if (!word) return;
  popupDefinition.textContent = 'Loading…';
  try {
    const res  = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    const html = Array.isArray(data) && data[0].meanings
      ? formatJson(data[0])
      : `<div class="dict-header">${word}</div><div class="dict-def">No definition found.</div>`;
    popupDefinition.innerHTML = html;
    saveHistory(word, html);
  } catch {
    popupDefinition.innerHTML = `<div class="dict-header">${word}</div><div class="dict-def">Error fetching definition.</div>`;
  }
});

// History functions
async function saveHistory(word, definition) {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  history.unshift({ word, definition, ts: Date.now() });
  await browser.storage.local.set({ history });
}

async function loadHistory() {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  popupHistoryList.innerHTML = history.map((h, i) =>
    `<li data-index="${i}">${new Date(h.ts).toLocaleString()}: <strong>${h.word}</strong></li>`
  ).join('');
  popupHistoryList.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', async () => {
      const idx = li.dataset.index;
      const { history } = await browser.storage.local.get('history');
      const entry = history[idx];
      showTab('lookup');
      popupInput.value      = entry.word;
      popupDefinition.innerHTML = entry.definition;
    });
  });
}

popupClearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  popupHistoryList.innerHTML = '';
});

// Utility: reuse formatJson from background
function formatJson(entry) {
  const parts = [];
  const phon = entry.phonetics?.find(p => p.text)?.text || '';
  const phonText = phon.match(/^\/.*\/$/) ? phon : `/${phon}/`;
  const pos   = entry.meanings[0]?.partOfSpeech || '';
  parts.push(
    `<div class="dict-header">` +
      `${entry.word}` +
      `${phonText ? ` | <span class="dict-phonetic">${phonText}</span>` : ''}` +
      `${pos ? ` | <span class="dict-pos-inline">${pos}</span>` : ''}` +
    `</div>`
  );
  entry.meanings.forEach(m => {
    m.definitions.forEach((d,i) => {
      parts.push(`<div class="dict-def"><strong>${i+1}</strong> ${d.definition}</div>`);
      if (d.example) parts.push(`<div class="dict-ex"><em>${d.example}</em></div>`);
    });
  });
  if (entry.derivatives || entry.derivativeOf) {
    parts.push(`<div class="dict-deriv-header">Derivatives:</div>`);
    const derivs = entry.derivatives || entry.derivativeOf;
    derivs.forEach(w => parts.push(`<div class="dict-deriv">- ${w}</div>`));
  }
  return parts.join('');
}