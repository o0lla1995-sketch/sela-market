/**
 * recentsStore.ts — عمليات البحث الحديثة (آخر 10، بلا تكرار).
 */
import {create} from 'zustand';
import {RECENT_SEARCHES_MAX, storage} from '../core/config';

const KEY = 'recent-searches:v1';

interface RecentsState {
  searches: string[];
  add: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
}

function load(): string[] {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(s => typeof s === 'string');
      }
    }
  } catch {
    /* تجاهل */
  }
  return [];
}

function save(items: string[]): void {
  storage.set(KEY, JSON.stringify(items));
}

export const useRecentsStore = create<RecentsState>((set, get) => ({
  searches: load(),

  add: (q) => {
    const clean = q.trim();
    if (clean.length < 2) {
      return;
    }
    const next = [clean, ...get().searches.filter(s => s !== clean)].slice(0, RECENT_SEARCHES_MAX);
    set({searches: next});
    save(next);
  },

  remove: (q) => {
    const next = get().searches.filter(s => s !== q);
    set({searches: next});
    save(next);
  },

  clear: () => {
    set({searches: []});
    save([]);
  },
}));
