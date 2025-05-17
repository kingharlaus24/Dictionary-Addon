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
tabLookup.addEventListener('click', () => showTab('lookup'));
tabHistory.addEventListener('click', () => showTab('history'));

async function lookupWord(word, save=true) {
  if (!word) return;
  popupDefinition.textContent = 'Loading…';
  try {
    const res  = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    renderEntry(data[0], popupDefinition);
    if (save) await saveHistory(word, data[0]);
  } catch {
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

document.addEventListener('DOMContentLoaded', () => showTab('lookup'));