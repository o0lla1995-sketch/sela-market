/**
 * HomeScreen.tsx — رئيسية المول (v3.4 — الجولة 64):
 * ─────────────────────────────────────────────────────────────────
 *  • طلب المستخدم الأهم: «تقسيم لأنواع المتاجر — كل قسم يعرض عدداً
 *    من أحدث وأفضل المنتجات + الانتقال لتصفح منتجات القسم بالكامل».
 *    أقسام ديناميكية من تصنيفات المتاجر الفعلية (مطاعم/بقالة/ملابس…)
 *    — لكل نوع شريط منتجات من أفضل متاجره (الأعلى تقييماً بتدوير
 *    دائري)، وأيقونة «عرض الكل» تفتح شاشة القسم الكاملة الجديدة.
 *  • التروسة: عادت الزوايا الدائرية السفلية (طلب صريح — كانت
 *    مسطحة منذ v3.2)، وحُذف شريط «توصيل إلى» منها — انتقل رقاقة
 *    منطقة لطيفة ومضغوطة إلى أقصى يسار عنوان قسم «متاجر تخدم»
 *    حيث سياقه الحقيقي، و«عرض الكل» لباقي الأقسام أيقونة مضغوطة
 *    في أقصى يسار العنوان (طلب صريح بالنص).
 *  • «أحدث ما وصل المول»: كاروسيل شبكي 2×2 بجلب تدريجي مستمر.
 *  • شبكة أمان البيانات: نداء /home المجمّع + كاش محلي + شريط
 *    «تعذّر التحديث» بزر إعادة محاولة.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {
  radius,
  shadowRaised,
  shadowFor,
  spacing,
  type,
  fonts,
  tileFor,
} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {ProductCard} from '../../components/ProductCard';
import {ProductRailCard, WeeklyOfferCard} from '../../components/ProductCards';
import {Entrance, useCollapseHeader} from '../../core/motion';
import {hasDiscount} from '../../core/discount';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loader,
  RowSkeleton,
  Screen,
  SectionTitle,
} from '../../components/ui';
import {CircleStoreCard, storeTypeInfo} from '../../components/StoreCard';
import {
  getCrossProducts,
  getDeliveryRegions,
  getHomeFeed,
  getStoreProducts,
  getStores,
} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
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

/** عدد المنتجات في صفحة الكاروسيل الشبكي (2×2). */
const GRID_PAGE = 4;

