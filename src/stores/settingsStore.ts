/**
 * settingsStore.ts — إعدادات المستخدم الدائمة (MMKV):
 * المود (فاتح/داكن/تلقائي)، الإشعارات، شاشة الترحيب،
 * العناوين المحفوظة، آخر منطقة توصيل مستخدمة.
 * v1.1: حُذف حقل رابط الخادم المتقدم نهائياً (الخادم الرسمي
 * الوحيد في config.ts — لا شيء يحتاجه المستخدم لتغييره).
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import type {ThemeMode} from '../core/types';

const KEY = 'settings:v1';

interface SettingsState {
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  onboarded: boolean;
  savedAddresses: string[];
  lastRegionByStore: Record<string, string>;
  /** v2.1: الدخول بالبصمة عند توفر جلسة محفوظة. */
  biometricLoginEnabled: boolean;
  /** إعدادات الجلسة الحالية للطبقة العاملة (لا تُحفظ). */
  setThemeMode: (m: ThemeMode) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setOnboarded: () => void;
  setBiometricLoginEnabled: (v: boolean) => void;
  addAddress: (address: string) => void;
  removeAddress: (address: string) => void;
  rememberRegion: (storeId: number, region: string) => void;
}

interface PersistedSettings {
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  onboarded: boolean;
  savedAddresses: string[];
  lastRegionByStore: Record<string, string>;
  biometricLoginEnabled?: boolean;
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
        onboarded: parsed.onboarded === true,
        savedAddresses: Array.isArray(parsed.savedAddresses)
          ? parsed.savedAddresses.filter(a => typeof a === 'string').slice(0, 5)
          : [],
        lastRegionByStore:
          parsed.lastRegionByStore && typeof parsed.lastRegionByStore === 'object'
            ? parsed.lastRegionByStore
            : {},
        biometricLoginEnabled: parsed.biometricLoginEnabled === true,
      };
    }
  } catch {
    /* تخزين تالف → افتراضيات */
  }
  return {
    themeMode: 'system',
    notificationsEnabled: true,
    onboarded: false,
    savedAddresses: [],
    lastRegionByStore: {},
    biometricLoginEnabled: false,
  };
}

const initial = load();

function persist(state: SettingsState): void {
  const data: PersistedSettings = {
    themeMode: state.themeMode,
    notificationsEnabled: state.notificationsEnabled,
    onboarded: state.onboarded,
    savedAddresses: state.savedAddresses,
    lastRegionByStore: state.lastRegionByStore,
    biometricLoginEnabled: state.biometricLoginEnabled,
  };
  storage.set(KEY, JSON.stringify(data));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: initial.themeMode,
  notificationsEnabled: initial.notificationsEnabled,
  onboarded: initial.onboarded,
  savedAddresses: initial.savedAddresses,
  lastRegionByStore: initial.lastRegionByStore,
  biometricLoginEnabled: initial.biometricLoginEnabled === true,

  setThemeMode: (m) => {
    set({themeMode: m});
    persist(get());
  },
  setNotificationsEnabled: (v) => {
    set({notificationsEnabled: v});
    persist(get());
  },
  setOnboarded: () => {
    set({onboarded: true});
    persist(get());
  },
  setBiometricLoginEnabled: (v) => {
    set({biometricLoginEnabled: v});
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
