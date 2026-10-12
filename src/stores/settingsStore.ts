/**
 * settingsStore.ts — إعدادات المستخدم الدائمة (MMKV):
 * المود (فاتح/داكن/تلقائي)، الإشعارات، رابط الخادم (متقدم)،
 * شاشة الترحيب، العناوين المحفوظة، آخر منطقة توصيل مستخدمة.
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import type {ThemeMode} from '../core/types';

const KEY = 'settings:v1';

interface SettingsState {
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  serverUrl: string;
  onboarded: boolean;
  savedAddresses: string[];
  lastRegionByStore: Record<string, string>;
  /** إعدادات الجلسة الحالية للطبقة العاملة (لا تُحفظ). */
  setThemeMode: (m: ThemeMode) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setServerUrl: (url: string) => void;
  setOnboarded: () => void;
  addAddress: (address: string) => void;
  removeAddress: (address: string) => void;
  rememberRegion: (storeId: number, region: string) => void;
}

interface PersistedSettings {
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  serverUrl: string;
  onboarded: boolean;
  savedAddresses: string[];
  lastRegionByStore: Record<string, string>;
}

function load(): PersistedSettings {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      return {
        themeMode: parsed.themeMode === 'dark' || parsed.themeMode === 'light'
          ? parsed.themeMode
          : 'system',
        notificationsEnabled: parsed.notificationsEnabled !== false,
        serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : '',
        onboarded: parsed.onboarded === true,
        savedAddresses: Array.isArray(parsed.savedAddresses)
          ? parsed.savedAddresses.filter(a => typeof a === 'string').slice(0, 5)
          : [],
        lastRegionByStore:
          parsed.lastRegionByStore && typeof parsed.lastRegionByStore === 'object'
            ? parsed.lastRegionByStore
            : {},
      };
    }
  } catch {
    /* تخزين تالف → افتراضيات */
  }
  return {
    themeMode: 'system',
    notificationsEnabled: true,
    serverUrl: '',
    onboarded: false,
    savedAddresses: [],
    lastRegionByStore: {},
  };
}

const initial = load();

function persist(state: SettingsState): void {
  const data: PersistedSettings = {
    themeMode: state.themeMode,
    notificationsEnabled: state.notificationsEnabled,
    serverUrl: state.serverUrl,
    onboarded: state.onboarded,
    savedAddresses: state.savedAddresses,
    lastRegionByStore: state.lastRegionByStore,
  };
  storage.set(KEY, JSON.stringify(data));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: initial.themeMode,
  notificationsEnabled: initial.notificationsEnabled,
  serverUrl: initial.serverUrl,
  onboarded: initial.onboarded,
  savedAddresses: initial.savedAddresses,
  lastRegionByStore: initial.lastRegionByStore,

  setThemeMode: (m) => {
    set({themeMode: m});
    persist(get());
  },
  setNotificationsEnabled: (v) => {
    set({notificationsEnabled: v});
    persist(get());
  },
  setServerUrl: (url) => {
    set({serverUrl: url.trim()});
    persist(get());
  },
  setOnboarded: () => {
    set({onboarded: true});
    persist(get());
  },
  addAddress: (address) => {
    const clean = address.trim();
    if (!clean) {
      return;
    }
    const next = [clean, ...get().savedAddresses.filter(a => a !== clean)].slice(0, 5);
    set({savedAddresses: next});
    persist(get());
  },
  removeAddress: (address) => {
    set({savedAddresses: get().savedAddresses.filter(a => a !== address)});
    persist(get());
  },
  rememberRegion: (storeId, region) => {
    set({
      lastRegionByStore: {...get().lastRegionByStore, [String(storeId)]: region},
    });
    persist(get());
  },
}));
