/**
 * v2.7 — الجولة 58 (تطبيق المتجر): تنظيف المفضلة + كثافة الصفحات
 * + سلسلة إرسال الطلب.
 * ─────────────────────────────────────────────────────────────────
 * شكوى التاجر بالنص:
 *  «صفحة المنتج ليست احترافية وأحجام العناصر بها كبيرة وغير عملية»
 *  «صفحة طلب المنتج غير عملية… وعند الضغط علي زر الطلب لا يرسل
 *   الطلب مطلقاً الي نقطة البيع وايضا [لا] تضاف الي قائمة الطلبات»
 *  «اذا اضاف المستخدم منتج الي المفضلة وقد تم إزالة المنتج ولم
 *   يعد موجود يبقي ظاهر بقائمة المفضلة».
 *
 * ① المفضلة: prune/markVerified/staleIds + TTL ٢٤ ساعة + البقاء
 *    عند فشل الجلب (انقطاع ≠ حذف) — سلوكياً على المخزن الحقيقي.
 * ② WishlistScreen: تحقق عند الفتح بنداء واحد لكل متجر (المصدر).
 * ③ ProductScreen: كثافة v2.7 (معرض 60%، سعر 21px، بلا صندوق
 *    أيقونة) + إصلاح الهامش السفلي خلف الشريط الثابت (+140).
 * ④ CheckoutScreen: صف تحذير الفشل فوق الزر + syncOrdersOnce فوري
 *    بعد النجاح (قائمة الطلبات تتحدث لحظياً) + مفتاح الإيديمبوتنسية
 *    يبقى نفسه حتى النجاح.
 * ⑤ الإصدار: 2.7.0 (11).
 */
import {useWishlistStore} from '../src/stores/wishlistStore';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

/** منتج تجريبي بأقل الحقول التي تلمسها المفضلة. */
function fakeProduct(id: number, storeId = 7) {
  return {
    id,
    store_id: storeId,
    name: `منتج ${id}`,
    price_minor: 1000,
    stock: 5,
    category: 'بقالة',
  } as never;
}

describe('v2.7 — تنظيف المفضلة من المنتجات غير الموجودة', () => {
  beforeEach(() => {
    useWishlistStore.setState({items: {}});
  });

  test('① staleIds: الجديد محدّث والقديم منتهي (TTL ٢٤ ساعة)', () => {
    const s = useWishlistStore.getState();
    s.toggle(fakeProduct(1), 'متجر أ'); // جديد — verifiedAt null → منتهي فوراً
    useWishlistStore.setState({
      items: {
        ...useWishlistStore.getState().items,
        '1': {...useWishlistStore.getState().items['1'], verifiedAt: Date.now()},
        // منتج 2: منتهي (تحقق قبل 25 ساعة)
        '2': {
          product: fakeProduct(2),
          storeName: 'متجر أ',
          savedAt: Date.now() - 48 * 3600 * 1000,
          verifiedAt: Date.now() - 25 * 3600 * 1000,
        },
      },
    });
    const stale = useWishlistStore.getState().staleIds();
    expect(stale).toContain(2);
    expect(stale).not.toContain(1);
  });

  test('① prune: يحذف المعطيات فقط ويعيد العدد — والباقي لا يُمس', () => {
    const s = useWishlistStore.getState();
    s.toggle(fakeProduct(10), 'متجر أ');
    s.toggle(fakeProduct(11), 'متجر أ');
    const removed = s.prune([10, 999]);
    expect(removed).toBe(1);
    const items = useWishlistStore.getState().items;
    expect(items['10']).toBeUndefined();
    expect(items['11']).toBeDefined();
    expect(items['999']).toBeUndefined();
  });

  test('① markVerified: يختم المحدّثين فقط', () => {
    const s = useWishlistStore.getState();
    s.toggle(fakeProduct(20), 'متجر أ');
    s.toggle(fakeProduct(21), 'متجر أ');
    s.markVerified([20]);
    const items = useWishlistStore.getState().items;
    expect(items['20'].verifiedAt).not.toBeNull();
    expect(items['21'].verifiedAt).toBeUndefined();
  });

  test('② شاشة المفضلة: تحقق عند الفتح — نداء لكل متهر لا لكل منتج، وفشل الجلب لا يحذف', () => {
    const screen = read('src/screens/wishlist/WishlistScreen.tsx');
    // التجميع حسب المتجر + نداء واحد لكل متجر مختلف.
    expect(screen).toContain('const byStore = new Map<number, number[]>()');
    expect(screen).toMatch(/getStoreProducts\(storeId, \{per: VERIFY_PAGE_PER, page\}\)/);
    // فشل جلب متجر ≠ حذف منتجاته.
    expect(screen).toContain('if (available == null) {');
    expect(screen).toMatch(/continue; \/\/ فشل جلب — لا نحذف \(انقطاع ≠ حذف\)\./);
    // إشعار لطيف عند التنظيف.
    expect(screen).toContain('نُظّفت مفضلتك');
  });

  test('③ صفحة المنتج: كثافة v2.7 + إصلاح الهامش السفلي', () => {
    const screen = read('src/screens/product/ProductScreen.tsx');
    // المعرض 60% من العرض (كان 86%).
    /* v3.0: أُعيد بناء المعرض بعرض كامل 4:5 — انظر v30-round60.test.ts */
    expect(screen).toContain('screenWidth * 1.25');
    // السعر 21px (كان 30px) وبلا صندوق أيقونة 76px.
    /* v3.0: السعر 26px بعرض كامل بعد إعادة البناء */
    expect(screen).toContain('fontSize: 26');
    expect(screen).not.toContain('bigIcon');
    // الهامش السفلي: آخر المحتوى لا يختفي خلف شريط الشراء الثابت.
    /* v3.0: الإخلاء صار بارتفاع الشريط المثبت المطلق نفسه */
    expect(screen).toContain('paddingBottom: barClearance');
    // المتجر سطر مضغوط 38px (كان 52px).
    expect(screen).toMatch(/StoreAvatar[^]*size=\{38\}/);
  });

  test('④ إتمام الطلب داخل السلة (v2.8): فشل واضح + تحديث لحظي', () => {
    /* v2.8 (الجولة 59): شاشة «إتمام الطلب» الوسيطة حُذفت من التدفق —
     * طلب التاجر بالنص: «أريده أبسط… إتمام الطلب مباشرة». نفس
     * الضمانات انتقلت للسلة نفسها: صف تحذير صادق فوق الزر، تحديث
     * لحظي لقائمة الطلبات، وإيديمبوتنسية تمنع التكرار. */
    expect(() => read('src/screens/checkout/CheckoutScreen.tsx')).toThrow();
    const cart = read('src/screens/cart/CartScreen.tsx');
    // صف التحذير فوق الزر — لا نجاح زائف أبداً.
    expect(cart).toContain('lastSendError');
    expect(cart).toContain('errorRow');
    // تحديث قائمة الطلبات فور النجاح (كان ينتظر ٤٥ ثانية).
    expect(cart).toContain('void syncOrdersOnce(true);');
    // إعادة الضغط بلا خوف التكرار — نص يطمئن المستخدم.
    expect(cart).toContain('لا تنشئ طلباً مكرراً');
    // زر واحد مباشر: «إتمام الطلب — الإجمالي».
    expect(cart).toContain('إتمام الطلب —');
  });

  test('⑤ الإصدار: محدّث في الجولة 60 (3.0.0)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '3.0.1'");
    expect(config).toContain('APP_BUILD_CODE = 14');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 14');
    expect(gradle).toContain('versionName "3.0.1"');
  });
});
