const { formatJson } = require('../background');

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
      derivs: ['testing']
    });
  });
});
