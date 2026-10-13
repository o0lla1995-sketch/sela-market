package com.sela.market.native_modules

import android.annotation.SuppressLint
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * BiometricModule — سيلا ماركت (v2.5 — إعادة كتابة كاملة)
 * ─────────────────────────────────────────────────────────────────
 * المسار القديم (KeyguardManager.createConfirmDeviceCredentialIntent)
 * مهمل من Google منذ API 29 وبه عيوب موثقة على أجهزة كثيرة: يرجع
 * RESULT_CANCELED حتى بعد بصمة/رمز صحيح — فبقي المستخدم عالقاً على
 * شاشة البصمة كل مرة يفتح التطبيق. البديل الرسمي المعتمد الذي
 * تستخدمه تطبيقات البنوك: androidx BiometricPrompt (يتطلب
 * FragmentActivity — MainActivity حُوّلت لـ ReactFragmentActivity).
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

      // ── المسار الحديث: BiometricPrompt عبر FragmentActivity ──
      val fragmentActivity = activity as? FragmentActivity
      if (fragmentActivity != null) {
        val authenticators: Int =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // API 30+: البصمة + بيانات اعتماد الجهاز في نافذة واحدة.
            BiometricManager.Authenticators.BIOMETRIC_WEAK or
              BiometricManager.Authenticators.DEVICE_CREDENTIAL
          } else if (canBiometric()) {
            // API 21–29 مع بصمة: نافذة البصمة فقط (الرمز عبر مسار
            // الإلغاء → زر «كلمة المرور» في الشاشة).
            BiometricManager.Authenticators.BIOMETRIC_WEAK
          } else {
            // بلا بصمة على إصدار قديم → المسار القديم أسفل.
            -1
          }

        if (authenticators != -1) {
          val prompt = BiometricPrompt(
            fragmentActivity,
            ContextCompat.getMainExecutor(fragmentActivity),
            object : BiometricPrompt.AuthenticationCallback() {
              override fun onAuthenticationSucceeded(
                result: BiometricPrompt.AuthenticationResult,
              ) {
                promise.resolve(true)
              }

              override fun onAuthenticationError(
                errorCode: Int,
                errString: CharSequence,
              ) {
                // خطأ المستخدم (إلغاء/محاولات كثيرة) → false؛
                // خطأ النظام أيضاً false — لا تعليق أبداً.
                promise.resolve(false)
              }
            },
          )
          val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("الدخول إلى سيلا ماركت")
            .setSubtitle(reason.ifBlank { "استخدم بصمتك أو رمز القفل للمتابعة" })
            .setAllowedAuthenticators(authenticators)
            // بصمة ناجحة = فتح فوري بلا نقرة تأكيد إضافية.
            .setConfirmationRequired(false)
          // DEVICE_CREDENTIAL مع BIOMETRIC_WEAK لا يقبل نص زر الإلغاء.
          if (authenticators ==
            BiometricManager.Authenticators.BIOMETRIC_WEAK
          ) {
            info.setNegativeButton("إلغاء", ContextCompat.getMainExecutor(fragmentActivity)) { _, _ -> }
          }
          prompt.authenticate(info.build())
          return
        }
      }

      // ── المسار القديم (بلا FragmentActivity أو بلا بصمة قبل API 30):
      // Keyguard القديم — موثوق على الإصدارات التي صُمم لها.
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
