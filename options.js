const offlineToggle = document.getElementById('offlineToggle');
const dictFile = document.getElementById('dictFile');
const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');

async function loadOptions() {
  const { offline, userDict = {}, history = [] } = await browser.storage.local.get({ offline: false, userDict: {}, history: [] });
  offlineToggle.checked = offline;
  historyList.innerHTML = history.map(h => `<li>${new Date(h.ts).toLocaleString()}: <strong>${h.word}</strong> – ${h.definition}</li>`).join('');
}

offlineToggle.addEventListener('change', () => {
  browser.storage.local.set({ offline: offlineToggle.checked });
});

dictFile.addEventListener('change', () => {
  const file = dictFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(e.target.result);
      browser.storage.local.set({ userDict: obj });
      alert('Offline dictionary loaded! Enable "Use offline dictionary" to use it.');
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
});

clearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  historyList.innerHTML = '';
});

document.addEventListener('DOMContentLoaded', loadOptions);