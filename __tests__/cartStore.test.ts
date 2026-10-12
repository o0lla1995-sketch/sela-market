/**
 * cartStore.test.ts — منطق السلة: سلة لكل متجر، الكميات بالوزن،
 * الحذف عند أقل من الحد، والمجاميع.
 */
import {useCartStore} from '../src/stores/cartStore';
import type {Product, StoreRef} from '../src/core/types';

const store: StoreRef = {id: 1, name: 'سوبر ماركت النور', storeNumber: 'ST-000001'};
const store2: StoreRef = {id: 2, name: 'دكان أبو محمد', storeNumber: 'ST-000002'};

const piece: Product = {
  id: 101,
  product_ref: '101',
  name: 'أرز أبو كاس 5كغ',
  category: 'بقالة',
  price_minor: 3350,
  stock: 12,
  barcode: null,
  sold_by_weight: 0,
  unit_label: null,
  description: null,
  store_id: 1,
};

const weight: Product = {
  id: 103,
  product_ref: '103',
  name: 'طماطم',
  category: 'خضار',
  price_minor: 400,
  stock: 30,
  barcode: null,
  sold_by_weight: 1,
  unit_label: 'كيلو',
  description: null,
  store_id: 1,
};

function fresh() {
  useCartStore.getState().clearAll();
}

describe('per-store carts', () => {
  beforeEach(fresh);

  it('keeps carts isolated per store', () => {
    useCartStore.getState().addProduct(store, piece);
    useCartStore.getState().addProduct(store2, {...piece, id: 555, store_id: 2});
    expect(Object.keys(useCartStore.getState().carts)).toHaveLength(2);
    expect(useCartStore.getState().countFor(1)).toBe(1);
    expect(useCartStore.getState().countFor(2)).toBe(1);
  });

  it('clearing one store leaves the other intact', () => {
    useCartStore.getState().addProduct(store, piece);
    useCartStore.getState().addProduct(store2, {...piece, id: 556, store_id: 2});
    useCartStore.getState().clearStore(1);
    expect(useCartStore.getState().entryFor(1)).toBeNull();
    expect(useCartStore.getState().entryFor(2)).not.toBeNull();
  });
});

describe('quantities', () => {
  beforeEach(fresh);

  it('pieces step by 1', () => {
    useCartStore.getState().addProduct(store, piece);
    useCartStore.getState().increment(1, 101);
    expect(useCartStore.getState().countFor(1)).toBe(2);
  });

  it('weight steps by half kilo', () => {
    useCartStore.getState().addProduct(store, weight);
    // أول إضافة = 0.5
    expect(useCartStore.getState().countFor(1)).toBe(0.5);
    useCartStore.getState().increment(1, 103);
    expect(useCartStore.getState().countFor(1)).toBe(1);
  });

  it('decrement below minimum removes the line', () => {
    useCartStore.getState().addProduct(store, weight); // 0.5
    useCartStore.getState().decrement(1, 103); // أقل من 0.5 → إزالة
    expect(useCartStore.getState().entryFor(1)).toBeNull();
  });

  it('setQty to zero removes the line', () => {
    useCartStore.getState().addProduct(store, piece);
    useCartStore.getState().setQty(1, 101, 0);
    expect(useCartStore.getState().entryFor(1)).toBeNull();
  });
});

describe('totals', () => {
  beforeEach(fresh);

  it('subtotal uses server-style rounding', () => {
    useCartStore.getState().addProduct(store, piece); // 3350 × 1
    useCartStore.getState().addProduct(store, weight); // 400 × 0.5 = 200
    expect(useCartStore.getState().subtotalFor(1)).toBe(3350 + 200);
  });

  it('countAll sums across stores', () => {
    useCartStore.getState().addProduct(store, piece); // 1
    useCartStore.getState().addProduct(store, weight); // 0.5
    useCartStore.getState().addProduct(store2, {...piece, id: 557, store_id: 2}); // 1
    expect(useCartStore.getState().countAll()).toBe(2.5);
  });
});

describe('reAddLines (إعادة طلب)', () => {
  beforeEach(fresh);

  it('merges re-ordered lines with existing ones', () => {
    useCartStore.getState().addProduct(store, piece); // 1
    useCartStore.getState().reAddLines(store, [
      {
        productId: 101,
        name: 'أرز أبو كاس 5كغ',
        priceMinor: 3350,
        unitLabel: null,
        soldByWeight: false,
        stock: 12,
        quantity: 2,
      },
    ]);
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines).toHaveLength(1);
    expect(entry?.lines[0].quantity).toBe(3);
  });
});
