/**
 * v31-round61.test.ts — الجولة 61 (v3.1.0): ملاحظات التاجر الرابع عشر.
 * ─────────────────────────────────────────────────────────────────
 * كل شكوى مثبتة بحرس على المصدر:
 *  ① «يظهر نتيجة البحث ثم يحدث خلل في التطبيق فيغلق مباشرة»
 *     → أبعاد رقمية + resizeMethod="resize" لصور البطاقات (كانت
 *       تفك ترميز 800px كاملة فتقتل الذاكرة OOM).
 *  ② «عند تسجيل الدخول في شاشة الترحيب أبقى عالقاً في الصفحة»
 *     → نهاية دخول/تسجيل ذكية: reset إلى الرئيسية عندما لا يوجد
 *       ما نعود إليه خلف نافذة الدخول.
 *  ③ «أبقى عالقاً في الصفحة المفتوحة بنافذة خصوصاً في الشراء»
 *     → شاشة نجاح الطلب تعيد مكدس السلة إلى السلة (لا نجاح عالق).
 *  ④ «أيقونة اختيار منطقة مختفية بجانب الشاشة» + «الكثير من الكلام»
 *     → شريط منطقة بعرض كامل داخل تروسة ملونة + حذف الشروحات.
 *  ⑤ «صفحة التاجر مقرفة ومتداخلة خصوصاً عند وجود تقييمات»
 *     → تروسة مدمجة + حذف الإحصاءات + الآراء أسفل المنتجات.
 *  ⑥ «المنتج المعطّل يختفي من المتجر ولا يختفي من المفضلة»
 *     → فحص توفر بنداء واحد فور فتح المفضلة.
 *  ⑦ «الإشعارات عند فتحها تعلّم مقروءة مباشرة» → تعليم تلقائي.
 *  ⑧ التصميم: تروسة بلون العلامة + شريط لوني للعناوين + كبسولة
 *     التبويب النشط (استلهام الأنظمة العالمية بلا مسحة جديدة).
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('الجولة 61 — v3.1.0', () => {
  test('① صور البطاقات: أبعاد رقمية + resize (قاتل الانهيار OOM)', () => {
    const card = read('src/components/ProductCard.tsx');
    expect(card).toContain('useWindowDimensions');
    expect(card).toContain('resizeMethod="resize"');
    expect(card).toContain('photoWidth');
    // عارض المنتج كذلك (المعرض + ملء الشاشة)
    const product = read('src/screens/product/ProductScreen.tsx');
    expect(product).toContain('resizeMethod="resize"');
  });

  test('② نهاية الدخول/التسجيل الذكية — لا عالقية الترحيب', () => {
    const login = read('src/screens/auth/LoginScreen.tsx');
    expect(login).toContain("below === 'Welcome'");
    expect(login).toContain("navigation.reset({index: 0, routes: [{name: 'Main'}]})");
    const register = read('src/screens/auth/RegisterScreen.tsx');
    expect(register).toContain("below === 'Welcome'");
    expect(register).toContain("navigation.reset({index: 0, routes: [{name: 'Main'}]})");
  });

  test('③ نجاح الطلب يعيد مكدس السلة — لا نافذة شراء عالقة', () => {
    const success = read('src/screens/checkout/OrderSuccessScreen.tsx');
    expect(success).toContain("navigation.reset({index: 0, routes: [{name: 'Cart'}]})");
  });

  test('④ شريط المنطقة داخل التروسة + حذف الكلام الزائد', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // شريط «التوصيل إلى» بعرض كامل داخل التروسة الملونة
    expect(home).toContain('regionBar');
    expect(home).toContain('التوصيل إلى');
    expect(home).toContain('حدّد منطقتك');
    expect(home).toContain('heroBg');
    // الرقاقة الجانبية القديمة أُزيلت
    expect(home).not.toContain('changeChip');
    // الشرح المطوّل تحت «أحدث ما وصل المول» أُزيل
    expect(home).not.toContain('محدّثة لحظة مزامنة التاجر');
  });

  test('⑤ صفحة التاجر: تروسة مدمجة + آراء أسفل المنتجات', () => {
    const store = read('src/screens/stores/StoreScreen.tsx');
    // التقييم سطر واحد داخل التروسة الملونة
    expect(store).toContain('ratingRow');
    expect(store).toContain('heroBg');
    // شريط الإحصاءات المكرر حُذف
    expect(store).not.toContain('statsStyles');
    // الآراء: كاروسيل أفقي مدمج مقضم فوق المنتجات (v3.2 — الجولة 62)
    expect(store).toContain('snapToInterval={264 + spacing.md}');
    expect(store).toContain('آراء المشترين');
    // الشرح المطوّل داخل ملخص الآراء أُزيل
    expect(store).not.toContain('لضمان آراء حقيقية');
    // المناطق سطر أفقي واحد قابل للتمرير (لا كومة رقائق ملتفة)
    expect(store).toContain('التوصيل إلى ${regions.length} مناطق');
    const regionsBlock = store.slice(store.indexOf('مناطق التوصيل — سطر أفقي'));
    expect(regionsBlock.slice(0, 900)).toContain('horizontal');
  });

  test('⑥ المفضلة: فحص توفر فوري بنداء واحد + صورة المنتج', () => {
    const endpoints = read('src/api/endpoints.ts');
    expect(endpoints).toContain('checkProductsAvailability');
    expect(endpoints).toContain('/api/market/products/availability');
    const wish = read('src/screens/wishlist/WishlistScreen.tsx');
    expect(wish).toContain('checkProductsAvailability');
    expect(wish).toContain('VERIFY_THROTTLE_MS');
    // مروحة كتالوج كل متجر أُزيلت
    expect(wish).not.toContain('fetchAvailableIds');
    // صورة المنتج بدل شعار المتجر الخطأ
    expect(wish).not.toContain('StoreAvatar');
  });

  test('⑦ الإشعارات: الفتح يعلمها مقروءة مباشرة', () => {
    const notif = read('src/screens/notifications/NotificationsScreen.tsx');
    expect(notif).toContain('useEffect');
    expect(notif).toContain('markAllRead()');
    // زر «تعليم الكل» اليدوي لم يعد لازماً
    expect(notif).not.toContain('تعليم الكل كمقروء');
    // لمس إشعار طلب يقفز إلى الطلبات
    expect(notif).toContain("navigate('Orders')");
  });

  test('⑧ لمسات التصميم العالمية: عنوان بشريط لوني + كبسولة التبويب', () => {
    const ui = read('src/components/ui.tsx');
    expect(ui).toContain('accentBar');
    const nav = read('src/navigation/RootNavigator.tsx');
    expect(nav).toContain('TabIconWrap');
    expect(nav).toContain('brandSoft');
  });

  test('⑨ الإصدار: 3.2.0 (16)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '3.2.0'");
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionName "3.2.0"');
    expect(gradle).toContain('versionCode 16');
  });
});
