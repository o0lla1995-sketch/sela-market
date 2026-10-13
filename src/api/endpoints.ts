/**
 * endpoints.ts — الواجهات المُغلَّفة بأنواعها (مطابقة لـ market.js v4.1).
 */
import {apiRequest} from './client';
import type {
  Address,
  CategoryCount,
  CrossProduct,
  MarketUser,
  Order,
  Product,
  RateOrderResponse,
  Store,
  StoreDetail,
  StoreRatings,
} from '../core/types';

/* ── عام: المتاجر والمنتجات ─────────────────────────────── */

/**
 * v2.3: إعدادات السوق العامة (لا تتطلب جلسة) — يقرأ منها التطبيق:
 *  • forgotPassword: هل يظهر زر «نسيت كلمة المرور؟» في شاشة الدخول
 *    (يتحكم به المالك من لوحة الإدارة؛ مغيّر افتراضياً).
 *  • contactPhone: رقم تواصل الإدارة (يظهر عند تعطيل الاستعادة:
 *    «تواصل مع الإدارة لاستعادة حسابك»).
 */
export interface MarketConfig {
  forgotPassword: boolean;
  contactPhone: string | null;
}

export async function getMarketConfig(): Promise<MarketConfig> {
  const res = await apiRequest<{
    ok: true;
    forgotPassword: boolean;
    contactPhone: string | null;
  }>('/api/market/config');
  return {
    forgotPassword: res.forgotPassword === true,
    contactPhone: res.contactPhone ?? null,
  };
}

/* ── v2.5: بانِي سلسلة الاستعلام المحلي — السبب الجذري الحقيقي ────
 * ─────────────────────────────────────────────────────────────────
 * محرك Hermes في RN 0.74 لا يوفر URLSearchParams إطلاقاً (متحقق
 * منه من libhermes.so داخل APK: صفر ظهور). كل نداء لمنتجات كان
 * يرمي ReferenceError قبل خروج أي طلب شبكة — لذلك سبع جولات من
 * إصلاحات الخادم (gzip/304/HTTPS/كسر الكاش) لم تغيّر شيئاً:
 * التطبيق لم يرسل طلب منتجات واحداً في حياته. المتاجر/التصنيفات
 * كانت تعمل لأنها بلا معاملات استعلام. encodeURIComponent مضمون
 * في كل محركات JS — نبني به الاستعلام يدوياً ونموت هذا الفصل
 * إلى الأبد. */
function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const parts: string[] = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  return parts.join('&');
}

export interface StoresQuery {
  /** v2.0 (خادم 4.4): متاجر تخدم هذه المنطقة فقط (مرتبة برسم
   *  التوصيل لها تصاعدياً) مع deliveryFeeMinor لكل متجر. */
  region?: string;
}

export async function getStores(query: StoresQuery = {}): Promise<Store[]> {
  // v2.5: buildQuery بدل URLSearchParams (غير موجود في Hermes).
  const qs = buildQuery({region: query.region});
  const res = await apiRequest<{ok: true; stores: Store[]}>(
    `/api/market/stores${qs ? `?${qs}` : ''}`,
  );
  return res.stores;
}

/** v2.0: كل مناطق التوصيل المتاحة عبر المول (تغذي مسجل العنوان). */
export async function getDeliveryRegions(): Promise<string[]> {
  const res = await apiRequest<{ok: true; regions: string[]}>(
    '/api/market/regions',
  );
  return res.regions;
}

export async function getStoreDetail(storeId: number): Promise<StoreDetail> {
  return apiRequest<StoreDetail>(`/api/market/stores/${storeId}`);
}

/** v2.0 (خادم 4.4): مراجعات متجر — متوسط + عدد + أحدث 50 تعليقاً. */
export async function getStoreRatings(storeId: number): Promise<StoreRatings> {
  const res = await apiRequest<{
    ok: true;
    rating: number | null;
    ratingCount: number;
    reviews: StoreRatings['reviews'];
  }>(`/api/market/stores/${storeId}/ratings`);
  return {rating: res.rating, ratingCount: res.ratingCount, reviews: res.reviews};
}

