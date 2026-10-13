/**
 * cartPersistence.test.ts — اختبار الانحدار الحاسم لدورة حفظ/قراءة السلة.
 * ─────────────────────────────────────────────────────────────────
 * v2.6: العطب الذي أفنى ثقة المستخدم: persist كان يكتب الغلاف
 * {carts, lastActiveStoreId} بينما loadCarts قرأته كأنه سجل المتاجر
 * مباشرة — بعد أي إعادة تشغيل كانت البنية التالفة تصل إلى
 * CartTabIcon فتنفجر e.lines.reduce على undefined عند كل إقلاع:
 * «التطبيق يغلق ولا يفتح».
 *
 * الاختبارات هنا تحاكي إعادة التشغيل فعلياً: كتابة عبر نسخة وحدة،
 * ثم jest.resetModules + require جديدة (قرص MMKV مشترك عبر المحاكي)
 * — أي رجوع للعطب القديم يفشل فوراً على CI قبل وصوله للهاتف.
 */
import {MMKV} from './helpers/mmkv-mock';

const CART_KEY = 'cart:v2';
const STORE_ID = 'sela-market';

/** يبدأ «تشغيلاً نظيفاً» ويعيد متجر السلة بقراءة القرص الحالي. */
function bootApp() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {useCartStore} = require('../src/stores/cartStore');
  return useCartStore;
}

/** يكتب حمولة خام في «قرص» MMKV كما كانت نسخة سابقة ستكتبها. */
function seedRawCart(payload: string) {
  const disk = new MMKV({id: STORE_ID});
  disk.set(CART_KEY, payload);
}

/** الحساب الحرفي الذي كانت CartTabIcon تنفجر عنده — يجب أن يعمل دائماً. */
function tabIconCount(carts: unknown): number {
  return Object.values((carts ?? {}) as Record<string, {lines?: {quantity?: number}[]}>).reduce(
    (sum, e) =>
      Array.isArray(e?.lines)
        ? sum + e.lines.reduce((s, l) => s + (Number.isFinite(l?.quantity) ? l.quantity : 0), 0)
        : sum,
    0,
  );
}

beforeEach(() => {
  (MMKV as unknown as {__resetAll: () => void}).__resetAll();
});

describe('cart persistence across app restarts (v2.6 regression)', () => {
  it('round-trip: added items survive a restart and stay usable', () => {
    // التشغيل الأول: إضافة منتجين.
    const store1 = bootApp();
    store1.getState().addProduct(
      {id: 7, name: 'سوبر ماركت النور', storeNumber: 'ST-7'},
      {
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
        store_id: 7,
      },
      null,
      2,
    );

    // «إعادة التشغيل»: وحدة جديدة تقرأ ما كُتب على القرص.
    const store2 = bootApp();
    const carts = store2.getState().carts;
    expect(Object.keys(carts)).toEqual(['7']);
    expect(carts['7'].lines).toHaveLength(1);
    expect(carts['7'].lines[0].quantity).toBe(2);
    expect(store2.getState().countFor(7)).toBe(2);
    // حساب شارة السلة (CartTabIcon) لا يرمي ويعطي العدد الصحيح.
    expect(tabIconCount(carts)).toBe(2);
    expect(store2.getState().lastActiveStoreId).toBe(7);
  });

  it('legacy corrupted payload (v2.5 wrapper) is unwrapped, not fed to the UI', () => {
    // هذا حرفياً ما كانت v2.5 تكتبه — وكان يقتل التطبيق عند الإقلاع.
    seedRawCart(
      JSON.stringify({
        carts: {
          '7': {
            storeId: 7,
            storeName: 'سوبر ماركت النور',
            storeNumber: 'ST-7',
            lines: [
              {
                key: '101:',
                productId: 101,
                name: 'أرز',
                priceMinor: 3350,
                unitLabel: null,
                soldByWeight: false,
                stock: 12,
                quantity: 3,
                variant: null,
              },
            ],
            updatedAt: 1757000000000,
          },
        },
        lastActiveStoreId: 7,
      }),
    );

    const store = bootApp();
    const carts = store.getState().carts;
    // الغلاف فُتح: المفتاح «7» (المتجر) وليس «carts» (الغلاف).
    expect(Object.keys(carts)).toEqual(['7']);
    expect(carts['7'].lines).toHaveLength(1);
    expect(store.getState().countAll()).toBe(3);
    expect(tabIconCount(carts)).toBe(3);
  });

  it('garbage on disk boots to an empty cart instead of crashing', () => {
    seedRawCart('هذا ليس JSON{{{{{');
    const store = bootApp();
    expect(store.getState().carts).toEqual({});
    expect(store.getState().countAll()).toBe(0);
    expect(tabIconCount(store.getState().carts)).toBe(0);
  });

  it('entries with invalid lines are dropped silently', () => {
    seedRawCart(
      JSON.stringify({
        carts: {
          '7': {storeId: 7, storeName: 'سليم', storeNumber: '1', lines: [{nope: true}], updatedAt: 1},
          '8': {storeId: 8, storeName: 'تالف بلا أسطر', storeNumber: '2', updatedAt: 2},
        },
        lastActiveStoreId: 8,
      }),
    );
    const store = bootApp();
    expect(store.getState().carts).toEqual({});
    expect(store.getState().countAll()).toBe(0);
  });
});
