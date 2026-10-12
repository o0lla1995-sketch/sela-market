package com.sela.market.native_modules

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.sela.market.R

/**
 * NotificationsModule — سيلا ماركت
 * ─────────────────────────────────────────────────────────────────
 * إشعارات نظام محلية لتغيّرات حالة طلبات المستخدم (قبول/رفض/إرسال/
 * تسليم/إلغاء/إرجاع). لا خدمة push خارجية — الطبقة العليا تستطلع
 * الطلبات دورياً أثناء فتح التطبيق وتطلق هذه الإشعارات عند التغيّر.
 *
 *  areNotificationsEnabled() -> Boolean
 *  requestPermission()       -> Boolean (حالة Android 13+ فقط)
 *  show(id, title, body, kind) -> نشر على قناة "market_orders"
 */
class NotificationsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val CHANNEL_ORDERS = "market_orders"
    const val CHANNEL_PROMOS = "market_promos"
  }

  override fun getName(): String = "MarketNotifications"

  init {
    createChannels()
  }

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = reactApplicationContext
      .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val orders = NotificationChannel(
      CHANNEL_ORDERS,
      "تحديثات الطلبات",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "قبول المتجر لطلبك، إرساله، وتأكيد التسليم"
    }
    val promos = NotificationChannel(
      CHANNEL_PROMOS,
      "العروض والجديد",
      NotificationManager.IMPORTANCE_DEFAULT
    ).apply {
      description = "عروض المتاجر والمنتجات الجديدة"
    }
    nm.createNotificationChannel(orders)
    nm.createNotificationChannel(promos)
  }

  private fun hasPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
    } else {
      NotificationManagerCompat.from(reactApplicationContext).areNotificationsEnabled()
    }
  }

  @ReactMethod
  fun areNotificationsEnabled(promise: Promise) {
    try {
      promise.resolve(hasPermission())
    } catch (e: Exception) {
      promise.reject("E_NOTIF", e.message, e)
    }
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    try {
      // الحوار الفعلي يفوَّض إلى PermissionsAndroid في الطبقة العليا —
      // هنا نُبلّغ عن الحالة الحالية فقط.
      promise.resolve(hasPermission())
    } catch (e: Exception) {
      promise.reject("E_NOTIF", e.message, e)
    }
  }

  /** فتح التطبيق عند لمس الإشعار (الشاشة الرئيسية للتطبيق). */
  private fun contentIntent(): PendingIntent {
    val intent = reactApplicationContext.packageManager
      .getLaunchIntentForPackage(reactApplicationContext.packageName)
      ?: Intent()
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    return PendingIntent.getActivity(
      reactApplicationContext, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  @ReactMethod
  fun show(id: Int, title: String, body: String, kind: String, promise: Promise) {
    try {
      if (!hasPermission()) {
        promise.resolve(false)
        return
      }
      val ctx = reactApplicationContext
      val channel = if (kind == "promo") CHANNEL_PROMOS else CHANNEL_ORDERS
      // عربي أولاً: سياق التطبيق نفسه عربي RTL (MainApplication يفرض
      // ذلك)، والبنّاء يرث الإعدادات. وبصفتها ضمانة نصية إضافية على
      // أي واجهة نظام، يُسبق كل نص بـ RLM (U+200F) ليكون اتجاه
      // الفقرة من اليمين إلى اليسار.
      val rlm = "\u200F"
      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(ctx, channel)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(ctx)
      }
      val notification = builder
        .setSmallIcon(R.drawable.ic_stat_market)
        .setContentTitle(rlm + title)
        .setContentText(rlm + body)
        .setStyle(Notification.BigTextStyle().bigText(rlm + body))
        .setContentIntent(contentIntent())
        .setAutoCancel(true)
        .build()
      NotificationManagerCompat.from(ctx).notify(id, notification)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_NOTIF", e.message, e)
    }
  }
}
