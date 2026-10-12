/**
 * wishlistStore.ts — المفضلة: منتجات محفوظة مع اسم متجرها (لقطات —
 * كافية للعرض والقفز إلى صفحة المنتج).
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import type {CrossProduct, Product} from '../core/types';

const KEY = 'wishlist:v1';

interface WishlistState {
  items: Record<string, {product: Product; storeName: string; savedAt: number}>;
  toggle: (product: Product, storeName: string) => boolean;
  has: (productId: number) => boolean;
  remove: (productId: number) => void;
  clear: () => void;
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

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: load(),

  toggle: (product, storeName) => {
    const key = String(product.id);
    const items = {...get().items};
    if (items[key] != null) {
      delete items[key];
      set({items});
      storage.set(KEY, JSON.stringify(items));
      return false;
    }
    items[key] = {product, storeName, savedAt: Date.now()};
    set({items});
    storage.set(KEY, JSON.stringify(items));
    return true;
  },

  has: (productId) => get().items[String(productId)] != null,
  remove: (productId) => {
    const items = {...get().items};
    delete items[String(productId)];
    set({items});
    storage.set(KEY, JSON.stringify(items));
  },
  clear: () => {
    set({items: {}});
    storage.set(KEY, JSON.stringify({}));
  },
}));
