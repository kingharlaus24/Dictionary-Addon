const input = document.getElementById('wordInput');
const btn = document.getElementById('lookupBtn');
const output = document.getElementById('definition');
btn.addEventListener('click', async () => {
  const word = input.value.trim();
  if (!word) return;
  output.textContent = 'Loading...';
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    if (Array.isArray(data) && data[0].meanings) {
      const defs = data[0].meanings[0].definitions
        .map(d => `<p>• ${d.definition}</p>`)
        .join('');
      output.innerHTML = `<h3>${word}</h3>${defs}`;
    } else {
      output.textContent = 'No definition found.';
    }
  } catch (e) {
    output.textContent = 'Error fetching definition.';
  }
});