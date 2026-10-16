/**
 * share.ts — منظومة المشاركة (v4.0 — الجولة 68).
 * ─────────────────────────────────────────────────────────────────
 * طلب المستخدم بالنص: «صفحة التاجر وصفحة المنتج تفتقر إلى الكثير
 * من المزايا وخصوصاً المشاركة — يمكن للزبون مشاركة منتج وهكذا».
 *
 * تُبنى كل المشاركة على Share.share المدمج في React Native نفسه:
 * صفر مكتبات جديدة، صفر كوتلن، ويعمل مع كل تطبيقات الجوال
 * (واتساب/تيليغرام/الرسائل/بلوتوث…) ويحترم العربية RTL كاملة.
 *
 * النص المشترك رسالة تسويقية مختصرة قابلة للقراءة في أي محادثة:
 * اسم العنصر + سعره (للمنتج) + المتجر + دعوة قصيرة للتطبيق.
 */
import {Share} from 'react-native';
import {formatMoney} from './money';
import {effectiveMinor, hasDiscount} from './discount';
import {STATUS_META} from './orderStatus';
import type {CrossProduct, Order, Product} from './types';

/** توقيع الدعوة الموحّد أسفل كل رسالة مشاركة. */
const SIGNATURE = 'من تطبيق سيلا ماركت — سوّق من مئات المتاجر في مكان واحد';

/** خيار إخفاء شريط أدوات iOS الأنيق (لا يؤثر على أندرويد). */
async function shareMessage(message: string, title: string): Promise<boolean> {
  try {
    const res = await Share.share({message, title});
    return res.action === Share.sharedAction;
  } catch {
    /* المستخدم أغلق ورقة المشاركة أو لا يوجد تطبيق مشاركة — صمت */
    return false;
  }
}

/** مشاركة منتج — السعر بعد الخصم مع الأصلي مشطوباً نصياً. */
export async function shareProduct(
  product: Product | CrossProduct,
  storeName: string,
): Promise<boolean> {
  const lines: string[] = [`${product.name}`];
  const storeLabel =
    storeName || (product as CrossProduct).store_name || 'متجر سيلا';
  lines.push(`من متجر: ${storeLabel}`);
  if (hasDiscount(product)) {
    lines.push(
      `العرض: ${formatMoney(effectiveMinor(product))} بدلاً من ${formatMoney(
        product.price_minor,
      )} (خصم ${Math.round(product.discount_pct ?? 0)}%)`,
    );
  } else {
    lines.push(`السعر: ${formatMoney(product.price_minor)}`);
  }
  lines.push(SIGNATURE);
  return shareMessage(lines.join('\n'), product.name);
}

/** مشاركة متجر — التقييم وعدد المنتجات إن توفرا. */
export async function shareStore(
  store: {
    name: string;
    rating?: number | null;
    region?: string | null;
    store_number?: string | null;
  },
  productsCount?: number,
): Promise<boolean> {
  const lines: string[] = [`متجر ${store.name}`];
  const facts: string[] = [];
  if (store.rating != null && store.rating > 0) {
    facts.push(`تقييم ${store.rating} من 5`);
  }
  if (productsCount != null && productsCount > 0) {
    facts.push(`${productsCount} منتجاً`);
  }
  if (store.region != null && store.region.length > 0) {
    facts.push(`يخدم ${store.region}`);
  }
  if (facts.length > 0) {
    lines.push(facts.join(' · '));
  }
  if (store.store_number != null && store.store_number.length > 0) {
    lines.push(`رقم المتجر: ${store.store_number}`);
  }
  lines.push(SIGNATURE);
  return shareMessage(lines.join('\n'), store.name);
}

/** مشاركة طلب — رقمه وحالته ومتجره وإجماليه (بلا عنوان المنزل!). */
export async function shareOrder(order: Order): Promise<boolean> {
  const storeName = order.store?.name ?? 'المتجر';
  const meta = STATUS_META[order.status];
  const lines: string[] = [
    `طلبي من ${storeName}`,
    `رقم الطلب: ${order.order_number}`,
    `الحالة: ${meta.label}`,
    `الإجمالي مع التوصيل: ${formatMoney(order.total_minor)}`,
    SIGNATURE,
  ];
  return shareMessage(lines.join('\n'), order.order_number);
}
