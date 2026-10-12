/**
 * validation.ts — تحقق مطابق حرفياً لقواعد الخادم (src/market.js)
 * حتى يرى المستخدم الخطأ قبل إرسال الطلب لا بعده.
 */

/** رقم الهوية: 9 أرقام بالضبط (بعد إزالة الفراغات). */
export function cleanIdNumber(raw: string): string {
  return String(raw ?? '').replace(/\s+/g, '');
}

export function validateIdNumber(raw: string): string | null {
  const id = cleanIdNumber(raw);
  if (!/^\d{9}$/.test(id)) {
    return 'رقم الهوية يجب أن يكون 9 أرقام';
  }
  return null;
}

/** الاسم: 2–60 حرفاً بعد التقليم. */
export function validateName(raw: string): string | null {
  const name = String(raw ?? '').trim();
  if (name.length < 2 || name.length > 60) {
    return 'أدخل الاسم الكامل (حرفان على الأقل)';
  }
  return null;
}

/** الجوال: اختياري + ثم 9–15 رقماً (تُشال الفراغات والشرطات). */
export function cleanPhone(raw: string): string {
  return String(raw ?? '').replace(/[\s-]/g, '');
}

export function validatePhone(raw: string): string | null {
  const phone = cleanPhone(raw);
  if (!/^\+?\d{9,15}$/.test(phone)) {
    return 'رقم الجوال غير صالح (مثال: 0598765432)';
  }
  return null;
}

/** إخفاء معظم رقم الهوية في الواجهة: 401234567 → 40••••567 */
export function maskIdNumber(id: string): string {
  if (id.length < 5) {
    return id;
  }
  return `${id.slice(0, 2)}••••${id.slice(-3)}`;
}

/** فحص سريع لعنوان التوصيل (الخادم يقبل حتى 200 حرف). */
export function validateAddress(raw: string): string | null {
  const address = String(raw ?? '').trim();
  if (address.length < 4) {
    return 'أدخل عنواناً أوضح (الحي/الشارع ورقم البناية)';
  }
  if (address.length > 200) {
    return 'العنوان طويل جداً (200 حرف كحد أقصى)';
  }
  return null;
}
