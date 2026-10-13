/**
 * discount.test.ts — خصومات منتجات المتجر (v2.1 / خادم 4.5):
 * effectiveMinor بترتيب الأولوية (final_minor من الخادم → حساب محلي →
 * السعر الأصلي) + وفورات السلة التي تعرض في السلة والدفع.
 */

describe('effectiveMinor (سعر ما بعد الخصم)', () => {
  it('يرجع السعر الأصلي بلا خصم', () => {
    const {effectiveMinor} = require('../src/core/discount');
    expect(effectiveMinor({price_minor: 3350})).toBe(3350);
  });

  it('يستخدم final_minor من الخادم عند توفرها', () => {
    const {effectiveMinor} = require('../src/core/discount');
    expect(effectiveMinor({price_minor: 3350, discount_pct: 20, final_minor: 2680})).toBe(2680);
  });

  it('يحسب محلياً من discount_pct عند غياب final_minor', () => {
    const {effectiveMinor} = require('../src/core/discount');
    expect(effectiveMinor({price_minor: 4000, discount_pct: 25})).toBe(3000);
  });

  it('يقرب مثل الخادم (Math.round)', () => {
    const {effectiveMinor} = require('../src/core/discount');
    expect(effectiveMinor({price_minor: 3333, discount_pct: 10})).toBe(3000);
  });

  it('لا يهبط تحت صفر', () => {
    const {effectiveMinor} = require('../src/core/discount');
    expect(effectiveMinor({price_minor: 0, discount_pct: 50})).toBe(0);
  });
});

describe('hasDiscount (إظهار الشارة والسعر المشطوب)', () => {
  it('خاطئة بلا خصم وصادقة مع خصم', () => {
    const {hasDiscount} = require('../src/core/discount');
    expect(hasDiscount({price_minor: 1000})).toBe(false);
    expect(hasDiscount({price_minor: 1000, discount_pct: 15})).toBe(true);
    expect(hasDiscount({price_minor: 1000, final_minor: 850})).toBe(true);
    expect(hasDiscount({price_minor: 1000, final_minor: 1000})).toBe(false);
  });
});

describe('وفورات السلة (cartSavings/lineSavings)', () => {
  it('يجمع الفرق بين السعرين عبر الكمية', () => {
    const {lineSavings, cartSavings} = require('../src/core/discount');
    const line = {key: 'k', productId: 1, name: 'أرز', priceMinor: 2680, listPriceMinor: 3350, quantity: 2};
    expect(lineSavings(line)).toBe(1340);
    expect(lineSavings({...line, listPriceMinor: undefined})).toBe(0);
    expect(cartSavings([line, {...line, listPriceMinor: undefined}])).toBe(1340);
  });

  it('لا يعطي وفورات وهمية عند listPrice أرخص', () => {
    const {lineSavings} = require('../src/core/discount');
    expect(lineSavings({priceMinor: 100, listPriceMinor: 90, quantity: 3})).toBe(0);
  });
});

describe('سلة المخفضات: addProduct يسجل السعر بعد الخصم', () => {
  it('priceMinor = بعد الخصم وlistPriceMinor = قبل الخصم', () => {
    const useCartStore = require('../src/stores/cartStore').useCartStore;
    useCartStore.getState().clearAll();
    const store = {id: 7, name: 'متجر الخصومات', storeNumber: 'ST-7'};
    const product = {
      id: 55, product_ref: '55', name: 'عسل', price_minor: 5000,
      discount_pct: 20, final_minor: 4000, stock: 5, sold_by_weight: 0,
      store_id: 7,
    } as never;
    useCartStore.getState().addProduct(store, product);
    const entry = useCartStore.getState().entryFor(7);
    expect(entry?.lines[0].priceMinor).toBe(4000);
    expect(entry?.lines[0].listPriceMinor).toBe(5000);
    expect(useCartStore.getState().subtotalFor(7)).toBe(4000);
  });
});

describe('الجلب المتدرج (سلم per 12→6 — v3.0)', () => {
  it('ينزل درجة واحدة عند فشل الشبكة ويكمل الصفحات عند النجاح', async () => {
    jest.resetModules();
    jest.mock('../src/api/client', () => ({
      ApiError: class extends Error {
        code: string;
        status: number;
        constructor(msg: string, code: string, status: number) {
          super(msg);
          this.code = code;
          this.status = status;
        }
      },
      apiRequest: jest.fn(),
      absoluteUrl: (p: string | null) => p,
    }));
    const {getStoreProductsAdaptive} = require('../src/api/endpoints');
    const {apiRequest} = require('../src/api/client');

    const calls: string[] = [];
    let failFirstSize = true;
    (apiRequest as jest.Mock).mockImplementation(async (path: string) => {
      calls.push(path);
      const per = Number(new URL('http://x' + path).searchParams.get('per'));
      if (failFirstSize && per >= 12) {
        throw Object.assign(new Error('network'), {name: 'TypeError'});
      }
      // per=6: صفحة واحدة فيها 5 (نهاية الكتالوج)
      const page = Number(new URL('http://x' + path).searchParams.get('page'));
      if (per === 6) {
        const all = [
          {id: 1, name: 'أ', price_minor: 100, stock: 1, store_id: 1},
          {id: 2, name: 'ب', price_minor: 100, stock: 1, store_id: 1},
          {id: 3, name: 'ج', price_minor: 100, stock: 1, store_id: 1},
          {id: 4, name: 'د', price_minor: 100, stock: 1, store_id: 1},
          {id: 5, name: 'هـ', price_minor: 100, stock: 1, store_id: 1},
        ];
        const slice = all.slice((page - 1) * 6, (page - 1) * 6 + 6);
        return Promise.resolve({ok: true, products: slice});
      }
      return Promise.resolve({ok: true, products: []});
    });

    const got = await getStoreProductsAdaptive(1, 5);
    // فشل 12 ثم نجح 6 واكتمل في صفحة واحدة
    expect(got.map(p => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(calls.some(p => p.includes('per=12'))).toBe(true);
    expect(calls.some(p => p.includes('per=6'))).toBe(true);
    // لا درجات ثالثة بعد الآن — السلم القصير لا يحاول 3 ولا 1
    expect(calls.some(p => p.includes('per=3'))).toBe(false);
    expect(calls.some(p => p.includes('per=1&'))).toBe(false);
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('4xx من الخادم لا يعاد بدرجات أصغر — يستسلم فوراً برسالة الأصل', async () => {
    jest.resetModules();
    jest.mock('../src/api/client', () => ({
      ApiError: class extends Error {
        code: string;
        status: number;
        constructor(msg: string, code: string, status: number) {
          super(msg);
          this.code = code;
          this.status = status;
        }
      },
      apiRequest: jest.fn(),
      absoluteUrl: (p: string | null) => p,
    }));
    const {getStoreProductsAdaptive} = require('../src/api/endpoints');
    const {apiRequest, ApiError} = require('../src/api/client');

    const calls: string[] = [];
    (apiRequest as jest.Mock).mockImplementation(async (path: string) => {
      calls.push(path);
      throw new ApiError('المتجر غير متاح حالياً', 'STORE_NOT_FOUND', 404);
    });

    await expect(getStoreProductsAdaptive(999, 12)).rejects.toThrow('المتجر غير متاح');
    // نداء واحد فقط — لا هدر درجات على حكم خادم نهائي
    expect(calls.length).toBe(1);
    jest.resetModules();
    jest.restoreAllMocks();
  });
});
