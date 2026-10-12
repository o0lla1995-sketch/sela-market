/**
 * HomeScreen.tsx — رئيسية المول: تحية + جرس الإشعارات، بحث سريع،
 * التصنيفات، متاجر مقترحة أفقياً، وأحدث المنتجات عابرة للمتاجر بشبكة
 * لا نهائية + سحب للتحديث. زائر أم عضو — نفس التجربة.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Badge, Button, ErrorState, Loader, Screen, SectionTitle} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreCard} from '../../components/StoreCard';
import {getCategories, getCrossProducts, getStores} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {greeting} from '../../core/time';
import type {CategoryCount, CrossProduct, Store} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useNotificationsStore} from '../../stores/notificationsStore';
import {useCartStore} from '../../stores/cartStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Home'>;

/* أيقونات تصنيفات إرشادية عند غياب تصنيفات الخادم */
const CATEGORY_ICONS: Record<string, Parameters<typeof Icon>[0]['name']> = {
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
  const user = useAuthStore(s => s.user);
  const unread = useNotificationsStore(s => s.unread);
  const lastCartStore = useCartStore(s => s.lastActiveStoreId);

  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [products, setProducts] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHome = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [s, c, p] = await Promise.all([
        getStores(),
        getCategories(),
        getCrossProducts({page: 1, per: PRODUCTS_PAGE_SIZE}),
      ]);
      setStores(s);
      setCategories(c);
      setProducts(p);
      setPage(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل الرئيسية');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || error != null) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await getCrossProducts({page: page + 1, per: PRODUCTS_PAGE_SIZE});
      if (next.length === 0) {
        return;
      }
      setProducts(prev => {
        const seen = new Set(prev.map(p => `${p.store_id}:${p.id}`));
        return [...prev, ...next.filter(p => !seen.has(`${p.store_id}:${p.id}`))];
      });
      setPage(p => p + 1);
    } catch {
      /* صمت — المحاولة القادمة عند التمرير */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, error, page]);

  if (loading && products.length === 0 && stores.length === 0) {
    return (
      <Screen>
        <Header
          navigation={navigation}
          name={user?.name}
          unread={unread}
        />
        <Loader label="نجهّز لك المول…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header navigation={navigation} name={user?.name} unread={unread} />

      {error != null ? (
        <ErrorState message={error} onRetry={loadHome} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => `${item.store_id}:${item.id}`}
          numColumns={2}
          columnWrapperStyle={gridStyles.row}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}
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
            <View style={{gap: spacing.xl}}>
              {/* التصنيفات */}
              {categories.length > 0 ? (
                <View style={{gap: spacing.md}}>
                  <SectionTitle title="تسوّق حسب التصنيف" />
                  <FlatList
                    horizontal
                    data={categories}
                    keyExtractor={c => c.category}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                    renderItem={({item}) => (
                      <Pressable
                        onPress={() => navigation.navigate('Category', {category: item.category})}
                        style={({pressed}) => [
                          catStyles.chip,
                          {backgroundColor: palette.surface, borderColor: palette.line, opacity: pressed ? 0.85 : 1},
                        ]}>
                        <View style={[catStyles.iconWrap, {backgroundColor: palette.brandSoft}]}>
                          <Icon
                            name={CATEGORY_ICONS[item.category] ?? 'tag'}
                            size={21}
                            color={palette.brandDark}
                          />
                        </View>
                        <Text
                          style={[type.smallMedium, {color: palette.ink}]}
                          numberOfLines={1}>
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

              {/* متاجر مقترحة */}
              {stores.length > 0 ? (
                <View style={{gap: spacing.md}}>
                  <SectionTitle
                    title="متاجر المول"
                    actionLabel="كل المتاجر"
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

              {/* أحدث المنتجات */}
              <View style={{gap: spacing.xs}}>
                <SectionTitle title="أحدث ما وصل المول" />
                <Text style={[{fontSize: 11.5, color: palette.muted}]}>
                  منتجات من كل متاجر سيلا — محدّثة لحظة مزامنة التاجر
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={{paddingTop: spacing.xxxl}}>
              <ErrorState
                message="لا توجد منتجات منشورة بعد — تُزامن المتاجر منتجاتها كل 15 دقيقة"
                onRetry={loadHome}
              />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{paddingVertical: spacing.lg}}>
                <Loader label="نجلب المزيد…" />
              </View>
            ) : null
          }
          renderItem={({item}) => (
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
          )}
        />
      )}
    </Screen>
  );
}

/* ─── رأس الرئيسية ─── */

function Header({
  navigation,
  name,
  unread,
}: {
  navigation: Props['navigation'];
  name?: string;
  unread: number;
}) {
  const {palette} = useTheme();
  return (
    <View style={[headerStyles.wrap, {backgroundColor: palette.bg}]}>
      <View style={headerStyles.topRow}>
        <View style={headerStyles.greeting}>
          <Text style={[type.small, {color: palette.muted}]}>{greeting()}</Text>
          <Text style={[type.h2, {color: palette.ink}]}>
            {name ? name.split(' ')[0] : 'متسوّق سيلا'}
          </Text>
        </View>
        <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
          <Pressable
            onPress={() => navigation.navigate('Wishlist')}
            hitSlop={8}
            style={[headerStyles.iconBtn, {backgroundColor: palette.surface, borderColor: palette.line}]}>
            <Icon name="heart" size={19} color={palette.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
            style={[headerStyles.iconBtn, {backgroundColor: palette.surface, borderColor: palette.line}]}>
            <Icon name="bell" size={19} color={palette.inkSoft} />
            {unread > 0 ? (
              <View style={headerStyles.badgeSlot}>
                <Badge count={unread} />
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* شريط البحث (مدخل شاشة البحث) */}
      <Pressable
        onPress={() => navigation.navigate('Search')}
        style={({pressed}) => [
          headerStyles.searchEntry,
          {
            backgroundColor: palette.surface,
            borderColor: palette.line,
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <Icon name="search" size={19} color={palette.muted} />
        <Text style={[type.body, {color: palette.muted, flex: 1, textAlign: 'right'}]}>
          ابحث في كل متاجر المول…
        </Text>
        <View style={[headerStyles.searchChip, {backgroundColor: palette.brandSoft}]}>
          <Text style={[{fontSize: 11.5, color: palette.brandDark, fontFamily: fonts.bold}]}>
            بحث
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md},
  topRow: {flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'},
  greeting: {gap: 1, alignItems: 'flex-start'},
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSlot: {position: 'absolute', top: -5, left: -5},
  searchEntry: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  searchChip: {borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5},
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
  row: {gap: spacing.md, width: '100%'},
});
