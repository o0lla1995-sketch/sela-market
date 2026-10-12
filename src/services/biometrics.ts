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
