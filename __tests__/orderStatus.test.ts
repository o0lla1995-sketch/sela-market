/**
 * orderStatus.test.ts — منطق حالات الطلب: الخط الزمني، الإلغاء،
 * ونصوص الإشعارات.
 */
import {
  ACTIVE_STATUSES,
  STATUS_META,
  canCancel,
  isProgressStatus,
  statusNotificationBody,
  timelineIndex,
} from '../src/core/orderStatus';
import type {Order} from '../src/core/types';

const baseOrder: Order = {
  id: 7,
  order_number: 'ORD-20261012-000001',
  store_id: 1,
  user_id: 1,
  status: 'new',
  region_name: 'المركز',
  address: null,
  note: null,
  delivery_fee_minor: 1200,
  items_total_minor: 7300,
  total_minor: 8500,
  returned_minor: 0,
  invoice_ref: null,
  reject_reason: null,
  cancel_reason: null,
  revision: 1,
  created_at: 1700000000000,
  updated_at: 1700000000000,
  accepted_at: null,
  sent_at: null,
  delivered_at: null,
  cancelled_at: null,
  items: [],
  store: {id: 1, name: 'سوبر ماركت النور'},
};

describe('status metadata', () => {
  it('covers the full server lifecycle', () => {
    const expected = [
      'new',
      'accepted',
      'sent',
      'delivered',
      'rejected',
      'cancelled',
      'returned',
    ];
    for (const s of expected) {
      expect(STATUS_META[s as keyof typeof STATUS_META]).toBeDefined();
    }
  });
});

describe('canCancel (server rule: before send only)', () => {
  it('allows new and accepted', () => {
    expect(canCancel('new')).toBe(true);
    expect(canCancel('accepted')).toBe(true);
  });
  it('blocks everything after send', () => {
    expect(canCancel('sent')).toBe(false);
    expect(canCancel('delivered')).toBe(false);
    expect(canCancel('cancelled')).toBe(false);
  });
});

describe('timeline', () => {
  it('progress statuses map to indices', () => {
    expect(timelineIndex('new')).toBe(0);
    expect(timelineIndex('accepted')).toBe(1);
    expect(timelineIndex('sent')).toBe(2);
    expect(timelineIndex('delivered')).toBe(3);
  });
  it('terminal statuses are off the timeline', () => {
    expect(timelineIndex('rejected')).toBe(-1);
    expect(timelineIndex('cancelled')).toBe(-1);
    expect(timelineIndex('returned')).toBe(-1);
  });
  it('isProgressStatus matches', () => {
    expect(isProgressStatus('sent')).toBe(true);
    expect(isProgressStatus('rejected')).toBe(false);
  });
});

describe('notification bodies', () => {
  it('names the store and order number', () => {
    const body = statusNotificationBody({...baseOrder, status: 'accepted'});
    expect(body).toContain('سوبر ماركت النور');
    expect(body).toContain('ORD-20261012-000001');
  });
  it('includes reject reason when present', () => {
    const body = statusNotificationBody({
      ...baseOrder,
      status: 'rejected',
      reject_reason: 'نفد المخزون',
    });
    expect(body).toContain('نفد المخزون');
  });
});

describe('ACTIVE_STATUSES', () => {
  it('drives the orders tab default filter', () => {
    expect(ACTIVE_STATUSES).toEqual(['new', 'accepted', 'sent']);
  });
});
