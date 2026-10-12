/**
 * OrderDetailScreen.tsx — تفاصيل الطلب: خط زمن الحالة، رقم الطلب
 * ووقته، البنود والمبالغ، منطقة/عنوان التسليم، اتصال بالمتجر،
 * إلغاء قبل الإرسال، وإعادة الطلب بلمسة.
 */
import React, {useCallback, useState} from 'react';
import {Linking, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
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
import {getMyOrders, getStoreDetail, cancelOrder} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {formatDateTime, relativeTime} from '../../core/time';
import {formatMoney, formatQty} from '../../core/money';
import {canCancel, STATUS_META, statusTimestamp} from '../../core/orderStatus';
import {lineKeyOf, type Order, type Store} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useCartStore} from '../../stores/cartStore';
import {useToastStore} from '../../stores/toastStore';
import {syncOrdersOnce} from '../../services/ordersSync';
import type {OrdersStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

export function OrderDetailScreen({navigation, route}: Props) {
  const {palette} = useTheme();
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

  return (
    <Screen>
      <AppHeader
        title={order.order_number}
        subtitle={`طلب ${order.store?.name ?? ''}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} showsVerticalScrollIndicator={false}>
        {/* حالة الطلب */}
        <Card style={{gap: spacing.md}}>
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
        </Card>

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
            confirmCancel ? (
              <Card style={{gap: spacing.md, borderColor: palette.danger}}>
                <Text style={[type.small, {color: palette.inkSoft}]}>
                  الإلغاء متاح فقط قبل أن يرسل المتجر الطلب. هل أنت متأكد؟
                </Text>
                <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
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
              </Card>
            ) : (
              <Button
                label="إلغاء الطلب (قبل الإرسال)"
                variant="outline"
                icon="close"
                onPress={() => setConfirmCancel(true)}
              />
            )
          ) : null}
          <Button
            label="إعادة الطلب إلى السلة"
            variant="soft"
            icon="refresh"
            onPress={reorder}
          />
        </View>
      </ScrollView>
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
  infoRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
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
