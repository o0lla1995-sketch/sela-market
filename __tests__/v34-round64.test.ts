/**
 * v34-round64.test.ts — الجولة 64 (v3.4.0): إصلاح انهيار صفحة المتجر
 * جذرياً + أقسام أنواع المتاجر + إعادة تصميم شاشات الدخول + الهيدر.
 * ─────────────────────────────────────────────────────────────────
 * كل بند مثبت بحرس على المصدر — لا تراجع صامت بعد اليوم:
 *  ① الانهيار الحقيقي لصفحة المتجر: صفر Animated / useNativeDriver /
 *     Animated.event في StoreScreen — استُبدلت بحالة barShown آمنة
 *     + onScroll عادي (آليات v3.1.0 المُثبتة فقط، بلا أي وحدة أصلية).
 *  ② أقسام أنواع المتاجر (طلب المستخدم الأهم): تجميع حقيقي بـ
 *     storeTypeInfo + شريط منتجات لكل نوع + شاشة قسم كاملة جديدة
 *     (StoreTypeScreen) مسجلة في المكدسين.
 *  ③ الهيدر: زوايا سفلية دائرية + حذف شريط «توصيل إلى» منه.
 *  ④ رقاقة «توصيل إلى» اللطيفة في أقصى يسار عنوان قسم «متاجر تخدم»
 *     + «عرض الكل» أيقونة دائرية مضغوطة 30px في أقصى يسار العناوين.
 *  ⑤ شاشات الدخول/التسجيل/البصمة: علامة علامة + عناوين ضخمة، صفر
 *     ملاحظات ثانوية (hint) في التسجيل، أيقونة بصمة مخصصة جديدة.
 *  ⑥ الإصدار: 3.4.0 (18).
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** يجرد المصدر من التعليقات (أسطر // وكتل */ /*) — الحرس يفحص
 * الكود الفعلي فقط فلا يخطئ التعليق التوثيقي الذي يذكر الآلية
 * المحذوبة عمداً. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('الجولة 64 — v3.4.0: الإصلاح الجذري + أقسام الأنواع + الدخول العصري', () => {
  test('① انهيار صفحة المتجر: صفر Animated في StoreScreen — شريط آمن بحالة عادية', () => {
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    // لا أي منظومة Animated في الشاشة إطلاقاً (السبب الجذري للانهيار)
    expect(store).not.toContain('Animated.event');
    expect(store).not.toContain('useNativeDriver');
    expect(store).not.toContain('Animated.View');
    expect(store).not.toContain('Animated.Value');
    expect(store).not.toMatch(/import\s*{[^}]*Animated[^}]*}\s*from\s*'react-native'/);
    // البديل الآمن: حالة إظهار ثنائية + onScroll عادي يقارن عتبة
    expect(store).toContain('const [barShown, setBarShown] = useState(false);');
    expect(store).toContain('const show = y > 150;');
    expect(store).toContain('setBarShown(prev => (prev === show ? prev : show));');
    // الشريط يُرندر شرطياً بطبقة View عادية
    expect(store).toContain('{barShown ? (');
    // بقية الشاشة سليمة: الفلاتر والكاروسيل كما هما
    expect(store).toContain('FilterChip');
    expect(store).toContain('آراء المشترين');
  });

  test('② أقسام أنواع المتاجر: تجميع storeTypeInfo + جلب منتجات + شاشة القسم الكاملة', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // تجميع المتاجر حسب النوع بأيقونة وعدد
    expect(home).toContain('storeTypeInfo(s.category)');
    expect(home).toContain('typeSections');
    expect(home).toContain("navigation.navigate('StoreType', {type: sec.label})");
    // جلب المنتجات من أفضل متجري النوع بتدوير دائري
    expect(home).toContain('getStoreProducts(s.id, {per: 6})');
    expect(home).toContain('cachedFetch(`typeprods:v1:${s.id}`');
    // الشاشة الجديدة موجودة ومسجلة في المكدسين
    const screen = read('src/screens/stores/StoreTypeScreen.tsx');
    expect(screen).toContain('const {type} = route.params;');
    expect(screen).toContain('storeTypeInfo(s.category).label === type');
    expect(screen).toContain('CircleStoreCard');
    expect(screen).toContain('numColumns={2}');
    // جلب دوّار عادل بين متاجر القسم
    expect(screen).toContain('doneStores');
    expect(screen).toContain('fetchFromStore');
    const nav = read('src/navigation/RootNavigator.tsx');
    expect(nav).toContain('StoreType: {type: string}');
    expect(nav).toContain('name="StoreType"');
    expect((nav.match(/name="StoreType"/g) ?? []).length).toBe(2);
  });

  test('③ الهيدر: زوايا دائرية سفلية + حذف شريط «توصيل إلى» منه', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toContain('borderBottomLeftRadius: radius.xl');
    expect(home).toContain('borderBottomRightRadius: radius.xl');
    // شريط المنطقة حُذف من التروسة (النمط والبنية)
    expect(home).not.toContain('heroStyles.regionBar');
    expect(home).not.toContain('التوصيل إلى</Text>');
  });

  test('④ رقاقة المنطقة بأقصى يسار العنوان + «عرض الكل» أيقونة مضغوطة', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // رقاقة توصيل إلى مخصصة في قسم متاجر تخدم
    expect(home).toContain('function RegionChip(');
    expect(home).toContain('end={<RegionChip region={myRegion} onPress={openRegionPicker} />}');
    expect(home).toContain("region ?? 'حدّد منطقتك'");
    // عرض الكل أيقونة دائرية 30px في SectionTitle
    const ui = read('src/components/ui.tsx');
    expect(ui).toContain('actionIcon: {');
    expect(ui).toContain('width: 30,');
    expect(ui).toContain('height: 30,');
    expect(ui).toContain('end?: React.ReactNode;');
  });

  test('⑤ شاشات الدخول عصرية: علامة + عناوين ضخمة + صفر ملاحظات ثانوية', () => {
    const login = read('src/screens/auth/LoginScreen.tsx');
    expect(login).toContain('markBadge');
    expect(login).toContain('أهلاً بعودتك');
    // زر بصمة بالأيقونة المخصصة
    expect(login).toContain('icon="fingerprint"');
    // رابط حساب جديد
    expect(login).toContain("navigation.navigate('Register', {reason})");
    // زر إغلاق دائري بدل الهيدر الكبير
    expect(login).not.toContain('AppHeader');

    const register = read('src/screens/auth/RegisterScreen.tsx');
    expect(register).toContain('markBadge');
    expect(register).toContain('حساب جديد');
    // صفر ملاحظات ثانوية تحت الحقول (طلب المستخدم بالنص)
    expect(register).not.toContain('hint="');
    // سطر شروط واحد مختصر
    expect(register).toContain('بإنشاء الحساب توافق على شروط الاستخدام');
    expect(register).not.toContain('لا نطلب أي بطاقات دفع');
    expect(register).not.toContain('AppHeader');

    const gate = read('src/screens/auth/BiometricGateScreen.tsx');
    expect(gate).toContain('icon="fingerprint"');
    expect(gate).toContain('فتح بالبصمة');
    // الملاحظة الختامية غير المهمة حُذفت
    expect(gate).not.toContain('تعطيل البوابة من الإعدادات');
    // أيقونة البصمة الجديدة في العائلة
    const icon = read('src/components/Icon.tsx');
    expect(icon).toContain("| 'fingerprint'");
    expect(icon).toContain("case 'fingerprint':");
  });

  test('⑥ الإصدار: 3.4.0 (18)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '3.4.0'");
    expect(config).toContain('APP_BUILD_CODE = 18');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 18');
    expect(gradle).toContain('versionName "3.4.0"');
  });
});
