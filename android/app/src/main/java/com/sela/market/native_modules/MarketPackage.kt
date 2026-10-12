package com.sela.market.native_modules

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

/**
 * MarketPackage — الحزم الأصلية لتطبيق سيلا ماركت:
 * إشعارات حالة الطلبات المحلية + الدخول بالبصمة (v2.1).
 */
class MarketPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(NotificationsModule(reactContext), BiometricModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<View, ReactShadowNode<*>>> = emptyList()
}
