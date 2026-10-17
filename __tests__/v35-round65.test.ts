/**
 * v35-round65.test.ts — الجولة 65 (v3.5.0): إصلاح «البطاقة الضخمة
 * لمنتج واحد» في شبكات المنتجات — الجذر: جذر ProductCard كان يحمل
 * flex:1 داخل صفوف numColumns (RN يضع العناصر أبناء مباشرين لصف
 * flexDirection:'row' بلا أي غلاف)، فالمنتج الوحيد في صفه (عدد فردي/
 * نتيجة فلترة أو بحث بمائع واحد) كان يتمدد شريطاً بكامل عرض الشاشة
 * بينما صورته بقيت بمعادلة نصف العرض — «بطاقة غير صحيحة وفي الصف
 * الواحد تصبح كبيرة لمنتج واحد وشكلها مقرف» (شكوى المستخدم).
 * ─────────────────────────────────────────────────────────────────
 * كل بند مثبت بحرس على المصدر — لا تراجع صامت بعد اليوم:
 *  ① ProductCard: صفر flex:1 على جذر البطاقة + وضع الملء
 *     (الصورة تملأ عرض البطاقة بلا معادلة تقريبية).
 *  ② شبكة صفحة المتجر: خلايا مسقوفة 50% + هامش جانبي للصفوف
 *     (كانت الصفوف ملاصقة لحرفي الشاشة بصفر هامش).
 *  ③ شبكة قسم نوع المتجر + شبكة التصنيف: نفس الخلايا المسقوفة.
 *  ④ صفحات 2×2 بالرئيسية: سقف 50% + وضع الملء (لا cardPhotoWidth).
 *  ⑤ حرس رجوعي: نمط البحث المُجرّب (الجولة 63) لم يُمس.
 *  ⑥ الإصدار: 3.5.0 (19).
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** يجرد المصدر من التعليقات — الحرس يفحص الكود الفعلي فقط فلا
 * يخطئ التعليق التوثيقي الذي يذكر الآلية المحذوفة عمداً. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('الجولة 65 — v3.5.0: إصلاح بطاقة المنتج الضخمة في الشبكات', () => {
  test('① ProductCard: صفر flex:1 على الجذر + وضع الملء للصورة', () => {
    const card = stripComments(read('src/components/ProductCard.tsx'));
    // جذر البطاقة لم يعد يحمل flex:1 — كان يتمدد وحده بكامل الصف
    // حين يكون المنتج الوحيد في صفه داخل numColumns
    expect(card).not.toMatch(/card:\s*{[^}]*flex:\s*1/);
    // وضع الملء: بلا photoWidth صريح تملأ الصورة عرض البطاقة كاملاً
    expect(card).toContain("const photoWidth: number | '100%' = photoWidthProp ?? '100%';");
    // معادلة العرض التقريبية القديمة (useWindowDimensions) انتهت
    expect(card).not.toContain('useWindowDimensions');
    expect(card).not.toMatch(/Math\.floor\(\(screenWidth/);
    // البديل المرسوم عند غياب الصورة يقبل وضع الملء أيضاً
    expect(card).toContain("width: number | '100%';");
  });

  test('② شبكة صفحة المتجر: خلية مسقوفة 50% + هامش جانبي للصفوف', () => {
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    // كل بطاقة داخل خلية مسقوفة — لا بطاقة عارية ابن صف numColumns
    expect(store).toContain('<View style={gridStyles.cell}>');
    expect(store).toContain("cell: {flex: 1, maxWidth: '50%'}");
    // الصفوف أخيراً بهامش جانبي 16 — كانت ملاصقة لحرفي الشاشة
    expect(store).toContain('paddingHorizontal: spacing.lg,');
    // الشبكة ما زالت ثنائية الأعمدة
    expect(store).toContain('numColumns={2}');
  });

  test('③ شبكة قسم النوع + شبكة التصنيف: نفس الخلايا المسقوفة', () => {
    const type = stripComments(read('src/screens/stores/StoreTypeScreen.tsx'));
    expect(type).toContain('<View style={gridStyles.cell}>');
    expect(type).toContain("cell: {flex: 1, maxWidth: '50%'}");
    expect(type).toContain('numColumns={2}');

    const cat = stripComments(read('src/screens/category/CategoryScreen.tsx'));
    expect(cat).toContain("{flex: 1, maxWidth: '50%'}");
    expect(cat).not.toContain('paddingHorizontal: 0');
    expect(cat).toContain('numColumns={2}');
  });

  test('④ صفحات 2×2 بالرئيسية: سقف 50% + وضع الملء بلا cardPhotoWidth', () => {
    const home = stripComments(read('src/screens/home/HomeScreen.tsx'));
    // غلاف كل بطاقة داخل صف الصفحة مسقوف بنصف العرض
    expect(home).toContain("{flex: 1, maxWidth: '50%'}");
    // وضع الملء: photoWidth صريح انتهى مع معادلته التقريبية
    expect(home).not.toContain('cardPhotoWidth');
    expect(home).toContain('photoHeight={104}');
  });

  test('⑤ حرس رجوعي: نمط البحث المُجرّب (الجولة 63) لم يُمس', () => {
    const search = stripComments(read('src/screens/search/SearchScreen.tsx'));
    expect(search).toContain("cell: {flex: 1, maxWidth: '50%'}");
    expect(search).toContain('numColumns={2}');
    /* v4.0 (الجولة 68): أشرطة الرئيسية الأفقية (أنواع المتاجر +
     * المقترحات) صارت بطاقات الشريط المضغوطة ProductRailCard
     * (148) بدل بطاقات 152 — تنويع أشكال البطاقات حسب القسم;
     * شبكات 2×2 ما زالت بطاقات المنتج الكاملة بارتفاع 104. */
    const home = stripComments(read('src/screens/home/HomeScreen.tsx'));
    expect(home).toContain('ProductRailCard');
    expect(home).toContain('photoHeight={104}');
  });

  test('⑥ الإصدار: 3.5.0 (19)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '4.1.0'");
    expect(config).toContain('APP_BUILD_CODE = 23');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 23');
    expect(gradle).toContain('versionName "4.1.0"');
  });
});
