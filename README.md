# Dictionary Lookup

Dictionary Lookup is a Firefox add-on for quickly looking up English definitions from a selected word, the toolbar popup, or a keyboard shortcut. It uses a compact popover inspired by macOS Dictionary while staying within Firefox extension APIs.

Firefox does not expose the same system Dictionary integration that Safari has on macOS, so this add-on fetches definitions from public web APIs instead.

## Features

- Look up selected text from the right-click context menu.
- Use the keyboard shortcut `Ctrl+Shift+Y` to look up the current selection.
- Search directly from the toolbar popup.
- View definitions in a polished in-page popover.
- Save words and review recent lookup history.
- Search History and Saved words from the options/library page.
- Shows whether a result came from Dictionary or Wikipedia fallback.
- No analytics or tracking.

## Data Sources

- Primary definitions: [Free Dictionary API](https://dictionaryapi.dev/)
- Fallback summaries: [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Load the extension temporarily in Firefox:

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on**.
4. Select `manifest.json` from this repository.

## Project Structure

- `manifest.json`: Firefox extension manifest.
- `background.js`: lookup, storage, context menu, shortcut, and message handling.
- `content_script.js`: in-page definition popover.
- `popup.html`, `popup.js`, `styles.css`: toolbar popup UI.
- `options.html`, `options.js`: searchable history and saved-word library.
- `__tests__`: Jest tests and browser API mock.

## License

MIT License.
