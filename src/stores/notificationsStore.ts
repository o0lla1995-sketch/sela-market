/**
 * notificationsStore.ts — مركز الإشعارات داخل التطبيق: تحديثات حالة
 * الطلبات (من مستطلع الطلبات) محفوظة في MMKV بحد أقصى 100 عنصر.
 */
import {create} from 'zustand';
import {NOTIFICATIONS_MAX, storage} from '../core/config';
import type {AppNotification} from '../core/types';

const KEY = 'notifications:v1';

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  push: (n: Omit<AppNotification, 'id' | 'ts' | 'read'> & {id?: string; ts?: number}) => void;
  markAllRead: () => void;
  clear: () => void;
}

function load(): AppNotification[] {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as AppNotification[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    /* تجاهل */
  }
  return [];
}

const initialItems = load();

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: initialItems,
  unread: initialItems.filter(n => !n.read).length,

  push: (n) => {
    const item: AppNotification = {
      id: n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: n.kind,
      title: n.title,
      body: n.body,
      ts: n.ts ?? Date.now(),
      read: false,
    };
    // منع التكرار اللحظي (نفس المعرف) — المستطلع قد يمر سريعاً مرتين.
    if (get().items.some(x => x.id === item.id)) {
      return;
    }
    const items = [item, ...get().items].slice(0, NOTIFICATIONS_MAX);
    storage.set(KEY, JSON.stringify(items));
    set({items, unread: items.filter(x => !x.read).length});
  },

  markAllRead: () => {
    const items = get().items.map(n => ({...n, read: true}));
    storage.set(KEY, JSON.stringify(items));
    set({items, unread: 0});
  },

  clear: () => {
    storage.set(KEY, JSON.stringify([]));
    set({items: [], unread: 0});
  },
}));