export interface StoreProductsQuery {
  q?: string;
  page?: number;
  per?: number;
  /** v2.1 (خادم 4.5): عروض المتجر — المخفّضة فقط مرتبة بالخصم
   *  الأكبر أولاً (تغذي شريط «عروض المتجر» في صفحة المتجر). */
  offers?: boolean;
}

export async function getStoreProducts(
  storeId: number,
  query: StoreProductsQuery = {},
): Promise<Product[]> {
  // v2.5: buildQuery بدل URLSearchParams (غير موجود في Hermes —
  // كان هذا المسار بالذات سبب اختفاء منتجات المتجر كلياً).
  const qs = buildQuery({
    q: query.q,
    page: query.page,
    per: query.per,
    offers: query.offers === true ? 1 : undefined,
  });
  const res = await apiRequest<{ok: true; products: Product[]}>(
    `/api/market/stores/${storeId}/products${qs ? `?${qs}` : ''}`,
  );
  return res.products;
}

/* ── v2.1: الجلب المتدرج — الإصلاح الجذري الثالث للاختفاء ────
 * ─────────────────────────────────────────────────────────────────
 * الدليل من ثلاث جولات تجربة المستخدم: كل حمولة عملت كانت إطار TCP
 * واحداً (~430B) وكل حمولة فشلت كانت متعددة الأطر (~2KB). السلم:
 * نطلب 12 — إن فشل النداء شبكياً ننزل 6 ثم 3 ثم 1 (يدعم الخادم
 * per=1 منذ 4.5). عند أي نجاح نكمل الصفحات بنفس الحجم حتى العدد
 * المطلوب. الأسوأ النادر: طلبات متتالية ~200B — تحت عتبة العمل
 * المثبتة ميدانياً. */
const PER_LADDER: readonly number[] = [12, 6, 3, 1];

