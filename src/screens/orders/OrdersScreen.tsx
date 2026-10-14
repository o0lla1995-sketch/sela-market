/**
 * OrdersScreen.tsx — طلباتي: فلاتر (النشطة/المكتملة/الكل)، سحب للتحديث
 * + تحديث عند التركيز (يعمل مع مستطلع الطلبات). الزائر يرى بوابة دخول.
 */
import React, {useCallback, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts, radius} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  Button,
  EmptyState,
  ErrorState,
  Loader,
  Screen,
} from '../../components/ui';
import {OrderListCard} from '../../components/OrderViews';
import {RatingSheet} from '../../components/RatingSheet';
import {getMyOrders} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {syncOrdersOnce} from '../../services/ordersSync';
import type {Order, OrderStatus} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useRootNav, type OrdersStackParamList} from '../../navigation/RootNavigator';
import {useTabBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<OrdersStackParamList, 'Orders'>;

type Filter = 'active' | 'done' | 'all';

const FILTERS: {value: Filter; label: string}[] = [
  {value: 'active', label: 'النشطة'},
  {value: 'done', label: 'المكتملة'},
  {value: 'all', label: 'الكل'},
];

export function OrdersScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const tabClearance = useTabBottomClearance();
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);

  const rootNav = useRootNav();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);

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

  /* v3.3: عدادات الفلاتر داخل المبدّل الشرائحي — المستخدم يرى حجم
   * كل قسم قبل الضغط (لغة الواجهات الحديثة). */
  const activeCount = orders.filter(o =>
    ['new', 'accepted', 'sent'].includes(o.status),
  ).length;
  const counts: Record<Filter, number> = {
    active: activeCount,
    done: orders.length - activeCount,
    all: orders.length,
  };

  const unratedCount = orders.filter(
    o => o.status === 'delivered' && o.rating == null,
  ).length;

  return (
    <Screen>
      <AppHeader
        title="طلباتي"
        subtitle={`${user?.name ?? ''} — ${orders.length} طلباً`}
        big
      />

      {/* v3.3: مبدّل شرائحي (Segmented) بالعدادات — بديل احترافي
       * للرقائق المنفصلة؛ القطاع النشط يمتلئ بلون العلامة. */}
      <View
        style={[
          filterStyles.seg,
          {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
        ]}>
        {FILTERS.map(f => {
          const on = filter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              accessibilityState={{selected: on}}
              style={[
                filterStyles.segItem,
                {backgroundColor: on ? palette.brand : 'transparent'},
              ]}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: on ? fonts.bold : fonts.medium,
                  color: on ? palette.onBrand : palette.inkSoft,
                }}>
                {f.label}
                {counts[f.value] > 0 ? ` · ${counts[f.value]}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* شريط تذكير التقييم — طلبات مسلّمة بانتظار رأيك */}
      {unratedCount > 0 ? (
        <Pressable
          onPress={() => {
            const target = orders.find(
              o => o.status === 'delivered' && o.rating == null,
            );
            if (target != null) {
              setRatingOrder(target);
            }
          }}
          style={({pressed}) => [
            filterStyles.rateBanner,
            {backgroundColor: palette.warningSoft, borderColor: palette.warning, opacity: pressed ? 0.8 : 1},
          ]}>
          <Icon name="star" size={16} color={palette.warning} />
          <Text style={[{fontSize: 12, color: palette.inkSoft, flex: 1, fontFamily: fonts.medium}]}>
            لديك {unratedCount} {unratedCount === 1 ? 'طلب وصلك' : 'طلبات وصلتك'} بانتظار تقييمك
          </Text>
          <Icon name="forward" size={14} color={palette.warning} />
        </Pressable>
      ) : null}

      {loading && orders.length === 0 ? (
        <Loader label="نجلب طلباتك…" />
      ) : error != null ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: tabClearance}}
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
              onRate={setRatingOrder}
              onPress={() =>
                navigation.navigate('OrderDetail', {orderId: item.id, order: item})
              }
            />
          )}
        />
      )}

      {/* نافذة التقييم — تفتح من البطاقة أو شريط التذكير */}
      <RatingSheet
        visible={ratingOrder != null}
        onClose={() => setRatingOrder(null)}
        orderId={ratingOrder?.id ?? 0}
        storeName={ratingOrder?.store?.name ?? 'المتجر'}
        onRated={async () => {
          // حدّث الطلب محلياً كأنه مقيّم (الكامل يُجلب عند التحديث).
          const id = ratingOrder?.id;
          if (id != null) {
            setOrders(prev =>
              prev.map(o =>
                o.id === id
                  ? {...o, rating: {stars: 5, comment: null}}
                  : o,
              ),
            );
          }
        }}
      />
    </Screen>
  );
}

const filterStyles = StyleSheet.create({
  /* v3.3: حاوية المبدّل الشرائحي. */
  seg: {
    flexDirection: 'row-reverse',
    gap: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  rateBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
});
