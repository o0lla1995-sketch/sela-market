/**
 * time.ts — تنسيق الوقت بالعربية (منطقة القدس/آسيا مثل نقطة البيع).
 */

const DAY_MS = 24 * 3600 * 1000;

/** تاريخ قصير: 12/10/2026 */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** وقت قصير: 14:05 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** تاريخ ووقت: 12/10/2026 · 14:05 */
export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} · ${formatTime(ts)}`;
}

/** وقت نسبي عربي: «قبل قليل»، «قبل 5 دقائق»، «أمس»، «قبل 3 أيام». */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 60 * 1000) {
    return 'قبل قليل';
  }
  if (diff < 60 * 60 * 1000) {
    const m = Math.floor(diff / (60 * 1000));
    return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' :
      m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`;
  }
  if (diff < DAY_MS) {
    const h = Math.floor(diff / (60 * 60 * 1000));
    return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' :
      h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`;
  }
  if (diff < 2 * DAY_MS) {
    return 'أمس';
  }
  if (diff < 7 * DAY_MS) {
    const d = Math.floor(diff / DAY_MS);
    return d <= 2 ? `قبل ${d} يومين` : `قبل ${d} أيام`;
  }
  return formatDate(ts);
}

/** تحية حسب الساعة: صباح الخير / مساء الخير. */
export function greeting(now: number = Date.now()): string {
  const h = new Date(now).getHours();
  if (h < 12) {
    return 'صباح الخير';
  }
  if (h < 17) {
    return 'طاب يومك';
  }
  return 'مساء الخير';
}
