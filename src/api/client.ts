/**
 * client.ts — عميل HTTP لمنصة سيلا ماركت.
 * ─────────────────────────────────────────────────────────────────
 * • v2.4 — الإصلاح الجذري السابع (النهائي) لاختفاء المنتجات:
 *   القياسات الميدانية عبر سبع جولات أثبتت نمطاً واحداً ثابتاً على
 *   شبكة الجوال في غزة: كل رد أصغر من ~450 بايت يصل سليماً، وكل رد
 *   أكبر من ~1KB يُقتل في منتصف الطريق (إطار TCP واحد يعبر، المتعدد
 *   يُسقط). ترويسة «Accept-Encoding: identity» التي أضيفت قديماً
 *   لمحاربة بروكسي يفسد الردود المضغوطة على HTTP الصريح أصبحت الآن
 *   هي المرض نفسه: تمنع ضغط gzip فتتضخم ردود المنتجات من 413 بايت
 *   إلى 1182+ بايت — أي من فئة «تعمل» إلى فئة «تُقتل». مع HTTPS لا
 *   يستطيع أي وسيط رؤية المحتوى أصلاً فضلاً عن إفساده، والضغط أصبح
 *   آمناً ومطلوباً. OKHttp يضيف gzip ويفكّه تلقائياً عند حذف الترويسة.
 *   التغييرات:
 *   1) حذف identity → ضغط تلقائي → كل ردود المنتجات < 450 بايت.
 *   2) كسر كاش غير مشروط لكل قراءة GET (عداد تصاعدي) — لو رجع
 *      التطبيق للنقطة الاحتياطية HTTP الصريحة لا يملك بروكسي
 *      المشغّل نسخة مخزنة لأي رابط أصلاً فيضطر لسؤال الأصل دائماً:
 *      موت نهائي لسلسلة 304 وردود الكاش المكسورة.
 *   3) مهلة 12 ثانية + تباعد أقصر — الفشل يظهر خلال ثوانٍ لا دقائق.
 * • رمز الجلسة في ترويسة x-market-token (نفس ترويسة الخادم).
 * • سجل حي لآخر 200 نداء يغذي شاشة تشخيص الشبكة في الإعدادات —
 *   يرى المستخدم والمالك بأعينهم كل طلب يخرج من التطبيق وحجمه
 *   وزمنه وحالته، بلا أدوات التقاط خارجية.
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

/* ══ v2.4: سجل النداءات الحي — شاشة التشخيص ══════════════════
 * يسجَّل كل نداء يخرج من التطبيق (المسار، النقطة، الحالة، الحجم،
 * الزمن) في حلقة آخر 200 نداء. الهدف: إن عادت أي مشكلة شبكة
 * يفتح المستخدم «تشخيص الشبكة» من الإعدادات ويرى الحقيقة كاملة
 * بعينه — أي طلب خرج، أي رد وصل، وبأي حجم — بلا برامج التقاط. */

export interface ApiCallRecord {
  at: number;
  method: 'GET' | 'POST';
  path: string;
  /** 0 = لم يصل رد (شبكة) */
  status: number;
  /** حجم جسم الرد بالبايت (بعد فك الضغط حيث ينطبق). */
  bytes: number;
  ms: number;
  /** أساسية HTTPS أم احتياطية؟ */
  endpoint: 'primary' | 'fallback';
  ok: boolean;
  /** رمز الخطأ إن فشل. */
  code?: string;
}

const CALL_LOG_MAX = 200;
const callLog: ApiCallRecord[] = [];
const callLogListeners = new Set<() => void>();

function logCall(record: ApiCallRecord): void {
  callLog.push(record);
  if (callLog.length > CALL_LOG_MAX) {
    callLog.splice(0, callLog.length - CALL_LOG_MAX);
  }
  for (const l of callLogListeners) {
    try {
      l();
    } catch {
      /* تجاهل */
    }
  }
}

