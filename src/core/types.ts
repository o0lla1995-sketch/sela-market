/**
 * types.ts — أنواع بيانات منصة سيلا ماركت (مطابقة حرفياً لأشكال
 * استجابات sela-license-server v4.1 — انظر src/market.js على الخادم).
 */

/** متجر منشور (GET /api/market/stores). */
export interface Store {
  id: number;
  store_number: string;
  name: string;
  description: string | null;
  category: string | null;
  region: string | null;
  phone: string | null;
  whatsapp: string | null;
}

/** منطقة توصيل مع رسمها (بالقروش — minor units). */
export interface DeliveryRegion {
  name: string;
  fee_minor: number;
  enabled: number;
  sort_order: number;
}

/** تفاصيل متجر (GET /api/market/stores/:id). */
export interface StoreDetail {
  store: Store;
  deliveryRegions: DeliveryRegion[];
}

/** مجموعة خيارات شراء لمنتج (مقاسات/ألوان…) — يحددها التاجر
 * في نقطة البيع وتُزامَن مع الخادم (v4.3). */
export interface ProductOptionGroup {
  name: string;
  values: string[];
}

/** منتج داخل متجر (GET /api/market/stores/:id/products). */
export interface Product {
  id: number;
  product_ref: string;
  name: string;
  category: string | null;
  price_minor: number;
  stock: number;
  barcode: string | null;
  sold_by_weight: number;
  unit_label: string | null;
  description: string | null;
  store_id: number;
  /** v1.1: روابط صور المنتج (مسارات نسبية على الخادم — تُسكب مع
   *  عنوان الخادم عند العرض). صور التسجيل البصري بزواياها الثلاث. */
  images?: string[];
  /** v1.2 (خادم 4.3): مجموعات خيارات الشراء (مقاس/لون…) —
   *  تُبنى من متغيرات الملابس في نقطة البيع. null = بلا خيارات. */
  options?: ProductOptionGroup[] | null;
}

/** منتج عابر للمتاجر (GET /api/market/products) — يضيف معلومات المتجر. */
export interface CrossProduct extends Product {
  store_name: string;
  store_number: string;
}

/** تصنيف مجمّع (GET /api/market/categories). */
export interface CategoryCount {
  category: string;
  n: number;
}

/** مستخدم المتجر (رد التسجيل/الدخول). */
export interface MarketUser {
  name: string;
  idNumber: string;
}

/** رد الدخول — may carry mustSetPassword when a legacy account
 * (created before passwords) logs in via the migration path. */
export interface AuthResponse {
  ok: true;
  token: string;
  user: MarketUser;
  mustSetPassword?: boolean;
}

/** سطر طلب كما يخزنه الخادم. */
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_ref: string | null;
  product_name: string;
  /** v1.2 (خادم 4.3): لقطة الخيار المختار وقت الشراء
   *  (مثال: «المقاس: L · اللون: كحلي») — null = بلا خيارات. */
  variant?: string | null;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
}

/** حالة الطلب — دورة الحياة الكاملة على الخادم. */
export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'rejected'
  | 'cancelled'
  | 'returned';

/** طلب كامل (GET /api/market/orders). */
export interface Order {
  id: number;
  order_number: string;
  store_id: number;
  user_id: number;
  status: OrderStatus;
  region_name: string | null;
  address: string | null;
  note: string | null;
  delivery_fee_minor: number;
  items_total_minor: number;
  total_minor: number;
  returned_minor: number;
  invoice_ref: string | null;
  reject_reason: string | null;
  cancel_reason: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
  accepted_at: number | null;
  sent_at: number | null;
  delivered_at: number | null;
  cancelled_at: number | null;
  items: OrderItem[];
  store: {id: number; name: string; storeNumber?: string; store_number?: string} | null;
}

/** لقطة متجر داخل السلة/المفضلة (تكفي للعرض والتنقل). */
export interface StoreRef {
  id: number;
  name: string;
  storeNumber?: string;
}

/** سطر سلة — لقطة منتج لحظة الإضافة (السعر المرجعي هو الخادم عند الطلب).
 *  v1.2: السطر يتحدد بالمنتج + الخيار المختار — المنتج نفسه
 *  بمقاسين مختلفين سطران مستقلان (key فريدة لكل مزيج). */
export interface CartLine {
  /** `${productId}:${variant ?? ''}` — هوية السطر للعمليات. */
  key: string;
  productId: number;
  name: string;
  priceMinor: number;
  unitLabel: string | null;
  soldByWeight: boolean;
  stock: number;
  quantity: number;
  /** لقطة الخيار المختار («المقاس: L · اللون: كحلي») أو null. */
  variant: string | null;
}

/** مفتاح سطر السلة — مزيج المنتج والخيار المختار. */
export function lineKeyOf(productId: number, variant: string | null): string {
  return `${productId}:${variant ?? ''}`;
}

/** يبني نص لقطة الخيار من مجموعة الخيارات واختيارات المستخدم. */
export function variantTextOf(
  groups: ProductOptionGroup[] | null | undefined,
  selection: Record<string, string>,
): string | null {
  if (groups == null || groups.length === 0) {
    return null;
  }
  const parts: string[] = [];
  for (const g of groups) {
    const value = selection[g.name];
    if (value != null && value.length > 0) {
      parts.push(`${g.name}: ${value}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** هل اكتمل اختيار كل مجموعات الخيارات؟ (لا الإضافة قبلها) */
export function optionsComplete(
  groups: ProductOptionGroup[] | null | undefined,
  selection: Record<string, string>,
): boolean {
  if (groups == null || groups.length === 0) {
    return true;
  }
  return groups.every(g => selection[g.name] != null && selection[g.name].length > 0);
}

/** سلة متجر واحد — طلب منفصل لكل متجر (قرار معماري مثبت). */
export interface CartStoreEntry {
  storeId: number;
  storeName: string;
  storeNumber: string;
  lines: CartLine[];
  updatedAt: number;
}

/** منتج محفوظ في المفضلة مع متجره. */
export interface WishlistEntry {
  product: Product;
  storeName: string;
  savedAt: number;
}

/** عنصر في مركز الإشعارات داخل التطبيق. */
export interface AppNotification {
  id: string;
  kind: 'order' | 'info';
  title: string;
  body: string;
  ts: number;
  read: boolean;
}

/** وضع المظهر (المود): فاتح / داكن / حسب النظام. */
export type ThemeMode = 'light' | 'dark' | 'system';
