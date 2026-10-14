/**
 * v33-round63.test.ts — الجولة 63 (v3.3.0): إصلاح الانهيار القاتل
 * + خمس تحسينات بناء على شكاوى التاجر.
 * ─────────────────────────────────────────────────────────────────
 * كل بند مثبت بحرس على المصدر — لا تراجع صامت بعد اليوم:
 *  ① الانهيار القاتل: صفر android_ripple في كل مصادر التطبيق
 *     (24 موضعاً في v3.2 كانت تكسر التطبيق عند كل لمسة) + إذن
 *     VIBRATE في المانيفست.
 *  ② البحث: النتيجة الوحيدة تبقى نصف عرض الشاشة داخل الشبكة
 *     الثنائية — لا شريط عرضي بكامل الشاشة.
 *  ③ الرئيسية: صور بطاقات «تجار تخدم المنطقة» انكمشت (64→46)
 *     مع انكماش البطاقة كلها (96→78) — طلب تاجر متكرر ثلاث مرات.
 *  ④ السلة: إعادة عرض احترافية — رأس متجر ملون، أصناف ببطاقات
 *     وبلاطات حرفية، لوحة إجمالي بارزة، زر 44px قياسي.
 *  ⑤ الطلبات: مبدّل شرائحي بالعدادات، تفاصيل الطلب نافذة منبثقة
 *     تنزلق من الأسفل، تأكيد الإلغاء حوار مركزي حقيقي، حافة لونية
 *     بحالة الطلب.
 *  ⑥ متاجر المول: بحث مخصص داخل الصفحة يفلتر المتاجر محلياً +
 *     عدّاد نتائج + مسح شامل + شارة توثيق ورقاقة رسوم توصيل.
 *  ⑦ الإصدار: 3.3.0 (17).
 */
import {readFileSync, readdirSync, statSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** يجمع كل ملفات ts/tsx تحت مساس — لفرض حرس «صفر ripple» شاملاً. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(tsx?|js|jsx)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('الجولة 63 — v3.3.0: إصلاح الانهيار + تحسينات التاجر', () => {
  test('① الانهيار القاتل: صفر android_ripple في كل المصادر + إذن VIBRATE', () => {
    // كل ملفات المصدر — لا استثناءات
    const files = collectSourceFiles(join(root, 'src'));
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter(f => {
      const text = readFileSync(f, 'utf8');
      return text.includes('android_ripple={{');
    });
    expect(offenders).toEqual([]);
    // haptics باقية وآمنة (try/catch) — الآن تعمل فعلاً بالإذن
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android.permission.VIBRATE');
    const haptics = read('src/core/haptics.ts');
    expect(haptics).toContain('try {');
  });

  test('② البحث: النتيجة الوحيدة نصف العرض — خلية الشبكة مسقوفة 50%', () => {
    const search = read('src/screens/search/SearchScreen.tsx');
    // صف الشبكة يُطبّق دائماً (لا يتلاشى عند نتيجة واحدة)
    expect(search).toContain('columnWrapperStyle={gridStyles.row}');
    expect(search).not.toContain('visible.length > 1 ? gridStyles.row');
    // الخلية نفسها لا تتجاوز نصف العرض أبداً
    expect(search).toContain("cell: {flex: 1, maxWidth: '50%'}");
  });

  test('③ الرئيسية: صور «تجار تخدم المنطقة» أصغر — 46 مع بطاقة 78', () => {
    const storeCard = read('src/components/StoreCard.tsx');
    // الصورة داخل البطاقة الدائرية
    expect(storeCard).toContain('logoUrl={store.logo_url} size={46}');
    // البطاقة كلها انكمشت
    expect(storeCard).toContain('width: 78,');
    expect(storeCard).toContain('width: 56,');
    // snap الرئيسية يطابق العرض الجديد
    const home = read('src/screens/home/HomeScreen.tsx');
    expect(home).toContain('snapToInterval={78 + spacing.md}');
  });

  test('④ السلة: إعادة عرض احترافية بلا مساس بالمنطق', () => {
    const cart = read('src/screens/cart/CartScreen.tsx');
    // رأس المتجر شريط هوية ملون
    expect(cart).toContain('cardStyles.groupHead, {backgroundColor: palette.brandSoft}');
    // صنف ببطاقة مضمنة + بلاطة حرفية
    expect(cart).toContain('cardStyles.lineTile');
    expect(cart).toContain('cardStyles.linesWrap');
    // لوحة الإجمالي البارزة + رقاقة الدفع
    expect(cart).toContain('cardStyles.totalPanel');
    expect(cart).toContain('cardStyles.cashChip');
    // زر إتمام الطلب 44px قياسي (بلا small)
    expect(cart).toContain("label={placing ? 'جارٍ إرسال الطلب…' : `إتمام الطلب");
    // المنطق الحرج لم يُمس: إيديمبوتنسية + سقف المخزون
    expect(cart).toContain('orderRequestIdRef');
    expect(cart).toContain('INSUFFICIENT_STOCK');
    expect(cart).toContain('max={cap}');
  });

  test('⑤ الطلبات: مبدّل شرائحي + نافذة منبثقة + حوار تأكيد', () => {
    const orders = read('src/screens/orders/OrdersScreen.tsx');
    // مبدّل شرائحي بالعدادات
    expect(orders).toContain('filterStyles.seg');
    expect(orders).toContain('counts[f.value]');
    // تفاصيل الطلب نافذة منبثقة تنزلق من الأسفل
    const nav = read('src/navigation/RootNavigator.tsx');
    expect(nav).toContain("name=\"OrderDetail\"");
    expect(nav).toContain("presentation: 'modal', animation: 'slide_from_bottom'");
    // حوار الإلغاء المركزي + حافة الحالة الملونة
    const detail = read('src/screens/orders/OrderDetailScreen.tsx');
    expect(detail).toContain('dialogStyles.panel');
    expect(detail).toContain('borderRightColor: tone.fg');
    // بطاقات القائمة بحافة لونية + سهم استمرار
    const views = read('src/components/OrderViews.tsx');
    expect(views).toContain('borderRightColor: tone.fg');
  });

  test('⑥ متاجر المول: بحث داخل الصفحة يفلتر المتاجر فعلاً', () => {
    const stores = read('src/screens/stores/StoresScreen.tsx');
    // حقل بحث حقيقي مرتبط بحالة query (لا قفز لبحث المنتجات)
    expect(stores).toContain('<SearchBar');
    expect(stores).toContain('value={query}');
    expect(stores).toContain('onChangeText={setQuery}');
    // عدّاد النتائج + مسح شامل
    expect(stores).toContain('styles.resultRow');
    expect(stores).toContain('مسح الفلاتر');
    // الفلترة المحلية بالاسم/الوصف/المنطقة باقية
    expect(stores).toContain('s.name.includes(q)');
    // بطاقة المتجر: شارة توثيق + رقاقة رسوم توصيل + عدد التقييمات
    const card = read('src/components/StoreCard.tsx');
    expect(card).toContain('vStyles.verifyChip');
    expect(card).toContain('vStyles.feeRow, {backgroundColor: palette.successSoft}');
    expect(card).toContain('count={store.ratingCount}');
  });

  test('⑦ الإصدار: 3.3.0 (17)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '3.3.0'");
    expect(config).toContain('APP_BUILD_CODE = 17');
    expect(config).toContain('APP_VERSION_LABEL');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionName "3.3.0"');
    expect(gradle).toContain('versionCode 17');
  });
});
