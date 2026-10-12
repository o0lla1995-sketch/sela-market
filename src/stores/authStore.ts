/**
 * authStore.ts — جلسة مستخدم المتجر: التسجيل والدخول والخروج وحذف
 * الحساب فوق /api/market/auth/*. الرمز يُحفظ في MMKV (صلاحية 90 يوماً
 * من الخادم — عند انتهائها يُعاد الدخول).
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import * as api from '../api/endpoints';
import type {MarketUser} from '../core/types';
import {ApiError} from '../api/client';

const KEY = 'auth:v1';

interface PersistedAuth {
  token: string;
  user: MarketUser;
}

interface AuthState {
  token: string | null;
  user: MarketUser | null;
  busy: boolean;
  error: string | null;
  register: (idNumber: string, name: string, phone: string) => Promise<boolean>;
  login: (idNumber: string, phone: string) => Promise<boolean>;
  logout: () => void;
  deleteAccount: () => Promise<boolean>;
  clearError: () => void;
}

function loadSession(): PersistedAuth | null {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
      if (typeof parsed.token === 'string' && parsed.user != null) {
        return {token: parsed.token, user: parsed.user as MarketUser};
      }
    }
  } catch {
    /* تجاهل */
  }
  return null;
}

function saveSession(session: PersistedAuth | null): void {
  if (session == null) {
    storage.delete(KEY);
  } else {
    storage.set(KEY, JSON.stringify(session));
  }
}

const session = loadSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: session?.token ?? null,
  user: session?.user ?? null,
  busy: false,
  error: null,

  register: async (idNumber, name, phone) => {
    set({busy: true, error: null});
    try {
      const res = await api.register({idNumber, name, phone});
      saveSession({token: res.token, user: res.user});
      set({token: res.token, user: res.user, busy: false});
      return true;
    } catch (e) {
      set({busy: false, error: e instanceof ApiError ? e.message : 'تعذر إنشاء الحساب — تحقق من الإنترنت'});
      return false;
    }
  },

  login: async (idNumber, phone) => {
    set({busy: true, error: null});
    try {
      const res = await api.login({idNumber, phone});
      saveSession({token: res.token, user: res.user});
      set({token: res.token, user: res.user, busy: false});
      return true;
    } catch (e) {
      set({busy: false, error: e instanceof ApiError ? e.message : 'تعذر تسجيل الدخول — تحقق من الإنترنت'});
      return false;
    }
  },

  logout: () => {
    saveSession(null);
    set({token: null, user: null, error: null});
  },

  deleteAccount: async () => {
    set({busy: true, error: null});
    try {
      await api.deleteAccount(get().token);
      saveSession(null);
      set({token: null, user: null, busy: false});
      return true;
    } catch (e) {
      set({busy: false, error: e instanceof ApiError ? e.message : 'تعذر حذف الحساب — تحقق من الإنترنت'});
      return false;
    }
  },

  clearError: () => set({error: null}),
}));
