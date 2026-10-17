/**
 * v38-round68.test.ts — الجولة 68 (v4.0.0): إحياء التطبيق —
 * موشن ناعمة ومشاركة وعروض الأسبوع وترتيب السلال وتتبع ألطف.
 *
 * طلب المستخدم: «التطبيق جامد وغير متجاوب — الهيدر عند عمل سكرول
 * وموشن لطيفة وانتقالات سلسة + بطاقات متنوعة حسب القسم + المشاركة
 * من صفحة المنتج والتاجر + عروض الأسبوع + ترتيب السلال + التتبع
 * والمراقبة والتنقل».
 *
 * الحرس هنا يثبّت:
 *  ① عدّة الحركة: محرك JS حصراً (لا محرك أصلي على أي مسار تمشير).
 *  ② تروسة الرئيسية المنطوية + الشريط المضغوط.
 *  ③ المشاركة: منتج/متجر/طلب عبر مشاركة النظام (صفر مكتبات).
 *  ④ عروض هذا الأسبوع + فلتر «العروض فقط» في البحث.
 *  ⑤ تنويع البطاقات: شريط مضغوط + بطاقة عرض أفقية + شبكة كاملة.
 *  ⑥ ترتيب السلال + رأس الملخص الموحّد.
 *  ⑦ صفحة المتجر: مشاركة + شريط أرقام.
 *  ⑧ صفحة المنتج: مشاركة + توصيل يبدأ من + نبضة الإضافة.
 *  ⑨ تتبع الطلبات: خط زمن متدرج + شريط مراقبة + مشاركة الطلب.
 *  ⑩ الانتقالات الأسرع (300ms) وقفزة شارة السلة.
 *  ⑪ الإصدار: 4.0.0 (22).
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** يجرد المصدر من التعليقات — فحص الكود الفعلي فقط. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('الجولة 68 — v4.0.0: إحياء التطبيق', () => {
  test('① عدّة الحركة: محرك JS حصراً — لا محرك أصلي إطلاقاً', () => {
    const motion = stripComments(read('src/core/motion.tsx'));
    expect(motion).toContain('export function PressableScale');
    expect(motion).toContain('export function useEntrance');
    expect(motion).toContain('export function usePop');
    expect(motion).toContain('export function useCollapseHeader');
    // القاعدة الصارمة (درس v3.4): لا محرك أصلي في أي حركة مرتبطة
    // بالتمرير — كل شيء JS driver.
    expect(motion).not.toContain('useNativeDriver: true');
    expect(motion).not.toContain('Animated.event');
  });

  test('② تروسة الرئيسية المنطوية + الشريط المضغوط عند التمرير', () => {
    const home = stripComments(read('src/screens/home/HomeScreen.tsx'));
    // المحرك: onScroll ← setValue (JS) عبر الهوك الموحد
    expect(home).toContain('useCollapseHeader');
    expect(home).toContain('collapse.onScroll(e.nativeEvent.contentOffset.y)');
    expect(home).not.toContain('Animated.event');
    // الشريط المضغوط: عنوان + منطقة + بحث/مفضلة/إشعارات
    expect(home).toContain('سيلا ماركت');
    expect(home).toContain('compactStyles');
    expect(home).toContain('compactActive');
    // طبقة التروسة العائمة + إخلاء المحتوى بتباعد مكافئ
    expect(home).toContain('HERO_CONTENT_H');
    expect(home).toContain('paddingTop: HERO_CONTENT_H + spacing.md');
  });

  test('③ المشاركة: منتج/متجر/طلب عبر مشاركة النظام — صفر مكتبات', () => {
    const share = stripComments(read('src/core/share.ts'));
    expect(share).toContain("import {Share} from 'react-native'");
    expect(share).toContain('export async function shareProduct');
    expect(share).toContain('export async function shareStore');
    expect(share).toContain('export async function shareOrder');
    // لا روابط منزل في مشاركة الطلب (خصوصية)
    expect(share).not.toContain('order.address');
    // الأزرار في الشاشات الثلاث
    const product = stripComments(read('src/screens/product/ProductScreen.tsx'));
    expect(product).toContain('shareProduct(product, storeRef.name)');
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    expect(store).toContain('void shareStore(');
    const orderDetail = stripComments(read('src/screens/orders/OrderDetailScreen.tsx'));
    expect(orderDetail).toContain('void shareOrder(order)');
  });

  test('④ عروض هذا الأسبوع: قسم الرئيسية + فلتر العروض في البحث', () => {
    const home = stripComments(read('src/screens/home/HomeScreen.tsx'));
    expect(home).toContain('عروض هذا الأسبوع');
    expect(home).toContain('WeeklyOfferCard');
    expect(home).toContain('getCrossProducts({per: 48, offers: true})');
    // «كل العروض» يفتح البحث مفلتراً
    expect(home).toContain("navigation.navigate('Search', {offers: true, browse: true})");
    // المعامل على الـ API + فلترة محلية احتياطية
    const endpoints = stripComments(read('src/api/endpoints.ts'));
    expect(endpoints).toContain('offers: query.offers === true ? 1 : undefined');
    const search = stripComments(read('src/screens/search/SearchScreen.tsx'));
    expect(search).toContain('offersOnly');
    expect(search).toContain('if (filters.offersOnly) {');
    expect(search).toContain('العروض فقط (المخفّضة)');
    // الرابط يمر من التنقل
    const nav = stripComments(read('src/navigation/RootNavigator.tsx'));
    expect(nav).toContain('offers?: boolean');
  });

  test('⑤ تنويع البطاقات حسب القسم: شريط مضغوط + عرض أفقي + شبكة كاملة', () => {
    const cards = stripComments(read('src/components/ProductCards.tsx'));
    expect(cards).toContain('export function ProductRailCard');
    expect(cards).toContain('export function WeeklyOfferCard');
    // بطاقة الشريط: مربعة مضغوطة بلا رقائق تفصيلية
    expect(cards).toContain('aspectRatio: 1');
    // بطاقة العرض: قرص نسبة الخصم + السعر الجديد/القديم + التوفير
    expect(cards).toContain('وفّر {formatMoney(savedMinor)}');
    expect(cards).toContain('pctDisc');
    // بطاقة الشبكة الأصلية بقيت للكتالوج الكامل
    const card = stripComments(read('src/components/ProductCard.tsx'));
    expect(card).toContain('chipsRow');
  });

  test('⑥ ترتيب السلال + رأس الملخص الموحّد', () => {
    const cart = stripComments(read('src/screens/cart/CartScreen.tsx'));
    expect(cart).toContain("basketSort, setBasketSort] = useState<'recent' | 'value' | 'name'>");
    expect(cart).toContain('localeCompare(b.storeName');
    expect(cart).toContain('قيمة الأصناف');
    expect(cart).toContain('BasketSortChip');
    expect(cart).toContain('grandItemsSubtotal');
  });

  test('⑦ صفحة المتجر: مشاركة + شريط أرقام + شريط لاصق ناعم', () => {
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    // مشاركة فوق التروسة + زر مستقل في الإجراءات
    expect(store).toContain('مشاركة المتجر');
    expect(store).toContain('heroStyles.shareBtn');
    // شريط الأرقام: منتجات/عروض/مناطق/تقييم
    expect(store).toContain('مناطق توصيل');
    expect(store).toContain('statsStyles');
    // الشريط اللاصق: تلاشٍ متصل بمحرك JS (بلا محرك أصلي)
    expect(store).toContain('barOpacity');
    expect(store).not.toContain('useNativeDriver');
    expect(store).not.toContain('Animated.event');
  });

  test('⑧ صفحة المنتج: مشاركة + توصيل يبدأ من + نبضة الإضافة', () => {
    const product = stripComments(read('src/screens/product/ProductScreen.tsx'));
    // مشاركة في التروسة وبجانب المفضلة
    expect(product).toContain('مشاركة المنتج');
    expect(product).toContain('onShare');
    // معلومة التوصيل الحية من مناطق المتجر
    expect(product).toContain('التوصيل يبدأ من');
    expect(product).toContain('minFeeMinor');
    // تقييم المتجر في سطره
    expect(product).toContain('من 5 ({storeDelivery.ratingCount} تقييماً)');
    // نبضة زر الإضافة
    expect(product).toContain('addPulse.pop()');
  });

  test('⑨ تتبع الطلبات: خط زمن متدرج + شريط مراقبة + مشاركة', () => {
    const views = stripComments(read('src/components/OrderViews.tsx'));
    expect(views).toContain('AnimatedTimelineRow');
    expect(views).toContain('index * 90');
    const detail = stripComments(read('src/screens/orders/OrderDetailScreen.tsx'));
    expect(detail).toContain('نراقب حالة طلبك تلقائياً');
    expect(detail).toContain('تحديث الآن');
    expect(detail).toContain('liveTracking');
  });

  test('⑩ انتقالات أسرع وأنعم + قفزة شارة السلة عند الإضافة', () => {
    const nav = stripComments(read('src/navigation/RootNavigator.tsx'));
    expect(nav).toContain('animationDuration: 300');
    expect(nav).toContain('badgeScale');
    // التوست المتحرك
    const ui = stripComments(read('src/components/ui.tsx'));
    expect(ui).toContain('function ToastItem');
  });

  test('⑪ الإصدار: 4.0.0 (22)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '4.1.0'");
    expect(config).toContain('APP_BUILD_CODE = 23');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 23');
    expect(gradle).toContain('versionName "4.1.0"');
  });
});
