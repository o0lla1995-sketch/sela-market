package com.sela.market

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.sela.market.native_modules.MarketPackage
import java.util.Locale

class MainApplication : Application(), ReactApplication {

  /**
   * سيلا ماركت عربي أولاً على مستوى العملية كلها. فرض اللغة ar واتجاه
   * RTL على سياق التطبيق يعني أن كل سياق مشتق — كل Activity وسياق
   * React والإشعارات التي نبنيها منه — يحمل إعدادات عربية RTL بغض
   * النظر عن لغة الجهاز نفسه (أجهزة عبرية/إنجليزية مشمولة). هذا ما
   * يجعل إشعارات حالة الطلب تُعرض من اليمين إلى اليسار دون انقطاع
   * عند الحافة اليسرى، ويبقي I18nManager.isRTL صحيحاً منذ الإطلاق.
   */
  override fun attachBaseContext(base: Context) {
    val locale = Locale("ar")
    Locale.setDefault(locale)
    val config = Configuration(base.resources.configuration)
    config.setLocale(locale)
    config.setLayoutDirection(locale)
    super.attachBaseContext(base.createConfigurationContext(config))
  }

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // وحدة الإشعارات المحلية (حالة الطلب) — الوحدة الأصلية
              // الوحيدة التي يحتاجها تطبيق المتجر.
              add(MarketPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // RN 0.76+: merged native libraries — SoLoader must be handed the
    // merged .so mapping instead of the legacy `false` flag.
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
