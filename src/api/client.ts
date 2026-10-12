/**
 * client.ts — عميل HTTP لمنصة سيلا ماركت.
 * ─────────────────────────────────────────────────────────────────
 * • العنوان الأساسي: خادم سيلا الرسمي (نفس نشر Coolify الخاص
 *   بالتراخيص — تم التحقق من عمله من تطبيق نقطة البيع).
 * • رمز الجلسة في ترويسة x-market-token (نفس ترويسة الخادم).
 * • مهلة 20 ثانية عبر AbortController + رسالة عربية واضحة عند الفشل.
 * • Accept-Encoding: identity على كل النداءات — بوابة Coolify تضغط
 *   الردود الأكبر من كيلوبايت واحد (gzip) وبعض شبكات الجوال العربية
 *   تُفسد الردود المضغوطة على HTTP غير المعمّى فيصل المتاجر الصغيرة
 *   (بلا ضغط) وتفشل قوائم المنتجات (مضغوطة) — طلب بلا ضغط يلغي
 *   المشكلة من جذورها، والحمولات أصلاً صغيرة.
 * • إعادة محاولة تلقائية (حتى 3 محاولات بتباعد متصاعد) للأخطاء
 *   الشبكية على القراءات (تلتقط عتبة الاتصال البارد الأولى بعد
 *   فتح التطبيق وضعف الشبكة اللحظي).
 * • أخطاء الخادم {ok:false, error:CODE} تُحوّل إلى ApiError برسالة
 *   عربية جاهزة للعرض مع الاحتفاظ بالرمز والحقول الإضافية (regions…).
 */
import {API_TIMEOUT_MS, DEFAULT_SERVER_URL} from '../core/config';

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

/** رسائل أخطاء الخادم بلغة المستخدم. */
export function apiErrorText(code: string): string {
  switch (code) {
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

export function currentBaseUrl(): string {
  return DEFAULT_SERVER_URL.replace(/\/+$/, '');
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
): Promise<T> {
  const {method = 'GET', body, token, timeoutMs = API_TIMEOUT_MS} = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${currentBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // بلا ضغط: يمنع بوابة Coolify من gzip الردود الكبيرة التي
        // تفسدها بعض شبكات الجوال على HTTP الصريح (سبب اختفاء
        // المنتجات مع ظهور المتاجر في v1.2).
        'Accept-Encoding': 'identity',
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
  return data as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const retryOnNetwork = options.retryOnNetwork ?? options.method !== 'POST';
  const attempts = retryOnNetwork ? 3 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await requestOnce<T>(path, options);
    } catch (e) {
      lastError = e;
      const retriable =
        e instanceof ApiError && (e.code === 'NETWORK' || e.code === 'TIMEOUT');
      if (!retriable || attempt === attempts - 1) {
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
