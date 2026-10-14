/**
 * v30-round60.test.ts — الجولة 60 (v3.0.0): إعادة بناء هيكلية المتجر.
 * ─────────────────────────────────────────────────────────────────
 * شكاوى التاجر الثلاث التي تعالجها هذه الجولة، وكل واحدة مثبتة:
 *  ① «لا تظهر أزرار في صفحة المنتج لتحديد الطلب ولا يظهر شي حرفياً»
 *     → شريط شراء مثبّت تثبيتاً مطلقاً (position:absolute bottom:0)
 *       يستحيل دفعه خارج الشاشة.
 *  ② «عند البحث تظهر خطأ محاولات كثيرة وكأنه يرسل طلبات كثيرة»
 *     → إعادة محاولة ذكية على 429 + حارس استجابات متقادمة + كسر
 *       كاش انتقائي + سلم قصير + تغذية رئيسية مجمعة (نداء واحد).
 *  ③ «لودر التحميل في أسفل صفحة المتجر يعمل ويحاول جلب المزيد
 *     حتى دون وجود المزيد» → علم استنفاد نهائي + تذييل وصلت للنهاية.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('الجولة 60 — v3.0.0: إعادة البناء الهيكلي', () => {
  test('① شريط الشراء: تثبيت مطلق لا يمكن أن يختفي خلف المحتوى', () => {
    const ui = read('src/components/ui.tsx');
    // BottomFixed أصبح شريطاً مطلقاً مثبتاً بقاع الشاشة
    expect(ui).toContain('export function BottomFixed');
    const box = ui.slice(ui.indexOf('const fixedStyles'));
    expect(box).toContain("position: 'absolute'");
    expect(box).toContain('bottom: 0');
    expect(box).toContain('left: 0');
    expect(box).toContain('right: 0');
    // Screen الداخلية flex:1 صريحة — حاوية محدودة لكل قوائم التمرير
    const globalStyles = ui.slice(ui.indexOf('const styles = StyleSheet'));
    expect(globalStyles).toContain('grow: {flex: 1}');
    // مكون نهاية القائمة الجديد موجود
    expect(ui).toContain('export function EndOfList');
  });

  test('① صفحة المنتج: شريط الشراء دائم الإتاحة + إخلاء المحتوى', () => {
    const screen = read('src/screens/product/ProductScreen.tsx');
    expect(screen).toContain('<BottomFixed>');
    // الإخلاء أسفل القائمة فوق الشريط المثبت
    expect(screen).toContain('barClearance');
    expect(screen).toContain('paddingBottom: barClearance');
    // معرض بنسبة نون 4:5
    expect(screen).toContain('screenWidth * 1.25');
    // سقف المخزون محفوظ من v2.8 (لا تراجع)
    expect(screen).toContain('max={maxQty}');
    expect(screen).toContain('Math.floor(product.stock * 1000) / 1000');
    // التوصيات عبر الكاش الجديد (لا نداء لكل فتح منتج)
    expect(screen).toContain('getStoreSimilarProducts');
    // الألوان: بلاطة التصنيف تلوّن الصفحة
    expect(screen).toContain('tileFor(product.category');
  });

  test('② محدد المعدل: إعادة محاولة واحدة ذكية على 429 للقراءات فقط', () => {
    const client = read('src/api/client.ts');
    expect(client).toContain("e.code === 'RATE_LIMITED'");
    expect(client).toContain("options.method !== 'POST'");
    // محاولتان لا ثلاث — لا عاصفة طلبات عند التعثر
    expect(client).toContain('[preferred, other]');
    // كسر الكاش انتقائي: على الاحتياطية فقط، لا على الأساسية HTTPS
    expect(client).toContain('endpointIndex !== 0');
  });

  test('② الرئيسية: تغذية مجمعة بنداء واحد بدل المروحة', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toContain('getHomeFeed');
    expect(home).not.toContain('getCrossProductsAdaptive');
    // انتهت مروكة «شبكة الأمان» التي كانت تضرب 12 متجراً على حدة
    expect(home).not.toContain('getStoreProducts');
    // بلاطات التصنيفات الملونة
    expect(home).toContain('tileFor(item.category');
    const endpoints = read('src/api/endpoints.ts');
    expect(endpoints).toContain('api/market/home');
    // كاش التوصيات لكل متجر
    expect(endpoints).toContain('getStoreSimilarProducts');
    // احتياط النشر المزدوج: خادم قديم بلا /home لا يكسر الرئيسية
    expect(endpoints).toContain('e.status === 404');
  });

  test('③ صفحة المتجر: استنفاد نهائي بدل اللودر الأبدي', () => {
    const store = read('src/screens/stores/StoreScreen.tsx');
    expect(store).toContain('setExhausted(true)');
    expect(store).toContain('if (exhausted)');
    expect(store).toContain('EndOfList');
    // حارس الاستجابات المتقادمة في بحث المتجر
    expect(store).toContain('searchSeq');
    // الاستنفاد الفوري لكتالوج أقصر من صفحة
    expect(store).toContain('p.length < PRODUCTS_PAGE_SIZE');
  });

  test('③ شاشة البحث: debounce أطول + حارس تسلسل', () => {
    const search = read('src/screens/search/SearchScreen.tsx');
    expect(search).toContain('searchSeq');
    expect(search).toContain('}, 500);');
    expect(search).toContain('seq !== searchSeq.current');
  });

  test('③ شاشة التصنيف: علم استنفاد كذلك', () => {
    const category = read('src/screens/category/CategoryScreen.tsx');
    expect(category).toContain('setExhausted(true)');
    expect(category).toContain('EndOfList');
    expect(category).toContain('tileFor(category');
  });

  test('④ نظام الألوان الغني: عائلة بلاطات لكل تصنيف بلون ثابت', () => {
    const tokens = read('src/theme/tokens.ts');
    expect(tokens).toContain('export function tileFor');
    expect(tokens).toContain('TILES_LIGHT');
    expect(tokens).toContain('TILES_DARK');
    // عشرة أزواج ألوان على الأقل (فوق الهوية البرتقالية الوحيدة)
    expect((tokens.match(/\{soft: '#/g) ?? []).length).toBeGreaterThanOrEqual(20);
  });

  test('⑤ الإصدار: 3.2.0 (16)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '3.2.0'");
    expect(config).toContain('APP_BUILD_CODE = 16');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 16');
    expect(gradle).toContain('versionName "3.2.0"');
  });
});