/** لقطة السجل (الأحدث أخيراً). */
export function getCallLog(): readonly ApiCallRecord[] {
  return callLog;
}

/** الاشتراك في تحديثات السجل (لشاشة التشخيص). */
export function subscribeCallLog(listener: () => void): () => void {
  callLogListeners.add(listener);
  return () => {
    callLogListeners.delete(listener);
  };
}

function clearCallLog(): void {
  callLog.splice(0, callLog.length);
  for (const l of callLogListeners) {
    try {
      l();
    } catch {
      /* تجاهل */
    }
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
    /* v2.8 (خادم 5.4): سقف المخزون يتكلم بوضوح — السلة تعرض اسم
     * المنتج والمتاح الفعلي في صف التحذير فوق زر الإرسال. */
    case 'INSUFFICIENT_STOCK':
      return 'الكمية المطلوبة أكبر من المتاح في المتجر';
    case 'PRODUCT_UNAVAILABLE':
      return 'أحد منتجات السلة سُحب من المتجر مؤقتاً';
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

/* ── إدارة نقاط النهاية (أساسية HTTPS + احتياطية + sticky) ── */

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
  /** إعادة المحاولة على أخطاء الشبكة — افتراضياً نعم
   *  للقراءات فقط (كتابات مثل إنشاء الطلب لا تُعاد تلقائياً). */
  retryOnNetwork?: boolean;
}

/* v2.4: عدّاد كسر الكاش — كل قراءة GET تحمل `_c=` فريداً متصاعداً.
 * أي وسيط على الطريق (بروكسي مشغّل على HTTP الصريح) لن يجد أبداً
 * نسخة مخزنة لنفس الرابط: كل طلب رابط جديد لم يُر من قبل، فلا كاش
 * ولا 304 ولا ردود مكسورة من نسخة قديمة. يبدأ من قيمة عشوائية كي
 * لا تتطابق العدادات بين الأجهزة بعد إعادة التشغيل. */
let cacheBustCounter =
  Date.now() % 1000000 + Math.floor(Math.random() * 1000);

async function requestOnce<T>(
  path: string,
  options: RequestOptions,
  endpointIndex: number,
): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
    timeoutMs = API_TIMEOUT_MS,
  } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = normalizeUrl(ENDPOINTS[endpointIndex]);
  // كسر كاش غير مشروط لكل قراءة — انظر التعليق على العدّاد أعلاه.
  const bust = method === 'GET'
    ? `${path.includes('?') ? '&' : '?'}_c=${cacheBustCounter++}`
    : '';
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${base}${path}${bust}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // v2.4: لا نرسل Accept-Encoding إطلاقاً — OKHttp يضيف gzip
        // تلقائياً ويفكّه بشفافية. ردود المنتجات تنكمش من ~1182 بايت
        // إلى ~413 بايت: فئة «إطار واحد يعبر شبكات الجوال» المثبتة
        // ميدانياً. الإرسال اليدوي لidentity كان يضخّم الردود ثلاثة
        // أضعاف فتقتلها الشبكة في منتصف الطريق.
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
        ...(token ? {'x-market-token': token} : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const code = (e as {name?: string} | null)?.name === 'AbortError'
      ? 'TIMEOUT'
      : 'NETWORK';
    const message =
      code === 'TIMEOUT'
        ? 'استغرق الطلب وقتاً أطول من اللازم — حاول مجدداً'
        : 'تعذر الاتصال — تحقق من اتصال الإنترنت';
    logCall({
      at: startedAt,
      method,
      path,
      status: 0,
      bytes: 0,
      ms: Date.now() - startedAt,
      endpoint: endpointIndex === 0 ? 'primary' : 'fallback',
      ok: false,
      code,
    });
    throw new ApiError(message, code, 0);
  }
  clearTimeout(timer);

  let data: Record<string, unknown> = {};
  let bodyBytes = 0;
  try {
    const text = await response.text();
    bodyBytes = text.length;
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* رد بلا JSON (خادم بوابة/خطأ شبكة) */
  }

  const ok = response.ok && data.ok === true;
  const errCode = !ok
    ? typeof data.error === 'string'
      ? data.error
      : 'SERVER_ERROR'
    : undefined;
  logCall({
    at: startedAt,
    method,
    path,
    status: response.status,
    bytes: bodyBytes,
    ms: Date.now() - startedAt,
    endpoint: endpointIndex === 0 ? 'primary' : 'fallback',
    ok,
    code: errCode,
  });

  // v2.2→v2.4: 304 لم يعد ممكناً أصلاً (روابط فريدة + no-store)،
  // لكن إن تسلل من وسيط غريب نرمي خطأ واضحاً بدل تحليل جسم فارغ.
  if (response.status === 304) {
    throw new ApiError(
      'الشبكة تعيد ردوداً مكسورة (304) — جرّب تبديل الاتصال واي فاي/بيانات',
      'BAD_GATEWAY_304',
      304,
    );
  }

  if (!ok) {
    throw new ApiError(
      apiErrorText(errCode ?? 'SERVER_ERROR'),
      errCode ?? 'SERVER_ERROR',
      response.status,
      data as Record<string, unknown>,
    );
  }
  // نجاح عبر هذه النقطة — تثبيتها sticky للنداءات التالية.
  savePreferredIndex(endpointIndex);
  return data as T;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const retryOnNetwork = options.retryOnNetwork ?? options.method !== 'POST';
  // المحاولات: sticky أولاً، ثم النقطة الأخرى، ثم sticky مجدداً —
  // يمتص فشل نقطة كاملة وضعف الشبكة اللحظي وعتبة الاتصال البارد
  // الأولى بعد فتح التطبيق.
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
      // v2.4: تباعد أقصر (400ms ثم 1000ms) — الكشف عن الفشل خلال
      // ثوانٍ لا دقائق، والمحاولة البديلة فورية كي لا يملّ المستخدم.
      await new Promise(resolve =>
        setTimeout(resolve, attempt === 0 ? 400 : 1000),
      );
    }
  }
  throw lastError;
}

