import { centsToRands, formatMoney, formatMoneyShort, hoursText, plural, randsToCents, timeAgo } from './format';

describe('money formatting', () => {
  it('formats cents as rands with two decimals', () => {
    expect(formatMoney(1899)).toBe('R\u00a018.99');
    expect(formatMoney(0)).toBe('R\u00a00.00');
    expect(formatMoney(5)).toBe('R\u00a00.05');
  });

  it('groups thousands', () => {
    expect(formatMoney(123456789)).toBe('R\u00a01\u00a0234\u00a0567.89');
  });

  it('rounds chart labels to whole rands', () => {
    expect(formatMoneyShort(51950)).toBe('R\u00a0520');
  });

  it('parses what a person types into cents without floating point drift', () => {
    expect(randsToCents('18.99')).toBe(1899);
    expect(randsToCents('18,5')).toBe(1850);
    expect(randsToCents(' 20 ')).toBe(2000);
    expect(randsToCents('0.29')).toBe(29);
    expect(randsToCents('1.005')).toBeNull();
    expect(randsToCents('abc')).toBeNull();
    expect(randsToCents('-5')).toBeNull();
    expect(randsToCents('')).toBeNull();
  });

  it('round-trips cents and rands', () => {
    expect(centsToRands(1899)).toBe('18.99');
    expect(randsToCents(centsToRands(2549))).toBe(2549);
  });
});

describe('text helpers', () => {
  it('describes opening hours', () => {
    expect(hoursText({ closed: false, open: '07:00', close: '19:00' })).toBe('07:00 to 19:00');
    expect(hoursText({ closed: true, open: null, close: null })).toBe('Closed');
  });

  it('says how long ago something happened', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(timeAgo('2026-11-23T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-11-23T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-23T10:00:00Z', now)).toBe('2 hours ago');
    expect(timeAgo('2026-11-21T12:00:00Z', now)).toBe('2 days ago');
  });

  it('pluralises', () => {
    expect(plural(1, 'sale')).toBe('1 sale');
    expect(plural(3, 'sale')).toBe('3 sales');
  });
});
