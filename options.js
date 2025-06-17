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

    // Best-effort definition lookup
    let def = '';
    if (h.entry) {
      if (Array.isArray(h.entry.defs) && h.entry.defs.length) {
        def = h.entry.defs[0].text;
      } else {
        const first = h.entry.meanings?.[0]?.definitions?.[0]?.definition;
        if (first) def = first;
      }
    }
    if (def) li.appendChild(document.createTextNode(` – ${def}`));

    historyList.appendChild(li);
  });
}

clearHistory.addEventListener('click', async () => {
  await browser.storage.local.set({ history: [] });
  historyList.textContent = '';
});

document.addEventListener('DOMContentLoaded', loadOptions);
