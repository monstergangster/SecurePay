const { escapeCsvCell } = require('../utils/csv');

describe('CSV cell escaping', () => {
  it('quotes cells and escapes embedded quotes', () => {
    expect(escapeCsvCell('Merchant, "North"')).toBe('"Merchant, ""North"""');
  });

  it('neutralizes spreadsheet formula prefixes in user-controlled strings', () => {
    for (const value of ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)', '  =1+1']) {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    }
  });

  it('quotes negative numeric values without treating them as user formulas', () => {
    expect(escapeCsvCell(-10)).toBe('"-10"');
  });
});
