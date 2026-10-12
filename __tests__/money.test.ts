/**
 * money.test.ts — تنسيق العملة والكميات والأسطر.
 */
import {
  formatMoney,
  formatMoneyExact,
  formatQty,
  lineTotal,
  minorToShekels,
  minQty,
  qtyStep,
} from '../src/core/money';

describe('minorToShekels', () => {
  it('converts minor units to shekels', () => {
    expect(minorToShekels(3350)).toBe(33.5);
    expect(minorToShekels(8500)).toBe(85);
    expect(minorToShekels(0)).toBe(0);
    expect(minorToShekels(1)).toBe(0.01);
  });
});

describe('formatMoney', () => {
  it('formats whole amounts without decimals', () => {
    expect(formatMoney(8500)).toBe('₪ 85');
  });
  it('keeps two decimals for fractions', () => {
    expect(formatMoney(3350)).toBe('₪ 33.50');
    expect(formatMoney(3355)).toBe('₪ 33.55');
  });
  it('never shows scientific notation', () => {
    expect(formatMoney(1)).toBe('₪ 0.01');
  });
});

describe('formatMoneyExact', () => {
  it('always shows two decimals (invoices)', () => {
    expect(formatMoneyExact(8500)).toBe('₪ 85.00');
    expect(formatMoneyExact(3355)).toBe('₪ 33.55');
  });
});

describe('formatQty', () => {
  it('integer quantities for piece products', () => {
    expect(formatQty(3, false)).toBe('3');
  });
  it('fractional quantities survive for weight products', () => {
    expect(formatQty(1.5, true)).toBe('1.5');
    expect(formatQty(0.5, true)).toBe('0.5');
    expect(formatQty(2, true)).toBe('2');
  });
});

describe('qty steps (weight = half kilos)', () => {
  it('steps and minimums match the checkout UX', () => {
    expect(qtyStep(false)).toBe(1);
    expect(qtyStep(true)).toBe(0.5);
    expect(minQty(false)).toBe(1);
    expect(minQty(true)).toBe(0.5);
  });
});

describe('lineTotal', () => {
  it('rounds to whole minor units like the server', () => {
    expect(lineTotal(3350, 2)).toBe(6700);
    expect(lineTotal(400, 1.5)).toBe(600);
    // 33.33 × 3 = 99.99 → exact
    expect(lineTotal(3333, 3)).toBe(9999);
  });
});
