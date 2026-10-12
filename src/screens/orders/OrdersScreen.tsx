/**
 * OrdersScreen.tsx — طلباتي: فلاتر (النشطة/المكتملة/الكل)، سحب للتحديث
 * + تحديث عند التركيز (يعمل مع مستطلع الطلبات). الزائر يرى بوابة دخول.
 */
import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type} from '../../theme/tokens';
import {
  AppHeader,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Loader,
  Screen,
} from '../../components/ui';
import {OrderListCard} from '../../components/OrderViews';
import {getMyOrders} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {syncOrdersOnce} from '../../services/ordersSync';
import type {Order, OrderStatus} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useRootNav, type OrdersStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<OrdersStackParamList, 'Orders'>;

type Filter = 'active' | 'done' | 'all';

const FILTERS: {value: Filter; label: string}[] = [
  {value: 'active', label: 'النشطة'},
  {value: 'done', label: 'المكتملة'},
  {value: 'all', label: 'الكل'},
];

export function OrdersScreen({navigation}: Props) {
  const {palette} = useTheme();
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);

  const rootNav = useRootNav();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (token == null) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await syncOrdersOnce(true);
      const fresh = await getMyOrders(token);
      setOrders(fresh);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  if (token == null) {
    return (
      <Screen>
        <AppHeader title="طلباتي" big />
        <EmptyState
          icon="receipt"
          title="سجّل الدخول لمتابعة طلباتك"
          body="حسابك برقم الهوية يعرض طلباتك من كل متاجر المول في مكان واحد مع تتبع مباشر لكل طلب"
          actionLabel="تسجيل الدخول"
          onAction={() => rootNav.navigate('Login', {reason: 'orders'})}
        />
      </Screen>
    );
  }

  const filtered = orders.filter(o => {
    if (filter === 'active') {
      return ['new', 'accepted', 'sent'].includes(o.status);
    }
    if (filter === 'done') {
      return ['delivered', 'returned', 'rejected', 'cancelled'].includes(o.status);
    }
    return true;
  });

  return (
    <Screen>
      <AppHeader
        title="طلباتي"
        subtitle={`${user?.name ?? ''} — ${orders.length} طلباً`}
        big
      />

      <View style={filterStyles.row}>
        {FILTERS.map(f => (
          <Chip
            key={f.value}
            label={f.label}
            active={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </View>

      {loading && orders.length === 0 ? (
        <Loader label="نجلب طلباتك…" />
      ) : error != null ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md}}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          ListEmptyComponent={
            filter === 'active' && orders.length > 0 ? (
              <EmptyState
                icon="checkCircle"
                title="لا طلبات نشطة"
                body="كل طلباتك السابقة مكتملة — ابدأ طلباً جديداً من الرئيسية"
                actionLabel="ابدأ التسوق"
                onAction={() => navigation.getParent()?.navigate('Shop')}
              />
            ) : orders.length === 0 ? (
              <EmptyState
                icon="receipt"
                title="لا طلبات بعد"
                body="أول طلب من سيلا ماركت بانتظارك — تصفح المتاجر وأضف ما تحتاج إلى السلة"
                actionLabel="ابدأ التسوق"
                onAction={() => navigation.getParent()?.navigate('Shop')}
              />
            ) : (
              <EmptyState icon="receipt" title="لا طلبات في هذا الفلتر" />
            )
          }
          renderItem={({item}) => (
            <OrderListCard
              order={item}
              onPress={() =>
                navigation.navigate('OrderDetail', {orderId: item.id, order: item})
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const filterStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
