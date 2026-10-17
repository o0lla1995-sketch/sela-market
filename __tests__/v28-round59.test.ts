/**
 * v28-round59.test.ts — الجولة 59 (التجربة ١٢ للتاجر): منطق الشراء
 * العالمي + سقف المخزون + التوصيات الذكية.
 * ─────────────────────────────────────────────────────────────────
 * طلبات التاجر بالنص:
 *  ① «لا أريد الطلب من زر إضافة في بطاقة المنتج» — البطاقة تفتح
 *     صفحة المنتج فقط (كما أمازون/نون)، وشارة «في السلة» معلوماتية.
 *  ② «إتمام الطلب مباشرة دون صفحة وسيطة» — السلة تكمل الطلب كاملاً
 *     (أصناف + عنوان + توصيل + ملخص + زر واحد) والشاشة الوسيطة
 *     اختفت من التنقل.
 *  ③ «بما أن كمية المنتج معروفة لماذا يستطيع طلب أكبر منها؟» —
 *     سقف المخزون في العدّاد والمخزن والخادم (5.4).
 *  ④ «يقترح منتجات مشابهة بشكل ذكي واحترافي» — محرك توصيات
 *     متعدد الإشارات (تصنيف/توفر/سعر/خصم/اهتمام/اسم).
 *  ⑤ أزرار مدمجة (44/36) — «الزر كبير جداً».
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (rel: string): string =>
  fs.readFileSync(path.join(root, rel), 'utf8');

/* ── محرك التوصيات: اختبار منطقي فعلي لا نصي ─────────────────── */
import {
  recommendSimilar,
  recommendationScore,
  RECOMMEND_LIMIT,
} from '../src/core/recommend';

