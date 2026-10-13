package com.sela.market.native_modules

import android.annotation.SuppressLint
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.biometric.BiometricManager
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * BiometricModule — سيلا ماركت (v2.5 — إعادة كتابة كاملة).
 * ─────────────────────────────────────────────────────────────────
 * المسار القديم (KeyguardManager.createConfirmDeviceCredentialIntent)
 * مهمل من Google منذ API 29 وبه عيوب موثقة على أجهزة كثيرة: يرجع
 * RESULT_CANCELED حتى بعد بصمة/رمز صحيح — فبقي المستخدم عالقاً على
 * شاشة البصمة كل مرة يفتح التطبيق.
 *
 * البديل الرسمي المعتمد (نفس مسار تطبيقات البنوك): androidx
 * BiometricPrompt — لكنه يتطلب FragmentActivity وRN 0.74 لا يوفر
 * ReactFragmentActivity، لذلك يستضيفه نشاط شفاف مخصص
 * (BiometricDialogActivity) يفتح فوق التطبيق ويسلّم النتيجة عبر
 * BiometricBridge. MainActivity تبقى ReactActivity كما هي.
 *
 *  isSupported()            -> جهاز فيه قفل آمن (بصمة/نقشة/رمز)
 *  hasEnrolledFingerprint() -> بصمة مسجلة (أو قفل آمن كحد أدنى)
 *  authenticate(reason)     -> Promise<Boolean>
 *    • API 30+: نافذة النظام تقبل البصمة أو الرمز أو النقشة معاً.
 *    • API 21–29 مع بصمة: نافذة البصمة (BiometricPrompt المتوافق).
 *    • API 21–29 بلا بصمة (قفل فقط): مسار Keyguard القديم —
 *      موثوق على هذه الإصدارات القديمة التي صُمم لها.
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

  /** هل يستطيع المحرك إثبات الهوية ببيانات حيوية ضعيفة (بصمة/وجه)؟ */
  private fun canBiometric(): Boolean =
    try {
      BiometricManager.from(reactApplicationContext)
        .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) ==
        BiometricManager.BIOMETRIC_SUCCESS
    } catch (e: Exception) {
      false
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
      // v2.5: BiometricManager الرسمي بدل FingerprintManager المهمل —
      // يغطي البصمة والوجه معاً على كل الإصدارات.
      val secure = keyguard?.isDeviceSecure == true
      promise.resolve(canBiometric() || secure)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** فتح نافذة المصادقة — Promise<Boolean> (true = نجاح). */
  @ReactMethod
  fun authenticate(reason: String, promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity
      if (activity == null || keyguard?.isDeviceSecure != true) {
        promise.resolve(false)
        return
      }

      // ── المسار الحديث: نشاط شفاف يستضيف BiometricPrompt ──
      // API 30+ أو (21–29 مع بصمة مسجلة).
      val useBiometricPrompt =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.R || canBiometric()
      if (useBiometricPrompt) {
        BiometricBridge.onResult = { ok ->
          // قد يصل الرد من خيط آخر — resolve آمن من أي خيط.
          promise.resolve(ok)
        }
        val intent = Intent(activity, BiometricDialogActivity::class.java)
        intent.putExtra(BiometricDialogActivity.EXTRA_REASON, reason)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
        return
      }

      // ── المسار القديم: بلا بصمة قبل API 30 (قفل فقط) — Keyguard
      // القديم موثوق على الإصدارات التي صُمم لها.
      val km = keyguard
      if (km == null) {
        promise.resolve(false)
        return
      }
      @SuppressLint("deprecation")
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
    p?.resolve(resultCode == Activity.RESULT_OK)
  }

  override fun onNewIntent(intent: Intent) {
    // لا شيء — مطلوب بالواجهة فقط
  }
}