export function HomeScreen({navigation}: Props) {
  const {palette} = useTheme();
  const tabClearance = useTabBottomClearance();
  const insets = useSafeAreaInsets();
  const {width: screenWidth} = useWindowDimensions();
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
  /* v4.0 (الجولة 68): عروض هذا الأسبوع — أقوى التخفيضات من كل
   * متاجر المول دفعة واحدة (الخادم يدعم offers=1 وإن كان أقدم
   * فلترنا محلياً من نفس الدفعة). */
  const [weeklyOffers, setWeeklyOffers] = useState<CrossProduct[]>([]);
  /* v3.4: شريط منتجات كل نوع متجر — {product, store} لبناء storeRef. */
  const [typeProducts, setTypeProducts] = useState<
    Record<string, {product: Product; store: Store}[]>
  >({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionChoices, setRegionChoices] = useState<string[]>([]);

  /* ── تحميل الرئيسية — نداء واحد مجمّع (خادم 5.5) ── */
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
      setError(feedRes.error);
      setStale(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  /* ── v4.0: عروض هذا الأسبوع — دفعة كبيرة مفلترة بالخصم ──
   * تجلب مرة واحدة بالكاش المحلي (5 دقائق كأحدث الصفحة) وتُرتّب
   * بالخصم الأكبر أولاً — القسم يختفي تلقائياً إن لم توجد عروض. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await cachedFetch('offers:week:v1', () =>
        getCrossProducts({per: 48, offers: true}),
      );
      if (!alive || res.data == null) {
        return;
      }
      const deals = res.data
        .filter(p => hasDiscount(p))
        .sort((a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0))
        .slice(0, 10);
      setWeeklyOffers(deals);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  /* ── مقترحات لك: من تصنيفات اهتماماتك المحلية ── */
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

  /* ── v3.4: أقسام أنواع المتاجر — طلب المستخدم الأهم ──
   * تصنيف المتاجر الفعلي (مطاعم/بقالة/ملابس/صيدلية…) عبر
   * storeTypeInfo نفسها المستخدمة في كل بطاقات التطبيق — أعلى
   * أربعة أنواع بعدد المتاجر، ولكل نوع شريط من أحدث وأفضل
   * منتجات أفضل متجريه (الأعلى تقييماً) بتدوير دائري بينهما. */
  const typeSections = useMemo(() => {
    const groups = new Map<string, {icon: IconName; stores: Store[]}>();
    for (const s of stores) {
      const info = storeTypeInfo(s.category);
      const g = groups.get(info.label);
      if (g != null) {
        g.stores.push(s);
      } else {
        groups.set(info.label, {icon: info.icon, stores: [s]});
      }
    }
    return Array.from(groups.entries())
      .map(([label, g]) => ({label, icon: g.icon, stores: g.stores}))
      .sort((a, b) => b.stores.length - a.stores.length)
      .slice(0, 4);
  }, [stores]);

  useEffect(() => {
    let alive = true;
    if (typeSections.length === 0) {
      setTypeProducts({});
      return;
    }
    (async () => {
      for (const sec of typeSections) {
        const top = [...sec.stores]
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 2);
        const batches = await Promise.all(
          top.map(s =>
            cachedFetch(`typeprods:v1:${s.id}`, () =>
              getStoreProducts(s.id, {per: 6}),
            ),
          ),
        );
        if (!alive) {
          return;
        }
        /* تدوير دائري بين المتجرين — تنويع بصري بدل كتلة متجر واحد */
        const seenKeys = new Set<string>();
        const rail: {product: Product; store: Store}[] = [];
        const maxLen = Math.max(...batches.map(b => b.data?.length ?? 0));
        for (let i = 0; i < maxLen; i += 1) {
          top.forEach((store, si) => {
            const p = batches[si].data?.[i];
            if (p != null) {
              const key = `${store.id}:${p.id}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                rail.push({product: p, store});
              }
            }
          });
        }
        if (!alive) {
          return;
        }
        setTypeProducts(prev => ({...prev, [sec.label]: rail.slice(0, 6)}));
      }
    })();
    return () => {
      alive = false;
    };
  }, [typeSections]);

  /* ── جلب صفحات إضافية لصفحات كاروسيل «أحدث ما وصل» ── */
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

  /* ── v4.0 (الجولة 68): محرّك التروسة المنطوية ──
   * طلب المستخدم: «أشعر أن التطبيق جامد — في الهيدر عند عمل
   * سكرول وموشن لطيفة وانتقالات سلسة». التروسة الآن طبقة عائمة
   * تنطوي ببطء (parallax 0.55×) وتتلاشى كلما نزل المحتوى، ويحل
   * محلها شريط مضغوط أنيق (تحية مصغّرة + بحث + أجراس) بين عتبتين
   * بانزلاق وتلاشٍ متصلين — لا قفزة ثنائية. المحرك JS بالكامل
   * (قاعدة v3.4: صفر عقد أصلية على مسار التمرير). */
  const HERO_CONTENT_H = 118;
  const collapse = useCollapseHeader({heroHeight: HERO_CONTENT_H, collapseFrom: 56, collapseTo: 132});
  const {compactActive} = collapse;

  /* ── هندسة كاروسيل «أحدث ما وصل المول» ──
   * كل صفحة: شبكة 2×2 بعرض الشاشة متناقصاً الحواشي + فجوة بين
   * الصفحات. snapToInterval يضمن قفزاً ناعماً صفحةً صفحة. */
  const carouselInset = spacing.lg;
  const pageGap = spacing.md;
  const pageWidth = screenWidth - carouselInset * 2;
  const snapInterval = pageWidth + pageGap;
  const gridPages = Math.ceil(products.length / GRID_PAGE);
  /* v3.5: بطاقات صفحات 2×2 تنتقل لوضع الملء — الصورة تملأ عرض
   * البطاقة والخلية مسقوفة 50%، فلا معادلة تقريبية بعد الآن. */

  /* صف كاروسيل واحد: عمودان من بطاقتين (شبكة 2×2). */
  const renderGridPage = (pageIndex: number) => {
    const start = pageIndex * GRID_PAGE;
    const items = products.slice(start, start + GRID_PAGE);
    return (
      <View key={`p${pageIndex}`} style={[gridPageStyles.page, {width: pageWidth}]}>
        {[0, 1].map(row => (
          <View key={row} style={gridPageStyles.row}>
            {items.slice(row * 2, row * 2 + 2).map(item => (
              <View key={`${item.store_id}:${item.id}`} style={{flex: 1, maxWidth: '50%'}}>
                <ProductCard
                  product={item}
                  photoHeight={104}
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
            ))}
            {/* عمود فارغ عند صفحة غير مكتملة — يحفظ عرض الأعمدة */}
            {items.length % 2 === 1 && row === Math.ceil(items.length / 2) - 1 ? (
              <View style={{flex: 1}} />
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen>
      {/* ═══ التروسة العائمة المنطوية (v4.0) ═══
       * طبقة مطلقة أعلى الشاشة (نفس نمط شريط المتجر المثبت في
       * v3.4 — position absolute داخل الإطار الآمن): المحتوى يمر
       * تحتها بتباعد paddingTop مكافئ. عند التمرير تنطوي ببطء
       * وتتلاشى، وتُعاد لمساتها للشريط المضغوط كي لا تحجبه. */}
      <Animated.View
        pointerEvents={compactActive ? 'none' : 'auto'}
        style={[
          heroStyles.wrap,
          heroFloatStyles.wrap,
          {backgroundColor: heroBg},
          collapse.heroStyle,
          shadowRaised(palette.isDark),
        ]}>
        <View style={heroStyles.inner}>
          <View style={heroStyles.topRow}>
            <View style={heroStyles.greetingCol}>
              <Text style={heroStyles.greetingText}>{greeting()}</Text>
              <Text style={heroStyles.greetingName}>
                {user != null ? user.name.split(' ')[0] : 'متسوّق سيلا'}
              </Text>
            </View>
            <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
              <Pressable
                onPress={() => navigation.navigate('Wishlist')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="المفضلة"
                style={heroStyles.iconBtnOnBrand}>
                <Icon name="heart" size={19} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Notifications')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="الإشعارات"
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

          {/* v3.4 (الجولة 64): شريط «توصيل إلى» حُذف من الهيدر بطلب
           * المستخدم — رقاقة المنطقة اللطيفة انتقلت إلى أقصى يسار
           * عنوان قسم «متاجر تخدم» أدناه حيث سياقها الحقيقي. */}

          {/* مدخل البحث — أبيض فوق لون العلامة بنفس انحناء القسم */}
          <Pressable
            onPress={() => navigation.navigate('Search')}
            accessibilityRole="button"
            accessibilityLabel="البحث في المول"
            style={[heroStyles.searchEntry, shadowFor(palette.isDark)]}>
            <Icon name="search" size={19} color={palette.muted} />
            <Text style={[type.body, {color: palette.muted, flex: 1, textAlign: 'right'}]}>
              ابحث عن منتج في كل متاجر المول…
            </Text>
            <View style={[heroStyles.searchChip, {backgroundColor: palette.brand}]}>
              <Icon name="sliders" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      </Animated.View>

      {/* ═══ الشريط المضغوط (v4.0) ═══
       * يظهر محل التروسة عند التمرير: عنوان المول + بحث مصغّر +
       * المفضلة والإشعارات — استمرارية الأفعال بلا انقطاع. طبقة
       * مطلقة بنفس نمط شريط صفحة المتجر (المثبت على الأجهزة). */}
      <Animated.View
        pointerEvents={compactActive ? 'auto' : 'none'}
        style={[
          compactStyles.wrap,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.line,
          },
          collapse.compactStyle,
          shadowRaised(palette.isDark),
        ]}>
        <View style={compactStyles.brandCol}>
          <Text style={[compactStyles.brandTitle, {color: palette.ink}]}>سيلا ماركت</Text>
          <Text style={[compactStyles.brandSub, {color: palette.muted}]} numberOfLines={1}>
            {myRegion != null ? `توصيل إلى ${myRegion}` : 'سوّق من مئات المتاجر'}
          </Text>
        </View>
        <View style={{flexDirection: 'row-reverse', gap: spacing.sm}}>
          <Pressable
            onPress={() => navigation.navigate('Search')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="البحث في المول"
            style={[compactStyles.iconBtn, {borderColor: palette.line}]}>
            <Icon name="search" size={18} color={palette.ink} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Wishlist')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="المفضلة"
            style={[compactStyles.iconBtn, {borderColor: palette.line}]}>
            <Icon name="heart" size={18} color={palette.ink} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="الإشعارات"
            style={[compactStyles.iconBtn, {borderColor: palette.line}]}>
            <Icon name="bell" size={18} color={palette.ink} />
            {unread > 0 ? (
              <View style={heroStyles.badgeSlot}>
                <Badge count={unread} />
              </View>
            ) : null}
          </Pressable>
        </View>
      </Animated.View>

      {/* ═══ محتوى الصفحة القابل للتمرير تحت التروسة العائمة ═══ */}
      <Animated.ScrollView
        style={{flex: 1}}
        showsVerticalScrollIndicator={false}
        /* v4.0: تباعد ثابت يساوي ارتفاع التروسة + تنفّس — المحتوى
         * يمر تحت الطبقة العائمة من أول بكسل. */
        contentContainerStyle={{
          paddingTop: HERO_CONTENT_H + spacing.md,
          paddingBottom: tabClearance,
        }}
        /* v4.0: محرك JS صرف (قاعدة v3.4 — لا Animated.event ولا
         * محرك أصلي على مسار التمرير). */
        scrollEventThrottle={16}
        onScroll={e => collapse.onScroll(e.nativeEvent.contentOffset.y)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadHome();
              setRefreshing(false);
            }}
            tintColor={palette.brand}
            colors={[palette.brand]}
          />
        }>
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
            {/* ─── متاجر تخدم منطقتك — رقاقة المنطقة بأقصى يسار العنوان ─── */}
            <Entrance delay={0}>
            <View style={{gap: spacing.md}}>
              <SectionTitle
                title={
                  myRegion != null ? `متاجر تخدم ${myRegion}` : 'متاجر تخدم منطقتك'
                }
                end={<RegionChip region={myRegion} onPress={openRegionPicker} />}
              />
              {myRegion == null ? (
                <Pressable
                  onPress={openRegionPicker}
                  accessibilityRole="button"
                  style={({pressed}) => [
                    regionStyles.emptyCard,
                    {
                      backgroundColor: palette.brandSoft,
                      borderColor: palette.brandBorder,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{scale: pressed ? 0.98 : 1}],
                    },
                  ]}>
                  <View style={[regionStyles.pinCircle, {backgroundColor: palette.brand}]}>
                    <Icon name="pin" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={{flex: 1, fontSize: 12.5, color: palette.ink, fontFamily: fonts.medium}}>
                    حدّد منطقتك لتظهر المتاجر التي توصّل إليك
                  </Text>
                  <Icon name="chevronLeft" size={16} color={palette.brandDark} />
                </Pressable>
              ) : regionStores.length > 0 ? (
                <FlatList
                  horizontal
                  data={regionStores.slice(0, 10)}
                  keyExtractor={s => `r${s.id}`}
                  showsHorizontalScrollIndicator={false}
                  /* v3.2: snap ناعم على عرض البطاقة — استمرار تصفح مريح
                   * (v3.3: حُدّث لعرض 78 بعد انكماش بطاقة المتجر). */
                  snapToInterval={78 + spacing.md}
                  decelerationRate="fast"
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
                  لا متاجر تخدم «{myRegion}» حالياً — غيّر المنطقة من رقاقة القسم
                </Text>
              )}
            </View>
            </Entrance>

            {/* ─── عروض هذا الأسبوع (v4.0) ───
             * أقوى تخفيضات المول في بطاقات «صفقة» أفقية كاملة
             * المعلومات — قرار الشراء بنظرة واحدة. «كل العروض» يفتح
             * البحث مفلتراً بالعروض فقط. */}
            {weeklyOffers.length > 0 ? (
              <Entrance delay={70}>
                <View style={{gap: spacing.md}}>
                  <SectionTitle
                    title="عروض هذا الأسبوع"
                    subtitle="أقوى التخفيضات من كل متاجر المول"
                    actionLabel="كل العروض"
                    onAction={() => navigation.navigate('Search', {offers: true, browse: true})}
                  />
                  <FlatList
                    horizontal
                    data={weeklyOffers}
                    keyExtractor={p => `offer-w-${p.store_id}:${p.id}`}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={252 + spacing.md}
                    decelerationRate="fast"
                    contentContainerStyle={{gap: spacing.md, paddingVertical: 8}}
                    renderItem={({item}) => (
                      <WeeklyOfferCard
                        product={item}
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
                </View>
              </Entrance>
            ) : null}

            {/* ─── أقسام حسب نوع المتجر (v3.4 — طلب المستخدم الأهم) ───
             * لكل نوع شريط من أحدث وأفضل منتجات أفضل متاجره،
             * وأيقونة «عرض الكل» بأقصى يسار العنوان تفتح شاشة
             * القسم الكاملة (StoreTypeScreen) بكل متاجر القسم
             * ومنتجاتها بجلب دوّار عادل حتى الاستنفاد. */}
            {typeSections.map((sec, idx) => {
              const rail = typeProducts[sec.label] ?? [];
              if (rail.length === 0) {
                return null;
              }
              return (
                <Entrance key={`type-${sec.label}`} delay={120 + idx * 50}>
                <View style={{gap: spacing.md}}>
                  <SectionTitle
                    title={sec.label}
                    subtitle={`${sec.stores.length} ${
                      sec.stores.length === 1 ? 'متجر' : 'متاجر'
                    } في المول`}
                    actionLabel="عرض الكل"
                    onAction={() => navigation.navigate('StoreType', {type: sec.label})}
                  />
                  {/* v4.0: بطاقة الشريط المضغوطة — صورة مربعة واسم وسعر
                   * فقط: بطاقتان ونصف في الشاشة بدل بطاقة ونصف، وتنويع
                   * واضح عن بطاقة الشبكة الكاملة (طلب تنويع الأشكال). */}
                  <FlatList
                    horizontal
                    data={rail}
                    keyExtractor={item => `t${item.store.id}:${item.product.id}`}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={148 + spacing.md}
                    decelerationRate="fast"
                    contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                    renderItem={({item}) => (
                      <ProductRailCard
                        product={item.product}
                        width={148}
                        storeName={item.store.name}
                        storeRef={{
                          id: item.store.id,
                          name: item.store.name,
                          storeNumber: item.store.store_number,
                        }}
                        onPress={() =>
                          navigation.navigate('Product', {
                            product: item.product,
                            storeRef: {
                              id: item.store.id,
                              name: item.store.name,
                              storeNumber: item.store.store_number,
                            },
                          })
                        }
                      />
                    )}
                  />
                </View>
                </Entrance>
              );
            })}

            {/* ─── مقترحات لك (اهتماماتك) — كاروسيل snap ─── */}
            {recommended.length > 0 ? (
              <Entrance delay={140}>
                <View style={{gap: spacing.md}}>
                  <SectionTitle title="مقترحات لك" subtitle="من تصنيفات شاهدتها وعجبتك" />
                  <FlatList
                    horizontal
                    data={recommended}
                    keyExtractor={item => `rec${item.store_id}:${item.id}`}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={148 + spacing.md}
                    decelerationRate="fast"
                    contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                    renderItem={({item}) => (
                      <ProductRailCard
                        product={item}
                        width={148}
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
                    )}
                  />
                </View>
              </Entrance>
            ) : null}

            {/* ─── التصنيفات — بلاطات ملونة عمودية (نمط نون) ─── */}
            {firstEverLoad ? (
              <View style={{gap: spacing.md}}>
                <RowSkeleton />
              </View>
            ) : categories.length > 0 ? (
              <Entrance delay={160}>
              <View style={{gap: spacing.md}}>
                <SectionTitle title="تسوّق حسب التصنيف" />
                <FlatList
                  horizontal
                  data={categories.slice(0, 12)}
                  keyExtractor={c => c.category}
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={104}
                  decelerationRate="fast"
                  contentContainerStyle={{gap: spacing.md, paddingVertical: 4}}
                  renderItem={({item}) => {
                    const tile = tileFor(item.category, palette.isDark);
                    return (
                      /* v3.6 (الجولة 66 — طلب المستخدم: «بطاقات الأقسام
                       * مميزة يعني تكون صورة وعنوان بدون تفاصيل»): بطاقة
                       * بيضاء نظيفة بميدالية دائرية كبيرة ناعمة بلون بلاطة
                       * التصنيف + الاسم فقط — بلا عدّاد منتجات ولا أي
                       * تفاصيل ثانوية (نمط نون/أمازون في بلاطات الأقسام). */
                      <Pressable
                        onPress={() => navigation.navigate('Category', {category: item.category})}
                        accessibilityRole="button"
                        accessibilityLabel={item.category}
                        style={({pressed}) => [
                          catStyles.tile,
                          {
                            backgroundColor: palette.surface,
                            borderColor: tile.solid + '2E',
                            opacity: pressed ? 0.85 : 1,
                            transform: [{scale: pressed ? 0.95 : 1}],
                          },
                          shadowFor(palette.isDark),
                        ]}>
                        <View style={[catStyles.iconWrap, {backgroundColor: tile.soft}]}>
                          <Icon
                            name={CATEGORY_ICONS[item.category] ?? 'tag'}
                            size={27}
                            color={tile.solid}
                          />
                        </View>
                        <Text
                          style={{
                            fontSize: 12,
                            color: palette.ink,
                            fontFamily: fonts.bold,
                            textAlign: 'center',
                          }}
                          numberOfLines={1}>
                          {item.category}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
              </Entrance>
            ) : null}

            {/* ─── أحدث ما وصل المول — كاروسيل شبكي 2×2 بانتقال صفحات ───
             * v3.2: طلب التاجر «snap-to-grid pagination» — كانت شبكة
             * تمرير رأسية لا نهائية؛ الآن صفحات مقضمة من 4 منتجات،
             * والجلب التدريجي يستمر عند بلوغ آخر صفحة. */}
            <Entrance delay={190}>
            <View style={{gap: spacing.md}}>
              <SectionTitle
                title="أحدث ما وصل المول"
                subtitle="صفّح الصفحات — منتجات جديدة كل مزامنة"
                actionLabel="عرض الكل"
                onAction={() => navigation.navigate('Search', {browse: true})}
              />
              {firstEverLoad ? (
                <RowSkeleton />
              ) : products.length === 0 ? (
                <EmptyState
                  icon="emptyBag"
                  title="لا منتجات منشورة بعد"
                  body="تُزامن المتاجر منتجاتها كل 15 دقيقة — عد لاحقاً"
                />
              ) : (
                <View>
                  <FlatList
                    horizontal
                    data={Array.from({length: gridPages}, (_, i) => i)}
                    keyExtractor={i => `page${i}`}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={snapInterval}
                    decelerationRate="fast"
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={{gap: pageGap}}
                    renderItem={({item}) => renderGridPage(item)}
                  />
                  {loadingMore ? (
                    <View style={{paddingVertical: spacing.sm}}>
                      <Loader label="نجلب المزيد…" />
                    </View>
                  ) : null}
                </View>
              )}
            </View>
            </Entrance>
          </View>
        )}
      </Animated.ScrollView>

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
  /* v3.4: عادت الزوايا الدائرية السفلية بطلب المستخدم الصريح —
   * التروسة كبطاقة عائمة أنيقة بظل مرفوع فوق محتوى التمرير
   * (كانت مسطحة الحواف منذ v3.2 بلا أي انحناء سفلي).
   * v4.0: الطبقة نفسها صارت عائمة منطوية — هندستها في
   * heroFloatStyles ومحتواها هنا كما هو. */
  wrap: {
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  inner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingCol: {gap: 1, alignItems: 'flex-start'},
  greetingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.regular,
  },
  greetingName: {
    fontSize: 19,
    lineHeight: 27,
    color: '#FFFFFF',
    fontFamily: fonts.black,
  },
  iconBtnOnBrand: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgeSlot: {position: 'absolute', top: -5, left: -5},
  searchEntry: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.md,
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
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
  },
});

const catStyles = StyleSheet.create({
  /* v3.6: بلاطة القسم — صورة (ميدالية) وعنوان فقط بلا تفاصيل. */
  tile: {
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    width: 92,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 999,
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

/* v4.0 (الجولة 68): هندسة التروسة العائمة — طبقة مطلقة أعلى الشاشة
 * (نفس نمط شريط صفحة المتجر المثبت على الأجهزة منذ v3.4). */
const heroFloatStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
});

/* v4.0 (الجولة 68): الشريط المضغوط — يظهر بانزلاق وتلاشٍ عند
 * التمرير محل التروسة المنطوية: عنوان المول + المنطقة + أزرار
 * البحث/المفضلة/الإشعارات — استمرارية كاملة للأفعال الشائعة. */
const compactStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brandCol: {gap: 1, alignItems: 'flex-start', flex: 1},
  brandTitle: {fontSize: 17, lineHeight: 23, fontFamily: fonts.black},
  brandSub: {fontSize: 10.5, fontFamily: fonts.medium},
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ═══ v3.4: رقاقة «توصيل إلى» اللطيفة — أقصى يسار عنوان القسم ═══
 * طلب المستخدم بالنص: «زر توصيل الي بشكل لطيف وبسيط عند تغير
 * المنطقة يظهر في أقصي الزاوية اليسري بجانب الهيدر لقسم متاجر
 * تخدم» — كبسولة مضغوطة: دبوس + اسم المنطقة الحالي + سهم صغير،
 * تفتح مساعد اختيار المنطقة وتتحدث فور تغيّرها. */
function RegionChip({
  region,
  onPress,
}: {
  region: string | null;
  onPress: () => void;
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        region != null
          ? `منطقة التوصيل: ${region} — للتغيير`
          : 'حدّد منطقة التوصيل'
      }
      style={({pressed}) => [
        regionChipStyles.chip,
        {
          backgroundColor: palette.brandSoft,
          borderColor: palette.brandBorder,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Icon name="pin" size={13} color={palette.brandDark} />
      <Text
        style={{
          fontSize: 12,
          color: palette.brandDark,
          fontFamily: fonts.bold,
          maxWidth: 120,
        }}
        numberOfLines={1}>
        {region ?? 'حدّد منطقتك'}
      </Text>
      <Icon name="chevronDown" size={12} color={palette.brandDark} />
    </Pressable>
  );
}

const regionChipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
});

/* v3.2: صفحة الكاروسيل الشبكي 2×2. */
const gridPageStyles = StyleSheet.create({
  page: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
    width: '100%',
  },
});
