/**
 * validation.test.ts — التحقق مطابق حرفياً لقواعد الخادم.
 */
import {
  cleanIdNumber,
  cleanPhone,
  maskIdNumber,
  validateAddress,
  validateIdNumber,
  validateName,
  validatePhone,
} from '../src/core/validation';

describe('validateIdNumber', () => {
  it('accepts exactly 9 digits', () => {
    expect(validateIdNumber('401234567')).toBeNull();
  });
  it('rejects short/long/non-numeric', () => {
    expect(validateIdNumber('40123456')).not.toBeNull();
    expect(validateIdNumber('4012345670')).not.toBeNull();
    expect(validateIdNumber('40123A567')).not.toBeNull();
    expect(validateIdNumber('')).not.toBeNull();
  });
  it('cleans spaces like the server', () => {
    expect(cleanIdNumber(' 401 234 567 ')).toBe('401234567');
    expect(validateIdNumber(' 401 234 567 ')).toBeNull();
  });
});

describe('validateName', () => {
  it('accepts 2-60 chars', () => {
    expect(validateName('أحمد الخطيب')).toBeNull();
    expect(validateName('أب')).toBeNull();
  });
  it('rejects empty/too long', () => {
    expect(validateName('')).not.toBeNull();
    expect(validateName('أ')).not.toBeNull();
    expect(validateName('أ'.repeat(61))).not.toBeNull();
  });
});

describe('validatePhone', () => {
  it('accepts local and international formats', () => {
    expect(validatePhone('0598765432')).toBeNull();
    expect(validatePhone('+972598765432')).toBeNull();
  });
  it('rejects letters and short numbers', () => {
    expect(validatePhone('05987')).not.toBeNull();
    expect(validatePhone('059876543A')).not.toBeNull();
    expect(validatePhone('')).not.toBeNull();
  });
  it('cleans spaces and dashes like the server', () => {
    expect(cleanPhone('059-876 5432')).toBe('0598765432');
    expect(validatePhone('059-876 5432')).toBeNull();
  });
});

describe('maskIdNumber', () => {
  it('hides the middle of the id for display', () => {
    expect(maskIdNumber('401234567')).toBe('40••••567');
    expect(maskIdNumber('12345')).toBe('12••••345');
  });
});

describe('validateAddress', () => {
  it('requires a meaningful address', () => {
    expect(validateAddress('الحي الثاني، بناية 4')).toBeNull();
    expect(validateAddress('ش')).not.toBeNull();
    expect(validateAddress('')).not.toBeNull();
    expect(validateAddress('ك'.repeat(201))).not.toBeNull();
  });
});
