/**
 * recommend.ts — محرك التوصيات الذكية للمنتجات المشابهة (v2.8).
 * ─────────────────────────────────────────────────────────────────
 * طلب التاجر بالنص: «في صفحة المنتج يقترح على المستخدم منتجات
 * أخرى مشابهة بشكل ذكي واحترافي». درسنا كيف ترتب الأنظمة العالمية
 * (أمازون «منتجات ذات صلة»، نون «منتجات مشابهة»، طلبات «قد يعجبك»)
 * توصياتها: إشارات متعددة تُدمج في درجة واحدة، لا فلتراً واحداً.
 *
 * الإشارات المدمجة هنا (كلها محلية — بلا خادم توصيات):
 *  1. نفس التصنيف +100 — أقوى إشارة شرائية.
 *  2. متوفر +25 / نافد −60 — التوصية بنافد تجربة سيئة عالمياً.
 *  3. قرب السعر حتى +22 — مشاهد هاتف بـ 2000₪ لا يُقترح له شاحن
 *     بـ 20₪؛ قرب السعر يعني نفس قرار الشراء تقريباً.
 *  4. خصم نشط +14 — عامل ترويجي (يرفع التحويل كما في المتاجر
 *     العالمية التي تدفع العروض للتوصيات).
 *  5. وزن اهتمام المستخدم بالتصنيف حتى +12 — من interestStore
 *     (مشاهدة=1، مفضلة=3، طلب=6، بتلاشي أسبوعين).
 *  6. تشابه اسم (كلمات مشتركة) حتى +18 — شبكة الأمان للمنتجات
 *     بلا تصنيف (مثل «حليب كريم كيوري» ← «جبنة كيوري»).
 *
 * سياسة التعبئة: المشابهة أولاً؛ إن قلّت عن الحد نكمل من نفس
 * المتجر (متوفّرة ثم المخفّضة) — لا قسم فارغ أبداً ما دام في
 * المتجر منتجات سواها.
 */
import type {Product} from './types';

/** حدود محرك التوصيات — ثوابت قابلة للضبط والاختبار. */
export const RECOMMEND_LIMIT = 6;
/** أقل عدد مشابهات قبل التعبئة من بقية المتجر. */
export const RECOMMEND_FILL_THRESHOLD = 4;

export interface RecommendContext {
  /** المنتج الحالي الذي تعرض صفحته. */
  current: Pick<
    Product,
    'id' | 'name' | 'category' | 'price_minor' | 'discount_pct' | 'stock'
  >;
  /** أوزان اهتمام المستخدم (تصنيف → وزن) من interestStore. */
  categoryWeights?: Record<string, number>;
  /** حد القرب السعري المعقول (قروش) — خارجَه تضعف الإشارة. */
  priceBandMinor?: number;
}

/** كلمات الاسم الدالة — حروف عربية/لاتينية من كلمتين فأكثر. */
function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .split(/[\s\u060C،/()-]+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3),
  );
}

function nameOverlapScore(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) {
    return 0;
  }
  let shared = 0;
  tb.forEach(t => {
    if (ta.has(t)) {
      shared += 1;
    }
  });
  const overlap = shared / Math.min(ta.size, tb.size);
  return Math.round(overlap * 18);
}

function priceProximityScore(
  candidatePrice: number,
  currentPrice: number,
  band: number,
): number {
  if (!Number.isFinite(candidatePrice) || !Number.isFinite(currentPrice)) {
    return 0;
  }
  const diff = Math.abs(candidatePrice - currentPrice);
  if (diff <= band * 0.25) {
    return 22;
  }
  if (diff <= band * 0.5) {
    return 16;
  }
  if (diff <= band) {
    return 9;
  }
  if (diff <= band * 2) {
    return 3;
  }
  return 0;
}

/** هل المنتج متوفر للشراء الآن؟ */
function inStock(p: {stock: number}): boolean {
  return Number.isFinite(p.stock) && p.stock > 0;
}

/** درجة ترشيح منتج واحد مقابل المنتج الحالي — أعلى = أنسب. */
export function recommendationScore(
  candidate: Pick<
    Product,
    'id' | 'name' | 'category' | 'price_minor' | 'discount_pct' | 'stock'
  >,
  ctx: RecommendContext,
): number {
  if (candidate.id === ctx.current.id) {
    return -Infinity;
  }
  let score = 0;
  /* 1) نفس التصنيف — الإشارة الأقوى. */
  const sameCategory =
    ctx.current.category != null &&
    candidate.category != null &&
    candidate.category === ctx.current.category;
  if (sameCategory) {
    score += 100;
  }
  /* 2) التوفر — النافد يهبط للقاع ولا يظهر إلا مضطرين. */
  score += inStock(candidate) ? 25 : -60;
  /* 3) قرب السعر. */
  const band =
    ctx.priceBandMinor ??
    Math.max(2000, Math.round(ctx.current.price_minor * 0.6));
  score += priceProximityScore(candidate.price_minor, ctx.current.price_minor, band);
  /* 4) خصم نشط — عامل ترويجي. */
  if (Number.isFinite(candidate.discount_pct) && (candidate.discount_pct ?? 0) > 0) {
    score += 14;
  }
  /* 5) وزن اهتمام المستخدم بتصنيف المرشح. */
  const weight =
    candidate.category != null ? (ctx.categoryWeights ?? {})[candidate.category] : 0;
  if (Number.isFinite(weight) && weight > 0) {
    score += Math.min(12, Math.round(weight));
  }
  /* 6) تشابه الاسم — شبكة أمان بلا تصنيف. */
  if (!sameCategory) {
    score += nameOverlapScore(candidate.name, ctx.current.name);
  }
  return score;
}

type Recommendable = Pick<
  Product,
  'id' | 'name' | 'category' | 'price_minor' | 'discount_pct' | 'stock'
>;

/**
 * الترشيح الرئيسي: يرتب منتجات المتجر حسب قربها من المنتج الحالي.
 * المرشحون عادة من نفس المتجر (طلب صفحة منتج داخل متجر)؛ لا مانع
 * من تمرير منتجات مول كاملة — الخوارزمية عامة.
 */
export function recommendSimilar<T extends Recommendable>(
  candidates: T[],
  ctx: RecommendContext,
  limit: number = RECOMMEND_LIMIT,
): T[] {
  /* سياسة النفاد: المتوفر أولاً دائماً؛ النافد لا يدخل إلا إن لم
   * يكفِ المتوفر لملء القسم — قائمة واحدة مرتبة ثم اقتصاص. */
  const ranked = candidates
    .filter(c => c.id !== ctx.current.id)
    .sort((a, b) => recommendationScore(b, ctx) - recommendationScore(a, ctx));
  const available = ranked.filter(c => inStock(c));
  const unavailable = ranked.filter(c => !inStock(c));
  /* التعبئة الذكية: إن قلّت المتوفرة عن العتبة نكمل من النافد
   * (النتيجة مرتبة أصلاً فالأفضل أولاً داخل كل مجموعة). */
  const fillable =
    available.length >= RECOMMEND_FILL_THRESHOLD
      ? available
      : [...available, ...unavailable];
  return fillable.slice(0, limit);
}
