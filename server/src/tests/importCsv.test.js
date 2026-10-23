const { normalizeImportHeader, REQUIRED_FIELDS } = require('../utils/importCsv');

describe('CSV import headers', () => {
  it('maps headers regardless of case, whitespace, or underscores', () => {
    expect([
      'TRANSACTION_ID',
      ' Customer ID ',
      'AMOUNT',
      'Currency',
      ' time_stamp ',
    ].map(normalizeImportHeader)).toEqual(REQUIRED_FIELDS);
  });

  it('removes a UTF-8 BOM from the first header', () => {
    expect(normalizeImportHeader('\uFEFFtransactionId')).toBe('transactionId');
  });

  it('preserves optional header names after trimming', () => {
    expect(normalizeImportHeader(' merchantCategory ')).toBe('merchantCategory');
  });
});
