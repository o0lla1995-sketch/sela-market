/**
 * wishlistStore.ts — المفضلة: منتجات محفوظة مع اسم متجرها (لقطات —
 * كافية للعرض والقفز إلى صفحة المنتج).
 * ─────────────────────────────────────────────────────────────────
 * v2.7: تنظيف احترافي من المنتجات التي لم تعد موجودة — شكوى التاجر
 * بالنص: «اذا اضاف المستخدم منتج الي المفضلة وقد تم إزالة المنتج
 * ولم يعد موجود يبقي ظاهر بقائمة المفضلة».
 *  • verifiedAt لكل عنصر — التحقيق مرة كل ٢٤ ساعة فقط (لا ضغط
 *    على الخادم مع كل فتح).
 *  • prune() يستدعى من WishlistScreen بعد جلب كتالوج كل متجر
 *    (نداء واحد لكل متجر — لا نداء لكل منتج)؛ لا يحذف شيئاً إن
 *    فشل الجلب (انقطاع شبكة ≠ منتج محذوف).
 *  • has() يشترط verifiedAt حديثاً لعرض شارة القلب كاملة في
 *    الواجهات — العنصر القديم جداً يظهر «لم يعد متوفراً» حتى
 *    يتحقق أو يُحذف.
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import {useInterestStore} from './interestStore';
import type {CrossProduct, Product} from '../core/types';

const KEY = 'wishlist:v1';

/** عمر التحقيق: ٢٤ ساعة — بعدها يُعاد فحص العنصر عند فتح المفضلة. */
export const WISHLIST_VERIFY_TTL_MS = 24 * 3600 * 1000;

interface WishlistEntry {
  product: Product;
  storeName: string;
  savedAt: number;
  /** آخر تحقق ناجح من الكتالوج (epoch ms) — null = لم يتحقق قط. */
  verifiedAt?: number;
}

interface WishlistState {
  items: Record<string, WishlistEntry>;
  toggle: (product: Product, storeName: string) => boolean;
  has: (productId: number) => boolean;
  remove: (productId: number) => void;
  clear: () => void;
  /** v2.7: يحذف المعطيات من قائمة المفضلة — يعيد عدد المحذوف.
   *  لا يمس منتجاً لفشل جلب كتالوجه (شبكة) — فقط من غاب فعلاً
   *  عن كتالوج جُلب بنجاح. */
  prune: (toRemove: number[]) => number;
  /** v2.7: ختم كل معرفات ناجحة بالوقت الحالي (بعد جلب ناجح). */
  markVerified: (productIds: number[]) => void;
  /** v2.7: العناصر التي انتهت صلاحية تحقيقها (24 ساعة). */
  staleIds: () => number[];
}

function load(): WishlistState['items'] {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as WishlistState['items'];
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    /* تجاهل */
  }
  return {};
}

function persist(items: WishlistState['items']): void {
  storage.set(KEY, JSON.stringify(items));
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: load(),

  toggle: (product, storeName) => {
    const key = String(product.id);
    const items = {...get().items};
    if (items[key] != null) {
      delete items[key];
      set({items});
      persist(items);
      return false;
    }
    items[key] = {product, storeName, savedAt: Date.now()};
    set({items});
    persist(items);
    // v2.0: الإضافة للمفضلة إشارة اهتمام قوية (وزن 3) — محلية فقط.
    useInterestStore.getState().trackWishlist(product.category);
    return true;
  },

  has: (productId) => get().items[String(productId)] != null,

  remove: (productId) => {
    const items = {...get().items};
    delete items[String(productId)];
    set({items});
    persist(items);
  },

  clear: () => {
    set({items: {}});
    persist({});
  },

  prune: (toRemove) => {
    if (toRemove.length === 0) {
      return 0;
    }
    const items = {...get().items};
    let removed = 0;
    for (const id of toRemove) {
      const key = String(id);
      if (items[key] != null) {
        delete items[key];
        removed += 1;
      }
    }
    if (removed > 0) {
      set({items});
      persist(items);
    }
    return removed;
  },

  markVerified: (productIds) => {
    if (productIds.length === 0) {
      return;
    }
    const now = Date.now();
    const items = {...get().items};
    let touched = false;
    for (const id of productIds) {
      const entry = items[String(id)];
      if (entry != null && entry.verifiedAt !== now) {
        items[String(id)] = {...entry, verifiedAt: now};
        touched = true;
      }
    }
    if (touched) {
      set({items});
      persist(items);
    }
  },

  staleIds: () => {
    const now = Date.now();
    const out: number[] = [];
    for (const [key, entry] of Object.entries(get().items)) {
      if (entry.verifiedAt == null || now - entry.verifiedAt > WISHLIST_VERIFY_TTL_MS) {
        out.push(Number(key));
      }
    }
    return out;
  },
}));
