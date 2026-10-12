/**
 * discount.ts — خصومات منتجات المتجر (خادم 4.5).
 * ─────────────────────────────────────────────────────────────────
 * التاجر يحدد خصماً على منتجه في تطبيق نقطة البيع (0–95%) — يُحسب
 * عند البيع في POS ويُعرض في متجر سيلا. الخادم يرسل final_minor
 * محسوبة؛ هذا الملف يجعل العرض والسلة يستخدمانها بترتيب واحد:
 *   1. final_minor من الخادم (المرجع — نفس تقريب الخادم)
 *   2. وإلا تُحسب محلياً من discount_pct
 *   3. وإلا السعر الأصلي.
 */
import type {CartLine} from './types';

/** أي كائن يحمل السعر — منتج أو سطر سلة بلقطة الخصم. */
interface PriceFields {
  price_minor: number;
  discount_pct?: number;
  final_minor?: number;
}

/** السعر الفعلي بعد الخصم (ما يُدفع). */
export function effectiveMinor(p: PriceFields): number {
  if (p.final_minor != null && p.final_minor > 0) {
    return p.final_minor;
  }
  if (p.discount_pct != null && p.discount_pct > 0) {
    return Math.max(0, Math.round(p.price_minor * (1 - p.discount_pct / 100)));
  }
  return p.price_minor;
}

/** هل لهذا المنتج خصم معروض؟ (لإظهار الشارة والسعر المشطوب) */
export function hasDiscount(p: {price_minor: number; discount_pct?: number; final_minor?: number}): boolean {
  if (p.discount_pct != null && p.discount_pct > 0) {
    return true;
  }
  return p.final_minor != null && p.final_minor < p.price_minor;
}

/** وفورات السطر: الفرق بين السعر قبل وبعد — 0 بلا خصم. */
export function lineSavings(line: Pick<CartLine, 'priceMinor' | 'listPriceMinor' | 'quantity'>): number {
  if (line.listPriceMinor == null || line.listPriceMinor <= line.priceMinor) {
    return 0;
  }
  return Math.max(0, Math.round(line.listPriceMinor * line.quantity) - Math.round(line.priceMinor * line.quantity));
}

/** إجمالي وفورات سلة متجر — لشريط «وفّرت» في السلة والدفع. */
export function cartSavings(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineSavings(l), 0);
}