describe('الجولة 59 — v2.8.0: منطق الشراء العالمي وسقف المخزون', () => {
  test('① بطاقة المنتج: بلا زر إضافة — تفتح صفحة المنتج فقط', () => {
    const card = read('src/components/ProductCard.tsx');
    // لا عدّاد ولا زر إضافة في البطاقة.
    expect(card).not.toContain('QtyStepper');
    expect(card).not.toContain('addBtn');
    // الشارة المعلوماتية «في السلة» موجودة بدلهما.
    expect(card).toContain('في السلة');
    // إحالة بصرية لفتح صفحة المنتج — سهم «‹» (v3.2).
    expect(card).toContain('chevronLeft');
    // المتجر لا يزال يرى شارات الخصم والنفاد.
    expect(card).toContain('نفدت');
    expect(card).toContain('بقي القليل');
  });

  test('② السلة تكمل الطلب مباشرة — الشاشة الوسيطة حُذفت من التنقل', () => {
    const nav = read('src/navigation/RootNavigator.tsx');
    expect(nav).not.toContain("name=\"Checkout\"");
    expect(nav).not.toContain('CheckoutScreen');
    const cart = read('src/screens/cart/CartScreen.tsx');
    // عناصر الشراء الثلاثة داخل السلة نفسها.
    expect(cart).toContain('عنوان التسليم');
    expect(cart).toContain('منطقة التوصيل') ||
      expect(cart).toContain('التوصيل');
    // زر الإتمام يحمل الإجمالي — لمسة واحدة.
    expect(cart).toContain('إتمام الطلب —');
    // الذكاء: العنوان الافتراضي يُختار تلقائياً.
    expect(cart).toContain('is_default === 1');
    // الذكاء: منطقة العنوان تطابق منطقة التوصيل تلقائياً.
    expect(cart).toContain('addressRegionHint');
  });

  test('③ سقف المخزون: العدّاد يتوقف عند المتاح (الواجهة)', () => {
    const ui = read('src/components/ui.tsx');
    // QtyStepper يقبل حداً أقصى ويعرض «الحد الأقصى» عنده.
    expect(ui).toMatch(/max\?: number/);
    expect(ui).toContain('الحد الأقصى');
    // الزيادة معطلة عند السقف.
    expect(ui).toContain('onPress={atMax ? undefined : onIncrease}');
    const screen = read('src/screens/product/ProductScreen.tsx');
    // maxQty من المخزون نفسه (كسور الكيلو محفوظة).
    expect(screen).toContain('Math.floor(product.stock * 1000) / 1000');
    // العدّادان (قبل وبعد الإضافة) مقيدان بالسقف.
    expect(screen.match(/max=\{maxQty\}/g)?.length).toBe(2);
    // النص يخبر بالمتوفر.
    expect(screen).toContain('المتاح');
    const store = read('src/stores/cartStore.ts');
    // المخزن نفسه يقص أي زيادة (add/setQuantity/increment).
    expect(store).toContain('capAtStock');
    expect(store).toContain('stockCapOf');
    // منتج نفد لا يدخل السلة أصلاً.
    expect(store).toContain('capped <= 0');
  });

  test('③b أخطاء الخادم الصريحة تصل المستخدم برسائل مفهومة', () => {
    const client = read('src/api/client.ts');
    expect(client).toContain("'INSUFFICIENT_STOCK'");
    expect(client).toContain("'PRODUCT_UNAVAILABLE'");
    const cart = read('src/screens/cart/CartScreen.tsx');
    // السلة تعرض اسم المنتج والمتاح في صف التحذير.
    expect(cart).toContain("e.code === 'INSUFFICIENT_STOCK'");
    expect(cart).toContain('productName');
    expect(cart).toContain('المتاح الآن');
  });

  test('④ التوصيات الذكية: منطق الترتيب الفعلي', () => {
    const current = {
      id: 1, name: 'حليب كيوري كامل الدسم', category: 'ألبان',
      price_minor: 800, discount_pct: 0, stock: 10,
    };
    const sameCatInStock = {
      id: 2, name: 'لبن كيوري', category: 'ألبان',
      price_minor: 750, discount_pct: 0, stock: 8,
    };
    const sameCatPricey = {
      id: 3, name: 'جبنة بيضاء مستوردة', category: 'ألبان',
      price_minor: 45000, discount_pct: 0, stock: 5,
    };
    const outOfStockCat = {
      id: 4, name: 'حليب مجفف', category: 'ألبان',
      price_minor: 900, discount_pct: 0, stock: 0,
    };
    const otherCat = {
      id: 5, name: 'منظف أرضيات', category: 'منظفات',
      price_minor: 700, discount_pct: 0, stock: 9,
    };
    /* المشابه نفس التصنيف المتوفر القريب سعراً يتصدر. */
    const ranked = recommendSimilar(
      [otherCat, outOfStockCat, sameCatPricey, sameCatInStock],
      {current},
    );
    expect(ranked[0].id).toBe(sameCatInStock.id);
    /* النافد يهبط تحت المتوفر مهما كان تصنيفه. */
    expect(ranked.indexOf(outOfStockCat)).toBeGreaterThan(
      ranked.indexOf(sameCatPricey),
    );
    /* النتيجة لا تتجاوز الحد. */
    expect(ranked.length).toBeLessThanOrEqual(RECOMMEND_LIMIT);
    /* المنتج الحالي لا يوصَّف بنفسه أبداً. */
    expect(recommendSimilar([current], {current})).toHaveLength(0);
    /* تشابه الاسم يعمل بلا تصنيف (شبكة الأمان). */
    const noCat = recommendSimilar(
      [{id: 9, name: 'حليب كيوري نصف دسم', category: null as unknown as string,
        price_minor: 780, discount_pct: 0, stock: 4}],
      {current: {...current, category: null}},
    );
    expect(noCat).toHaveLength(1);
  });

  test('④b صفحة المنتج: قسم التوصيات + سبب مقروء', () => {
    const screen = read('src/screens/product/ProductScreen.tsx');
    expect(screen).toContain('recommendSimilar');
    expect(screen).toContain('منتجات مشابهة قد تعجبك');
    // سبب التوصية يُشرح للمستخدم كما المتاجر العالمية.
    expect(screen).toContain('similarReason');
    expect(screen).toContain('من نفس التصنيف');
    // أوزان اهتمام المستخدم الحقيقية تغذي الترتيب.
    expect(screen).toContain('categoryWeights()');
    // interestStore يوفر الأوزان المتلاشية.
    const interest = read('src/stores/interestStore.ts');
    expect(interest).toContain('categoryWeights');
  });

  test('⑤ أزرار مدمجة: 44px للأساسي و36px للصغير', () => {
    const ui = read('src/components/ui.tsx');
    expect(ui).toContain('const height = small ? 36 : 44;');
  });

  test('⑥ الإصدار: محدّث في الجولة 62 (3.2.0)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '4.2.0'");
    expect(config).toContain('APP_BUILD_CODE = 24');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 24');
    expect(gradle).toContain('versionName "4.2.0"');
  });

  test('⑦ المفضلة تتسق مع المنطق الجديد: زر واحد يفتح صفحة المنتج', () => {
    const wish = read('src/screens/wishlist/WishlistScreen.tsx');
    expect(wish).toContain('اطلب من صفحة المنتج');
    // لا إضافة عمياء من القوائم.
    expect(wish).not.toContain('addProduct');
  });
});
