/**
 * locationStore.ts — منطقة المستخدم وعناوينه (v2.0 — خادم 4.4).
 * ─────────────────────────────────────────────────────────────────
 * «منطقتي» هي مفتاح الذكاء المكاني في التطبيق:
 *  • للعضو: منطقة عنوانه الافتراضي على الخادم (تُزامَن عند الدخول
 *    وعند تغيير الافتراضي) — أقرب ما يكون لعنوانه الحقيقي.
 *  • للزائر: آخر منطقة اختارها محلياً (MMKV) — تُسأل بلطف من
 *    الرئيسية عند أول تصفح وتتغير بلمسة.
 * المنطقة تغذي: قسم «متاجر تخدم منطقتك» في الرئيسية، فرز ومقارنة
 * رسوم التوصيل في دليل المتاجر، وضبط مسبق لمنطقة إتمام الطلب.
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import {getMyAddresses} from '../api/endpoints';
import type {Address} from '../core/types';
import {useAuthStore} from './authStore';

const REGION_KEY = 'my-region:v1';
const ADDRESSES_KEY = 'my-addresses:v1';

interface LocationState {
  /** منطقة المستخدم الحالية (null = لم تُحدد بعد). */
  myRegion: string | null;
  /** عناوين الحساب (فارغة للزائر). */
  addresses: Address[];
  /** آخر مزامنة ناجحة للعناوين. */
  syncedAt: number | null;
  /** منطقة الزائر المحلية أو عنوان افتراضي محفوظ. */
  setLocalRegion: (region: string | null) => void;
  /** يجلب عناوين الحساب ويحدّث myRegion من الافتراضي. */
  syncFromServer: () => Promise<void>;
  /** يستبدل العناوين محلياً بعد عملية حفظ/حذف (بلا نداء إضافي). */
  applyAddresses: (addresses: Address[]) => void;
  /** مسح كامل عند الخروج/تبديل الحساب. */
  reset: () => void;
}

function readLocalRegion(): string | null {
  try {
    const raw = storage.getString(REGION_KEY);
    if (raw != null && raw.length > 0) {
      return raw;
    }
  } catch {
    /* تجاهل */
  }
  return null;
}

function cacheAddresses(addresses: Address[]): void {
  try {
    storage.set(ADDRESSES_KEY, JSON.stringify(addresses));
  } catch {
    /* تجاهل */
  }
}

function readCachedAddresses(): Address[] {
  try {
    const raw = storage.getString(ADDRESSES_KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as Address[];
      }
    }
  } catch {
    /* تجاهل */
  }
  return [];
}

export const useLocationStore = create<LocationState>((set, get) => ({
  myRegion: readLocalRegion(),
  addresses: readCachedAddresses(),
  syncedAt: null,

  setLocalRegion: region => {
    if (region == null || region.length === 0) {
      storage.delete(REGION_KEY);
    } else {
      storage.set(REGION_KEY, region);
    }
    set({myRegion: region});
  },

  syncFromServer: async () => {
    const token = useAuthStore.getState().token;
    if (token == null) {
      // زائر: لا عناوين خادم — تبقى المنطقة المحلية كما هي.
      set({addresses: [], syncedAt: Date.now()});
      return;
    }
    try {
      const addresses = await getMyAddresses(token);
      const def = addresses.find(a => a.is_default === 1) ?? addresses[0];
      cacheAddresses(addresses);
      set({
        addresses,
        syncedAt: Date.now(),
        // العنوان الافتراضي يعلو المنطقة المحلية دائماً للعضو.
        ...(def != null ? {myRegion: def.region} : {}),
      });
    } catch {
      // فشل الشبكة: الكاش المحلي يكفي — محاولة لاحقة.
      set({syncedAt: Date.now()});
    }
  },

  applyAddresses: addresses => {
    cacheAddresses(addresses);
    const def = addresses.find(a => a.is_default === 1) ?? addresses[0];
    set({
      addresses,
      ...(def != null ? {myRegion: def.region} : {}),
    });
  },

  reset: () => {
    storage.delete(ADDRESSES_KEY);
    set({addresses: [], syncedAt: null});
  },
}));
