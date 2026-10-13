package com.sela.market

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import java.util.Locale
import com.facebook.react.ReactFragmentActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * v2.5: ReactFragmentActivity بدل ReactActivity — حوار BiometricPrompt
 * الرسمي (مسار البنوك المعتمد) يحتاج FragmentActivity.
 * كل تسلسل RN العام محفوظ كما هو — هذه الفئة تصل بواسطة نفس
 * المنطق (نفس delegate ونفس الواجهات) مع دعم الـ Fragments.
 */
class MainActivity : ReactFragmentActivity() {

    /**
     * The name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "SelaMarket"

    /**
     * سيلا ماركت تطبيق عربي أولاً. الطبقة العليا (JS) تستدعي
     * I18nManager.forceRTL لكن ذلك يسري بعد إعادة تشغيل العملية فقط
     * وهشّ على بعض واجهات الشركات المصنعة. فرض اللغة العربية واتجاه
     * RTL على مستوى الـ Activity يجعل كل شاشة وكل قائمة أفقية وكل
     * إشعار نظام يُرسم من اليمين إلى اليسار على أي جهاز (عبرية أو
     * إنجليزية) ومن أول إطار.
     */
    override fun attachBaseContext(newBase: Context) {
        val locale = Locale("ar")
        Locale.setDefault(locale)
        val config = Configuration(newBase.resources.configuration)
        config.setLocale(locale)
        config.setLayoutDirection(locale)
        super.attachBaseContext(newBase.createConfigurationContext(config))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // MarketSplash theme is set in AndroidManifest — keep it on the window until
        // React paints the first frame, then let the default theme take over.
        setTheme(R.style.AppTheme)
        super.onCreate(savedInstanceState)
    }

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use
     * [DefaultReactActivityDelegate] which allows you to enable New Architecture
     * with a single boolean flag [fabricEnabled].
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
