/**
 * cartStore.test.ts — منطق السلة: سلة لكل متجر، الكميات بالوزن،
 * الحذف عند أقل من الحد، والمجاميع.
 * v1.2: هوية السطر = المنتج + الخيار المختار — منتج واحد بخيارين
 * سطران مستقلان يُجمعان في العدّاد ولا يطمس أحدهما الآخر.
 */
import {useCartStore} from '../src/stores/cartStore';
import {lineKeyOf, variantTextOf, optionsComplete} from '../src/core/types';
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

/** v1.2: منتج بخيارات (تيشيرت بمقاسات وألوان). */
const shirt: Product = {
  ...piece,
  id: 104,
  name: 'تيشيرت قطن',
  price_minor: 5900,
  options: [
    {name: 'المقاس', values: ['S', 'M', 'L', 'XL']},
    {name: 'اللون', values: ['أسود', 'كحلي']},
  ],
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
    useCartStore.getState().increment(1, lineKeyOf(101, null));
    expect(useCartStore.getState().countFor(1)).toBe(2);
  });

  it('weight steps by half kilo', () => {
    useCartStore.getState().addProduct(store, weight);
    // أول إضافة = 0.5
    expect(useCartStore.getState().countFor(1)).toBe(0.5);
    useCartStore.getState().increment(1, lineKeyOf(103, null));
    expect(useCartStore.getState().countFor(1)).toBe(1);
  });

  it('decrement below minimum removes the line', () => {
    useCartStore.getState().addProduct(store, weight); // 0.5
    useCartStore.getState().decrement(1, lineKeyOf(103, null)); // أقل من 0.5 → إزالة
    expect(useCartStore.getState().entryFor(1)).toBeNull();
  });

  it('setQty to zero removes the line', () => {
    useCartStore.getState().addProduct(store, piece);
    useCartStore.getState().setQty(1, lineKeyOf(101, null), 0);
    expect(useCartStore.getState().entryFor(1)).toBeNull();
  });
});

describe('v1.2 — variants (خيارات الشراء)', () => {
  beforeEach(fresh);

  it('same product with two variants = two independent lines', () => {
    useCartStore.getState().addProduct(store, shirt, 'المقاس: L · اللون: كحلي');
    useCartStore.getState().addProduct(store, shirt, 'المقاس: XL · اللون: أسود');
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines).toHaveLength(2);
    expect(entry?.lines.map(l => l.variant)).toEqual([
      'المقاس: L · اللون: كحلي',
      'المقاس: XL · اللون: أسود',
    ]);
  });

  it('adding the same variant twice merges quantities', () => {
    useCartStore.getState().addProduct(store, shirt, 'المقاس: L · اللون: كحلي');
    useCartStore.getState().addProduct(store, shirt, 'المقاس: L · اللون: كحلي');
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines).toHaveLength(1);
    expect(entry?.lines[0].quantity).toBe(2);
  });

  it('increment targets the exact variant line only', () => {
    useCartStore.getState().addProduct(store, shirt, 'المقاس: L · اللون: كحلي');
    useCartStore.getState().addProduct(store, shirt, 'المقاس: M · اللون: أسود');
    useCartStore.getState().increment(1, lineKeyOf(104, 'المقاس: L · اللون: كحلي'));
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines.find(l => l.variant === 'المقاس: L · اللون: كحلي')?.quantity).toBe(2);
    expect(entry?.lines.find(l => l.variant === 'المقاس: M · اللون: أسود')?.quantity).toBe(1);
  });

  it('removing one variant keeps the other', () => {
    useCartStore.getState().addProduct(store, shirt, 'المقاس: L · اللون: كحلي');
    useCartStore.getState().addProduct(store, shirt, 'المقاس: M · اللون: أسود');
    useCartStore.getState().removeLine(1, lineKeyOf(104, 'المقاس: L · اللون: كحلي'));
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines).toHaveLength(1);
    expect(entry?.lines[0].variant).toBe('المقاس: M · اللون: أسود');
  });
});

describe('variant helpers (المساعدات)', () => {
  it('variantTextOf builds snapshot text', () => {
    expect(
      variantTextOf(shirt.options, {'المقاس': 'L', 'اللون': 'كحلي'}),
    ).toBe('المقاس: L · اللون: كحلي');
  });

  it('variantTextOf null without options', () => {
    expect(variantTextOf(null, {})).toBeNull();
    expect(variantTextOf([], {})).toBeNull();
  });

  it('optionsComplete requires every group', () => {
    expect(optionsComplete(shirt.options, {})).toBe(false);
    expect(optionsComplete(shirt.options, {'المقاس': 'L'})).toBe(false);
    expect(optionsComplete(shirt.options, {'المقاس': 'L', 'اللون': 'كحلي'})).toBe(true);
    expect(optionsComplete(null, {})).toBe(true);
  });

  it('lineKeyOf distinguishes variants', () => {
    expect(lineKeyOf(104, null)).toBe('104:');
    expect(lineKeyOf(104, 'المقاس: L')).toBe('104:المقاس: L');
    expect(lineKeyOf(104, null)).not.toBe(lineKeyOf(104, 'المقاس: L'));
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

  it('variant lines contribute to subtotal', () => {
    useCartStore.getState().addProduct(store, shirt, 'المقاس: L · اللون: كحلي'); // 5900
    useCartStore.getState().addProduct(store, shirt, 'المقاس: M · اللون: أسود'); // 5900
    expect(useCartStore.getState().subtotalFor(1)).toBe(11800);
    expect(useCartStore.getState().countFor(1)).toBe(2);
  });
});

describe('reAddLines (إعادة طلب)', () => {
  beforeEach(fresh);

  it('merges re-ordered lines with existing ones', () => {
    useCartStore.getState().addProduct(store, piece); // 1
    useCartStore.getState().reAddLines(store, [
      {
        key: lineKeyOf(101, null),
        productId: 101,
        name: 'أرز أبو كاس 5كغ',
        priceMinor: 3350,
        unitLabel: null,
        soldByWeight: false,
        stock: 12,
        quantity: 2,
        variant: null,
      },
    ]);
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines).toHaveLength(1);
    expect(entry?.lines[0].quantity).toBe(3);
  });

  it('re-order keeps variant lines separate', () => {
    useCartStore.getState().reAddLines(store, [
      {
        key: lineKeyOf(104, 'المقاس: L'),
        productId: 104,
        name: 'تيشيرت قطن',
        priceMinor: 5900,
        unitLabel: null,
        soldByWeight: false,
        stock: 25,
        quantity: 1,
        variant: 'المقاس: L',
      },
      {
        key: lineKeyOf(104, 'المقاس: XL'),
        productId: 104,
        name: 'تيشيرت قطن',
        priceMinor: 5900,
        unitLabel: null,
        soldByWeight: false,
        stock: 25,
        quantity: 1,
        variant: 'المقاس: XL',
      },
    ]);
    const entry = useCartStore.getState().entryFor(1);
    expect(entry?.lines).toHaveLength(2);
  });
});
