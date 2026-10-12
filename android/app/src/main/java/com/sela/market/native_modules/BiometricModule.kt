package com.sela.market.native_modules

import android.annotation.SuppressLint
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.fingerprint.FingerprintManager
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * BiometricModule — سيلا ماركت (v2.1)
 * ─────────────────────────────────────────────────────────────────
 * خيار الدخول بالبصمة مباشرة (طلب الجولة 9). النشاط الرئيسي في RN
 * ليس FragmentActivity فلا يمكن إلحاق حوار androidx.biometric به؛
 * نستخدم مسار بيانات اعتماد الجهاز (KeyguardManager) — نفس ما تفعله
 * البنوك على أي جهاز: شاشة القفل النظامية والبصمة تفتحها مباشرة،
 * ويعمل على كل مستويات API بلا اعتماديات جديدة.
 *
 *  isSupported()          -> Boolean (للجهاز قفل مُفعّل)
 *  hasEnrolledFingerprint() -> Boolean (بصمة مسجلة)
 *  authenticate(reason)   -> Promise<Boolean>
 *    يفتح شاشة بيانات الاعتماد؛ البصمة/النقشة/الرمز كلها مقبولة،
 *    true عند النجاح وfalse عند الإلغاء — لا رفض أبداً.
 */
class BiometricModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  companion object {
    private const val CODE_CREDENTIAL = 4100
  }

  override fun getName(): String = "MarketBiometrics"

  private val keyguard: KeyguardManager?
    get() = reactApplicationContext
      .getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager

  @Suppress("DEPRECATION")
  private fun fingerprintManager(): FingerprintManager? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      reactApplicationContext.getSystemService(Context.FINGERPRINT_SERVICE) as? FingerprintManager
    } else {
      null
    }

  @ReactMethod
  fun isSupported(promise: Promise) {
    try {
      promise.resolve(keyguard?.isDeviceSecure == true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun hasEnrolledFingerprint(promise: Promise) {
    try {
      val fm = fingerprintManager()
      val hardware = fm != null &&
        reactApplicationContext.packageManager
          .hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
      promise.resolve(hardware && fm?.isHardwareDetected == true && fm.isFingerprintEnrolled)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** يفتح شاشة بيانات اعتماد الجهاز — البصمة تفتحها مباشرة. */
  @ReactMethod
  @SuppressLint("deprecation")
  fun authenticate(reason: String, promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity
      val km = keyguard
      if (activity == null || km == null || !km.isDeviceSecure) {
        promise.resolve(false)
        return
      }
      val intent = km.createConfirmDeviceCredentialIntent(
        "الدخول إلى سيلا ماركت",
        reason.ifBlank { "استخدم بصمتك أو رمز القفل للمتابعة" },
      )
      if (intent == null) {
        promise.resolve(false)
        return
      }
      pendingPromise = promise
      activity.startActivityForResult(intent, CODE_CREDENTIAL)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  private var pendingPromise: Promise? = null

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != CODE_CREDENTIAL) {
      return
    }
    val p = pendingPromise
    pendingPromise = null
    // RESULT_OK (-1) = نجاح (بصمة/نقشة/رمز)؛ RESULT_CANCELED = إلغاء
    p?.resolve(resultCode == Activity.RESULT_OK)
  }

  override fun onNewIntent(intent: Intent) {
    // لا شيء — مطلوب بالواجهة فقط
  }
}
