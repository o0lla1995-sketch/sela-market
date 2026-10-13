package com.sela.market.native_modules

import android.os.Build
import android.os.Bundle
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * BiometricDialogActivity — سيلا ماركت (v2.5).
 * ─────────────────────────────────────────────────────────────────
 * حوار BiometricPrompt الرسمي (مسار البنوك) يتطلب FragmentActivity،
 * وRN 0.74 لا يوفر ReactFragmentActivity وتبديل MainActivity نفسها
 * فشل في البناء. الحل المعياري: نشاط شفاف بلا واجهة يستضيف الحوار
 * فقط، يفتح فوق التطبيق، يعرض نافذة النظام (بصمة/رمز/نقشة)، ثم
 * يسلم النتيجة للوحدة عبر BiometricBridge ويغلق نفسه فوراً.
 *
 * يظهر للمستخدم تماماً كأن الحوار خرج من التطبيق نفسه.
 */
class BiometricDialogActivity : FragmentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val reason = intent.getStringExtra(EXTRA_REASON) ?: ""

    val authenticators: Int =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // API 30+: البصمة + بيانات اعتماد الجهاز في نافذة واحدة.
        BiometricManager.Authenticators.BIOMETRIC_WEAK or
          BiometricManager.Authenticators.DEVICE_CREDENTIAL
      } else {
        // API 21–29: نافذة البصمة (الرمز عبر مسار الإلغاء).
        BiometricManager.Authenticators.BIOMETRIC_WEAK
      }

    val prompt = BiometricPrompt(
      this,
      ContextCompat.getMainExecutor(this),
      object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(
          result: BiometricPrompt.AuthenticationResult,
        ) {
          BiometricBridge.report(true)
          finish()
        }

        override fun onAuthenticationError(
          errorCode: Int,
          errString: CharSequence,
        ) {
          // إلغاء المستخدم أو خطأ النظام — كلاهما «لم يُفتح» بلا تعليق.
          BiometricBridge.report(false)
          finish()
        }
      },
    )

    val info = BiometricPrompt.PromptInfo.Builder()
      .setTitle("الدخول إلى سيلا ماركت")
      .setSubtitle(reason.ifBlank { "استخدم بصمتك أو رمز القفل للمتابعة" })
      .setAllowedAuthenticators(authenticators)
      // بصمة ناجحة = فتح فوري بلا نقرة تأكيد إضافية.
      .setConfirmationRequired(false)

    if (authenticators == BiometricManager.Authenticators.BIOMETRIC_WEAK) {
      // الوضع البصمي وحده يتطلب نص زر إلغاء (setNegativeButtonText —
      // اسم الـ API في 1.1.0)؛ مع بيانات اعتماد الجهاز (API 30+)
      // يرفض النظام الجمع بينهما.
      info.setNegativeButtonText("إلغاء")
    }

    try {
      prompt.authenticate(info.build())
    } catch (e: Exception) {
      // جهاز شاذ يرفض الإعداد — نغلق بأمان بدل شاشة سوداء.
      BiometricBridge.report(false)
      finish()
    }
  }

  /** زر الرجوع أثناء الحوار = إلغاء نظيف لا شاشة عالقة. */
  override fun onBackPressed() {
    BiometricBridge.report(false)
    finish()
  }

  /** شبكة أمان: أي خروج من النشاط بلا نتيجة = فشل نظيف (no-op إن
   *  سُلّمت النتيجة أصلاً — report يصفّر المستمع بعد أول تسليم). */
  override fun onDestroy() {
    super.onDestroy()
    BiometricBridge.report(false)
  }

  companion object {
    const val EXTRA_REASON = "reason"
  }
}

/** قناة تسليم النتيجة بين النشاط الشفاف والوحدة الأصلية. */
object BiometricBridge {
  @Volatile
  var onResult: ((Boolean) -> Unit)? = null

  fun report(ok: Boolean) {
    val cb = onResult
    onResult = null
    cb?.invoke(ok)
  }
}
