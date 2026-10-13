/**
 * biometrics.ts — جسر وحدة الدخول بالبصمة الأصلية (v2.1).
 * ─────────────────────────────────────────────────────────────────
 * MarketBiometrics (Kotlin): isSupported / hasEnrolledFingerprint /
 * authenticate(reason) → Promise<boolean>. مسار بيانات اعتماد الجهاز
 * — شاشة القفل النظامية والبصمة تفتحها مباشرة.
 */
import {NativeModules, Platform} from 'react-native';

interface MarketBiometricsNative {
  isSupported(): Promise<boolean>;
  hasEnrolledFingerprint(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}

const native =
  Platform.OS === 'android'
    ? (NativeModules.MarketBiometrics as MarketBiometricsNative | undefined)
    : undefined;

/** هل يدعم الجهاز الدخول بالبصمة/قفل الجهاز؟ */
export async function biometricsSupported(): Promise<boolean> {
  try {
    return native != null ? await native.isSupported() : false;
  } catch {
    return false;
  }
}

/** هل توجد بصمة مسجلة (لعرض «سجّل بصمة من إعدادات الجهاز» عند غيابها). */
export async function fingerprintEnrolled(): Promise<boolean> {
  try {
    return native != null ? await native.hasEnrolledFingerprint() : false;
  } catch {
    return false;
  }
}

/** محادثة واحدة — true عند نجاح البصمة/الرمز، false عند الإلغاء. */
export async function authenticateBiometric(reason: string): Promise<boolean> {
  try {
    return native != null ? await native.authenticate(reason) : false;
  } catch {
    return false;
  }
}

/* ── v2.5: حالة قفل البصمة — قتل سباق إعادة القفل ──────────────
 * حوار المصادقة نشاط منفصل، فتطبيق الرئيسي يذهب للخلفية ثم يعود
 * عند إغلاقه. مستمع إعادة القفل في RootNavigator (v2.3) يفتح البوابة
 * عند كل عودة من الخلفية — وبدون هذا الحارس كان يُعاد قفل التطبيق
 * في وجه المستخدم في نفس اللحظة التي نجحت فيها بصمته (السبب الخفي
 * الثاني لبقاء المستخدم «عالقاً على شاشة البصمة»). */
let biometricAuthInFlight = false;
let lastBiometricUnlockAt = 0;

/** قبل بدء محاولة المصادقة (بصمة أو مسار الرمز القديم). */
export function markBiometricAuthStarted(): void {
  biometricAuthInFlight = true;
}

/** بعد انتهاء المحاولة — ok=true يسجل لحظة الفتح. */
export function markBiometricAuthEnded(ok: boolean): void {
  biometricAuthInFlight = false;
  if (ok) {
    lastBiometricUnlockAt = Date.now();
  }
}

/** هل نتجاهل إعادة القفل الآن؟ (مصادقة جارية أو فتح نجح قبل لحظات) */
export function shouldSuppressReLock(): boolean {
  return (
    biometricAuthInFlight || Date.now() - lastBiometricUnlockAt < 3000
  );
}
