/**
 * client.ts — عميل HTTP لمنصة سيلا ماركت.
 * ─────────────────────────────────────────────────────────────────
 * • v2.3 — الإصلاح الجذري لاختفاء المنتجات (الجولة السادسة):
 *   تشخيص خمس جولات سابقة عالج كلٌّ منها عرضاً (304 ثم ردود 200 مشوهة
 *   على شبكة المستخدم) بينما السبب الفعلي واحد: التطبيق كان يتخاطب
 *   مع الخادم عبر HTTP صريح، وبعض بروكسيات مزودي الجوال في غزة
 *   تعترض النص الصريح وتخزّنه وتخرّبه — والتشفير (HTTPS) هو العلاج
 *   الوحيد الذي يستحيل على أي وسيط عبثه.
 *   البنية الجديدة:
 *   1) نقطة رسمية معمّاة: https://market.pornxvideo.com (أساسية).
 *   2) نقطة احتياطية صريحة (نشر sslip.io) تُستخدم تلقائياً فقط عند
 *      فشل الأساسية فشلاً شبكياً، مع عودة تلقائية للأساسية.
 *   3) sticky: آخر نقطة ناجحة تُستخدم أولاً في الجلسة نفسها لتقليل
 *      زمن أول نداء، مع تجربة الأخرى فور أول فشل.
 * • رمز الجلسة في ترويسة x-market-token (نفس ترويسة الخادم).
 * • مهلة 20 ثانية عبر AbortController + رسالة عربية واضحة عند الفشل.
 * • Accept-Encoding: identity — بعض شبكات الجوال تفسد الردود المضغوطة.
 * • إعادة محاولة تلقائية (حتى 3 محاولات بتباعد متصاعد + تبديل نقطة
 *   النهاية بين المحاولات) لأخطاء الشبكة على القراءات.
 * • 304 من وسيط مكسور: إعادة فورية برابط فريد (كسر الكاش).
 * • أخطاء الخادم {ok:false, error:CODE} تُحوّل إلى ApiError برسالة
 *   عربية جاهزة للعرض مع الاحتفاظ بالرمز والحقول الإضافية.
 */
import {
  API_TIMEOUT_MS,
  ENDPOINT_KEY,
  FALLBACK_SERVER_URL,
  PRIMARY_SERVER_URL,
  storage,
} from '../core/config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** رسائل أخطاء إضافية لتدفق الاستعادة بالرمز (v2.3). */
export function apiErrorText(code: string): string {
  switch (code) {
    case 'FORGOT_DISABLED':
      return 'استعادة كلمة المرور معطّلة — تواصل مع الإدارة';
    case 'SMS_NOT_CONFIGURED':
      return 'خدمة الرسائل غير مهيأة على الخادم — تواصل مع الإدارة';
    case 'SMS_SEND_FAILED':
      return 'تعذر إرسال رمز التحقق — حاول بعد قليل';
    case 'BAD_CODE':
      return 'رمز التحقق غير صحيح أو منتهي — اطلب رمزاً جديداً';
    case 'TOO_MANY_CODES':
      return 'طلبت رموزاً كثيرة — انتظر ساعة ثم أعد المحاولة';
    case 'BAD_ID_NUMBER':
      return 'رقم الهوية يجب أن يكون 9 أرقام';
    case 'BAD_NAME':
      return 'الاسم غير صالح (2–60 حرفاً)';
    case 'BAD_PHONE':
      return 'رقم الجوال غير صالح';
    case 'BAD_PASSWORD':
      return 'كلمة المرور: 8 أحرف على الأقل وتحتوي رقماً وحرفاً';
    case 'BAD_CURRENT_PASSWORD':
      return 'كلمة المرور الحالية غير صحيحة';
    case 'PASSWORD_REQUIRED':
      return 'هذا الحساب محمي بكلمة مرور — سجّل الدخول بها';
    case 'ACCOUNT_LOCKED':
      return 'أُقفل الحساب مؤقتاً بعد محاولات خاطئة متكررة — حاول بعد ربع ساعة';
    case 'ID_ALREADY_REGISTERED':
      return 'رقم الهوية مسجل مسبقاً — سجّل الدخول بدلاً من التسجيل';
    case 'BAD_CREDENTIALS':
      return 'رقم الهوية أو كلمة المرور غير صحيحة';
    case 'AUTH_REQUIRED':
      return 'انتهت الجلسة — سجّل الدخول من جديد';
    case 'STORE_NOT_FOUND':
      return 'المتجر غير متاح حالياً (قد أوقف نشره مؤقتاً)';
    case 'BAD_ITEMS':
      return 'محتويات السلة غير صالحة — راجعها وحاول مجدداً';
    case 'BAD_REGION':
      return 'منطقة التوصيل المختارة لم تعد متاحة';
    case 'PRODUCT_NOT_FOUND':
      return 'أحد المنتجات لم يعد متاحاً لدى المتجر';
    case 'BAD_QUANTITY':
      return 'كمية أحد المنتجات غير صالحة';
    case 'ORDER_NOT_FOUND':
      return 'الطلب غير موجود';
    case 'BAD_STATUS':
      return 'حالة الطلب تغيّرت على الخادم — حدّث الصفحة وحاول مجدداً';
    case 'ALREADY_RATED':
      return 'قيّمت هذا الطلب من قبل — شكراً لك';
    case 'BAD_RATING':
      return 'اختر عدد النجوم (1–5)';
    case 'ADDRESS_NOT_FOUND':
      return 'العنوان غير موجود — حدّث الصفحة';
    case 'TOO_MANY_ADDRESSES':
      return 'وصلت الحد الأقصى (10 عناوين) — احذف واحداً لإضافة آخر';
    case 'ACCOUNT_DELETED':
      return 'تم حذف هذا الحساب';
    case 'RATE_LIMITED':
      return 'محاولات كثيرة جداً — انتظر قليلاً ثم أعد المحاولة';
    default:
      return 'حدث خطأ غير متوقع — حاول مجدداً';
  }
}

