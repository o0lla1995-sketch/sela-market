/**
 * money.ts — تنسيق العملة والكميات.
 * الأسعار تصل بالقروش (minor units — 1/100 شيكل) من الخادم وتُعرض
 * بعملة المتجر (شيكل ₪ افتراضياً كما على الخادم: ILS).
 */

/** تحويل القروش إلى شيكل عشري: 3350 → 33.5 */
export function minorToShekels(minor: number): number {
  return Math.round(minor) / 100;
}

/** تنسيق مبلغ للعرض: 3350 → «₪ 33.50» (بدون أرقام عربية — أوضح للأسعار). */
export function formatMoney(minor: number): string {
  const value = minorToShekels(minor);
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `₪ ${formatted}`;
}

/** تنسيق مبلغ دائماً بكسور (للفواتير): 8500 → «₪ 85.00» */
export function formatMoneyExact(minor: number): string {
  return `₪ ${minorToShekels(minor).toFixed(2)}`;
}

/**
 * تنسيق كمية: المنتجات بالوزن تعرض حتى 3 كسور عشرية (1.5 كيلو)،
 * والقطعية أعداد صحيحة. لا نستخدم toFixed الأعمى حتى لا تظهر «2.000».
 */
export function formatQty(qty: number, soldByWeight: boolean): string {
  if (!soldByWeight) {
    return String(Math.round(qty));
  }
  const rounded = Math.round(qty * 1000) / 1000;
  return String(rounded);
}

/** خطوة الزيادة في عدّاد الكمية: وزن = 0.5، قطعة = 1. */
export function qtyStep(soldByWeight: boolean): number {
  return soldByWeight ? 0.5 : 1;
}

/** أدنى كمية: وزن = 0.5، قطعة = 1. */
export function minQty(soldByWeight: boolean): number {
  return soldByWeight ? 0.5 : 1;
}

/** إجمالي سطر بالقروش (تقريب لأقرب قرش كالخادم). */
export function lineTotal(priceMinor: number, qty: number): number {
  return Math.round(priceMinor * qty);
}
