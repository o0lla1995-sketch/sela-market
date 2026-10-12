/**
 * config.ts — ثوابت سيلا ماركت العامة.
 */
import {MMKV} from 'react-native-mmkv';

/** إصدار التطبيق المعروض للمستخدم (يجب أن يطابق versionName في Gradle). */
export const APP_VERSION = '2.2.0';
export const APP_BUILD_CODE = 6;
export const APP_VERSION_LABEL = `${APP_VERSION} (${APP_BUILD_CODE})`;

/**
 * الرابط الافتراضي لخادم سيلا — نفس خادم التراخيص ومنصة المتجر
 * (نشر Coolify واحد) الذي يتصل به تطبيق نقطة البيع بنجاح.
 */
export const DEFAULT_SERVER_URL =
  'http://8jz9a3yyhn3eltmwqgnchn29.130.61.171.201.sslip.io';

/** مهلة كل نداء API قبل الإلغاء (ملي ثانية). */
export const API_TIMEOUT_MS = 20000;

/** حجم صفحة المنتجات الافتراضي. */
export const PRODUCTS_PAGE_SIZE = 12;

/** فاصل استطلاع الطلبات أثناء فتح التطبيق (ملي ثانية). */
export const ORDERS_POLL_INTERVAL_MS = 45000;

/** أقصى عدد عناصر في مركز الإشعارات المحفوظة. */
export const NOTIFICATIONS_MAX = 100;

/** أقصى عدد عمليات بحث حديثة محفوظة. */
export const RECENT_SEARCHES_MAX = 10;

/** حدود الكمية لكل سطر في السلة (مطابقة لتحقق الخادم). */
export const MAX_QTY_PER_LINE = 100000;

/** مخزن MMKV الوحيد للتطبيق — كل المخازن تشترك فيه. */
export const storage = new MMKV({id: 'sela-market'});
