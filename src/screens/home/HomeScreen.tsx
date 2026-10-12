/**
 * HomeScreen.tsx — رئيسية المول (v1.2):
 * تروسة بطل: تحية باسم المستخدم + جرس الإشعارات + المفضلة ومدخل
 * بحث بارز (حذفنا شريط ملاحظة التوصيل والدفع بطلب المستخدم —
 * التفاصيل تظهر عند إتمام الطلب فقط)، تصنيفات أفقية بعدّاداتها،
 * متاجر المول، ثم شبكة أحدث المنتجات بصورها (لا نهائية + سحب
 * للتحديث). البيانات تعبر طبقة الكاش — تُعرض آخر لقطة فوراً عند
 * الفتح وعند ضعف الشبكة بدل شاشة خطأ.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, shadowFor, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {
  Badge,
  ErrorState,
  Loader,
  ProductGridSkeleton,
  RowSkeleton,
  Screen,
  SectionTitle,
  Skeleton,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreCard} from '../../components/StoreCard';
import {getCategories, getCrossProducts, getStores} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {greeting} from '../../core/time';
import type {CategoryCount, CrossProduct, Store} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useNotificationsStore} from '../../stores/notificationsStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Home'>;

/* أيقونات تصنيفات إرشادية عند غياب أيقونة مخصصة */
const CATEGORY_ICONS: Record<string, IconName> = {
  'بقالة': 'bag',
  'فواكه وخضروات': 'scale',
  'خضار': 'scale',
  'فواكه': 'scale',
  'لحوم ودواجن': 'cash',
  'لحوم': 'cash',
  'ألبان وأجبان': 'box',
  'مخبوزات': 'store',
  'مشروبات': 'box',
  'منظفات': 'box',
  'إلكترونيات': 'grid',
  'ملابس': 'tag',
};

