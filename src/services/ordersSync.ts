/**
 * ordersSync.ts — مستطلع الطلبات: يجلب «طلباتي» كل 45 ثانية أثناء فتح
 * التطبيق (وعند فتح شاشة الطلبات) ويقارن الحالة/المراجعة مع آخر لقطة؛
 * كل تغيّر يُطلق إشعاراً محلياً + عنصراً في مركز الإشعارات + يحدّث
 * شارة شريط الطلبات. لا خدمطة push خارجية — كل شيء فوق نفس الخادم.
 */
import {AppState, AppStateStatus} from 'react-native';
import {getMyOrders} from '../api/endpoints';
import {ApiError} from '../api/client';
import {ORDERS_POLL_INTERVAL_MS, storage} from '../core/config';
import {STATUS_META, statusNotificationBody} from '../core/orderStatus';
import type {Order, OrderStatus} from '../core/types';
import {useAuthStore} from '../stores/authStore';
import {useNotificationsStore} from '../stores/notificationsStore';
import {useSettingsStore} from '../stores/settingsStore';
import {requestNotificationsPermission, showLocalNotification} from './localNotifications';

const SNAPSHOT_KEY = 'orders-snapshot:v1';

/** لقطة آخر حالة معروفة لكل طلب. */
type Snapshot = Record<string, {status: OrderStatus; revision: number}>;

function loadSnapshot(): Snapshot {
  try {
    const raw = storage.getString(SNAPSHOT_KEY);
    if (raw != null) {
      return JSON.parse(raw) as Snapshot;
    }
  } catch {
    /* تجاهل */
  }
  return {};
}

function saveSnapshot(snap: Snapshot): void {
  storage.set(SNAPSHOT_KEY, JSON.stringify(snap));
}

/** عدد الطلبات النشطة (شارة شريط التبويبات). */
let activeCount = 0;
export function getActiveOrdersCount(): number {
  return activeCount;
}

/** آخر نسخة طلبات جُلبت — للاستخدام الفوري في الشاشات. */
let lastOrders: Order[] = [];
export function getLastOrders(): Order[] {
  return lastOrders;
}

let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: {remove: () => void} | null = null;
let syncing = false;
/** أول مزامنة بعد الدخول لا تُشعِر (تأسيس اللقطة بصمت). */
let primed = false;

/**
 * جلبة واحدة + مقارنة + إشعارات. تُستدعى دورياً وعند الطلب.
 * يعيد عدد التغييرات (0 = بلا جديد).
 */
export async function syncOrdersOnce(silent = false): Promise<number> {
  const {token} = useAuthStore.getState();
  if (token == null || syncing) {
    return 0;
  }
  syncing = true;
  let changes = 0;
  try {
    const orders = await getMyOrders(token);
    lastOrders = orders;
    activeCount = orders.filter(o =>
      ['new', 'accepted', 'sent'].includes(o.status),
    ).length;

    const prev = loadSnapshot();
    const next: Snapshot = {};
    for (const order of orders) {
      next[String(order.id)] = {status: order.status, revision: order.revision};
    }

    if (primed) {
      for (const order of orders) {
        const before = prev[String(order.id)];
        if (before == null) {
          // طلب جديد وُضع من هذا الجهاز؟ إشعار لطيف فقط إن جاء من
          // مكان آخر (لا نزعج المستخدم بطلبه الخاص).
          if (!silent) {
            notifyOrder(order);
            changes++;
          }
        } else if (before.status !== order.status || before.revision !== order.revision) {
          notifyOrder(order);
          changes++;
        }
      }
    } else {
      primed = true;
    }
    saveSnapshot(next);
  } catch (e) {
    // انقطاع صمت أو انتهاء جلسة — يُعاد المحاولة في الدورة التالية.
    if (e instanceof ApiError && e.code === 'AUTH_REQUIRED') {
      useAuthStore.getState().logout();
    }
  } finally {
    syncing = false;
  }
  return changes;
}

function notifyOrder(order: Order): void {
  const settings = useSettingsStore.getState();
  if (!settings.notificationsEnabled) {
    return;
  }
  const meta = STATUS_META[order.status];
  const body = statusNotificationBody(order);
  // مركز الإشعارات داخل التطبيق دائماً.
  useNotificationsStore.getState().push({
    id: `order-${order.id}-${order.revision}`,
    kind: 'order',
    title: `${meta.label} · ${order.store?.name ?? ''}`.trim(),
    body,
  });
  // إشعار النظام (إن سُمح) — id رقمي مشتق من الطلب والمراجعة.
  void showLocalNotification(
    (order.id * 1000 + (order.revision % 1000)) % 2147483000,
    'سيلا ماركت — تحديث طلبك',
    body,
    'order',
  );
}

/** بدء الاستطلاع الدوري (يُستدعى مرة من App). */
export function startOrdersSync(): void {
  stopOrdersSync();
  void syncOrdersOnce();
  timer = setInterval(() => {
    if (useAuthStore.getState().token != null) {
      void syncOrdersOnce();
    }
  }, ORDERS_POLL_INTERVAL_MS);
  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void syncOrdersOnce(true);
    }
  });
}

/** إيقاف الاستطلاع (تسجيل خروج). */
export function stopOrdersSync(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
  if (appStateSub != null) {
    appStateSub.remove();
    appStateSub = null;
  }
  primed = false;
  lastOrders = [];
  activeCount = 0;
}

/** بعد تسجيل الدخول أو استئناف جلسة: تأسيس اللقطة بصمت ثم الدوران
 * + طلب إذن الإشعارات (لحظة سياقية صحيحة: المستخدم يتوقع تحديثات). */
export function primeAndStart(): void {
  primed = false;
  startOrdersSync();
  const settings = useSettingsStore.getState();
  if (settings.notificationsEnabled) {
    void requestNotificationsPermission();
  }
}
