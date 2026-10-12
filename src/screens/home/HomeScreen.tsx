/**
 * HomeScreen.tsx — رئيسية المول (v2.0 — ذكية ومتجاوبة):
 *  • «متاجر تخدم منطقتك» — دائري مختصر (طلب المستخدم صراحة) مرتب
 *    برسم التوصيل لمنطقتك، مع مساعد اختيار المنطقة للزائر.
 *  • «مقترحات لك» — من تصنيفات اهتماماتك (مشاهدة/مفضلة/طلبات —
 *    بيانات محلية لا تغادر جهازك).
 *  • أحدث المنتجات مع شبكة أمان ذكية: إذا تعذّر المنتج العابر
 *    تُجلب منتجات كل متجر على حدة (نقطة نهاية مختلفة أصغر حجماً)
 *    فلا تختفي المنتجات أبداً لمشكلة نقطة واحدة.
 *  • كاش أولاً + شريط «تعذّر التحديث» بزر إعادة محاولة فوري.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, shadowFor, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {
  Badge,
  Button,
  ErrorState,
  Loader,
  ProductGridSkeleton,
  RowSkeleton,
  Screen,
  SectionTitle,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {CircleStoreCard} from '../../components/StoreCard';
import {
  getCategories,
  getCrossProducts,
  getCrossProductsAdaptive,
  getDeliveryRegions,
  getStoreProducts,
  getStores,
} from '../../api/endpoints';
import {cachedFetch, readCache} from '../../api/cached';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {greeting} from '../../core/time';
import type {CategoryCount, CrossProduct, Product, Store} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useLocationStore} from '../../stores/locationStore';
import {useInterestStore} from '../../stores/interestStore';
import {useNotificationsStore} from '../../stores/notificationsStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useTabBottomClearance} from '../../core/layout';

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

/** يحوّل منتج متجر إلى منتج عابر (لتوحيد عرض البطاقات). */
function crossOf(p: Product, store: Store): CrossProduct {
  return {...p, store_name: store.name, store_number: store.store_number};
}