export const apiRequest = request;

/* ── v2.5: فحص الشبكة الذاتي — شاشة التشخيص ════════════════════
 * درس الجولة الثامنة: الفحص القديم كان يمرر مسارات نصية جاهزة
 * فيفحص طبقة الشبكة وحدها — بينما كان الخلل الفعلي في طبقة بناء
 * الطلب (URLSearchParams غير موجودة في Hermes ترمي ReferenceError
 * قبل أي نداء). الفحص الجديد يستدعي الدوال الحقيقية نفسها التي
 * تستخدمها الشاشات (يحقنها المستدعي من endpoints.ts لتفادي
 * الاستيراد الدائري) + يفحص قدرات محرك JS أولاً — هكذا أي
 * خلل قادم في أي طبقة يظهر باسمه في التقرير. */

export interface ProbeStep {
  label: string;
  path: string;
  status: number;
  bytes: number;
  ms: number;
  ok: boolean;
  detail: string;
}

export interface ProbeReport {
  at: number;
  /** النقطة التي نجحت أخيراً. */
  endpoint: 'primary' | 'fallback' | null;
  steps: ProbeStep[];
}

/** تعريف خطوة فحص — دالة حقيقية من endpoints.ts (لا مسار نصي). */
export interface ProbeDef {
  label: string;
  /** المسار المتوقع (للعرض فقط). */
  path: string;
  run: () => Promise<unknown>;
}

/* v2.5: قدرات محرك JS — أول ما يُفحص. الدرس الثامنة:
 * RN 0.74 يزود بإثناء URLSearchParams «مزيفاً» — المنشئ و
 * toString يعملان ولكن set() يرمي «not implemented» — فالفحص
 * النوعي بـ typeof ينجح والواقع مكسور! الفحص هنا وظيفي
 * فعلي: نبني نداء حقيقياً ونجرب أن يعمل فعلاً. */
