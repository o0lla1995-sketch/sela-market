/**
 * config.ts — ثوابت سيلا ماركت العامة.
 */
import {MMKV} from 'react-native-mmkv';

/** إصدار التطبيق المعروض للمستخدم (يجب أن يطابق versionName في Gradle). */
export const APP_VERSION = '2.6.0';
export const APP_BUILD_CODE = 10;
export const APP_VERSION_LABEL = `${APP_VERSION} (${APP_BUILD_CODE})`;

/**
 * v2.3 — أولوية HTTPS ثم احتياط HTTP (الإصلاح الجذري لاختفاء المنتجات):
 * خمس جولات تجربة أثبتت أن بروكسيات مزودي الجوال في غزة تخزّن وتخرّب
 * HTTP الصريح (304 بجسم فارغ ثم ردود مشوهة) — والتشفير وحده يمنعها
 * نهائياً. الرسمي المعمّى أولاً، والاحتياطي الصريح يُستخدم فقط إن
 * فشل الأول شبكياً (خادمه منزوع مؤقتاً مثلاً) ثم يعود تلقائياً.
 */
export const PRIMARY_SERVER_URL = 'https://market.pornxvideo.com';
export const FALLBACK_SERVER_URL =
  'http://8jz9a3yyhn3eltmwqgnchn29.130.61.171.201.sslip.io';

/** التوافقية مع ما سبق — الرسمي. */
export const DEFAULT_SERVER_URL = PRIMARY_SERVER_URL;

/** مفتاح MMKV لتذكر آخر نقطة ناجحة (sticky). */
export const ENDPOINT_KEY = 'api:endpoint';

/** مهلة كل نداء API قبل الإلغاء (ملي ثانية) — v2.4: خُفّضت من 20 إلى 12
 * ثانية: الفشل يظهر للمستخدم خلال ثوانٍ مع إعادة محاولة فورية على
 * النقطة الأخرى بدل انتظار طويل بلا فائدة على شبكة متعثرة. */
export const API_TIMEOUT_MS = 12000;

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
