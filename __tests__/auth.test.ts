/**
 * auth.test.ts — اختبارات v1.1: سياسات كلمة المرور وقوتها.
 * تطابق قواعد الخادم v4.2 حرفياً (8–72 محرفاً + رقم + حرف).
 */
import {
  passwordProblem,
  passwordStrength,
} from '../src/api/endpoints';

describe('سياسة كلمة المرور (مطابقة للخادم)', () => {
  test('أقصر من 8 مرفوضة', () => {
    expect(passwordProblem('abc123')).not.toBeNull();
    expect(passwordProblem('')).not.toBeNull();
  });

  test('أرقام فقط مرفوضة — يجب حرف ورقم', () => {
    expect(passwordProblem('12345678')).not.toBeNull();
  });

  test('حروف فقط مرفوضة', () => {
    expect(passwordProblem('abcdefgh')).not.toBeNull();
  });

  test('حرف + رقم بثمانية محارف مقبولة', () => {
    expect(passwordProblem('sela2024')).toBeNull();
  });

  test('عربية + رقم مقبولة', () => {
    expect(passwordProblem('سيلا2024')).toBeNull();
  });

  test('أطول من 72 مرفوضة', () => {
    expect(passwordProblem('a1'.repeat(40))).not.toBeNull();
  });
});

describe('مؤشر قوة كلمة المرور', () => {
  test('قصيرة = 0', () => {
    expect(passwordStrength('ab1')).toBe(0);
  });

  test('مقبولة فأعلى عند بلوغ 8 محارف', () => {
    expect(passwordStrength('sela2024')).toBeGreaterThanOrEqual(1);
  });

  test('قوية عند 12+ محرفاً بأرقام وحروف', () => {
    expect(passwordStrength('sela-market-2024')).toBe(3);
  });
});
