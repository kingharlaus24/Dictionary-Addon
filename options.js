const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');

async function loadOptions() {
  const { history = [] } = await browser.storage.local.get({ history: [] });
  // Clear existing items
  historyList.textContent = '';
  // Render history items
  history.forEach(h => {
    const li = document.createElement('li');
    const timestamp = new Date(h.ts).toLocaleString();
    // Text: "MM/DD/YYYY, hh:mm:ss: "
    li.textContent = `${timestamp}: `;
    // Word in bold
    const strong = document.createElement('strong');
    strong.textContent = h.word;
    li.appendChild(strong);
    // Definition after dash
    li.appendChild(document.createTextNode(` – ${h.definition}`));
    historyList.appendChild(li);
  });
}

clearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  historyList.textContent = '';
});

document.addEventListener('DOMContentLoaded', loadOptions);