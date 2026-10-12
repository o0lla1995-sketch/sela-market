/**
 * cached.ts — قراءات محفوظة بلا خسارة بيانات عند تعثر الشبكة.
 * ─────────────────────────────────────────────────────────────────
 * النمط: «cache-then-network» — أول ما تفتح الشاشة تُعرض آخر لقطة
 * ناجحة فوراً (من MMKV) ثم تُحدَّث من الخادم. إذا فشل التحديث
 * تبقى اللقطة القديمة معلومةً بشريط «بيانات محفوظة» بدل شاشة خطأ
 * كاملة — تجربة المتاجر العالمية عند ضعف الاتصال.
 */
import {storage} from '../core/config';
import {ApiError} from './client';

interface CachedEnvelope<T> {
  at: number;
  data: T;
}

export interface CachedResult<T> {
  data: T | null;
  /** متى جُلبت اللقطة المعروضة (null = لا كاش). */
  cachedAt: number | null;
  /** فشل التحديث من الشبكة؟ (المعروض كاش قديم). */
  stale: boolean;
  error: string | null;
}

/** يقرأ لقطة محفوظة (بلا نداء شبكة). */
export function readCache<T>(key: string): {data: T; at: number} | null {
  try {
    const raw = storage.getString(`cache:${key}`);
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    if (parsed == null || typeof parsed.at !== 'number') {
      return null;
    }
    return {data: parsed.data, at: parsed.at};
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const envelope: CachedEnvelope<T> = {at: Date.now(), data};
    storage.set(`cache:${key}`, JSON.stringify(envelope));
  } catch {
    /* كاش ممتلئ/فاسد — تجاهل */
  }
}

/**
 * يجلب بيانات من الشبكة ويعرض الكاش عند الفشل:
 *  • نجاح → يعيد البيانات الطازجة ويحدّث الكاش.
 *  • فشل + كاش موجود → يعيد الكاش مع stale:true (لا خطأ).
 *  • فشل + لا كاش → يعيد error ليعرضها المستدعي.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<CachedResult<T>> {
  const cached = readCache<T>(key);
  try {
    const fresh = await fetcher();
    writeCache(key, fresh);
    return {data: fresh, cachedAt: Date.now(), stale: false, error: null};
  } catch (e) {
    const message = e instanceof ApiError
      ? e.message
      : 'تعذر تحميل البيانات — حاول مجدداً';
    if (cached != null) {
      return {data: cached.data, cachedAt: cached.at, stale: true, error: message};
    }
    return {data: null, cachedAt: null, stale: false, error: message};
  }
}

/** يمسح كل الكاش (تُستخدم عند تغيير الحساب/الجلسة). */
export function clearCache(): void {
  try {
    const keys = storage.getAllKeys().filter(k => k.startsWith('cache:'));
    for (const k of keys) {
      storage.delete(k);
    }
  } catch {
    /* تجاهل */
  }
}
