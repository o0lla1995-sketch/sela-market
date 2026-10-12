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
  /** v2.0 (خادم 4.4): متوسط تقييم المتجر (1–5) أو null قبل أول تقييم. */
  rating?: number | null;
  /** v2.0: عدد التقييمات. */
  ratingCount?: number;
  /** v2.0: رسم التوصيل لمنطقة الاستعلام (?region=) — موجود فقط عند
   *  الفلترة بمنطقة (مقارنة أرخص توصيل لمنطقتك). */
  deliveryFeeMinor?: number;
  /** v2.1 (خادم 4.5): رابط شعار المتجر المرفوع من تطبيق نقطة البيع
   *  (مسار نسبي) — غائب بلا شعار. */
  logo_url?: string | null;
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
  /** v2.1 (خادم 4.5): خصم التاجر على المنتج (0–95) — غائب بلا خصم.
   *  final_minor: السعر بعد الخصم كما يحسبه الخادم (مرجع التسعير). */
  discount_pct?: number;
  final_minor?: number;
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
  /** v2.1 (خادم 4.5): وفورات المشتري من خصومات منتجات هذا الطلب. */
  items_discount_minor?: number;
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
  /** v2.0 (خادم 4.4): تقييم الطلب إن قُيّم — يعرض التطبيق زر
   *  «قيّم المتجر» للطلبات المسلّمة غير المقيّمة. */
  rating?: {stars: number; comment: string | null} | null;
  store: {id: number; name: string; storeNumber?: string; store_number?: string; logo_url?: string | null} | null;
}

/** لقطة متجر داخل السلة/المفضلة (تكفي للعرض والتنقل).
 *  v2.1: logoUrl يمرّر شعار المتجر الحقيقي حيثما توفر. */
export interface StoreRef {
  id: number;
  name: string;
  storeNumber?: string;
  logoUrl?: string | null;
}

/** سطر سلة — لقطة منتج لحظة الإضافة (السعر المرجعي هو الخادم عند الطلب).
 *  v1.2: السطر يتحدد بالمنتج + الخيار المختار — المنتج نفسه
 *  بمقاسين مختلفين سطران مستقلان (key فريدة لكل مزيج).
 *  v2.0: لقطة تصنيف المنتص — تغذي «مقترحات لك» عند إتمام الطلب. */
export interface CartLine {
  /** `${productId}:${variant ?? ''}` — هوية السطر للعمليات. */
  key: string;
  productId: number;
  name: string;
  /** v2.1: السعر بعد الخصم (ما يُدفع فعلاً). */
  priceMinor: number;
  /** v2.1: السعر قبل الخصم — غائب بلا خصم (العرض المشطوب). */
  listPriceMinor?: number;
  unitLabel: string | null;
  soldByWeight: boolean;
  stock: number;
  quantity: number;
  /** لقطة الخيار المختار («المقاس: L · اللون: كحلي») أو null. */
  variant: string | null;
  /** لقطة تصنيف المنتج لحظة الإضافة (تغذي التوصيات). */
  category?: string | null;
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
  /** v2.1: شعار المتجر إن توفر عند الإضافة (لعرضه في السلة). */
  storeLogoUrl?: string | null;
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

/* ═══ v2.0 (خادم 4.4): العناوين والتقييمات ═══ */

/** عنوان محفوظ للمستخدم (GET/POST /api/market/addresses). */
export interface Address {
  id: number;
  user_id: number;
  label: string;
  region: string;
  city: string | null;
  street: string | null;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  phone: string | null;
  notes: string | null;
  is_default: number;
  created_at: number;
  updated_at: number;
}

/** يبني سطر عنوان واحد قابل للقراءة («غزة — النصر، بناية 12، ط 3، ش 5»). */
export function addressLine(a: Address): string {
  const parts = [a.city, a.street].filter(p => p != null && p.length > 0);
  const tail = [a.building, a.floor, a.apartment]
    .filter(p => p != null && p.length > 0)
    .join(' · ');
  const head = parts.length > 0 ? parts.join('، ') : a.region;
  return tail.length > 0 ? `${head}، ${tail}` : head;
}

/** مراجعة متجر (GET /api/market/stores/:id/ratings). */
export interface StoreReview {
  stars: number;
  comment: string | null;
  createdAt: number;
  userName: string;
}

/** ملخص تقييم متجر — متوسط + مراجعات. */
export interface StoreRatings {
  rating: number | null;
  ratingCount: number;
  reviews: StoreReview[];
}

/** رد تقييم طلب (POST /api/market/orders/:id/rate). */
export interface RateOrderResponse {
  ok: true;
  rating: {stars: number; comment: string | null};
  storeRating: {rating: number | null; ratingCount: number};
}
