/**
 * cartStore.ts — السلة: سلة مستقلة لكل متجر (قرار معماري مثبت في ملف
 * الهوية: «سلة لكل متجر = طلب لكل متجر» حتى لا تتداخل الطلبات بين
 * التجار). الكميات قطعية أو نصف كيلو للمنتجات بالوزن، والمخزون
 * المعروض لقطة المزامنة — الخادم يحسم السعر والمخزون عند الطلب.
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import type {CartLine, CartStoreEntry, Product, StoreRef} from '../core/types';
import {lineTotal, minQty, qtyStep} from '../core/money';

const KEY = 'cart:v1';

interface CartState {
  carts: Record<string, CartStoreEntry>;
  /** آخر متجر أضيف إليه شيء — لتسهيل «إتمام الطلب» من شاشة المنتج. */
  lastActiveStoreId: number | null;

  addProduct: (store: StoreRef, product: Product, qty?: number) => void;
  setQty: (storeId: number, productId: number, qty: number) => void;
  increment: (storeId: number, productId: number) => void;
  decrement: (storeId: number, productId: number) => void;
  removeLine: (storeId: number, productId: number) => void;
  clearStore: (storeId: number) => void;
  clearAll: () => void;
  /** إعادة إضافة طلب سابق (إعادة الطلب بلمسة). */
  reAddLines: (store: StoreRef, lines: CartLine[]) => void;

  lineCountFor: (storeId: number) => number;
  countFor: (storeId: number) => number;
  countAll: () => number;
  subtotalFor: (storeId: number) => number;
  entryFor: (storeId: number) => CartStoreEntry | null;
}

function loadCarts(): Record<string, CartStoreEntry> {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as Record<string, CartStoreEntry>;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    /* تجاهل */
  }
  return {};
}

function persist(carts: Record<string, CartStoreEntry>, lastActiveStoreId: number | null): void {
  storage.set(KEY, JSON.stringify({carts, lastActiveStoreId}));
}

const initialRaw = loadCarts();
const initialLast = (() => {
  try {
    const raw = storage.getString(KEY);
    if (raw != null) {
      return (JSON.parse(raw) as {lastActiveStoreId?: number}).lastActiveStoreId ?? null;
    }
  } catch {
    /* تجاهل */
  }
  return null;
})();

export const useCartStore = create<CartState>((set, get) => ({
  carts: initialRaw,
  lastActiveStoreId: initialLast,

  addProduct: (store, product, qty) => {
    const key = String(store.id);
    const carts = {...get().carts};
    const entry: CartStoreEntry = carts[key] ?? {
      storeId: store.id,
      storeName: store.name,
      storeNumber: store.storeNumber ?? '',
      lines: [],
      updatedAt: Date.now(),
    };
    const step = qtyStep(product.sold_by_weight === 1);
    const addQty = qty ?? step;
    const existing = entry.lines.find(l => l.productId === product.id);
    let lines: CartLine[];
    if (existing) {
      lines = entry.lines.map(l =>
        l.productId === product.id
          ? {...l, quantity: Math.min(100000, l.quantity + addQty), stock: product.stock}
          : l,
      );
    } else {
      lines = [
        ...entry.lines,
        {
          productId: product.id,
          name: product.name,
          priceMinor: product.price_minor,
          unitLabel: product.unit_label,
          soldByWeight: product.sold_by_weight === 1,
          stock: product.stock,
          quantity: addQty,
        },
      ];
    }
    carts[key] = {...entry, lines, updatedAt: Date.now()};
    set({carts, lastActiveStoreId: store.id});
    persist(carts, store.id);
  },

  setQty: (storeId, productId, qty) => {
    const key = String(storeId);
    const carts = {...get().carts};
    const entry = carts[key];
    if (entry == null) {
      return;
    }
    if (qty <= 0) {
      get().removeLine(storeId, productId);
      return;
    }
    carts[key] = {
      ...entry,
      lines: entry.lines.map(l => (l.productId === productId ? {...l, quantity: Math.min(100000, qty)} : l)),
      updatedAt: Date.now(),
    };
    set({carts});
    persist(carts, get().lastActiveStoreId);
  },

  increment: (storeId, productId) => {
    const entry = get().carts[String(storeId)];
    const line = entry?.lines.find(l => l.productId === productId);
    if (line == null) {
      return;
    }
    get().setQty(storeId, productId, Math.round((line.quantity + qtyStep(line.soldByWeight)) * 1000) / 1000);
  },

  decrement: (storeId, productId) => {
    const entry = get().carts[String(storeId)];
    const line = entry?.lines.find(l => l.productId === productId);
    if (line == null) {
      return;
    }
    const next = Math.round((line.quantity - qtyStep(line.soldByWeight)) * 1000) / 1000;
    if (next < minQty(line.soldByWeight)) {
      get().removeLine(storeId, productId);
      return;
    }
    get().setQty(storeId, productId, next);
  },

  removeLine: (storeId, productId) => {
    const key = String(storeId);
    const carts = {...get().carts};
    const entry = carts[key];
    if (entry == null) {
      return;
    }
    const lines = entry.lines.filter(l => l.productId !== productId);
    if (lines.length === 0) {
      delete carts[key];
    } else {
      carts[key] = {...entry, lines, updatedAt: Date.now()};
    }
    set({carts});
    persist(carts, get().lastActiveStoreId);
  },

  clearStore: (storeId) => {
    const carts = {...get().carts};
    delete carts[String(storeId)];
    set({carts});
    persist(carts, get().lastActiveStoreId);
  },

  clearAll: () => {
    set({carts: {}, lastActiveStoreId: null});
    persist({}, null);
  },

  reAddLines: (store, lines) => {
    const key = String(store.id);
    const carts = {...get().carts};
    const entry: CartStoreEntry = carts[key] ?? {
      storeId: store.id,
      storeName: store.name,
      storeNumber: store.storeNumber ?? '',
      lines: [],
      updatedAt: Date.now(),
    };
    const merged = [...entry.lines];
    for (const line of lines) {
      const existing = merged.find(l => l.productId === line.productId);
      if (existing) {
        existing.quantity = Math.min(100000, existing.quantity + line.quantity);
      } else {
        merged.push({...line});
      }
    }
    carts[key] = {...entry, lines: merged, updatedAt: Date.now()};
    set({carts, lastActiveStoreId: store.id});
    persist(carts, store.id);
  },

  lineCountFor: (storeId) => get().carts[String(storeId)]?.lines.length ?? 0,
  countFor: (storeId) =>
    (get().carts[String(storeId)]?.lines ?? []).reduce((sum, l) => sum + l.quantity, 0),
  countAll: () =>
    Object.values(get().carts).reduce(
      (sum, e) => sum + e.lines.reduce((s, l) => s + l.quantity, 0),
      0,
    ),
  subtotalFor: (storeId) =>
    (get().carts[String(storeId)]?.lines ?? []).reduce(
      (sum, l) => sum + lineTotal(l.priceMinor, l.quantity),
      0,
    ),
  entryFor: (storeId) => get().carts[String(storeId)] ?? null,
}));