export interface RuntimeCaps {
  fetch: boolean;
  AbortController: boolean;
  URLSearchParams: boolean;
  URL: boolean;
  encodeURIComponent: boolean;
  Promise: boolean;
}

function urlSearchParamsWorks(): boolean {
  try {
    if (typeof URLSearchParams !== 'function') {
      return false;
    }
    const probe = new URLSearchParams();
    probe.set('a', '1');
    return probe.toString() === 'a=1';
  } catch {
    return false;
  }
}

function urlWorks(): boolean {
  try {
    if (typeof URL !== 'function') {
      return false;
    }
    const probe = new URL('https://example.com/x');
    return probe.protocol === 'https:';
  } catch {
    return false;
  }
}

export function runtimeCapabilities(): RuntimeCaps {
  return {
    fetch: typeof fetch === 'function',
    AbortController: typeof AbortController === 'function',
    URLSearchParams: urlSearchParamsWorks(),
    URL: urlWorks(),
    encodeURIComponent: typeof encodeURIComponent === 'function',
    Promise: typeof Promise === 'function',
  };
}

export async function runNetworkProbe(defs: ProbeDef[]): Promise<ProbeReport> {
  clearCallLog();
  const steps: ProbeStep[] = [];

  // الخطوة صفر: قدرات المحرك. الفشل الفادح في ما يعتمد عليه
  // التطبيق فعلاً (fetch/Abort/encode/Promise) — أما URLSearchParams/URL
  // فمعلوماتية فقط لأن التطبيق منذ v2.5 لا يستخدمها إطلاقاً
  // (نتعلمها من الدرس الثامن: مزيفة RN 0.74 مكسورة).
  const caps = runtimeCapabilities();
  const missing = (Object.keys(caps) as (keyof RuntimeCaps)[]).filter(
    k => !caps[k],
  );
  const criticalMissing = missing.filter(
    k => k !== 'URLSearchParams' && k !== 'URL',
  );
  const informational = missing.filter(
    k => k === 'URLSearchParams' || k === 'URL',
  );
  steps.push({
    label: 'قدرات محرك JS',
    path: 'fetch · AbortController · encodeURIComponent · …',
    status: criticalMissing.length === 0 ? 200 : 0,
    bytes: 0,
    ms: 0,
    ok: criticalMissing.length === 0,
    detail:
      criticalMissing.length > 0
        ? `خطير مفقود: ${criticalMissing.join('، ')} — ثبّت التحديث الأخير`
        : informational.length > 0
          ? `كل الميزات الحرجة سليمة. (معلومة: ${informational.join('، ')} غير متاحة في المحرك — التطبيق لا يحتاجها)`
          : 'كل واسطات الشبكة متوفرة وتعمل فعلياً',
  });

  let endpointUsed: ProbeReport['endpoint'] = null;
  for (const p of defs) {
    const t0 = Date.now();
    try {
      await p.run();
      const rec = getCallLog()[getCallLog().length - 1];
      steps.push({
        label: p.label,
        path: p.path,
        status: rec?.status ?? 200,
        bytes: rec?.bytes ?? 0,
        ms: Date.now() - t0,
        ok: true,
        detail: 'وصل الرد سليماً',
      });
      endpointUsed = rec?.endpoint ?? endpointUsed;
    } catch (e) {
      const rec = getCallLog()[getCallLog().length - 1];
      steps.push({
        label: p.label,
        path: p.path,
        status: rec?.status ?? 0,
        bytes: rec?.bytes ?? 0,
        ms: Date.now() - t0,
        ok: false,
        detail:
          e instanceof ApiError
            ? `${e.code}: ${e.message}`
            : e instanceof Error
              ? `${e.name}: ${e.message}`
              : 'خطأ غير معروف',
      });
    }
  }
  return {at: Date.now(), endpoint: endpointUsed, steps};
}
