package com.sela.market.native_modules

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

/**
 * MarketPackage — الحزمة الأصلية الوحيدة لتطبيق سيلا ماركت:
 * وحدة الإشعارات المحلية (تحديثات حالة الطلبات).
 */
class MarketPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(NotificationsModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<View, ReactShadowNode<*>>> = emptyList()
}