export function HomeScreen({navigation}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const unread = useNotificationsStore(s => s.unread);

  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [products, setProducts] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadHome = useCallback(async () => {
    setError(null);
    setLoading(true);
    const [storesRes, catsRes, prodsRes] = await Promise.all([
      cachedFetch('stores', () => getStores()),
      cachedFetch('categories', () => getCategories()),
      cachedFetch('products:p1', () => getCrossProducts({page: 1, per: PRODUCTS_PAGE_SIZE})),
    ]);
    // المتاجر والتصنيفات: الكاش يكفي لعرضهما بلا خطأ قطعاً بعد أول نجاح.
    if (storesRes.data != null) {
      setStores(storesRes.data);
    } else if (storesRes.error != null) {
      setError(storesRes.error);
    }
    if (catsRes.data != null) {
      setCategories(catsRes.data);
    }
    if (prodsRes.data != null) {
      setProducts(prodsRes.data);
      setHasMore(prodsRes.data.length >= PRODUCTS_PAGE_SIZE);
      setPage(1);
      setStale(false);
    } else if (prodsRes.error != null && storesRes.data == null) {
      setError(prodsRes.error);
    } else if (prodsRes.error != null) {
      setStale(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || error != null || !hasMore || stale) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await getCrossProducts({page: page + 1, per: PRODUCTS_PAGE_SIZE});
      if (next.length === 0) {
        setHasMore(false);
        return;
      }
      setProducts(prev => {
        const seen = new Set(prev.map(p => `${p.store_id}:${p.id}`));
        return [...prev, ...next.filter(p => !seen.has(`${p.store_id}:${p.id}`))];
      });
      setPage(p => p + 1);
      setHasMore(next.length >= PRODUCTS_PAGE_SIZE);
    } catch {
      /* صمت — المحاولة القادمة عند التمرير */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, error, hasMore, stale, page]);

  const firstEverLoad = loading && products.length === 0 && stores.length === 0;

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={item => `${item.store_id}:${item.id}`}
        numColumns={2}
        columnWrapperStyle={gridStyles.row}
        contentContainerStyle={{paddingBottom: spacing.xl}}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await loadHome();
          setRefreshing(false);
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View style={{paddingBottom: spacing.lg}}>
            {/* ─── التروسة البطلة ─── */}
            <View
              style={[
                heroStyles.wrap,
                {backgroundColor: palette.surface, paddingTop: insets.top + spacing.md},
              ]}>
              <View style={heroStyles.topRow}>
                <View style={heroStyles.greetingCol}>
                  <Text style={[type.small, {color: palette.muted}]}>{greeting()}</Text>
                  <Text style={[type.h2, {color: palette.ink, fontFamily: fonts.black}]}>
                    {user != null ? user.name.split(' ')[0] : 'متسوّق سيلا'}
                  </Text>
                </View>
                <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                  <Pressable
                    onPress={() => navigation.navigate('Wishlist')}
                    hitSlop={8}
                    style={[heroStyles.iconBtn, {backgroundColor: palette.surfaceAlt}]}>
                    <Icon name="heart" size={19} color={palette.inkSoft} />
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('Notifications')}
                    hitSlop={8}
                    style={[heroStyles.iconBtn, {backgroundColor: palette.surfaceAlt}]}>
                    <Icon name="bell" size={19} color={palette.inkSoft} />
                    {unread > 0 ? (
                      <View style={heroStyles.badgeSlot}>
                        <Badge count={unread} />
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              </View>

              {/* مدخل البحث */}
              <Pressable
                onPress={() => navigation.navigate('Search')}
                style={({pressed}) => [
                  heroStyles.searchEntry,
                  {
                    backgroundColor: palette.bg,
                    borderColor: palette.line,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Icon name="search" size={19} color={palette.muted} />
                <Text style={[type.body, {color: palette.muted, flex: 1, textAlign: 'right'}]}>
                  ابحث عن منتج في كل متاجر المول…
                </Text>
                <View style={[heroStyles.searchChip, {backgroundColor: palette.brand}]}>
                  <Icon name="sliders" size={14} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>

            {/* شريط البيانات المحفوظة */}
            {stale ? (
              <View
                style={[
                  staleStyles.banner,
                  {backgroundColor: palette.warningSoft, borderColor: palette.warning},
                ]}>
                <Icon name="wifiOff" size={15} color={palette.warning} />
                <Text style={[type.tiny, {color: palette.inkSoft, flex: 1}]}>
                  تعذّر التحديث الآن — تعرض هذه الصفحة آخر لقطة محفوظة
                </Text>
              </View>
            ) : null}

            {error != null && stores.length === 0 && products.length === 0 ? (
              <View style={{padding: spacing.lg}}>
                <ErrorState message={error} onRetry={loadHome} />
              </View>
            ) : (
              <View style={{paddingHorizontal: spacing.lg, gap: spacing.xl, paddingTop: spacing.lg}}>
                {/* ─── التصنيفات ─── */}
                {firstEverLoad ? (
                  <RowSkeleton />
                ) : categories.length > 0 ? (
                  <View style={{gap: spacing.md}}>
                    <SectionTitle title="تسوّق حسب التصنيف" />
                    <FlatList
                      horizontal
                      data={categories.slice(0, 12)}
                      keyExtractor={c => c.category}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                      renderItem={({item}) => (
                        <Pressable
                          onPress={() => navigation.navigate('Category', {category: item.category})}
                          style={({pressed}) => [
                            catStyles.chip,
                            {
                              backgroundColor: palette.surface,
                              borderColor: palette.line,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}>
                          <View style={[catStyles.iconWrap, {backgroundColor: palette.brandSoft}]}>
                            <Icon
                              name={CATEGORY_ICONS[item.category] ?? 'tag'}
                              size={21}
                              color={palette.brandDark}
                            />
                          </View>
                          <Text style={[type.smallMedium, {color: palette.ink}]} numberOfLines={1}>
                            {item.category}
                          </Text>
                          <Text style={[{fontSize: 10, color: palette.muted}]}>
                            {item.n} منتجاً
                          </Text>
                        </Pressable>
                      )}
                    />
                  </View>
                ) : null}

                {/* ─── متاجر المول ─── */}
                {firstEverLoad ? (
                  <RowSkeleton />
                ) : stores.length > 0 ? (
                  <View style={{gap: spacing.md}}>
                    <SectionTitle
                      title="متاجر المول"
                      actionLabel="الكل"
                      onAction={() => navigation.navigate('Stores')}
                    />
                    <FlatList
                      horizontal
                      data={stores.slice(0, 10)}
                      keyExtractor={s => String(s.id)}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                      renderItem={({item}) => (
                        <StoreCard
                          store={item}
                          horizontal
                          onPress={() =>
                            navigation.navigate('Store', {storeId: item.id, storeName: item.name})
                          }
                        />
                      )}
                    />
                  </View>
                ) : null}

                {/* ─── أحدث المنتجات ─── */}
                <View style={{gap: spacing.xs}}>
                  <SectionTitle
                    title="أحدث ما وصل المول"
                    actionLabel="عرض الكل"
                    onAction={() => navigation.navigate('Search')}
                  />
                  <Text style={[{fontSize: 11.5, color: palette.muted}]}>
                    منتجات من كل متاجر سيلا — محدّثة لحظة مزامنة التاجر
                  </Text>
                  {firstEverLoad ? (
                    <View style={{marginTop: spacing.md}}>
                      <ProductGridSkeleton count={6} />
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !firstEverLoad && error == null && !stale ? (
            <View style={{paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl}}>
              <ErrorState
                message="لا توجد منتجات منشورة بعد — تُزامن المتاجر منتجاتها كل 15 دقيقة"
                onRetry={loadHome}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{paddingVertical: spacing.lg}}>
              <Loader label="نجلب المزيد…" />
            </View>
          ) : null
        }
        renderItem={({item}) => (
          <View style={{flex: 1}}>
            <ProductCard
              product={item}
              storeRef={{id: item.store_id, name: item.store_name, storeNumber: item.store_number}}
              onPress={() =>
                navigation.navigate('Product', {
                  product: item,
                  storeRef: {
                    id: item.store_id,
                    name: item.store_name,
                    storeNumber: item.store_number,
                  },
                })
              }
            />
          </View>
        )}
        style={{backgroundColor: palette.bg}}
      />
    </Screen>
  );
}

const heroStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    borderBottomRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingCol: {gap: 1, alignItems: 'flex-start'},
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSlot: {position: 'absolute', top: -5, left: -5},
  searchEntry: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  searchChip: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const staleStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
});

const catStyles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    width: 104,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const gridStyles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    width: '100%',
    marginBottom: spacing.md,
  },
});
