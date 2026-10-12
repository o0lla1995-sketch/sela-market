/**
 * orderStatus.ts — منظومة حالات الطلب: التسميات والألوان وخط الزمن
 * والانتقالات، بلغة المستخدم لا بلغة قاعدة البيانات.
 */
import type {Order, OrderStatus} from './types';

export interface StatusMeta {
  label: string;
  short: string;
  tone: 'info' | 'warning' | 'brand' | 'success' | 'danger' | 'muted' | 'purple';
  emojiFree: true;
  /** وصف ما يعنيه هذا التحديث للعميل. */
  description: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  new: {
    label: 'طلب جديد',
    short: 'جديد',
    tone: 'info',
    emojiFree: true,
    description: 'وصل طلبك إلى المتجر وينتظر مراجعته',
  },
  accepted: {
    label: 'قيد التجهيز',
    short: 'تجهيز',
    tone: 'warning',
    emojiFree: true,
    description: 'قبل المتجر طلبك ويجهّزه الآن',
  },
  sent: {
    label: 'في الطريق إليك',
    short: 'في الطريق',
    tone: 'brand',
    emojiFree: true,
    description: 'خرج الطلب من المتجر وفي طريقه إليك',
  },
  delivered: {
    label: 'تم التسليم',
    short: 'مُسلّم',
    tone: 'success',
    emojiFree: true,
    description: 'تم تسليم الطلب وتحصيل قيمته — شكراً لتسوقك',
  },
  rejected: {
    label: 'مرفوض من المتجر',
    short: 'مرفوض',
    tone: 'danger',
    emojiFree: true,
    description: 'اعتذر المتجر عن تنفيذ الطلب',
  },
  cancelled: {
    label: 'ملغي',
    short: 'ملغي',
    tone: 'muted',
    emojiFree: true,
    description: 'أُلغي هذا الطلب قبل إرساله',
  },
  returned: {
    label: 'مُرجَع',
    short: 'مرتجع',
    tone: 'purple',
    emojiFree: true,
    description: 'أُرجع هذا الطلب كلياً أو جزئياً',
  },
};

/** الحالات «النشطة» — مرشّح شريط الطلبات الافتراضي. */
export const ACTIVE_STATUSES: OrderStatus[] = ['new', 'accepted', 'sent'];

/** هل الطلب في مسار التقدم الطبيعي (خط زمن متصل)؟ */
export function isProgressStatus(s: OrderStatus): boolean {
  return ['new', 'accepted', 'sent', 'delivered'].includes(s);
}

/** خطوات خط الزمن للطلب المتقدم: جديد ← تجهيز ← في الطريق ← تسليم. */
export const TIMELINE_STEPS: {status: OrderStatus; label: string; hint: string}[] = [
  {status: 'new', label: 'طلب مُرسل', hint: 'وصل طلبك للمتجر'},
  {status: 'accepted', label: 'قيد التجهيز', hint: 'قبل المتجر الطلب'},
  {status: 'sent', label: 'في الطريق', hint: 'خرج للتوصيل'},
  {status: 'delivered', label: 'تم التسليم', hint: 'استلمت طلبك'},
];

/** الفهرس المُنجز في خط الزمن (−1 = لم يبدأ). */
export function timelineIndex(status: OrderStatus): number {
  const i = TIMELINE_STEPS.findIndex(s => s.status === status);
  return i;
}

/** هل يمكن للمستخدم إلغاء الطلب؟ (قبل الإرسال فقط — قاعدة الخادم). */
export function canCancel(status: OrderStatus): boolean {
  return status === 'new' || status === 'accepted';
}

/** نص إشعار التحديث حسب الحالة الجديدة. */
export function statusNotificationBody(order: Order): string {
  const meta = STATUS_META[order.status];
  const store = order.store?.name ?? 'المتجر';
  switch (order.status) {
    case 'accepted':
      return `${store} قبل طلبك ${order.order_number} وهو قيد التجهيز`;
    case 'sent':
      return `طلبك ${order.order_number} من ${store} في الطريق إليك`;
    case 'delivered':
      return `تم تسليم طلبك ${order.order_number} — نتمنى لك تجربة سعيدة`;
    case 'rejected':
      return `اعتذر ${store} عن طلبك ${order.order_number}${
        order.reject_reason ? `: ${order.reject_reason}` : ''
      }`;
    case 'cancelled':
      return `أُلغي الطلب ${order.order_number}`;
    case 'returned':
      return `سُجّل إرجاع على الطلب ${order.order_number}`;
    default:
      return `${meta.label} — ${order.order_number}`;
  }
}

/** تاريخ آخر تحديث مفيد للعرض. */
export function statusTimestamp(order: Order): number {
  switch (order.status) {
    case 'accepted':
      return order.accepted_at ?? order.updated_at;
    case 'sent':
      return order.sent_at ?? order.updated_at;
    case 'delivered':
      return order.delivered_at ?? order.updated_at;
    case 'cancelled':
      return order.cancelled_at ?? order.updated_at;
    default:
      return order.updated_at;
  }
}
