/**
 * localNotifications.ts — جسر وحدة Kotlin MarketNotifications:
 * إشعارات نظام محلية لتغيّرات حالة الطلب (قناة market_orders).
 */
import {NativeModules, PermissionsAndroid, Platform} from 'react-native';

interface MarketNotificationsNative {
  areNotificationsEnabled(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  show(id: number, title: string, body: string, kind: string): Promise<boolean>;
}

const native = NativeModules.MarketNotifications as
  | MarketNotificationsNative
  | undefined;

/** هل أذونات الإشعارات ممنوحة الآن؟ (Android 13+ يتطلب طلباً زمنياً) */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (native == null) {
    return false;
  }
  try {
    return await native.areNotificationsEnabled();
  } catch {
    return false;
  }
}

/** طلب إذن POST_NOTIFICATIONS (Android 13+) بحوار النظام. */
export async function requestNotificationsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return areNotificationsEnabled();
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'إشعارات حالة الطلب',
        message: 'نُعلمك حين يقبل المتجر طلبك أو يرسله أو يسلّمه',
        buttonPositive: 'سماح',
        buttonNegative: 'لاحقاً',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** نشر إشعار محلي (id رقمي فريد لكل إشعار). */
export async function showLocalNotification(
  id: number,
  title: string,
  body: string,
  kind: 'order' | 'promo' = 'order',
): Promise<boolean> {
  if (native == null) {
    return false;
  }
  try {
    return await native.show(id, title, body, kind);
  } catch {
    return false;
  }
}
