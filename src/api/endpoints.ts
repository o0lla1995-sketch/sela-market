/**
 * endpoints.ts — الواجهات المُغلَّفة بأنواعها (مطابقة لـ market.js v4.1).
 */
import {apiRequest} from './client';
import type {
  CategoryCount,
  CrossProduct,
  MarketUser,
  Order,
  Product,
  Store,
  StoreDetail,
} from '../core/types';

/* ── عام: المتاجر والمنتجات ─────────────────────────────── */

export async function getStores(): Promise<Store[]> {
  const res = await apiRequest<{ok: true; stores: Store[]}>('/api/market/stores');
  return res.stores;
}

export async function getStoreDetail(storeId: number): Promise<StoreDetail> {
  return apiRequest<StoreDetail>(`/api/market/stores/${storeId}`);
}

export interface StoreProductsQuery {
  q?: string;
  page?: number;
  per?: number;
}

export async function getStoreProducts(
  storeId: number,
  query: StoreProductsQuery = {},
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (query.q) {
    params.set('q', query.q);
  }
  if (query.page) {
    params.set('page', String(query.page));
  }
  if (query.per) {
    params.set('per', String(query.per));
  }
  const qs = params.toString();
  const res = await apiRequest<{ok: true; products: Product[]}>(
    `/api/market/stores/${storeId}/products${qs ? `?${qs}` : ''}`,
  );
  return res.products;
}

export interface CrossProductsQuery {
  q?: string;
  category?: string;
  page?: number;
  per?: number;
}

/** بحث عابر للمتاجر + فلتر تصنيف (v4.1 على الخادم). */
export async function getCrossProducts(
  query: CrossProductsQuery = {},
): Promise<CrossProduct[]> {
  const params = new URLSearchParams();
  if (query.q) {
    params.set('q', query.q);
  }
  if (query.category) {
    params.set('category', query.category);
  }
  if (query.page) {
    params.set('page', String(query.page));
  }
  if (query.per) {
    params.set('per', String(query.per));
  }
  const qs = params.toString();
  const res = await apiRequest<{ok: true; products: CrossProduct[]}>(
    `/api/market/products${qs ? `?${qs}` : ''}`,
  );
  return res.products;
}

export async function getCategories(): Promise<CategoryCount[]> {
  const res = await apiRequest<{ok: true; categories: CategoryCount[]}>(
    '/api/market/categories',
  );
  return res.categories;
}

/* ── الحساب ─────────────────────────────────────────────── */

export interface AuthResponse {
  ok: true;
  token: string;
  user: MarketUser;
}

export async function register(input: {
  idNumber: string;
  name: string;
  phone: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/market/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function login(input: {
  idNumber: string;
  phone: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/market/auth/login', {
    method: 'POST',
    body: input,
  });
}

/** حذف الحساب (سياسة جوجل بلاي) — خادم v4.1+. */
export async function deleteAccount(token: string | null): Promise<{ok: true}> {
  return apiRequest<{ok: true}>('/api/market/auth/delete', {
    method: 'POST',
    token,
  });
}

/* ── الطلبات ────────────────────────────────────────────── */

export interface PlaceOrderInput {
  storeId: number;
  items: {productId: number; quantity: number}[];
  regionName: string;
  address?: string;
  note?: string;
}

export async function placeOrder(
  token: string,
  input: PlaceOrderInput,
): Promise<Order> {
  const res = await apiRequest<{ok: true; order: Order}>('/api/market/orders', {
    method: 'POST',
    token,
    body: input,
  });
  return res.order;
}

export async function getMyOrders(token: string): Promise<Order[]> {
  const res = await apiRequest<{ok: true; orders: Order[]}>('/api/market/orders', {
    token,
  });
  return res.orders;
}

export async function cancelOrder(token: string, orderId: number): Promise<Order> {
  const res = await apiRequest<{ok: true; order: Order}>(
    `/api/market/orders/${orderId}/cancel`,
    {method: 'POST', token},
  );
  return res.order;
}