export function HomeScreen({navigation}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const unread = useNotificationsStore(s => s.unread);
  const myRegion = useLocationStore(s => s.myRegion);
  const setLocalRegion = useLocationStore(s => s.setLocalRegion);
  const interestEntries = useInterestStore(s => s.entries);

  const [stores, setStores] = useState<Store[]>([]);
  const [regionStores, setRegionStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [products, setProducts] = useState<CrossProduct[]>([]);
  const [recommended, setRecommended] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionChoices, setRegionChoices] = useState<string[]>([]);

  /* ── تحميل الرئيسية ── */
  const loadHome = useCallback(async () => {
    setError(null);
    setLoading(true);
    setStale(false);

    const region = useLocationStore.getState().myRegion;
    const [storesRes, catsRes, prodsRes, regionRes] = await Promise.all([
      cachedFetch('stores', () => getStores()),
      cachedFetch('categories', () => getCategories()),
      // v2.1: جلب متدرج (سلم 12→6→3→1) — الإصلاح الجذري الثالث
      // لاختفاء المنتجات: الحمولات الصغيرة فقط تعبر مسلك شبكات الجوال.
      cachedFetch(
        'products:p1',
        () => getCrossProductsAdaptive(PRODUCTS_PAGE_SIZE),
      ),
      region != null
        ? cachedFetch(`stores:region:${region}`, () => getStores({region}))
        : Promise.resolve(null),
    ]);

    if (storesRes.data != null) {
      setStores(storesRes.data);
    } else if (storesRes.error != null) {
      setError(storesRes.error);
    }
    if (catsRes.data != null) {
      setCategories(catsRes.data);
    }
    if (regionRes != null && regionRes.data != null) {
      setRegionStores(regionRes.data);
    }

    if (prodsRes.data != null) {
      setProducts(prodsRes.data);
      setHasMore(prodsRes.data.length >= PRODUCTS_PAGE_SIZE);
      setPage(1);
    } else if (prodsRes.error != null) {
      // ── شبكة الأمان: المنتج العابر تعثّر — نجلب من كل متجر على
      // حدة (نقطة نهاية مختلفة أصغر حجماً قد تنجح حيث فشل الأكبر).
      const cachedStores = readCache<Store[]>('stores');
      const fallbackStores = storesRes.data ?? cachedStores?.data ?? [];
      if (fallbackStores.length > 0) {
        try {
          const chunks = await Promise.all(
            fallbackStores.slice(0, 12).map(s =>
              getStoreProducts(s.id, {per: 30}).catch(() => [] as Product[]),
            ),
          );
          const merged: CrossProduct[] = [];
          for (let i = 0; i < Math.min(fallbackStores.length, 12); i++) {
            for (const p of chunks[i] ?? []) {
              merged.push(crossOf(p, fallbackStores[i]));
            }
          }
          if (merged.length > 0) {
            setProducts(merged.slice(0, PRODUCTS_PAGE_SIZE));
            setHasMore(false);
            setPage(1);
            setStale(true); // نجحنا جزئياً — نعلّم أن التحديث الكامل تعثر.
          } else {
            setStale(true);
          }
        } catch {
          setStale(true);
        }
      } else {
        setStale(storesRes.data != null);
        if (storesRes.data == null) {
          setError(prodsRes.error);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  /* ── مزامنة «متاجر منطقتك» عند تغيّر المنطقة ── */
  useEffect(() => {
    let alive = true;
    if (myRegion == null) {
      setRegionStores([]);
      return;
    }
    (async () => {
      const res = await cachedFetch(`stores:region:${myRegion}`, () =>
        getStores({region: myRegion}),
      );
      if (alive && res.data != null) {
        setRegionStores(res.data);
      }
    })();
    return () => {
      alive = false;
    };
  }, [myRegion]);

  /* ── مقترحات لك: من تصنيفات اهتماماتك المحلية ──
   *  الاشتراك في entries يضمن إعادة الحساب فور كل إشارة جديدة. */
  const interestCats = useMemo(
    () => useInterestStore.getState().topCategories(2),
    [interestEntries],
  );
  useEffect(() => {
    let alive = true;
    if (interestCats.length === 0) {
      setRecommended([]);
      return;
    }
    (async () => {
      try {
        const chunks = await Promise.all(
          interestCats.map(c =>
            getCrossProducts({category: c, per: 6, page: 1}).catch(() => [] as CrossProduct[]),
          ),
        );
        if (!alive) {
          return;
        }
        const seen = new Set<string>();
        const merged: CrossProduct[] = [];
        for (const chunk of chunks) {
          for (const p of chunk) {
            const key = `${p.store_id}:${p.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(p);
            }
          }
        }
        setRecommended(merged.slice(0, 8));
      } catch {
        /* توصيات ليست حرجة — صمت */
      }
    })();
    return () => {
      alive = false;
    };
  }, [interestCats]);

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

  /* فتح مساعد المنطقة: مناطق حقيقية من الخادم مع الكاش المحلي. */
  const openRegionPicker = useCallback(async () => {
    setRegionPickerOpen(true);
    try {
      const list = await getDeliveryRegions();
      setRegionChoices(list);
    } catch {
      setRegionChoices([]);
    }
  }, []);

  const firstEverLoad = loading && products.length === 0 && stores.length === 0;
  const regionTitle = myRegion ?? 'منطقتك';

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={item => `${item.store_id}:${item.id}`}
        numColumns={2}
        columnWrapperStyle={gridStyles.row}
        contentContainerStyle={{paddingBottom: useTabBottomClearance()}}
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

            {/* شريط البيانات المحفوظة + إعادة محاولة فورية */}
            {stale ? (
              <View
                style={[
                  staleStyles.banner,
                  {backgroundColor: palette.warningSoft, borderColor: palette.warning},
                ]}>
                <Icon name="wifiOff" size={15} color={palette.warning} />
                <Text style={[type.tiny, {color: palette.inkSoft, flex: 1}]}>
                  تعذّر التحديث الآن — تعرض الصفحة آخر لقطة متاحة
                </Text>
                <Pressable onPress={() => void loadHome()} hitSlop={6}>
                  <Text style={{fontSize: 11.5, color: palette.warning, fontFamily: fonts.bold}}>
                    إعادة المحاولة
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {error != null && stores.length === 0 && products.length === 0 ? (
              <View style={{padding: spacing.lg}}>
                <ErrorState message={error} onRetry={loadHome} />
              </View>
            ) : (
              <View style={{paddingHorizontal: spacing.lg, gap: spacing.xl, paddingTop: spacing.lg}}>
                {/* ─── متاجر تخدم منطقتك ─── */}
                <View style={{gap: spacing.md}}>
                  <View style={{flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'}}>
                    <SectionTitle title={`متاجر تخدم ${regionTitle}`} />
                    <Pressable onPress={openRegionPicker} hitSlop={6}>
                      <View
                        style={[
                          regionStyles.changeChip,
                          {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
                        ]}>
                        <Icon name="pin" size={12} color={palette.brandDark} />
                        <Text style={{fontSize: 11.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                          {myRegion != null ? 'تغيير' : 'حدّد منطقتك'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                  {myRegion == null ? (
                    <Pressable
                      onPress={openRegionPicker}
                      style={({pressed}) => [
                        regionStyles.emptyCard,
                        {
                          backgroundColor: palette.brandSoft,
                          borderColor: palette.brandBorder,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}>
                      <View style={[regionStyles.pinCircle, {backgroundColor: palette.brand}]}>
                        <Icon name="pin" size={20} color="#FFFFFF" />
                      </View>
                      <View style={{flex: 1, gap: 2}}>
                        <Text style={[type.smallMedium, {color: palette.ink, fontFamily: fonts.bold}]}>
                          حدّد منطقتك لمتابعة أذكى
                        </Text>
                        <Text style={{fontSize: 11.5, color: palette.muted, lineHeight: 17}}>
                          نعرض لك المتاجر التي توصّل إليك، ونرتبها برسم التوصيل الأرخص أولاً
                        </Text>
                      </View>
                      <Icon name="forward" size={16} color={palette.brandDark} />
                    </Pressable>
                  ) : regionStores.length > 0 ? (
                    <FlatList
                      horizontal
                      data={regionStores.slice(0, 10)}
                      keyExtractor={s => `r${s.id}`}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                      renderItem={({item}) => (
                        <CircleStoreCard
                          store={item}
                          onPress={() =>
                            navigation.navigate('Store', {storeId: item.id, storeName: item.name})
                          }
                        />
                      )}
                    />
                  ) : (
                    <Text style={[type.tiny, {color: palette.muted}]}>
                      لا متاجر تخدم «{myRegion}» حالياً — جرّب منطقة أخرى أو تصفح كل المتاجر
                    </Text>
                  )}
                </View>

                {/* ─── مقترحات لك (اهتماماتك) ─── */}
                {recommended.length > 0 ? (
                  <View style={{gap: spacing.md}}>
                    <SectionTitle title="مقترحات لك" />
                    <FlatList
                      horizontal
                      data={recommended}
                      keyExtractor={item => `rec${item.store_id}:${item.id}`}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                      renderItem={({item}) => (
                        <View style={recStyles.card}>
                          <ProductCard
                            product={item}
                            storeRef={{
                              id: item.store_id,
                              name: item.store_name,
                              storeNumber: item.store_number,
                            }}
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
                    />
                  </View>
                ) : null}

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

                {/* ─── متاجر المول (بطاقات دائرية مختصرة) ─── */}
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
                      data={stores.slice(0, 12)}
                      keyExtractor={s => String(s.id)}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                      renderItem={({item}) => (
                        <CircleStoreCard
                          store={item}
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

      {/* ── مساعد اختيار المنطقة ── */}
      <Modal
        visible={regionPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRegionPickerOpen(false)}>
        <Pressable
          style={regionStyles.backdrop}
          onPress={() => setRegionPickerOpen(false)}>
          <Pressable
            style={[
              regionStyles.sheet,
              {backgroundColor: palette.surface, paddingBottom: insets.bottom + spacing.lg},
            ]}
            onPress={() => undefined}>
            <View style={[regionStyles.grab, {backgroundColor: palette.lineStrong}]} />
            <View style={{gap: spacing.sm}}>
              <Text style={[type.h2, {color: palette.ink, textAlign: 'center'}]}>
                منطقة التوصيل
              </Text>
              <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
                نرتب متاجر منطقتك برسم التوصيل الأرخص أولاً
              </Text>
            </View>
            {myRegion != null ? (
              <Pressable
                onPress={() => {
                  setLocalRegion(null);
                  setRegionPickerOpen(false);
                }}
                style={({pressed}) => [
                  regionStyles.optionRow,
                  {backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.7 : 1},
                ]}>
                <Icon name="close" size={16} color={palette.danger} />
                <Text style={{fontSize: 13, color: palette.danger, fontFamily: fonts.medium, flex: 1}}>
                  إلغاء تحديد المنطقة
                </Text>
              </Pressable>
            ) : null}
            <ScrollView style={{maxHeight: 320}} showsVerticalScrollIndicator={false}>
              <View style={{gap: spacing.sm, paddingTop: spacing.xs}}>
                {regionChoices.length === 0 ? (
                  <Loader label="نجلب المناطق…" />
                ) : (
                  regionChoices.map(r => {
                    const active = r === myRegion;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => {
                          setLocalRegion(r);
                          setRegionPickerOpen(false);
                        }}
                        style={({pressed}) => [
                          regionStyles.optionRow,
                          {
                            backgroundColor: active ? palette.brandSoft : palette.surfaceAlt,
                            borderColor: active ? palette.brand : palette.line,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}>
                        <Icon
                          name="truck"
                          size={16}
                          color={active ? palette.brandDark : palette.muted}
                        />
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily: active ? fonts.bold : fonts.medium,
                            color: active ? palette.brandDark : palette.ink,
                            flex: 1,
                          }}>
                          {r}
                        </Text>
                        {active ? (
                          <Icon name="check" size={16} color={palette.brandDark} strokeWidth={3} />
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </ScrollView>
            <Button
              label="تم"
              variant="soft"
              onPress={() => setRegionPickerOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
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

const regionStyles = StyleSheet.create({
  changeChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emptyCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopRightRadius: radius.xl,
    borderTopLeftRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    marginTop: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
});

const recStyles = StyleSheet.create({
  card: {width: 176},
});

const gridStyles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    width: '100%',
    marginBottom: spacing.md,
  },
});
