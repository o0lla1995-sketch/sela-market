/**
 * v39-round70.test.ts — الجولة 70 (v4.2.0): ملاحظات التاجر الثلاث.
 *
 * طلب المستخدم: «ارجع الهيدر السفلي للتطبيق كما كان لأنه أصبح زر
 * إضافة للسلة في صفحة المنتج تختفي أسفل منه — فقط طور الأيقونات
 * وشكل الهوفر فيها. ثانياً في صفحة التاجر هناك سهم رجوع مكرر يعمل
 * كمشاركة احذفه واجعل زر مشاركة المتجر أيقونة فقط واحذف الزر الخاصة
 * بالمشاركة في الصفحة، واجعل عند عمل سكرول البحث يصبح من الهيدر
 * حيث يصبح البحث أسهل وليس من الصفحة ويظهر البحث فقط عند السكرول».
 *
 * الحرس هنا يثبّت:
 *  ① الشريط السفلي عاد مثبتاً كما كان (يغطي زر إضافة للسلة) —
 *     وبقيت الأيقونات المزدوجة الطبقة (duotone) وكبسولة الهوفر.
 *  ② صفحة التاجر: سهم المشاركة المكرر أزيل + المشاركة أيقونة
 *     وحيدة بجوار الاتصال/واتساب + الزر العريض حُذف.
 *  ③ البحث من الهيدر: حقل البحث داخل الشريط اللاصق يظهر عند
 *     السكرول فقط — حقل البحث داخل الصفحة أُزيل.
 *  ④ أيقونة مشاركة قياسية محايدة الاتجاه (لا سهم يشبه الرجوع).
 *  ⑤ لوحة المفاتيح فوق البحث: نقرة تعمل فوراً + سحب يطويها.
 *  ⑥ الإصدار: 4.2.0 (24).
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

describe('الجولة 70 — v4.2.0: ملاحظات التاجر الثلاث', () => {
  test('① الشريط السفلي مثبت كما كان — لا يغطي زر الإضافة للسلة', () => {
    const nav = stripComments(read('src/navigation/RootNavigator.tsx'));
    // مثبت: خط شعرة علوي وأرضية صلبة — لا طفو فوق المحتوى
    expect(nav).toContain('borderTopWidth: StyleSheet.hairlineWidth');
    expect(nav).not.toContain('marginHorizontal: 14');
    expect(nav).not.toContain('marginBottom: Math.max(insets.bottom, 12) + 4');
    expect(nav).not.toContain('borderRadius: 24,');
    // «فقط طور الأيقونات وشكل الهوفر»: الأيقونات المزدوجة الطبقة
    // والكبسولة النابضة بقيتا بعد عودة الشريط مثبتاً
    expect(nav).toContain('duotone={focused}');
    expect(nav).toContain('usePop');
    expect(nav).toContain('brandSoft');
    // ارتفاع التسمية الثابت (نمط v4.0 المجرب) يمنع الانزياح
    expect(nav).toContain('height: 14');
  });

  test('② صفحة التاجر: سهم المشاركة المكرر أزيل والمشاركة أيقونة فقط', () => {
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    // لا زر مشاركة في التروسة البطولية (كان يشبه سهم رجوع ثانياً)
    expect(store).not.toContain('heroStyles.shareBtn');
    expect(store).not.toContain('name="forward"');
    // لا زر عريض «مشاركة المتجر» بنص مستقل في الصفحة
    expect(store).not.toContain('>مشاركة المتجر</Text>');
    // المشاركة أيقونة وحيدة 38px بجوار الاتصال/واتساب
    expect(store).toContain('actionStyles.iconBtn');
    expect(store).toContain('name="share"');
    // تعمل دائماً — شريط الإجراءات لم يعد مشروطاً بالهاتف/الواتساب
    expect(store).not.toContain('{store?.phone || store?.whatsapp ? (');
    // زر الرجوع الوحيد في التروسة باقٍ
    expect(store).toContain('heroStyles.backBtn');
  });

  test('③ البحث من الهيدر: الحقل داخل الشريط اللاصق يظهر عند السكرول', () => {
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    // حقل البحث داخل الشريط اللاصق — ليس مجرد أيقونة تقفز للأعلى
    expect(store).toContain('stickyStyles.searchField');
    expect(store).toContain('stickyStyles.searchInput');
    expect(store).toContain('ref={searchInputRef}');
    // يظهر عند السكرول ويبقى أثناء الكتابة/التركيز مهما نزل التمرير
    expect(store).toContain('const searchActive = searchFocused || query.trim().length > 0;');
    expect(store).toContain('const headerVisible = barShown || searchActive;');
    expect(store).toContain("pointerEvents={headerVisible ? 'auto' : 'none'}");
    // حقل البحث داخل الصفحة أُزيل («وليس من الصفحة»)
    expect(store).not.toContain('<SearchBar');
    // مسح سريع من داخل الشريط
    expect(store).toContain('accessibilityLabel="مسح البحث"');
    // رقائق الفلترة بقيت فوق الكتالوج
    expect(store).toContain('FilterChip');
  });

  test('④ أيقونة مشاركة قياسية محايدة الاتجاه في عدّة الأيقونات', () => {
    const icon = stripComments(read('src/components/Icon.tsx'));
    expect(icon).toContain("case 'share':");
    // سهم يصعد من صينية — لا يشبه سهم الرجوع إطلاقاً
    expect(icon).toContain("'share'");
  });

  test('⑤ لوحة المفاتيح فوق البحث: نقرة تعمل فوراً وسحب يطويها', () => {
    const store = stripComments(read('src/screens/stores/StoreScreen.tsx'));
    expect(store).toContain('keyboardShouldPersistTaps="handled"');
    expect(store).toContain('keyboardDismissMode="on-drag"');
  });

  test('⑥ الإصدار: 4.2.0 (24)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '4.2.0'");
    expect(config).toContain('APP_BUILD_CODE = 24');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 24');
    expect(gradle).toContain('versionName "4.2.0"');
  });
});
