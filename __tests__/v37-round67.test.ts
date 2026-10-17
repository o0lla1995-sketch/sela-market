/**
 * v37-round67.test.ts — الجولة 67 (v3.7.0): التسجيل على مرحلتين +
 * إصدار Google Play الجديد.
 * ─────────────────────────────────────────────────────────────────
 *  ① شاشة التسجيل مرحلتان: state المرحلة + شرط فتح الثانية بصلاحية
 *     بيانات المرحلة الأولى كاملة.
 *  ② المرحلة الأولى: الاسم + الهوية + الجوال فقط + زر «متابعة».
 *  ③ المرحلة الثانية: كلمة المرور + التأكيد + بطاقة ملخّص البيانات
 *     مع زر تعديل يعيد للمرحلة الأولى.
 *  ④ شريط المراحل (دائرتان + وصلة) أعلى الشاشة.
 *  ⑤ زر رجوع أندرويد على المرحلة الثانية يعود للأولى (beforeRemove
 *     مع preventDefault) ولا يخرج من الشاشة.
 *  ⑥ المنطق الأصلي محفوظ: استدعاء register بنفس الوسائط + وسم
 *     onboarding بعد النجاح + القفزة النظيفة للرئيسية.
 *  ⑦ الإصدار: 3.7.0 (21) — حزمة AAB جديدة كلياً لفك تعارض حزم
 *     Google Play مع versionCode 20 المرفوع سابقاً.
 */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

describe('الجولة 67 — v3.7.0: التسجيل على مرحلتين', () => {
  const screen = read('src/screens/auth/RegisterScreen.tsx');

  test('① حالة المرحلة + بوابة العبور المشروطة بالصلاحية', () => {
    expect(screen).toContain("useState<1 | 2>(1)");
    expect(screen).toContain('const goStage2 = () => {');
    // لا فتح للمرحلة الثانية والحقول الثلاثة غير صالحة.
    expect(screen).toMatch(
      /if \(\s*validateName\(name\) \|\|\s*validateIdNumber\(idNumber\) \|\|\s*validatePhone\(phone\)/,
    );
    expect(screen).toContain('setStage(2)');
  });

  test('② المرحلة الأولى: حقول البيانات + زر متابعة', () => {
    expect(screen).toContain('label="الاسم الكامل"');
    expect(screen).toContain('label="رقم الهوية"');
    expect(screen).toContain('label="رقم الجوال"');
    expect(screen).toContain('label="متابعة"');
    // زر المتابعة يشغّل بوابة العبور.
    expect(screen).toMatch(/label="متابعة" onPress=\{goStage2\}/);
  });

  test('③ المرحلة الثانية: كلمة المرور + الملخص + تعديل البيانات', () => {
    expect(screen).toContain('label="كلمة المرور"');
    expect(screen).toContain('label="تأكيد كلمة المرور"');
    // بطاقة ملخص بيانات المرحلة الأولى.
    expect(screen).toContain('summaryCard');
    expect(screen).toContain('هوية {cleanIdNumber(idNumber)}');
    // زر التعديل يعيد للمرحلة الأولى.
    expect(screen).toMatch(/label="تعديل"[\s\S]{0,120}onPress=\{\(\) => setStage\(1\)\}/);
  });

  test('④ شريط المراحل: دائرتان بوصلتين ووسمان', () => {
    expect(screen).toContain('stepsRow');
    expect(screen).toContain('<StepBadge n={1} label="البيانات"');
    expect(screen).toContain('<StepBadge n={2} label="كلمة المرور"');
    expect(screen).toContain('stepLine');
    // حالة الدائرة: نشطة/مكتملة/قادمة.
    expect(screen).toContain("state: 'active' | 'done' | 'todo'");
  });

  test('⑤ رجوع أندرويد من المرحلة الثانية يعود للأولى', () => {
    expect(screen).toMatch(
      /beforeRemove[\s\S]{0,220}e\.preventDefault\(\);[\s\S]{0,60}setStage\(1\);/,
    );
  });

  test('⑥ المنطق الأصلي محفوظ حرفياً', () => {
    // نفس وسائط الاستدعاء.
    expect(screen).toMatch(
      /await register\(\s*cleanIdNumber\(idNumber\),\s*name\.trim\(\),\s*cleanPhone\(phone\),\s*password,\s*\)/,
    );
    // وسم onboarding بعد النجاح فقط.
    expect(screen).toContain('setOnboarded()');
    // القفزة النظيفة للرئيسية من الترحيب.
    expect(screen).toContain("below === 'Welcome'");
    expect(screen).toContain("navigation.reset({index: 0, routes: [{name: 'Main'}]})");
  });

  test('⑦ الإصدار 3.7.0 (21) — حزمة جديدة لفك تعارض Google Play', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('versionCode 24');
    expect(gradle).toContain('versionName "4.2.0"');
    const config = read('src/core/config.ts');
    expect(config).toContain("APP_VERSION = '4.2.0'");
    expect(config).toContain('APP_BUILD_CODE = 24');
  });

  test('⑧ أيقونة المتجر 512×512 موجودة بأبعادها الصحيحة', () => {
    const sizeOf = (p: string) => {
      const b = require('fs').readFileSync(p);
      // PNG: العرض عند البايت 16، الارتفاع عند 20 (big-endian).
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };
    const [w, h] = sizeOf('assets/brand/app-icon-512.png');
    expect(w).toBe(512);
    expect(h).toBe(512);
  });
});
