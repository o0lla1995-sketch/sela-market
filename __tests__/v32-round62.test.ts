/**
 * v32-round62.test.ts — الجولة 62 (v3.2.0): التطوير الشامل للتجربة
 * والتصميم (UX/UI) بناء على مواصفة التاجر السباعية.
 * ─────────────────────────────────────────────────────────────────
 * كل بند مثبت بحرس على المصدر — لا تراجع صامت بعد اليوم:
 *  ① RTL: سهم الرجوع «‹» يساراً في كل التروسات + أسهم الاستمرار
 *     يساراً (سهم رجوع يميناً محظور في كل التطبيق).
 *  ② تروسة الرئيسية: كتلة لاصقة مدمجة (تحية + منطقة + بحث) خارج
 *     منطقة التمرير — ثابتة بلا قفزات + ظل مرفوع موحد.
 *  ③ الشريط السفلي: غير النشط inkSoft (لا رمادي باهت) + تسميات
 *     وصول + ارتفاع ثابت يمنع انزياح التخطيط.
 *  ④ البطاقات: حدود ‎#2A2A2A في الداكن + صفر نصوص فوق صور المنتجات
 *     (الرقائق تحت الصورة) + اهتزاز المفضلة (v3.3: ripple أُزيل —
 *     كان يفجّر انهياراً عند كل لمسة على أندرويد).
 *  ⑤ صفحة التاجر: شريط لاصق منسحب (رجوع + بحث) + رقائق فلترة
 *     سريعة + كاروسيل آراء أفقي مدمج مقضم.
 *  ⑥ البحث: فلترة محلية فورية + وضع التصفح «عرض الكل» + وسم نطاق
 *     + حالة فراغ واضحة بنص الاستعلام.
 *  ⑦ رؤوس الأقسام: صف space-between صارم — العنوان يميناً (RTL)
 *     و«عرض الكل» كبسولة رابط ثانوي بسهم «‹» — لا تزاحم أبداً.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('الجولة 62 — v3.2.0: التطوير الشامل UX/UI', () => {
  test('① سهم الرجوع «‹» يساراً في كل مكان — لا سهم يمين', () => {
    const ui = read('src/components/ui.tsx');
    // التروسة العامة: chevronLeft دائماً (لا تفرعة RTL قديمة)
    expect(ui).toContain('name="chevronLeft"');
    expect(ui).not.toContain("I18nManager.isRTL ? 'back'");
    // صفحة المتجر: التروسة البطولية والشريط اللاصق كلاهما «‹»
    const store = read('src/screens/stores/StoreScreen.tsx');
    expect(store).not.toContain("'back'");
    expect(store.match(/chevronLeft/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // بطاقة المتجر: سهم الاستمرار «‹» (لا «forward» يميناً)
    const storeCard = read('src/components/StoreCard.tsx');
    expect(storeCard).not.toContain("name=\"forward\"");
    expect(storeCard).toContain('chevronLeft');
  });

  test('② تروسة الرئيسية: لاصقة مدمجة خارج التمرير — بلا قفزات', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // الكتلة خارج ScrollView (لاصقة هندسياً) + ظل مرفوع
    expect(home).toContain('shadowRaised');
    // المكونات الثلاثة مدمجة: تحية + منطقة + بحث
    expect(home).toContain('greeting()');
    expect(home).toContain('التوصيل إلى');
    expect(home).toContain('ابحث عن منتج في كل متاجر المول');
    // شريط المنطقة بعرض كامل (لا رقاقة تختفي عند الحافة)
    expect(home).toContain('regionBar');
    // المحتوى القابل للتمرير منفصل تحت التروسة
    expect(home).toContain('محتوى الصفحة القابل للتمرير تحت التروسة الثابتة');
  });

  test('③ الشريط السفلي: تباين ووضوح ومنع انزياح التخطيط', () => {
    const nav = read('src/navigation/RootNavigator.tsx');
    expect(nav).toContain('tabBarInactiveTintColor: palette.inkSoft');
    expect(nav).toContain('tabBarActiveTintColor: palette.brandDeep');
    // ارتفاع ثابت للتسمية — لا انزياح عند التبديل
    expect(nav).toContain('height: 14');
    // تسميات وصول لكل التبويبات
    expect(nav).toContain('tabBarAccessibilityLabel');
  });

  test('④ البطاقات: حدود داكنة ‎#2A2A2A وصور نظيفة وتفاعلات لمسية', () => {
    const tokens = read('src/theme/tokens.ts');
    expect(tokens).toContain("'#2A2A2A'");
    const card = read('src/components/ProductCard.tsx');
    expect(card).toContain('cardBorderFor(palette.isDark)');
    // صفر نصوص فوق الصورة: قلب المفضلة فقط يبقى فوقها
    expect(card).not.toContain('unitChip');
    expect(card).not.toContain('discountBadge');
    expect(card).not.toContain('stockBadge');
    expect(card).not.toContain('cartBadge');
    // الرقائق المعلوماتية تحت الصورة
    expect(card).toContain('chipsRow');
    // v3.3: أُزيل android_ripple كلياً (كان يكسر التطبيق عند كل
    // لمسة) — اهتزاز المفضلة باقٍ.
    expect(card).not.toContain('android_ripple={{');
    expect(card).toContain('hapticLight');
    // بطاقات المتاجر كذلك: حدود داكنة وبلا ripple
    const storeCard = read('src/components/StoreCard.tsx');
    expect(storeCard).toContain('cardBorderFor(palette.isDark)');
    expect(storeCard).not.toContain('android_ripple={{');
  });

  test('⑤ صفحة التاجر: شريط لاصق + فلاتر سريعة + كاروسيل آراء', () => {
    const store = read('src/screens/stores/StoreScreen.tsx');
    // الشريط اللاصق بحركة أصلية (Animated) — رجوع + بحث دائماً
    expect(store).toContain('Animated.Value');
    expect(store).toContain('stickyTranslateY');
    // رقائق الفلترة السريعة: عروض + تصنيفات + ترتيب سعر
    expect(store).toContain('FilterChip');
    expect(store).toContain('offersOnly');
    expect(store).toContain('priceAsc');
    // كاروسيل الآراء الأفقي المقضم + بطاقة الملخص
    expect(store).toContain('snapToInterval={264 + spacing.md}');
    expect(store).toContain('summaryNum');
    // فلترة محلية فورية فوق الكتالوج (بلا نداءات)
    expect(store).toContain('const visible = useMemo');
    // القفز لأعلى عند البحث
    expect(store).toContain('scrollToOffset');
  });

  test('⑥ البحث: محلي فوري + وضع التصفح + نطاق واضح + فراغ مفهوم', () => {
    const search = read('src/screens/search/SearchScreen.tsx');
    // فلترة محلية فورية بالاستعلام الحالي
    expect(search).toContain("p.name.toLowerCase().includes(ql)");
    // وضع التصفح من «عرض الكل»
    expect(search).toContain('browse === true');
    expect(search).toContain('تصفح كل منتجات المول');
    // وسم النطاق
    expect(search).toContain('البحث يشمل كل متاجر المول');
    // حالة الفراغ تحمل نص الاستعلام
    expect(search).toContain('لا توجد منتجات مطابقة لبحثك');
    // الرئيسية ترسل browse:true من «عرض الكل»
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toContain("navigate('Search', {browse: true})");
  });

  test('⑦ رؤوس الأقسام: space-between صارم و«عرض الكل» رابط أنيق', () => {
    const ui = read('src/components/ui.tsx');
    expect(ui).toContain('justifyContent: \'space-between\'');
    expect(ui).toContain('flexShrink: 0');
    // العنوان ينكمش بأمان والسهم «‹» بجانب الرابط
    expect(ui).toContain('سهم يسار «‹» — اتجاه الاستمرار في RTL');
    // تباعد أدنى مضمون بين العنوان والرابط
    expect(ui).toContain('gap: spacing.md');
  });

  test('⑧ اللمسات اللمسية: اهتزاز على الأفعال الحرجة (بلا ripple — v3.3)', () => {
    const haptics = read('src/core/haptics.ts');
    expect(haptics).toContain('hapticLight');
    expect(haptics).toContain('hapticSuccess');
    // إذن الاهتزاز في المانيفست — بدونه تبقى النبضات صامتة
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android.permission.VIBRATE');
    // إضافة للسلة: تأكيد لمسي
    const product = read('src/screens/product/ProductScreen.tsx');
    expect(product).toContain('hapticSuccess');
    // إتمام الطلب: تأكيد لمسي مزدوج (زر + لحظة النجاح)
    const cart = read('src/screens/cart/CartScreen.tsx');
    expect(cart).toContain('hapticSuccess');
    expect(cart).toContain('haptic="success"');
    // v3.3: صفر ripple في كل مكونات الواجهة — كان يفجّر انهياراً
    // فورياً عند كل لمسة على أندرويد (شكوى الجولة 63 القاتلة).
    const ui = read('src/components/ui.tsx');
    expect(ui).not.toContain('android_ripple={{');
  });

  test('⑨ الكاروسيلات: صفحات شبكية 2×2 مقضمة snap', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // أحدث ما وصل المول: صفحات 2×2 + snap
    expect(home).toContain('GRID_PAGE = 4');
    expect(home).toContain('snapToInterval={snapInterval}');
    expect(home).toContain('decelerationRate="fast"');
    // الجلب التدريجي مستمر عند آخر صفحة
    expect(home).toContain('onEndReached={loadMore}');
    // مقترحات لك: snap أيضاً
    expect(home).toContain('snapToInterval={176 + spacing.md}');
  });

  test('⑩ الإصدار: 3.3.0 (17)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '3.3.0'");
    expect(config).toContain('APP_BUILD_CODE = 17');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionName "3.3.0"');
    expect(gradle).toContain('versionCode 17');
  });
});
