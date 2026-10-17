/**
 * v36-round66.test.ts — الجولة 66 (v3.6.0): ملاحظات المستخدم الثمانية
 * لتصميم متجر سيلا — حرس عدم التراجع.
 * ─────────────────────────────────────────────────────────────────
 *  ① شريط «أضف للسلة»: بلا insets.bottom (كان يترك هامشاً ميتاً كبيراً
 *     فوق الهيدر السفلي ويكبر مع الشاشات) + سقف محتوى 720 للشاشات
 *     العريضة + سقف معرض الصور 440 (تجاوب مع حجم الشاشة).
 *  ② صفحة المتجر: gap عمودي بين صفوف البطاقات (كانت ملاصقة).
 *  ③ صفحة المنتج: معاينة صور احترافية — مصغّرات قابلة للنقر أسفل
 *     الصورة + عارض ملء الشاشة بتكبير القرصة والنقر المزدوج وسحب
 *     الصورة المكبّرة مع قفل تقليب الصفحات أثناء التكبير.
 *  ④ بانر الانقطاع: طبقة عائمة داخل الإطار الآمن (position:absolute +
 *     paddingTop بإخلاء شريط الحالة) لا تُزيح جذر التنقل.
 *  ⑤ الترحيب: إغلاق نافذة الدخول/التسجيل يعود للترحيب — وسم
 *     onboarding يتم بعد نجاح الدخول/التسجيل فعلاً أو عند الزائر فقط.
 *  ⑥ بوابة البصمة: لا «الدخول بدون بصمة» (كان يكسر البصمة) — بديلها
 *     زر تسجيل خروج نظيف.
 *  ⑦ بطاقات الأقسام بالرئيسية: صورة (ميدالية) وعنوان فقط بلا تفاصيل.
 *  ⑧ بطاقات المنتجات المخفضة: شارة عرض عائمة + إطار أحمر + صف سعر
 *     جديد (نهائي كبير بالأحمر + أصلي مشطوب + «وفّر») بلا نص فوق التصوير.
 *  ⑨ الإصدار: 3.6.0 (20).
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

describe('الجولة 66 — v3.6.0: ملاحظات التصميم الثمانية', () => {
  test('① شريط الشراء: بلا إخلاء نظام ميت + تجاوب الشاشات الكبيرة', () => {
    const ui = read('src/components/ui.tsx');
    // لا insets.bottom في حاشية الشريط — القائمة السفلية تستهلكه.
    expect(ui).not.toContain('paddingBottom: insets.bottom + 10');
    expect(ui).toContain('paddingBottom: 10');
    // سقف المحتوى الموسّط على الشاشات العريضة.
    expect(ui).toContain('maxWidth: 720');

    const screen = read('src/screens/product/ProductScreen.tsx');
    // إخلاء المحتوى فوق الشريط بلا insets.bottom.
    expect(screen).toContain('const barClearance = 128');
    expect(screen).not.toContain('insets.bottom + 132');
    // سقف معرض الصور على الشاشات الكبيرة (تجاوب) + عرض صفحة يساوي
    // حاوية المعرض ليصحّ التقليب المقضم (screenWidth وحده كان يكسره).
    expect(screen).toContain('const galleryPageWidth = screenWidth - spacing.md * 2;');
    expect(screen).toContain('Math.min(galleryPageWidth, 440)');
  });

  test('② صفحة المتجر: تباعد عمودي بين صفوف البطاقات', () => {
    const screen = read('src/screens/stores/StoreScreen.tsx');
    // gap على حاوية المحتوى = تنفّس عمودي بين الصفوف.
    expect(screen).toMatch(/contentContainerStyle=\{\{\s*\n\s*gap: spacing\.md,/);
    // الهامش الجانبي محفوظ من v3.5.
    expect(screen).toContain('paddingHorizontal: spacing.lg');
  });

  test('③ معاينة الصور: مصغّرات + عارض بتكبير قرصة ونقر مزدوج', () => {
    const screen = read('src/screens/product/ProductScreen.tsx');
    // شريط المصغّرات القابل للنقر مع إبراز النشطة.
    expect(screen).toContain('galleryStyles.thumbsRow');
    expect(screen).toContain('jumpToImage');
    expect(screen).toContain("borderColor: active ? palette.brand : palette.line");
    // القفز لمصغّرة يمرّ بالعارض الأفقي (RTL سالب بمقياس عرض الصفحة).
    expect(screen).toContain('I18nManager.isRTL ? -clamped * pageW');
    // عارض التكبير: قرصة + نقر مزدوج + سحب مقصوص + قفل التقليب.
    expect(screen).toContain('function ZoomableImage');
    expect(screen).toContain('PanResponder.create');
    expect(screen).toContain('Math.min(5, pinchBase.current');
    expect(screen).toContain('toValue: 2.5');
    expect(screen).toContain('scrollEnabled={!viewerZoomed}');
    expect(screen).toContain('onPanResponderTerminationRequest: () => false');
    // النقاط القديمة أُزيلت (المصغّرات بديلها).
    expect(screen).not.toContain('galleryStyles.dotsRow');
  });

  test('④ بانر الانقطاع: عائم داخل الإطار الآمن بلا إزاحة محتوى', () => {
    const app = read('src/App.tsx');
    // طبقة مطلقة أعلى الشاشة داخل إخلاء شريط الحالة.
    expect(app).toContain('position: \'absolute\'');
    expect(app).toContain('paddingTop: insets.top + 6');
    // لا يُزيح المحتوى ولا يعترض اللمس.
    expect(app).toContain('pointerEvents="none"');
    // جذر التنقل يُرسم قبل البانر (البانر طبقة فوقه لا عنصر قبله).
    const navIdx = app.indexOf('<RootNavigator />');
    const bannerIdx = app.indexOf('{offline ? <OfflineBanner /> : null}');
    expect(navIdx).toBeGreaterThan(-1);
    expect(bannerIdx).toBeGreaterThan(navIdx);
  });

  test('⑤ الترحيب: الإغلاق يعود للترحيب — الوسم بعد النجاح فقط', () => {
    const welcome = read('src/screens/onboarding/WelcomeScreen.tsx');
    // الزائر فقط يوسم فوراً.
    expect(welcome).toContain("if (mode === 'guest') {\n      setOnboarded();\n      return;");
    // لا وسم عام قبل فتح النوافذ.
    expect(welcome).not.toContain("const start = (mode: 'guest' | 'login' | 'register') => {\n    setOnboarded();");

    const login = read('src/screens/auth/LoginScreen.tsx');
    // الدخول يوسم بعد النجاح فقط (داخل finishLogin).
    expect(login).toContain(
      'const finishLogin = (message?: string) => {\n    useSettingsStore.getState().setOnboarded();',
    );

    const register = read('src/screens/auth/RegisterScreen.tsx');
    // التسجيل كذلك — بعد نجاح التسجيل فقط.
    expect(register).toContain('if (ok) {');
    expect(register).toContain('useSettingsStore.getState().setOnboarded();');
  });

  test('⑥ بوابة البصمة: لا دخول بدون بصمة — بديلها تسجيل الخروج', () => {
    const gate = read('src/screens/auth/BiometricGateScreen.tsx');
    // المسار الالتفافي أُزيل كلياً — لا زر يفتح الجلسة بلا تحقق.
    expect(gate).not.toContain("onPress={() => navigation.replace('Main')}");
    // ولا نص الزر في الواجهة (التعليقات التوثيقية وحدها تذكره تاريخياً).
    expect(gate).not.toMatch(/>\s*الدخول بدون بصمة\s*</);
    // بديل تسجيل الخروج النظيف.
    expect(gate).toContain('const doLogout');
    expect(gate).toContain('stopOrdersSync()');
    expect(gate).toContain('useAuthStore.getState().logout()');
    expect(gate).toContain('تسجيل الخروج من التطبيق');
  });

  test('⑦ بطاقات الأقسام: صورة وعنوان فقط بلا تفاصيل', () => {
    const home = read('src/screens/home/HomeScreen.tsx');
    // ميدالية دائرية ناعمة كبيرة + الاسم فقط.
    expect(home).toContain('backgroundColor: tile.soft');
    expect(home).toContain('color={tile.solid}');
    // لا عدّاد منتجات ولا أي تفاصيل ثانوية.
    expect(home).not.toContain('{item.n} منتجاً');
  });

  test('⑧ بطاقات العروض: شارة عائمة + إطار أحمر + صف سعر جديد', () => {
    const card = read('src/components/ProductCard.tsx');
    // شارة العرض العائمة فوق حد البطاقة.
    expect(card).toContain('styles.dealBadge');
    expect(card).toContain('top: -9');
    // إطار أحمر مائل للبطاقة المخفضة.
    expect(card).toContain("borderColor: discounted ? palette.danger + 'B3'");
    // رقاقة الخصم الصلبة (نص أبيض + أيقونة الشعلة) لا الناعمة القديمة.
    expect(card).toContain('name="flame" size={11} color="#FFFFFF"');
    // رقاقة «نفدت» التشاركية تبقى ناعمة (dangerSoft) — تمييز العروض فقط.
    expect(card).toContain("[styles.chip, {backgroundColor: palette.dangerSoft}]");
    // صف السعر الجديد: نهائي بالأحمر + أصلي مشطوب + «وفّر».
    expect(card).toContain('[styles.price, {color: palette.danger}]');
    expect(card).toContain('وفّر {formatMoney(savedMinor)}');
    // التصوير يبقى نظيفاً: لا نص فوق الصورة نفسها.
    expect(card).not.toContain('tag');
  });

  test('⑨ الإصدار: 3.6.0 (20)', () => {
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '4.2.0'");
    expect(config).toContain('APP_BUILD_CODE = 24');
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 24');
    expect(gradle).toContain('versionName "4.2.0"');
  });
});