/* ── v2.3: إدارة نقاط النهاية (أساسية HTTPS + احتياطية + sticky) ── */

const ENDPOINTS = [PRIMARY_SERVER_URL, FALLBACK_SERVER_URL] as const;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/** يقرأ آخر نقطة ناجحة (sticky) — تُفضَّل في الجلسة الحالية. */
function loadPreferredIndex(): number {
  try {
    const saved = storage.getString(ENDPOINT_KEY);
    if (saved != null) {
      const idx = Number(saved);
      if (idx >= 0 && idx < ENDPOINTS.length) {
        return idx;
      }
    }
  } catch {
    /* تجاهل */
  }
  return 0;
}

function savePreferredIndex(idx: number): void {
  try {
    storage.set(ENDPOINT_KEY, String(idx));
  } catch {
    /* تجاهل */
  }
}

export function currentBaseUrl(): string {
  return normalizeUrl(ENDPOINTS[loadPreferredIndex()]);
}

/** يحوّل مساراً نسبياً (صورة/رابط من الخادم) إلى رابط مطلق. */
export function absoluteUrl(path: string | null | undefined): string | null {
  if (path == null || path === '') {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${currentBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
  /** إعادة المحاولة مرة واحدة على أخطاء الشبكة — افتراضياً نعم
   *  للقراءات فقط (كتابات مثل إنشاء الطلب لا تُعاد تلقائياً). */
  retryOnNetwork?: boolean;
}

async function requestOnce<T>(
  path: string,
  options: RequestOptions,
  endpointIndex: number,
  cacheBust = false,
): Promise<T> {
  const {method = 'GET', body, token, timeoutMs = API_TIMEOUT_MS} = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = normalizeUrl(ENDPOINTS[endpointIndex]);
  // كسر الكاش عند أي وسيط: رابط فريد لكل محاولة تعافٍ من 304 —
  // البروكسي لا يملك نسخة مخزنة لهذا الرابط أصلاً فيضطر لسؤال الأصل.
  const bust = cacheBust
    ? `${path.includes('?') ? '&' : '?'}_=${Date.now()}`
    : '';
  let response: Response;
  try {
    response = await fetch(`${base}${path}${bust}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // بلا ضغط: يمنع بوابة Coolify من gzip الردود الكبيرة التي
        // تفسدها بعض شبكات الجوال على HTTP الصريح.
        'Accept-Encoding': 'identity',
        // v2.2: لا كاش عند أي وسيط — لا يخزن الرد ولا يحوّل الطلب
        // لشرطي (إعادة تحقق 304) مهما كانت بروكسيات الشبكة.
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
        ...(token ? {'x-market-token': token} : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as {name?: string} | null)?.name === 'AbortError') {
      throw new ApiError('استغرق الطلب وقتاً أطول من اللازم — حاول مجدداً', 'TIMEOUT', 0);
    }
    throw new ApiError('تعذر الاتصال — تحقق من اتصال الإنترنت', 'NETWORK', 0);
  }
  clearTimeout(timer);

  // v2.2: 304 من وسيط مكسور (طلبنا لم يكن شرطياً أصلاً) — جسم فارغ
  // لا يُحلّل. نعيد فوراً برابط فريد يجبر الرد الكامل من الأصل؛
  // إن تكرر فالخلل أعمق من الكاش ونخبر المستخدم بوضوح.
  if (response.status === 304) {
    if (!cacheBust) {
      return requestOnce<T>(path, options, endpointIndex, true);
    }
    throw new ApiError(
      'الشبكة تعيد ردوداً مكسورة (304) — جرّب تبديل الاتصال واي فاي/بيانات',
      'BAD_GATEWAY_304',
      304,
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    /* رد بلا JSON (خادم بوابة/خطأ شبكة) */
  }

  if (!response.ok || data.ok !== true) {
    const code = typeof data.error === 'string' ? data.error : 'SERVER_ERROR';
    throw new ApiError(
      apiErrorText(code),
      code,
      response.status,
      data as Record<string, unknown>,
    );
  }
  // نجاح عبر هذه النقطة — تثبيتها sticky للنداءات التالية.
  savePreferredIndex(endpointIndex);
  return data as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const retryOnNetwork = options.retryOnNetwork ?? options.method !== 'POST';
  // المحاولات: sticky أولاً، ثم النقطة الأخرى، ثم sticky مجدداً بعد
  // تباعد — يمتص فشل نقطة كاملة (نطاق محجوب مؤقتاً) وضعف الشبكة
  // اللحظي وعتبة الاتصال البارد الأولى بعد فتح التطبيق.
  const preferred = loadPreferredIndex();
  const other = preferred === 0 ? 1 : 0;
  const order = retryOnNetwork ? [preferred, other, preferred] : [preferred];
  let lastError: unknown;
  for (let attempt = 0; attempt < order.length; attempt++) {
    try {
      return await requestOnce<T>(path, options, order[attempt]);
    } catch (e) {
      lastError = e;
      const retriable =
        e instanceof ApiError && (e.code === 'NETWORK' || e.code === 'TIMEOUT');
      if (!retriable || attempt === order.length - 1) {
        throw e;
      }
      // تباعد متصاعد: 800ms ثم 2000ms — يمتص ضعف الشبكة اللحظي
      // وعتبة الاتصال البارد الأولى بعد فتح التطبيق.
      await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 800 : 2000));
    }
  }
  throw lastError;
}

export const apiRequest = request;
