/**
 * cartStore.ts — السلة: سلة مستقلة لكل متجر (قرار معماري مثبت في ملف
 * الهوية: «سلة لكل متجر = طلب لكل متجر» حتى لا تتداخل الطلبات بين
 * التجار). الكميات قطعية أو نصف كيلو للمنتجات بالوزن، والمخزون
 * المعروض لقطة المزامنة — الخادم يحسم السعر والمخزون عند الطلب.
 *
 * v1.2: هوية السطر = المنتج + الخيار المختار (المقاس/اللون…) —
 * المنتج نفسه بخيارين مختلفين سطران مستقلان لا يُدمجان.
 */
import {create} from 'zustand';
import {storage} from '../core/config';
import {
  lineKeyOf,
  type CartLine,
  type CartStoreEntry,
  type Product,
  type StoreRef,
} from '../core/types';
import {lineTotal, minQty, qtyStep} from '../core/money';
import {effectiveMinor} from '../core/discount';

const KEY = 'cart:v2';

interface CartState {
  carts: Record<string, CartStoreEntry>;
  /** آخر متجر أضيف إليه شيء — لتسهيل «إتمام الطلب» من شاشة المنتج. */
  lastActiveStoreId: number | null;

  addProduct: (store: StoreRef, product: Product, variant?: string | null, qty?: number) => void;
  setQty: (storeId: number, lineKey: string, qty: number) => void;
  increment: (storeId: number, lineKey: string) => void;
  decrement: (storeId: number, lineKey: string) => void;
  removeLine: (storeId: number, lineKey: string) => void;
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
        // v1.2: أسطر v1 القديمة (بلا key/variant) تُرقّى في المكان.
        for (const entry of Object.values(parsed)) {
          if (!Array.isArray(entry.lines)) {
            continue;
          }
          entry.lines = entry.lines.map(l => ({
            ...l,
            key: l.key ?? lineKeyOf(l.productId, null),
            variant: l.variant ?? null,
          }));
        }
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

  addProduct: (store, product, variant = null, qty) => {
    const key = String(store.id);
    const carts = {...get().carts};
    const entry: CartStoreEntry = carts[key] ?? {
      storeId: store.id,
      storeName: store.name,
      storeNumber: store.storeNumber ?? '',
      storeLogoUrl: store.logoUrl ?? null,
      lines: [],
      updatedAt: Date.now(),
    };
    const step = qtyStep(product.sold_by_weight === 1);
    const addQty = qty ?? step;
    const lineKey = lineKeyOf(product.id, variant);
    const existing = entry.lines.find(l => l.key === lineKey);
    // v2.1: السعر المدفوع = بعد خصم التاجر؛ listPriceMinor يحفظ
    // السعر قبل الخصم للعرض المشطوب في السلة والدفع.
    const finalPrice = effectiveMinor(product);
    const listPrice =
      finalPrice < product.price_minor ? product.price_minor : undefined;
    let lines: CartLine[];
    if (existing) {
      lines = entry.lines.map(l =>
        l.key === lineKey
          ? {...l, quantity: Math.min(100000, l.quantity + addQty), stock: product.stock,
             priceMinor: finalPrice, listPriceMinor: listPrice}
          : l,
      );
    } else {
      lines = [
        ...entry.lines,
        {
          key: lineKey,
          productId: product.id,
          name: product.name,
          priceMinor: finalPrice,
          listPriceMinor: listPrice,
          unitLabel: product.unit_label,
          soldByWeight: product.sold_by_weight === 1,
          stock: product.stock,
          quantity: addQty,
          variant,
          category: product.category ?? null,
        },
      ];
    }
    carts[key] = {...entry, lines, updatedAt: Date.now()};
    set({carts, lastActiveStoreId: store.id});
    persist(carts, store.id);
  },

  setQty: (storeId, lineKey, qty) => {
    const key = String(storeId);
    const carts = {...get().carts};
    const entry = carts[key];
    if (entry == null) {
      return;
    }
    if (qty <= 0) {
      get().removeLine(storeId, lineKey);
      return;
    }
    carts[key] = {
      ...entry,
      lines: entry.lines.map(l => (l.key === lineKey ? {...l, quantity: Math.min(100000, qty)} : l)),
      updatedAt: Date.now(),
    };
    set({carts});
    persist(carts, get().lastActiveStoreId);
  },

  increment: (storeId, lineKey) => {
    const entry = get().carts[String(storeId)];
    const line = entry?.lines.find(l => l.key === lineKey);
    if (line == null) {
      return;
    }
    get().setQty(storeId, lineKey, Math.round((line.quantity + qtyStep(line.soldByWeight)) * 1000) / 1000);
  },

  decrement: (storeId, lineKey) => {
    const entry = get().carts[String(storeId)];
    const line = entry?.lines.find(l => l.key === lineKey);
    if (line == null) {
      return;
    }
    const next = Math.round((line.quantity - qtyStep(line.soldByWeight)) * 1000) / 1000;
    if (next < minQty(line.soldByWeight)) {
      get().removeLine(storeId, lineKey);
      return;
    }
    get().setQty(storeId, lineKey, next);
  },

  removeLine: (storeId, lineKey) => {
    const key = String(storeId);
    const carts = {...get().carts};
    const entry = carts[key];
    if (entry == null) {
      return;
    }
    const lines = entry.lines.filter(l => l.key !== lineKey);
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
      storeLogoUrl: store.logoUrl ?? null,
      lines: [],
      updatedAt: Date.now(),
    };
    const merged = [...entry.lines];
    for (const line of lines) {
      const lineKey = line.key ?? lineKeyOf(line.productId, line.variant ?? null);
      const existing = merged.find(l => l.key === lineKey);
      if (existing) {
        existing.quantity = Math.min(100000, existing.quantity + line.quantity);
      } else {
        merged.push({...line, key: lineKey, variant: line.variant ?? null});
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