async function fetchAdaptive<T extends {id: number}>(
  want: number,
  fetchPage: (per: number, page: number) => Promise<T[]>,
): Promise<T[]> {
  let lastError: unknown = null;
  for (const per of PER_LADDER) {
    try {
      const items: T[] = [];
      let page = 1;
      // نكمل صفحات بحجم per حتى want أو نهاية الكتالوج
      for (;;) {
        const batch = await fetchPage(per, page);
        if (batch.length === 0) {
          break;
        }
        for (const b of batch) {
          if (!items.some(x => x.id === b.id)) {
            items.push(b);
          }
        }
        if (items.length >= want) {
          break;
        }
        page += 1;
      }
      return items.slice(0, Math.max(1, want));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('adaptive fetch failed');
}

/** منتجات متجر بجلب متدرج — لصفحة المتجر وقسم أحدث المنتجات. */
export async function getStoreProductsAdaptive(
  storeId: number,
  want = 12,
  query: {q?: string; offers?: boolean} = {},
): Promise<Product[]> {
  return fetchAdaptive<Product>(want, (per, page) =>
    getStoreProducts(storeId, {per, page, q: query.q, offers: query.offers}),
  );
}

export interface CrossProductsQuery {
  q?: string;
  category?: string;
  page?: number;
  per?: number;
}

/** بحث عابر للمتاجر + فلتر تصنيف (v4.1 على الخادم). */
export async function getCrossProducts(
  query: CrossProductsQuery = {},
): Promise<CrossProduct[]> {
  // v2.5: buildQuery بدل URLSearchParams (غير موجود في Hermes —
  // هذا المسار يغذي «أحدث المنتجات» في الرئيسية وكان ميتاً كلياً).
  const qs = buildQuery({
    q: query.q,
    category: query.category,
    page: query.page,
    per: query.per,
  });
  const res = await apiRequest<{ok: true; products: CrossProduct[]}>(
    `/api/market/products${qs ? `?${qs}` : ''}`,
  );
  return res.products;
}

/** بحث/تصفح عابر بجلب متدرج — لقسم أحدث المنتجات في الرئيسية. */
export async function getCrossProductsAdaptive(
  want = 12,
  query: {q?: string; category?: string} = {},
): Promise<CrossProduct[]> {
  return fetchAdaptive<CrossProduct>(want, (per, page) =>
    getCrossProducts({per, page, q: query.q, category: query.category}),
  );
}

export async function getCategories(): Promise<CategoryCount[]> {
  const res = await apiRequest<{ok: true; categories: CategoryCount[]}>(
    '/api/market/categories',
  );
  return res.categories;
}

/* ── الحساب ─────────────────────────────────────────────── */

export interface AuthResponse {
  ok: true;
  token: string;
  user: MarketUser;
  /** مسار الترحيل: حساب قديم أنشئ قبل كلمات المرور. */
  mustSetPassword?: boolean;
}

/** v1.1: سياسة كلمة المرور — نفس قواعد الخادم (8+ حرفاً ورقم). */
export function passwordProblem(password: string): string | null {
  if (password == null || password.length < 8 || password.length > 72) {
    return 'كلمة المرور 8 أحرف على الأقل';
  }
  if (!/[0-9]/.test(password) || !/[^0-9]/.test(password)) {
    return 'يجب أن تحتوي رقماً وحرفاً على الأقل';
  }
  return null;
}

/** قوة كلمة المرور للعرض التدريجي في نموذج التسجيل. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) {
    return 0;
  }
  let score = 1;
  if (/[0-9]/.test(password) && /[^0-9]/.test(password)) {
    score = 2;
  }
  if (password.length >= 12 && /[a-zA-Zا-ي]/.test(password) && /[0-9]/.test(password)) {
    score = 3;
  }
  return score as 0 | 1 | 2 | 3;
}

export async function register(input: {
  idNumber: string;
  name: string;
  phone: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/market/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function login(input: {
  idNumber: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/market/auth/login', {
    method: 'POST',
    body: input,
  });
}

/** دخول حساب قديم بلا كلمة مرور (مسار الترحيل — هاتف + هوية). */
export async function legacyLogin(input: {
  idNumber: string;
  phone: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/market/auth/login', {
    method: 'POST',
    body: input,
  });
}

/** تعيين/تغيير كلمة المرور (يتطلب الجلسة؛ التغيير يتطلب الحالية). */
export async function setPassword(token: string, input: {
  password: string;
  currentPassword?: string;
}): Promise<{ok: true}> {
  return apiRequest<{ok: true}>('/api/market/auth/set-password', {
    method: 'POST',
    token,
    body: input,
  });
}

/* ── v2.3: استعادة كلمة المرور برمز SMS (تحت إدارة المالك) ────
 * ─────────────────────────────────────────────────────────────────
 * الاستعادة القديمة (هوية + هاتف ⇒ تغيير فوري) كانت ثغرة: أي شخص
 * يعرف رقم هوية الضحية وجوالها يسرق الحساب. البديل المُدار:
 *  1) getMarketConfig يقرر التطبيق أولاً إن كان الزر يظهر أصلاً.
 *  2) عند التفعيل: طلب رمز → يصل SMS للجوال المسجل فقط.
 *  3) الرمز + كلمة المرور الجديدة → التحقق ثم التغيير وإبطال
 *     كل الجلسات. لا دخول تلقائي بعدها — يسجل الدخول بكلمته
 *     الجديدة (تحقق خطوة ثانية فعلية). */

/** الخطوة 1: طلب رمز التحقق للجوال المسجل في الحساب. */
export async function forgotRequestCode(input: {
  idNumber: string;
  phone: string;
}): Promise<{ok: true; expiresInSeconds: number}> {
  return apiRequest<{ok: true; expiresInSeconds: number}>(
    '/api/market/auth/forgot/request',
    {method: 'POST', body: input},
  );
}

/** الخطوة 2: التحقق بالرمز وتعيين كلمة المرور الجديدة. */
export async function forgotVerifyAndSetPassword(input: {
  idNumber: string;
  phone: string;
  code: string;
  newPassword: string;
}): Promise<{ok: true}> {
  return apiRequest<{ok: true}>('/api/market/auth/forgot/verify', {
    method: 'POST',
    body: input,
  });
}

/** حذف الحساب (سياسة جوجل بلاي) — خادم v4.1+. */
export async function deleteAccount(token: string | null): Promise<{ok: true}> {
  return apiRequest<{ok: true}>('/api/market/auth/delete', {
    method: 'POST',
    token,
  });
}

/* ── الطلبات ────────────────────────────────────────────── */

export interface PlaceOrderInput {
  storeId: number;
  /** v1.2 (خادم 4.3): variant = لقطة الخيار المختار لكل سطر. */
  items: {productId: number; quantity: number; variant?: string | null}[];
  regionName: string;
  address?: string;
  note?: string;
  /** v2.6 (خادم 5.2): مفتاح إيديمبوتنسية يولّده العميل لكل عملية
   * إرسال — إعادة المحاولة بعد موت الشبكة تعيد نفس الطلب بدل
   * إنشاء مكرر (كانت الطلبات تُنشأ على الخادم ويموت ردها في
   * الطريق فيعلن التطبيق الفشل ويكرر المستخدم الضغط ⇒ طلبات
   * مكررة فعلياً لدى التاجر). */
  clientRequestId: string;
}

/** يولّد مفتاح إيديمبوتنسية فريداً لعملية إرسال طلب واحدة. */
export function newOrderRequestId(): string {
  return `ord-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function placeOrder(
  token: string,
  input: PlaceOrderInput,
): Promise<Order> {
  const res = await apiRequest<{ok: true; order: Order}>('/api/market/orders', {
    method: 'POST',
    token,
    body: input,
    // v2.6: إعادة المحاولة على فشل الشبكة آمنة الآن — الخادم
    // يرد نفس الطلب لنفس المفتاح (إيديمبوتنسية). رد POST لا يُعاد
    // عادة لأن الطلب قد ينشأ فعلاً؛ المفتاح يحسم هذا الخطر.
    retryOnNetwork: true,
  });
  return res.order;
}

export async function getMyOrders(token: string): Promise<Order[]> {
  const res = await apiRequest<{ok: true; orders: Order[]}>('/api/market/orders', {
    token,
  });
  return res.orders;
}

export async function cancelOrder(token: string, orderId: number): Promise<Order> {
  const res = await apiRequest<{ok: true; order: Order}>(
    `/api/market/orders/${orderId}/cancel`,
    {method: 'POST', token},
  );
  return res.order;
}

/* ── v2.0: تقييم الطلب بعد الاستلام (خادم 4.4) ───────────── */

export async function rateOrder(
  token: string,
  orderId: number,
  input: {stars: number; comment?: string},
): Promise<RateOrderResponse> {
  return apiRequest<RateOrderResponse>(`/api/market/orders/${orderId}/rate`, {
    method: 'POST',
    token,
    body: input,
  });
}

/* ── v2.0: دفتر عناوين المستخدم (خادم 4.4) ───────────────── */

export async function getMyAddresses(token: string): Promise<Address[]> {
  const res = await apiRequest<{ok: true; addresses: Address[]}>(
    '/api/market/addresses',
    {token},
  );
  return res.addresses;
}

export interface SaveAddressInput {
  /** تعديل عنوان قائم — 0 أو غياب القيمة يعني إضافة جديد. */
  id?: number;
  label: string;
  region: string;
  city?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  phone?: string;
  notes?: string;
  isDefault?: boolean;
}

export async function saveAddress(token: string, input: SaveAddressInput): Promise<Address> {
  const res = await apiRequest<{ok: true; address: Address}>(
    '/api/market/addresses',
    {method: 'POST', token, body: input},
  );
  return res.address;
}

export async function setDefaultAddress(token: string, addressId: number): Promise<Address> {
  const res = await apiRequest<{ok: true; address: Address}>(
    `/api/market/addresses/${addressId}/default`,
    {method: 'POST', token},
  );
  return res.address;
}

export async function deleteAddress(token: string, addressId: number): Promise<void> {
  await apiRequest<{ok: true}>(`/api/market/addresses/${addressId}/delete`, {
    method: 'POST',
    token,
  });
}
