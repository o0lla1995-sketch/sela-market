/**
 * interestStore.ts — اهتمامات المستخدم للتوصيات الذكية (v2.0).
 * ─────────────────────────────────────────────────────────────────
 * «التطبيق الذكي» الذي طلبه المستخدم: كل تفاعل (مشاهدة منتج،
 * إضافة للمفضلة، طلب مكتمل) يرفع وزن تصنيفه محلياً (MMKV). الرئيسية
 * تعرض «مقترحات لك» من تصنيفاتك الأثقل وزناً — بلا حساب خادم يعمل
 * حتى للزائر، وبلا أي بيانات شخصية تغادر الجهاز.
 *
 * الأوزان: مشاهدة = 1، مفضلة = 3، طلب = 6 — وتتلاشى أسبوعياً
 * (نصف عمر 14 يوماً) فتتبدى الاهتمامات الأخيرة لا القديمة.
 */
import {create} from 'zustand';
import {storage} from '../core/config';

const KEY = 'interests:v1';
const HALF_LIFE_MS = 14 * 24 * 3600 * 1000;
const MAX_CATEGORIES = 24;

interface InterestEntry {
  category: string;
  score: number;
  ts: number;
}

interface InterestState {
  /** خريطة التصنيف → الوزن (مع الطابع الزمني للتلاشي). */
  entries: Record<string, InterestEntry>;
  trackView: (category: string | null | undefined) => void;
  trackWishlist: (category: string | null | undefined) => void;
  trackOrder: (categories: (string | null | undefined)[]) => void;
  /** أعلى التصنيفات أهتماماً الآن (بعد احتساب التلاشي). */
  topCategories: (limit?: number) => string[];
  /** إجمالي الوزن — لعرض «نسبة التخصيص» لاحقاً. */
  totalScore: () => number;
  clear: () => void;
}

function load(): Record<string, InterestEntry> {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (parsed != null && typeof parsed === 'object') {
        return parsed as Record<string, InterestEntry>;
      }
    }
  } catch {
    /* تجاهل */
  }
  return {};
}

function save(entries: Record<string, InterestEntry>): void {
  try {
    storage.set(KEY, JSON.stringify(entries));
  } catch {
    /* تجاهل */
  }
}

/** وزن السجل مع التلاشي الأسبوعي (نصف عمر 14 يوماً). */
function decayed(entry: InterestEntry, now: number): number {
  const age = Math.max(0, now - entry.ts);
  return entry.score * Math.pow(0.5, age / HALF_LIFE_MS);
}

function addWeight(
  entries: Record<string, InterestEntry>,
  category: string,
  weight: number,
): Record<string, InterestEntry> {
  const now = Date.now();
  const key = category.trim();
  if (key.length === 0) {
    return entries;
  }
  const current = entries[key];
  const next: Record<string, InterestEntry> = {...entries};
  next[key] = {
    category: key,
    score: (current != null ? decayed(current, now) : 0) + weight,
    ts: now,
  };
  return next;
}

export const useInterestStore = create<InterestState>((set, get) => ({
  entries: load(),

  trackView: category => {
    if (category == null || category.length === 0) {
      return;
    }
    const next = addWeight(get().entries, category, 1);
    save(next);
    set({entries: next});
  },

  trackWishlist: category => {
    if (category == null || category.length === 0) {
      return;
    }
    const next = addWeight(get().entries, category, 3);
    save(next);
    set({entries: next});
  },

  trackOrder: categories => {
    const clean = categories
      .filter(c => c != null && c.length > 0)
      .map(c => c!.trim());
    if (clean.length === 0) {
      return;
    }
    // الطلب يرفع كل تصنيفاته مرة واحدة مهما تكرر في السلة.
    let next = get().entries;
    const unique = Array.from(new Set(clean));
    for (const c of unique) {
      next = addWeight(next, c, 6);
    }
    save(next);
    set({entries: next});
  },

  topCategories: (limit = 3) => {
    const now = Date.now();
    const {entries} = get();
    return Object.values(entries)
      .map(e => ({category: e.category, score: decayed(e, now)}))
      .filter(e => e.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(e => e.category);
  },

  totalScore: () => {
    const now = Date.now();
    return Object.values(get().entries).reduce(
      (sum, e) => sum + decayed(e, now),
      0,
    );
  },

  clear: () => {
    storage.delete(KEY);
    set({entries: {}});
  },
}));

/** يقتطع القاموس عند تجاوز الحد (استدعاء نادر من الشاشات). */
export function pruneInterests(): void {
  const state = useInterestStore.getState();
  const now = Date.now();
  const sorted = Object.values(state.entries)
    .sort((a, b) => decayed(b, now) - decayed(a, now))
    .slice(0, MAX_CATEGORIES);
  const next: Record<string, InterestEntry> = {};
  for (const e of sorted) {
    next[e.category] = e;
  }
  save(next);
  useInterestStore.setState({entries: next});
}
