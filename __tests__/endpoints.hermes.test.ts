/**
 * endpoints.hermes.test.ts — اختبار الانحدار الحاسم (v2.5).
 * ─────────────────────────────────────────────────────────────────
 * السبب الجذري لسبع جولات من «المنتجات لا تظهر»: محرك Hermes في
 * RN 0.74 لا يوفر URLSearchParams، وكل بناء لطلب منتجات كان يرمي
 * ReferenceError قبل خروج أي نداء شبكة. هذا الاختبار يحاكي المحرك
 * نفسه (يحذف URLSearchParams وURL من البيئة) ثم يستدعي الدوال
 * الحقيقية — إن عاد أي استخدام لهذه الواجهات يفشل الاختبار فوراً
 * بدل أن يصل للجهاز ويختفي بصمتاً.
 */

/* محاكاة Hermes: لا URLSearchParams ولا URL — تماماً كالجهاز. */
delete (global as unknown as Record<string, unknown>).URLSearchParams;
delete (global as unknown as Record<string, unknown>).URL;

/* التقاط المسارات التي يطلبها كل نداء. */
jest.mock('../src/api/client', () => ({
  apiRequest: jest.fn().mockResolvedValue({ok: true, stores: [], products: [], categories: []}),
  ApiError: class extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

import {apiRequest} from '../src/api/client';
import {
  getCrossProducts,
  getStores,
  getStoreProducts,
} from '../src/api/endpoints';

const calls = apiRequest as jest.Mock;

beforeEach(() => {
  calls.mockClear();
});

describe('بناء الاستعلامات بلا URLSearchParams (بيئة Hermes)', () => {
  it('getStores بلا منطقة — مسار نظيف بلا استعلام', async () => {
    await getStores();
    expect(calls).toHaveBeenCalledWith('/api/market/stores');
  });

  it('getStores بمنطقة — region معرّفة (كانت ترمي ReferenceError)', async () => {
    await getStores({region: 'غزة'});
    expect(calls).toHaveBeenCalledWith('/api/market/stores?region=%D8%BA%D8%B2%D8%A9');
  });

  it('getStoreProducts بكل المعاملات — المسار الذي كان ميتاً كلياً', async () => {
    await getStoreProducts(7, {per: 12, page: 2, q: 'حليب'});
    expect(calls).toHaveBeenCalledWith(
      '/api/market/stores/7/products?q=%D8%AD%D9%84%D9%8A%D8%A8&page=2&per=12',
    );
  });

  it('getStoreProducts بالعروض — offers=1', async () => {
    await getStoreProducts(3, {offers: true, per: 10});
    expect(calls).toHaveBeenCalledWith(
      '/api/market/stores/3/products?per=10&offers=1',
    );
  });

  it('getStoreProducts بلا معاملات — مسار نظيف', async () => {
    await getStoreProducts(9, {});
    expect(calls).toHaveBeenCalledWith('/api/market/stores/9/products');
  });

  it('getCrossProducts — «أحدث المنتجات» في الرئيسية (كان ميتاً كلياً)', async () => {
    await getCrossProducts({per: 12, page: 1});
    expect(calls).toHaveBeenCalledWith('/api/market/products?page=1&per=12');
  });

  it('getCrossProducts بتصنيف وبحث معاً', async () => {
    await getCrossProducts({category: 'بقالة', q: 'أرز', per: 6, page: 3});
    expect(calls).toHaveBeenCalledWith(
      '/api/market/products?q=%D8%A3%D8%B1%D8%B2&category=%D8%A8%D9%82%D8%A7%D9%84%D8%A9&page=3&per=6',
    );
  });

  it('لا نداء يرمي إطلاقاً حتى لو حُذفت كل واجهات URL*', async () => {
    expect(() => getStoreProducts(1, {per: 1})).not.toThrow();
    expect(() => getCrossProducts({per: 1})).not.toThrow();
    expect(() => getStores({region: 'x'})).not.toThrow();
  });
});
