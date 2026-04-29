require('./browser-mock');
const {
  formatJson,
  normalizeSelection,
  removeStoredItem,
  saveHistoryEntry,
  toggleFavorite
} = require('../background');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('formatJson', () => {
  it('formats API response into simplified object', () => {
    const sample = {
      word: 'test',
      phonetics: [{ text: 't\u025bst' }],
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [
            { definition: 'a procedure', example: 'a test case' }
          ]
        }
      ],
      derivatives: ['testing']
    };

    const result = formatJson(sample);
    expect(result).toEqual({
      word: 'test',
      phonetic: '/t\u025bst/',
      pos: 'noun',
      defs: [{ text: 'a procedure', example: 'a test case' }],
      derivs: ['testing'],
      source: 'Dictionary'
    });
  });
});

describe('normalizeSelection', () => {
  it('trims and collapses whitespace from selected text', () => {
    expect(normalizeSelection('  hello\n  world  ')).toBe('hello world');
  });

  it('uses the first word from a long selection', () => {
    expect(normalizeSelection('The quick brown fox jumps')).toBe('The');
  });

  it('removes surrounding punctuation from a single selected word', () => {
    expect(normalizeSelection('“testing,”')).toBe('testing');
  });
});

describe('history storage', () => {
  it('caps history at 100 items', async () => {
    const existingHistory = Array.from({ length: 100 }, (_, index) => ({
      word: `word-${index}`,
      entry: { word: `word-${index}` },
      ts: index
    }));
    browser.storage.local.get.mockResolvedValue({ history: existingHistory });

    await saveHistoryEntry('new-word', { word: 'new-word' });

    const saved = browser.storage.local.set.mock.calls[0][0].history;
    expect(saved).toHaveLength(100);
    expect(saved[0].word).toBe('new-word');
    expect(saved[99].word).toBe('word-98');
  });

  it('removes a stored item by timestamp', async () => {
    browser.storage.local.get.mockResolvedValue({
      history: [
        { word: 'keep', ts: 1 },
        { word: 'remove', ts: 2 }
      ]
    });

    await removeStoredItem('history', 2);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      history: [{ word: 'keep', ts: 1 }]
    });
  });
});

describe('favorite storage', () => {
  it('adds a favorite when the word is not saved', async () => {
    browser.storage.local.get.mockResolvedValue({ favorites: [] });

    const result = await toggleFavorite({ word: 'test', defs: [] });

    expect(result).toEqual({ ok: true, saved: true });
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      favorites: [
        expect.objectContaining({
          word: 'test',
          entry: expect.objectContaining({ word: 'test', saved: true })
        })
      ]
    });
  });

  it('removes a favorite when the word is already saved', async () => {
    browser.storage.local.get.mockResolvedValue({
      favorites: [
        { word: 'Test', entry: { word: 'Test' }, ts: 1 },
        { word: 'other', entry: { word: 'other' }, ts: 2 }
      ]
    });

    const result = await toggleFavorite({ word: 'test', defs: [] });

    expect(result).toEqual({ ok: true, saved: false });
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      favorites: [{ word: 'other', entry: { word: 'other' }, ts: 2 }]
    });
  });
});
