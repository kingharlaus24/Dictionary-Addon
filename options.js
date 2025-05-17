const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');

async function loadOptions() {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  historyList.innerHTML = history
    .map(h => `<li>${new Date(h.ts).toLocaleString()}: <strong>${h.word}</strong> – ${h.definition}</li>`)
    .join('');
}

clearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  historyList.innerHTML = '';
});

document.addEventListener('DOMContentLoaded', loadOptions);