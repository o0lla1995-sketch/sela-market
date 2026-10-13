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
import {radius, shadowFor, spacing, type, fonts, tileFor} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {
  Badge,
  Button,
  EndOfList,
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
  getCrossProducts,
  getDeliveryRegions,
  getHomeFeed,
  getStores,
} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {greeting} from '../../core/time';
import type {CategoryCount, CrossProduct, Store} from '../../core/types';
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

export function HomeScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const tabClearance = useTabBottomClearance();
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

  /* ── تحميل الرئيسية — v3.0: نداء واحد مجمّع (خادم 5.5) ──
   * كانت أربع نداءات متوازية (متاجر + تصنيفات + أحدث منتجات +
   * متاجر المنطقة) فوقها مروحة «شبكة أمان» تضرب كل متجر على حدة
   * (حتى 12 نداءً إضافياً) — فتح التطبيق وحده كان يستهلك ثلث
   * ميزانية محدد المعدل فتظهر «محاولات كثيرة» بعد ثوانٍ من التصفح.
   * الآن: /api/market/home يعيد كل شيء في نداء واحد (مع متاجر
   * المنطقة إذا حُددت) — والكاش المحلي يحمي عند التعثر. */
  const loadHome = useCallback(async () => {
    setError(null);
    setLoading(true);
    setStale(false);

    const region = useLocationStore.getState().myRegion;
    const feedRes = await cachedFetch('home:v1', () => getHomeFeed(region));

    if (feedRes.data != null) {
      setStores(feedRes.data.stores);
      setCategories(feedRes.data.categories);
      setRegionStores(feedRes.data.regionStores ?? []);
      setProducts(feedRes.data.latest);
      setHasMore(feedRes.data.latest.length >= PRODUCTS_PAGE_SIZE);
      setPage(1);
    } else if (feedRes.error != null) {
      /* فشل التحديث + لا كاش — شبكة الأمان القديمة كانت تضرب كل
       * متجر على حدة (مروحة طلبات)؛ الآن نكتفي بالكاش إن وُجد. */
      setError(feedRes.error);
      setStale(true);
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
  /* v3.1: خلفية التروسة — برتقالي العلامة في الفاتح، ودرجة أعمق
   * في الداكن لتبقى القراءة البيضاء مريحة (تباين 5:1). */
  const heroBg = palette.isDark ? '#C2410C' : '#EA580C';

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={item => `${item.store_id}:${item.id}`}
        numColumns={2}
        columnWrapperStyle={gridStyles.row}
        contentContainerStyle={{paddingBottom: tabClearance}}
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
            {/* ─── التروسة البطولية — v3.1: بلون العلامة الصريح ─── */}
            <View
              style={[
                heroStyles.wrap,
                {backgroundColor: heroBg, paddingTop: spacing.md},
              ]}>
              <View style={heroStyles.topRow}>
                <View style={heroStyles.greetingCol}>
                  <Text style={[type.small, {color: 'rgba(255,255,255,0.85)'}]}>
                    {greeting()}
                  </Text>
                  <Text style={[type.h2, {color: '#FFFFFF', fontFamily: fonts.black}]}>
                    {user != null ? user.name.split(' ')[0] : 'متسوّق سيلا'}
                  </Text>
                </View>
                <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                  <Pressable
                    onPress={() => navigation.navigate('Wishlist')}
                    hitSlop={8}
                    style={heroStyles.iconBtnOnBrand}>
                    <Icon name="heart" size={19} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('Notifications')}
                    hitSlop={8}
                    style={heroStyles.iconBtnOnBrand}>
                    <Icon name="bell" size={19} color="#FFFFFF" />
                    {unread > 0 ? (
                      <View style={heroStyles.badgeSlot}>
                        <Badge count={unread} />
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              </View>

              {/* v3.1: شريط المنطقة داخل التروسة — كان رقاقة صغيرة
               * تلتصق بحافة الشاشة فتبدو مخفية؛ الآن بعرض كامل بنمط
               * طلبات/أمازون: دبوس + اسم المنطقة + سهم، دائماً ظاهر. */}
              <Pressable
                onPress={openRegionPicker}
                style={({pressed}) => [
                  heroStyles.regionBar,
                  {opacity: pressed ? 0.85 : 1},
                ]}>
                <Icon name="pin" size={16} color="#FFFFFF" />
                <View style={{flex: 1, alignItems: 'flex-start'}}>
                  <Text
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.8)',
                      fontFamily: fonts.medium,
                    }}>
                    التوصيل إلى
                  </Text>
                  <Text
                    style={{
                      fontSize: 13.5,
                      color: '#FFFFFF',
                      fontFamily: fonts.bold,
                    }}
                    numberOfLines={1}>
                    {myRegion ?? 'حدّد منطقتك'}
                  </Text>
                </View>
                <Icon name="chevronDown" size={16} color="#FFFFFF" />
              </Pressable>

              {/* مدخل البحث — أبيض فوق لون العلامة */}
              <Pressable
                onPress={() => navigation.navigate('Search')}
                style={({pressed}) => [
                  heroStyles.searchEntry,
                  {opacity: pressed ? 0.85 : 1},
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
                {/* ─── متاجر تخدم منطقتك ─── v3.1: الاختيار صار من
                 * شريط التروسة أعلاه — هنا العرض فقط، بلا رقاقة
                 * جانبية كانت تختفي بحافة الشاشة وبلا شرح مطوّل. */}
                <View style={{gap: spacing.md}}>
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
                        <Icon name="pin" size={18} color="#FFFFFF" />
                      </View>
                      <Text style={{flex: 1, fontSize: 12.5, color: palette.ink, fontFamily: fonts.medium}}>
                        حدّد منطقتك لتظهر المتاجر التي توصّل إليك
                      </Text>
                      <Icon name="forward" size={16} color={palette.brandDark} />
                    </Pressable>
                  ) : regionStores.length > 0 ? (
                    <>
                      <SectionTitle title={`متاجر تخدم ${myRegion}`} />
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
                    </>
                  ) : (
                    <Text style={[type.tiny, {color: palette.muted}]}>
                      لا متاجر تخدم «{myRegion}» حالياً — غيّر المنطقة من أعلى الصفحة
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
                            photoWidth={160}
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

                {/* ─── التصنيفات — بلاطات ملونة عمودية (نمط نون) ─── */}
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
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 4}}
                      renderItem={({item}) => {
                        /* v3.0: لكل تصنيف لونه الثابت المخصص — نظام
                         * الألوان الغني الجديد (شكوى «مفتقد للألوان
                         * الأخرى»): نفس التصنيف يتلوّن بنفس اللون في
                         * الرئيسية وصفحة المنتج والتصنيف كله. */
                        const tile = tileFor(item.category, palette.isDark);
                        return (
                          <Pressable
                            onPress={() => navigation.navigate('Category', {category: item.category})}
                            style={({pressed}) => [
                              catStyles.tile,
                              {
                                backgroundColor: tile.soft,
                                borderColor: tile.solid + '33',
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}>
                            <View style={[catStyles.iconWrap, {backgroundColor: tile.solid}]}>
                              <Icon
                                name={CATEGORY_ICONS[item.category] ?? 'tag'}
                                size={22}
                                color="#FFFFFF"
                              />
                            </View>
                            <Text
                              style={{
                                fontSize: 12.5,
                                color: tile.ink,
                                fontFamily: fonts.bold,
                                textAlign: 'center',
                              }}
                              numberOfLines={1}>
                              {item.category}
                            </Text>
                            <Text style={{fontSize: 10, color: tile.solid, fontFamily: fonts.medium}}>
                              {item.n} منتجاً
                            </Text>
                          </Pressable>
                        );
                      }}
                    />
                  </View>
                ) : null}

                {/* v2.6: قُسم «متاجر المول» محذوف بطلب صريح من
                 * المستخدم — كان تكراراً بصرياً لقسم «متاجر تخدم
                 * منطقتك» أعلاه (القسمان يعرضان المتاجر أنفسها
                 * ببطاقات دائرية متطابقة فوق بعضهما). قائمة المتاجر
                 * الكاملة تبقى متاحة من تبويب «المتاجر» السفلي. */}

                {/* ─── أحدث المنتجات ─── */}
                <View style={{gap: spacing.xs}}>
                  <SectionTitle
                    title="أحدث ما وصل المول"
                    actionLabel="عرض الكل"
                    onAction={() => navigation.navigate('Search')}
                  />
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
          ) : !hasMore && products.length >= PRODUCTS_PAGE_SIZE ? (
            <EndOfList label="وصلت إلى كل منتجات المول" />
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
  /* v3.1: أزرار فوق لون العلامة — أبيض شفاف بنمط التروسات الملونة. */
  iconBtnOnBrand: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgeSlot: {position: 'absolute', top: -5, left: -5},
  /* v3.1: شريط المنطقة — بعرض كامل داخل التروسة، دائماً ظاهر. */
  regionBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  searchEntry: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
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
  /* v3.0: بلاطة عمودية ملونة كاملة (نمط نون) — لون التصنيف الثابت
   * نفسه من tileFor يملأ الخلفية والأيقونة الدائرية الصلبة. */
  tile: {
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    width: 96,
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
  emptyCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  pinCircle: {
    width: 40,
    height: 40,
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
