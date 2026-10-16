/**
 * OrderDetailScreen.tsx — تفاصيل الطلب: خط زمن الحالة، رقم الطلب
 * ووقته، البنود والمبالغ، منطقة/عنوان التسليم، اتصال بالمتجر،
 * إلغاء قبل الإرسال، وإعادة الطلب بلمسة.
 */
import React, {useCallback, useState} from 'react';
import {Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts, radius, toneColors} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  Button,
  Card,
  ErrorState,
  Loader,
  Screen,
  SectionTitle,
} from '../../components/ui';
import {OrderStatusBadge, OrderTimeline, OrderTotals} from '../../components/OrderViews';
import {RatingSheet, Stars} from '../../components/RatingSheet';
import {getMyOrders, getStoreDetail, cancelOrder} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {formatDateTime, relativeTime} from '../../core/time';
import {formatMoney, formatQty} from '../../core/money';
import {canCancel, STATUS_META, statusTimestamp} from '../../core/orderStatus';
import {lineKeyOf, type Order, type Store} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useCartStore} from '../../stores/cartStore';
import {useToastStore} from '../../stores/toastStore';
import {shareOrder} from '../../core/share';
import {syncOrdersOnce} from '../../services/ordersSync';
import type {OrdersStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

export function OrderDetailScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const {orderId, order: initialOrder} = route.params;

  const token = useAuthStore(s => s.token);
  const reAddLines = useCartStore(s => s.reAddLines);
  const toast = useToastStore(s => s.show);

  const [order, setOrder] = useState<Order | null>(initialOrder ?? null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(initialOrder == null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  const load = useCallback(async () => {
    if (token == null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const orders = await getMyOrders(token);
      const found = orders.find(o => o.id === orderId) ?? null;
      if (found != null) {
        setOrder(found);
        try {
          const detail = await getStoreDetail(found.store_id);
          setStore(detail.store);
        } catch {
          /* بيانات المتجر تحسينية فقط */
        }
      } else {
        setError('لم نجد هذا الطلب بين طلباتك');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل الطلب');
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useFocusEffect(
    React.useCallback(() => {
      if (order == null) {
        void load();
      } else {
        void syncOrdersOnce(true);
      }
    }, [order, load]),
  );

  if (loading && order == null) {
    return (
      <Screen>
        <AppHeader title="تفاصيل الطلب" onBack={() => navigation.goBack()} />
        <Loader />
      </Screen>
    );
  }

  if (order == null) {
    return (
      <Screen>
        <AppHeader title="تفاصيل الطلب" onBack={() => navigation.goBack()} />
        <ErrorState message={error ?? 'الطلب غير متاح'} onRetry={load} />
      </Screen>
    );
  }

  const doCancel = async () => {
    if (token == null) {
      return;
    }
    setCancelling(true);
    try {
      const updated = await cancelOrder(token, order.id);
      setOrder({...updated, items: updated.items ?? order.items, store: updated.store ?? order.store});
      setConfirmCancel(false);
      toast('أُلغي الطلب قبل إرساله', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'تعذر إلغاء الطلب', 'danger');
      // الحالة ربما تغيّرت — أعد الجلب.
      await load();
    } finally {
      setCancelling(false);
    }
  };

  const reorder = () => {
    const storeRef = {
      id: order.store_id,
      name: order.store?.name ?? 'المتجر',
      storeNumber: order.store?.store_number ?? order.store?.storeNumber,
    };
    reAddLines(
      storeRef,
      order.items.map(it => ({
        key: lineKeyOf(it.product_id ?? 0, it.variant ?? null),
        productId: it.product_id ?? 0,
        name: it.product_name,
        priceMinor: it.unit_price_minor,
        unitLabel: null,
        soldByWeight: false,
        stock: 999,
        quantity: it.quantity,
        variant: it.variant ?? null,
      })),
    );
    toast(`أُعيدت بنود الطلب إلى سلة ${storeRef.name}`, 'success');
    navigation.getParent()?.navigate('Cart');
  };

  const meta = STATUS_META[order.status];
  const canRate = order.status === 'delivered';
  /* v3.3: لون حالة الطلب — يلوّن الحافة الأمامية لبطاقة الحالة
   * (نفس لغة بطاقات القائمة). */
  const tone = toneColors(palette, meta.tone);
  /* v4.0: هل الطلب في مسار التتبع الحي؟ (يتحرك — يستحق مؤشر تحديث). */
  const liveTracking = order.status === 'new' || order.status === 'accepted' || order.status === 'sent';

  return (
    <Screen>
      <AppHeader
        title={order.order_number}
        subtitle={`طلب ${order.store?.name ?? ''}`}
        onBack={() => navigation.goBack()}
        /* v4.0: مشاركة الطلب — رقمه وحالته وإجماليه في رسالة جاهزة
         * (طلب المستخدم: المشاركة في كل الصفحات المفيدة). */
        right={
          <Pressable
            onPress={() => void shareOrder(order)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="مشاركة الطلب"
            style={[detailStyles.shareBtn, {backgroundColor: palette.surface, borderColor: palette.line}]}>
            <Icon name="forward" size={18} color={palette.ink} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: stackClearance}} showsVerticalScrollIndicator={false}>
        {/* حالة الطلب — v3.3: حافة ملونة بحالة الطلب + وصف */}
        <Card style={{gap: spacing.md, borderRightWidth: 4, borderRightColor: tone.fg}}>
          <View style={detailStyles.statusRow}>
            <OrderStatusBadge status={order.status} />
            <Text style={[{fontSize: 12, color: palette.muted}]}>
              {relativeTime(statusTimestamp(order))}
            </Text>
          </View>
          <Text style={[type.small, {color: palette.inkSoft, lineHeight: 21}]}>
            {meta.description}
          </Text>
          <OrderTimeline order={order} />
          {/* v4.0: شريط التتبع الحي — للطلبات المتحركة فقط: تحديث يدوي
           * فوري + طمأنة أن التطبيق يراقب تلقائياً (مستطلع الطلبات كل
           * ٤٥ ثانية) — طلب المستخدم: «التتبع والمراقبة». */}
          {liveTracking ? (
            <View style={[detailStyles.liveRow, {backgroundColor: palette.infoSoft, borderColor: palette.info}]}>
              <Icon name="refresh" size={13} color={palette.info} />
              <Text style={{fontSize: 11, color: palette.info, flex: 1, fontFamily: fonts.medium}}>
                نراقب حالة طلبك تلقائياً ونُشعرك بأي تحديث
              </Text>
              <Pressable
                onPress={() => {
                  toast('نجلب أحدث حالة للطلب…', 'info');
                  void load();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="تحديث حالة الطلب الآن">
                <Text style={{fontSize: 11.5, color: palette.info, fontFamily: fonts.bold}}>
                  تحديث الآن
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {/* تقييم المتجر — للطلبات المسلّمة فقط (خادم 4.4) */}
        {canRate ? (
          order.rating != null ? (
            <Card style={{gap: spacing.sm}}>
              <SectionTitle title="تقييمك لهذا الطلب" />
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 8}}>
                <Stars rating={order.rating.stars} size={18} />
                <Icon name="checkCircle" size={15} color={palette.success} />
              </View>
              {order.rating.comment ? (
                <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20}]}>
                  «{order.rating.comment}»
                </Text>
              ) : null}
            </Card>
          ) : (
            <Card style={{gap: spacing.sm, borderColor: palette.warning}}>
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm}}>
                <View style={[detailStyles.rateIcon, {backgroundColor: palette.warningSoft}]}>
                  <Icon name="star" size={20} color={palette.warning} />
                </View>
                <View style={{flex: 1, gap: 2}}>
                  <Text style={[type.h3, {color: palette.ink}]}>
                    وصل طلبك؟ قيّم {order.store?.name ?? 'المتجر'}
                  </Text>
                  <Text style={{fontSize: 11.5, color: palette.muted}}>
                    رأيك يبني تقييم المتجر الاحترافي ويساعد بقية المتسوقين
                  </Text>
                </View>
              </View>
              <Button
                label="قيّم الآن"
                variant="soft"
                icon="star"
                onPress={() => setRatingOpen(true)}
              />
            </Card>
          )
        ) : null}

        {/* بيانات التسليم */}
        <Card style={{gap: spacing.sm}}>
          <SectionTitle title="التسليم" />
          <InfoRow icon="truck" label="المنطقة" value={order.region_name ?? '—'} palette={palette} />
          {order.address ? (
            <InfoRow icon="pin" label="العنوان" value={order.address} palette={palette} />
          ) : null}
          {order.note ? (
            <InfoRow icon="note" label="ملاحظتك" value={order.note} palette={palette} />
          ) : null}
          <InfoRow
            icon="clock"
            label="وقت الطلب"
            value={formatDateTime(order.created_at)}
            palette={palette}
          />
          {order.invoice_ref ? (
            <InfoRow icon="doc" label="فاتورة المتجر" value={order.invoice_ref} palette={palette} />
          ) : null}
          {order.cancel_reason ? (
            <InfoRow icon="xCircle" label="سبب الإلغاء" value={order.cancel_reason} palette={palette} />
          ) : null}
          {order.reject_reason ? (
            <InfoRow icon="xCircle" label="سبب الرفض" value={order.reject_reason} palette={palette} />
          ) : null}
        </Card>

        {/* البنود */}
        <Card style={{gap: spacing.md}}>
          <SectionTitle title={`البنود (${order.items.length})`} />
          {order.items.map(it => (
            <View key={it.id} style={detailStyles.itemRow}>
              <View style={{flex: 1, gap: 2, alignItems: 'flex-start'}}>
                <Text style={[type.smallMedium, {color: palette.ink}]} numberOfLines={2}>
                  {it.product_name}
                </Text>
                {it.variant != null ? (
                  <Text style={{fontSize: 10.5, color: palette.brandDark}} numberOfLines={1}>
                    {it.variant}
                  </Text>
                ) : null}
              </View>
              <Text style={[{fontSize: 12, color: palette.muted}]}>
                {formatMoney(it.unit_price_minor)} × {formatQty(it.quantity, false)}
              </Text>
              <Text style={[{fontSize: 13, color: palette.brandDark, fontFamily: fonts.bold, minWidth: 64, textAlign: 'left'}]}>
                {formatMoney(it.line_total_minor)}
              </Text>
            </View>
          ))}
          <View style={{borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.md}}>
            <OrderTotals order={order} />
          </View>
        </Card>

        {/* المتجر */}
        {store ? (
          <Card style={{gap: spacing.md}}>
            <View style={detailStyles.storeRow}>
              <View style={{flex: 1, gap: 2, alignItems: 'flex-start'}}>
                <Text style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]}>
                  {store.name}
                </Text>
                {store.region ? (
                  <Text style={[{fontSize: 11.5, color: palette.muted}]}>{store.region}</Text>
                ) : null}
              </View>
              {store.phone ? (
                <Button
                  label="اتصال"
                  variant="soft"
                  small
                  icon="phone"
                  onPress={() => Linking.openURL(`tel:${store.phone}`)}
                />
              ) : null}
              {store.whatsapp ? (
                <Button
                  label="واتساب"
                  variant="outline"
                  small
                  icon="whatsapp"
                  onPress={() =>
                    Linking.openURL(`https://wa.me/${store.whatsapp!.replace(/[^\d]/g, '')}`)
                  }
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* الإجراءات */}
        <View style={{gap: spacing.md}}>
          {canCancel(order.status) ? (
            <Button
              label="إلغاء الطلب (قبل الإرسال)"
              variant="outline"
              icon="close"
              onPress={() => setConfirmCancel(true)}
            />
          ) : null}
          <Button
            label="إعادة الطلب إلى السلة"
            variant="soft"
            icon="refresh"
            onPress={reorder}
          />
        </View>
      </ScrollView>

      {/* v3.3: تأكيد الإلغاء — حوار مركزي حقيقي (نافذة منبثقة بغطاء
       * شفاف ولوحة مستديرة) بدل بطاقة مضمنة داخل التمرير. */}
      {confirmCancel ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmCancel(false)}>
          <View style={[dialogStyles.overlay, {backgroundColor: palette.overlay}]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setConfirmCancel(false)}
            />
            <View
              style={[
                dialogStyles.panel,
                {backgroundColor: palette.surface, borderColor: palette.line},
              ]}>
              <View style={[dialogStyles.iconWrap, {backgroundColor: palette.dangerSoft}]}>
                <Icon name="xCircle" size={26} color={palette.danger} />
              </View>
              <Text style={[type.h3, {color: palette.ink, textAlign: 'center'}]}>
                إلغاء الطلب
              </Text>
              <Text
                style={[
                  type.small,
                  {color: palette.muted, textAlign: 'center', lineHeight: 20},
                ]}>
                الإلغاء متاح فقط قبل أن يرسل المتجر الطلب ولا يمكن التراجع
                بعده. هل أنت متأكد؟
              </Text>
              <View style={{flexDirection: 'row-reverse', gap: spacing.md, width: '100%'}}>
                <Button
                  label="نعم، ألغِ الطلب"
                  variant="danger"
                  small
                  style={{flex: 1}}
                  loading={cancelling}
                  onPress={doCancel}
                />
                <Button
                  label="تراجع"
                  variant="outline"
                  small
                  style={{flex: 1}}
                  onPress={() => setConfirmCancel(false)}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* نافذة التقييم */}
      <RatingSheet
        visible={ratingOpen}
        onClose={() => setRatingOpen(false)}
        orderId={order.id}
        storeName={order.store?.name ?? 'المتجر'}
        onRated={stars => {
          setOrder(prev =>
            prev == null ? prev : {...prev, rating: {stars, comment: null}},
          );
        }}
      />
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  palette,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  value: string;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <View style={detailStyles.infoRow}>
      <Icon name={icon} size={15} color={palette.muted} />
      <Text style={[{fontSize: 12, color: palette.muted, minWidth: 70}]}>{label}</Text>
      <Text style={[{fontSize: 12.5, color: palette.ink, flex: 1, textAlign: 'right'}]}>
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  /* v4.0: زر مشاركة الطلب في التروسة — نفس لغة زر الرجوع. */
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* v4.0: شريط التتبع الحي داخل بطاقة الحالة. */
  liveRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
  },
  storeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
});

/* v3.3: حوار التأكيد المركزي. */
const dialogStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
