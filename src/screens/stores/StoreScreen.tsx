/**
 * StoreScreen.tsx — صفحة المتجر (v3.4 — الجولة 64):
 * ─────────────────────────────────────────────────────────────────
 *  • إصلاح جذري لانهيار فتح صفحة المتجر: حُذفت منظومة Animated
 *    ذات المحرك الأصلي كلياً (ربط حدث التمرير بعقد أصلية عبر
 *    المحرك الأصلي + طبقة متحركة بـ interpolations) — كانت
 *    الآلية الوحيدة المُدخلة بعد v3.1.0 السليمة وتُفجّر انهياراً
 *    أصلياً فورياً على معمارية Fabric الجديدة عند فتح الصفحة من
 *    الرئيسية أو دليل المتاجر. البديل آمن مئة بالمئة: onScroll
 *    عادي + حالة إظهار ثنائية عند تجاوز التروسة — نفس آليات
 *    v3.1.0 المُثبتة على جهاز المستخدم بلا أي وحدة أصلية إضافية.
 *  • شريط علوي لاصق: يظهر عند تجاوز التروسة البطولية — فيه زر
 *    الرجوع «‹» + اسم المتجر + أيقونة بحث تركّز حقل البحث فوراً.
 *    الزائر أبداً لا يعلق بلا زر رجوع مهما نزل في الكتالوج.
 *  • رقائق فلترة سريعة أفقية داخل المتجر (طلب التاجر): الكل /
 *    عروض / تصنيفات المتجر + ترتيب (الأحدث/الأرخص/الأغلى) —
 *    فلترة محلية فورية فوق الكتالوج المُحمّل بلا أي نداء شبكة.
 *  • مراجعات المشترين: كاروسيل أفقي مدمج مقضم (Snap) — بطاقة
 *    الملخص (متوسط + عدد) ثم مقتطفات المراجعات — إثبات اجتماعي
 *    مرئي فوراً بلا تضخيم عمودي للصفحة (كانت قائمة رأسية متزاحمة).
 *  • بحث داخل المتجر: محلي فوري فوق النتائج + خادمي مؤجل (400ms)
 *    بحارس تسلسل + قفز لأعلى القائمة عند كل استعلام جديد.
 *  • زر الرجوع في التروسة: يسار الشاشة بسهم «‹» (توحيد RTL كامل).
 *  • v3.5 (الجولة 65 — إصلاح «البطاقة الضخمة لمنتج واحد»): شبكة
 *    منتجات المتجر كانت تعرض البطاقة عارية داخل صف numColumns —
 *    flex:1 على جذر البطاقة كان يتمدد وحده بكامل عرض الشاشة حين
 *    يكون هو المنتج الوحيد في صفه (عدد فردي/فلترة/بحث بمائع واحد)
 *    بينما صورته بقيت بنصف العرض — شكل مقرف. الآن كل بطاقة داخل
 *    خلية مسقوفة 50% (نمط الجولة 63 المُجرّب في البحث) + الصورة
 *    تملأ البطاقة (وضع الملء) + صفوف الشبكة أخيراً بهامش جانبي 16
 *    مثل باقي أقسام الصفحة — كانت الصفوف ملاصقة لحرفي الشاشة.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {
  radius,
  shadowFor,
  shadowRaised,
  spacing,
  type,
  fonts,
  cardBorderFor,
} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {shareStore} from '../../core/share';
import {
  EmptyState,
  EndOfList,
  ErrorState,
  Loader,
  Screen,
  SearchBar,
  SectionTitle,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreOfferCard} from '../../components/ProductCards';
import {StoreAvatar, storeTypeInfo} from '../../components/StoreCard';
import {Stars} from '../../components/RatingSheet';
import {getStoreDetail, getStoreProducts, getStoreProductsAdaptive, getStoreRatings} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {formatMoney} from '../../core/money';
import {relativeTime} from '../../core/time';
import {hasDiscount, effectiveMinor} from '../../core/discount';
import type {DeliveryRegion, Product, StoreDetail, StoreRatings} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Store'>;

type SortKey = 'newest' | 'priceAsc' | 'priceDesc';

export function StoreScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const {storeId, storeName} = route.params;

  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [ratings, setRatings] = useState<StoreRatings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  /* v3.2: الفلترة السريعة المحلية داخل المتجر. */
  const [offersOnly, setOffersOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');

  const listRef = useRef<FlatList<Product>>(null);
  const searchInputRef = useRef<TextInput>(null);

  /* v3.4: الشريط العلوي اللاصق — حالة إظهار ثنائية آمنة تماماً.
   * كان تنفيذ v3.2 بمنظومة Animated ذات المحرك الأصلي (ربط حدث
   * التمرير بعقد أصلية) — وهي الآلية الوحيدة التي دخلت هذه الشاشة بعد
   * v3.1.0 السليمة، وتُفجّر انهياراً فورياً عند فتح الصفحة على
   * المعمارية الجديدة. الآن: onScroll عادي يقارن العتبة ويبدّل حالة
   * واحدة — setState يُتخطى تلقائياً حين لا تتغير القيمة فلا أي
   * إعادة رندر زائدة، وبلا أي وحدة أصلية في المسار.
   * v4.0 (الجولة 68): الحالة الثنائية بقيت لتفعيل اللمس فقط، أما
   * الظهور نفسه فصار انزلاقاً وتلاشياً متصلين بمحرك JS (setValue
   * من onScroll — بلا ربط أحداث أصلية ولا محرك أصلي: نفس قاعدة
   * السلامة، ومظهر ناعم بدل قفزة ظهور/اختفاء). */
  const [barShown, setBarShown] = useState(false);
  const barScrollY = useRef(new Animated.Value(0)).current;
  const barOpacity = useMemo(
    () =>
      barScrollY.interpolate({
        inputRange: [100, 170],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [barScrollY],
  );
  const barTranslate = useMemo(
    () =>
      barScrollY.interpolate({
        inputRange: [100, 170],
        outputRange: [-12, 0],
        extrapolate: 'clamp',
      }),
    [barScrollY],
  );

  const load = useCallback(async () => {
    setError(null);
    setProductsError(null);
    setLoading(true);
    try {
      const [d, r, o] = await Promise.all([
        getStoreDetail(storeId),
        getStoreRatings(storeId).catch(() => null),
        // عروض المتجر (المخفضة فقط) — فشلها غير فادح
        getStoreProducts(storeId, {offers: true, per: 10}).catch(() => [] as Product[]),
      ]);
      setDetail(d);
      setRatings(r);
      setOffers(o.filter(p => hasDiscount(p)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل المتجر');
    } finally {
      setLoading(false);
    }
    // المنتجات بجلب متدرج (سلم 12→6 عند تعثر الشبكة)
    try {
      const p = await getStoreProductsAdaptive(storeId, PRODUCTS_PAGE_SIZE);
      setProducts(p);
      setPage(1);
      setProductsError(null);
      setExhausted(p.length < PRODUCTS_PAGE_SIZE);
    } catch (e) {
      setProducts([]);
      setProductsError(
        e instanceof ApiError ? e.message : 'تعذر جلب منتجات المتجر',
      );
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* بحث داخل المتجر: خادمي مؤجل (400ms) بحارس تسلسل يمنع الردود
   * المتقادمة + قفز لأعلى القائمة عند كل استعلام فعلي. */
  const searchSeq = useRef(0);
  useEffect(() => {
    const mySeq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const p = await getStoreProducts(storeId, {
          q: query.trim() || undefined,
          per: PRODUCTS_PAGE_SIZE,
        });
        if (mySeq !== searchSeq.current) {
          return; // جاء رد أحدث — تجاهل
        }
        setProducts(p);
        setPage(1);
        setExhausted(p.length < PRODUCTS_PAGE_SIZE);
      } catch {
        /* تجاهل أخطاء الكتابة السريعة */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, storeId]);

  /* v3.2: عند كتابة استعلام جديد — عد لأعلى القائمة كي تُرى النتائج
   * فوراً (كان المستخدم يكتب من عمق الكتالوج فلا يلاحظ التغيير). */
  useEffect(() => {
    if (query.trim().length > 0) {
      listRef.current?.scrollToOffset({offset: 0, animated: true});
    }
  }, [query]);

  /* v3.2: تصنيفات المتجر الحقيقية من كتالوجه المُحمّل — رقائق فلاتر. */
  const storeCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category != null && p.category.trim().length > 0) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).slice(0, 10);
  }, [products]);

  /* v3.2: القائمة المرئية — فلترة محلية فورية (استعلام/عروض/
   * تصنيف) + ترتيب، فوق الكتالوج المُحمّل بلا أي نداء شبكة.
   * أثناء نافذة الـ400ms المؤجلة تُرشّح المنتجات المعروضة محلياً
   * فيبدو البحث لحظياً. */
  const visible = useMemo(() => {
    let list = products;
    const q = query.trim();
    if (q.length > 0) {
      list = list.filter(p => p.name.includes(q));
    }
    if (offersOnly) {
      list = list.filter(p => hasDiscount(p));
    }
    if (filterCategory != null) {
      list = list.filter(p => (p.category ?? '').trim() === filterCategory);
    }
    switch (sort) {
      case 'priceAsc':
        return [...list].sort((a, b) => effectiveMinor(a) - effectiveMinor(b));
      case 'priceDesc':
        return [...list].sort((a, b) => effectiveMinor(b) - effectiveMinor(a));
      default:
        return list;
    }
  }, [products, query, offersOnly, filterCategory, sort]);

  /* أي فلاتر نشطة توقف الجلب التدريجي (يعمل على الكتالوج الكامل). */
  const filtersActive = offersOnly || filterCategory != null;

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || query.trim().length > 0 || filtersActive) {
      return;
    }
    if (exhausted) {
      return;
    }
    if (productsError != null) {
      try {
        const p = await getStoreProductsAdaptive(storeId, PRODUCTS_PAGE_SIZE);
        setProducts(p);
        setPage(1);
        setProductsError(null);
        setExhausted(p.length < PRODUCTS_PAGE_SIZE);
      } catch {
        /* صمت — زر إعادة المحاولة داخل القسم يكفي */
      }
      return;
    }
    if (products.length === 0) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await getStoreProductsAdaptive(
        storeId,
        products.length + PRODUCTS_PAGE_SIZE,
      );
      if (next.length > products.length) {
        setProducts(next);
        setPage(p => p + 1);
        setExhausted(next.length < products.length + PRODUCTS_PAGE_SIZE);
      } else {
        setExhausted(true);
      }
    } catch {
      /* فشل مؤقت — إسكات اللودر فقط */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, products, productsError, storeId, exhausted, filtersActive]);

  const store = detail?.store;
  const regions: DeliveryRegion[] = detail?.deliveryRegions ?? [];
  const typeInfo = storeTypeInfo(store?.category);
  const storeRef = useMemo(
    () => ({
      id: storeId,
      name: store?.name ?? storeName ?? 'المتجر',
      storeNumber: store?.store_number,
      logoUrl: store?.logo_url ?? null,
    }),
    [storeId, store, storeName],
  );

  const heroBg = palette.isDark ? '#C2410C' : '#EA580C';
  const reviewsWithText = (ratings?.reviews ?? []).filter(
    r => r.comment != null && r.comment.length > 0,
  );
  const hasRating = ratings != null && ratings.ratingCount > 0;

  return (
    <Screen>
      {/* ═══ الشريط العلوي اللاصق (v3.4 — آمن تماماً، v4.0 — ناعم) ═══
       * يظهر بعد تجاوز التروسة بانزلاق وتلاشٍ متصلين — رجوع + اسم
       * المتجر + بحث فوري. طبقة مطلقة فوق المحتوى: صفر قفزات تخطيط،
       * وصفر وحدات أصلية (المحرك JS من onScroll ← setValue فقط). */}
      <Animated.View
        pointerEvents={barShown ? 'auto' : 'none'}
        style={[
          stickyStyles.bar,
          {
            backgroundColor: palette.surface,
            borderBottomColor: palette.line,
          },
          {opacity: barOpacity, transform: [{translateY: barTranslate}]},
          shadowRaised(palette.isDark),
        ]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          style={[stickyStyles.backBtn, {borderColor: palette.line}]}>
          <Icon name="chevronLeft" size={20} color={palette.ink} strokeWidth={2.4} />
        </Pressable>
        <StoreAvatar
          name={store?.name ?? storeName ?? 'س'}
          logoUrl={store?.logo_url}
          size={32}
        />
        <Text
          style={[type.h3, {color: palette.ink, flex: 1}]}
          numberOfLines={1}>
          {store?.name ?? storeName ?? 'المتجر'}
        </Text>
        <Pressable
          onPress={() => {
            listRef.current?.scrollToOffset({offset: 0, animated: true});
            searchInputRef.current?.focus();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="بحث داخل المتجر"
          style={[stickyStyles.searchBtn, {borderColor: palette.line}]}>
          <Icon name="search" size={18} color={palette.ink} />
        </Pressable>
      </Animated.View>

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        /* v3.5: الخلية مسقوفة 50% — المنتج الوحيد في صفه يبقى بنصف
         * العرض كبقية بطاقات الشبكة، لا شريطاً ضخماً بكامل السطر
         * (شكوى الجولة 65: «في الصف الواحد تصبح كبيرة لمنتج واحد
         * وشكلها مقرف»). + هامش جانبي للصفوف كان الصفر.
         * v3.6 (الجولة 66): gap عمودي بين الصفوف — كانت البطاقات
         * ملاصقة لبعضها عمودياً بلا أي تنفّس (شكوى «بطاقات المنتجات
         * ملاصقة لبعضها خصوصاً الهامش السفلي»). نفس نمط قسم نوع
         * المتجر المُجرّب في v3.5. */
        columnWrapperStyle={{
          gap: spacing.md,
          width: '100%',
          paddingHorizontal: spacing.lg,
        }}
        contentContainerStyle={{
          gap: spacing.md,
          paddingBottom: Math.max(insets.bottom + 24, 96),
        }}
        showsVerticalScrollIndicator={false}
        /* v3.4: onScroll عادي بلا أي محرك أصلي — مقارنة عتبة واحدة
         * وتبديل حالة عند التغير فقط (React يتخطى setState المتطابق). */
        onScroll={e => {
          const y = e.nativeEvent.contentOffset.y;
          /* v4.0: تغذية القيمة المتصلة للشريط (محرك JS — قاعدة v3.4)
           * + حالة العتبة لللمس فقط. */
          barScrollY.setValue(y);
          const show = y > 150;
          setBarShown(prev => (prev === show ? prev : show));
        }}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View>
            {/* ─── الترويسة البطولية ─── */}
            <View
              style={[
                heroStyles.wrap,
                {backgroundColor: heroBg, paddingTop: spacing.xl},
              ]}>
              <View style={heroStyles.ring} />
              {/* v3.2: زر الرجوع يسار الشاشة بسهم «‹» — توحيد RTL. */}
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="رجوع"
                style={heroStyles.backBtn}>
                <Icon name="chevronLeft" size={20} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
              {/* v4.0 (الجولة 68): زر مشاركة المتجر — طلب المستخدم
               * «المشاركة حيث يمكن للزبون مشاركة منتج وهكذا» — يظهر
               * فوق التروسة بجانب زر الرجوع بلون العلامة. */}
              <Pressable
                onPress={() => {
                  if (store != null) {
                    void shareStore(
                      {
                        name: store.name,
                        rating: store.rating ?? null,
                        region: store.region ?? null,
                        store_number: store.store_number ?? null,
                      },
                      products.length,
                    );
                  } else {
                    void shareStore(
                      {name: storeName ?? 'المتجر', rating: null, region: null, store_number: null},
                      products.length,
                    );
                  }
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="مشاركة المتجر"
                style={heroStyles.shareBtn}>
                <Icon name="forward" size={19} color="#FFFFFF" />
              </Pressable>
              <StoreAvatar name={store?.name ?? storeName ?? 'س'} logoUrl={store?.logo_url} size={84} />
              <Text style={[type.h1, {color: '#FFFFFF', fontFamily: fonts.black}]}>
                {store?.name ?? storeName ?? 'المتجر'}
              </Text>
              {/* شارات مدمجة في سطر واحد شفاف فوق اللون */}
              <View style={heroStyles.badgesRow}>
                <View style={heroStyles.badgeOnBrand}>
                  <Icon name={typeInfo.icon} size={11} color="#FFFFFF" />
                  <Text style={heroStyles.badgeOnBrandText}>{typeInfo.label}</Text>
                </View>
                {store?.region ? (
                  <View style={heroStyles.badgeOnBrand}>
                    <Icon name="pin" size={11} color="#FFFFFF" />
                    <Text style={heroStyles.badgeOnBrandText} numberOfLines={1}>
                      {store.region}
                    </Text>
                  </View>
                ) : null}
                {store?.store_number ? (
                  <View style={heroStyles.badgeOnBrand}>
                    <Icon name="checkCircle" size={11} color="#FFFFFF" />
                    <Text style={heroStyles.badgeOnBrandText}>موثّق</Text>
                  </View>
                ) : null}
              </View>
              {/* التقييم — سطر واحد مدمج */}
              {store?.rating != null && store.rating > 0 ? (
                <View style={heroStyles.ratingRow}>
                  <Stars rating={store.rating} size={14} />
                  <Text style={heroStyles.ratingRowText}>
                    {store.rating} ({store.ratingCount} تقييماً)
                  </Text>
                </View>
              ) : (
                <Text style={heroStyles.ratingRowText}>متجر جديد على المول</Text>
              )}
            </View>

            {loading && detail == null ? (
              <Loader label="ندخل المتجر…" />
            ) : error != null && detail == null ? (
              <View style={{padding: spacing.lg}}>
                <ErrorState message={error} onRetry={load} />
              </View>
            ) : (
              <View style={{padding: spacing.lg, gap: spacing.xl}}>
                {/* ─── v4.0: شريط أرقام المتجر — نظرة واحدة على حجم ───
                 * المتجر وجاهزيته (منتجات/عروض/مناطق التوصيل) قبل أي
                 * تمرير — يغذي قرار «أتسوّق من هنا؟» فوراً. */}
                {store != null || products.length > 0 ? (
                  <View style={statsStyles.row}>
                    <View style={[statsStyles.pill, {backgroundColor: palette.surfaceAlt}]}>
                      <Icon name="box" size={13} color={palette.brandDark} />
                      <Text style={[statsStyles.pillText, {color: palette.ink}]}>
                        {products.length} منتجاً
                      </Text>
                    </View>
                    {offers.length > 0 ? (
                      <View style={[statsStyles.pill, {backgroundColor: palette.dangerSoft}]}>
                        <Icon name="flame" size={13} color={palette.danger} />
                        <Text style={[statsStyles.pillText, {color: palette.danger}]}>
                          {offers.length} عرضاً
                        </Text>
                      </View>
                    ) : null}
                    {regions.length > 0 ? (
                      <View style={[statsStyles.pill, {backgroundColor: palette.successSoft}]}>
                        <Icon name="truck" size={13} color={palette.success} />
                        <Text style={[statsStyles.pillText, {color: palette.success}]}>
                          {regions.length} مناطق توصيل
                        </Text>
                      </View>
                    ) : null}
                    {store?.rating != null && store.rating > 0 ? (
                      <View style={[statsStyles.pill, {backgroundColor: palette.warningSoft}]}>
                        <Icon name="star" size={13} color={palette.warning} />
                        <Text style={[statsStyles.pillText, {color: palette.ink}]}>
                          {store.rating} من 5
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* ─── شريط الإجراءات ─── */}
                {store?.phone || store?.whatsapp ? (
                  <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                    {store?.phone ? (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${store.phone}`)}
                        style={({pressed}) => [
                          actionStyles.btn,
                          {
                            backgroundColor: palette.brandSoft,
                            borderColor: palette.brandBorder,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Icon name="phone" size={16} color={palette.brandDark} />
                        <Text style={[actionStyles.btnText, {color: palette.brandDark}]}>اتصال</Text>
                      </Pressable>
                    ) : null}
                    {store?.whatsapp ? (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `https://wa.me/${store.whatsapp!.replace(/[^\d]/g, '')}`,
                          )
                        }
                        style={({pressed}) => [
                          actionStyles.btn,
                          {
                            backgroundColor: palette.surface,
                            borderColor: palette.line,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Icon name="whatsapp" size={16} color={palette.ink} />
                        <Text style={[actionStyles.btnText, {color: palette.ink}]}>واتساب</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* v4.0: مشاركة المتجر — زر مستقل يعمل دائماً حتى بلا
                 * هاتف/واتساب (طلب المستخدم: المشاركة من صفحة التاجر). */}
                <Pressable
                  onPress={() => {
                    const name = store?.name ?? storeName ?? 'المتجر';
                    void shareStore(
                      {
                        name,
                        rating: store?.rating ?? null,
                        region: store?.region ?? null,
                        store_number: store?.store_number ?? null,
                      },
                      products.length,
                    );
                  }}
                  style={({pressed}) => [
                    actionStyles.btn,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.line,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{scale: pressed ? 0.98 : 1}],
                    },
                  ]}>
                  <Icon name="forward" size={16} color={palette.ink} />
                  <Text style={[actionStyles.btnText, {color: palette.ink}]}>مشاركة المتجر</Text>
                </Pressable>

                {/* ─── آراء المشترين — كاروسيل أفقي مدمج (v3.2) ───
                 * طلب التاجر: «ملخص التقييم + أهم مراجعتين في كاروسيل
                 * أفقي مقضم — إثبات اجتماعي مرئي فوراً بلا تضخيم رأسي».
                 * البطاقة الأولى: الملخص (الرقم الكبير + النجوم + العدد)،
                 * وبعدها مقتطفات المراجعات بعرض ثابت وsnap ناعم. */}
                {hasRating ? (
                  <View style={{gap: spacing.md}}>
                    <SectionTitle
                      title="آراء المشترين"
                      subtitle={`${ratings!.ratingCount} تقييماً موثقاً من مشترين حقيقيين`}
                    />
                    <FlatList
                      horizontal
                      data={reviewsWithText.slice(0, 10)}
                      keyExtractor={(_, i) => `rev${i}`}
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={264 + spacing.md}
                      decelerationRate="fast"
                      contentContainerStyle={{gap: spacing.md, paddingVertical: 4}}
                      ListHeaderComponent={
                        <View
                          style={[
                            reviewStyles.summary,
                            {
                              backgroundColor: palette.surface,
                              borderColor: cardBorderFor(palette.isDark),
                            },
                            shadowFor(palette.isDark),
                          ]}>
                          <Text style={[reviewStyles.summaryNum, {color: palette.ink}]}>
                            {ratings!.rating != null
                              ? ratings!.rating % 1 === 0
                                ? ratings!.rating.toFixed(0)
                                : ratings!.rating.toFixed(1)
                              : '—'}
                          </Text>
                          <Stars rating={ratings!.rating} size={13} />
                          <Text style={reviewStyles.summaryCount}>
                            من {ratings!.ratingCount} تقييماً
                          </Text>
                          <View style={[reviewStyles.verifiedChip, {backgroundColor: palette.successSoft}]}>
                            <Icon name="checkCircle" size={10} color={palette.success} />
                            <Text style={{fontSize: 9, color: palette.success, fontFamily: fonts.bold}}>
                              مشتريات موثقة
                            </Text>
                          </View>
                        </View>
                      }
                      renderItem={({item: r}) => (
                        <View
                          style={[
                            reviewStyles.card,
                            {
                              backgroundColor: palette.surface,
                              borderColor: cardBorderFor(palette.isDark),
                            },
                          ]}>
                          <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm}}>
                            <Text
                              style={{fontSize: 12.5, color: palette.ink, fontFamily: fonts.bold, flex: 1}}
                              numberOfLines={1}>
                              {r.userName}
                            </Text>
                            <View style={[reviewStyles.verifiedChip, {backgroundColor: palette.successSoft}]}>
                              <Icon name="checkCircle" size={10} color={palette.success} />
                              <Text style={{fontSize: 9, color: palette.success, fontFamily: fonts.bold}}>
                                شراء موثّق
                              </Text>
                            </View>
                          </View>
                          <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4}}>
                            <Stars rating={r.stars} size={11} compact />
                            <Text style={{fontSize: 10.5, color: palette.muted}}>
                              · {relativeTime(r.createdAt)}
                            </Text>
                          </View>
                          <Text style={[type.small, {color: palette.inkSoft, lineHeight: 19}]} numberOfLines={4}>
                            {r.comment}
                          </Text>
                        </View>
                      )}
                    />
                  </View>
                ) : null}

                {/* ─── مناطق التوصيل — سطر أفقي واحد مدمج ─── */}
                {regions.length > 0 ? (
                  <View style={{gap: spacing.sm}}>
                    <SectionTitle title={`التوصيل إلى ${regions.length} مناطق`} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={150}
                      decelerationRate="fast"
                      contentContainerStyle={{gap: spacing.sm, paddingVertical: 2}}>
                      {regions.map(r => (
                        <View
                          key={r.name}
                          style={[
                            regionStyles.chip,
                            {
                              backgroundColor: palette.surfaceAlt,
                              borderColor: palette.line,
                            },
                          ]}>
                          <Icon name="truck" size={13} color={palette.brandDark} />
                          <Text style={[{fontSize: 12, color: palette.ink, fontFamily: fonts.medium}]}>
                            {r.name}
                          </Text>
                          <Text style={[{fontSize: 12, color: palette.brandDark, fontFamily: fonts.bold}]}>
                            {formatMoney(r.fee_minor)}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* ─── عروض المتجر (تخفيضات التاجر من POS) ───
                 * v4.1 (الجولة 69): طلب التاجر — «العروض في صفحة
                 * التاجر تحتاج إلى تغيير البطاقات». البطاقة النصية
                 * الصغيرة (132px بلا صورة) صارت بطاقة صفقة كاملة
                 * أفقية بصورة المنتج وقرص الخصم والسعرين وسطر
                 * التوفير — StoreOfferCard. */}
                {offers.length > 0 ? (
                  <View style={{gap: spacing.sm}}>
                    <SectionTitle title={`عروض المتجر (${offers.length})`} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={236 + spacing.md}
                      decelerationRate="fast"
                      contentContainerStyle={{gap: spacing.md, paddingBottom: 2}}>
                      {offers.map(p => (
                        <StoreOfferCard
                          key={`offer-${p.id}`}
                          product={p}
                          onPress={() => navigation.navigate('Product', {product: p, storeRef})}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* ─── بحث داخل المتجر + رقائق الفلترة السريعة ─── */}
                <View style={{gap: spacing.md}}>
                  <SearchBar
                    value={query}
                    onChangeText={setQuery}
                    inputRef={searchInputRef}
                    placeholder={`ابحث داخل ${store?.name ?? 'المتجر'}…`}
                  />

                  {/* v3.2: رقائق فلترة أفقية سريعة (طلب التاجر):
                   * الكل / عروض / تصنيفات المتجر + ترتيب بالسعر —
                   * كلها محلية فورية فوق الكتالوج المُحمّل. */}
                  {storeCategories.length + (offers.length > 0 ? 1 : 0) > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.sm, paddingVertical: 2}}>
                      <FilterChip
                        label="الكل"
                        active={!offersOnly && filterCategory == null}
                        onPress={() => {
                          setOffersOnly(false);
                          setFilterCategory(null);
                        }}
                      />
                      {offers.length > 0 ? (
                        <FilterChip
                          label="عروض"
                          icon="tag"
                          active={offersOnly}
                          onPress={() => {
                            setOffersOnly(v => !v);
                            setFilterCategory(null);
                          }}
                        />
                      ) : null}
                      {storeCategories.map(c => (
                        <FilterChip
                          key={c}
                          label={c}
                          active={filterCategory === c}
                          onPress={() => {
                            setFilterCategory(filterCategory === c ? null : c);
                            setOffersOnly(false);
                          }}
                        />
                      ))}
                      {/* فاصل بصري قبل الترتيب */}
                      <View style={[filterStyles.divider, {backgroundColor: palette.lineStrong}]} />
                      <FilterChip
                        label="الأحدث"
                        icon="clock"
                        active={sort === 'newest'}
                        onPress={() => setSort('newest')}
                      />
                      <FilterChip
                        label="الأرخص"
                        icon="sort"
                        active={sort === 'priceAsc'}
                        onPress={() => setSort(sort === 'priceAsc' ? 'newest' : 'priceAsc')}
                      />
                      <FilterChip
                        label="الأغلى"
                        icon="sort"
                        active={sort === 'priceDesc'}
                        onPress={() => setSort(sort === 'priceDesc' ? 'newest' : 'priceDesc')}
                      />
                    </ScrollView>
                  ) : null}
                </View>

                <SectionTitle
                  title={`المنتجات (${visible.length})`}
                  subtitle={
                    filtersActive || query.trim().length > 0
                      ? `من ${products.length} منتجاً في المتجر`
                      : undefined
                  }
                />

                {productsError != null && query.trim().length === 0 ? (
                  <ErrorState
                    message={productsError}
                    onRetry={() => {
                      setProductsError(null);
                      void load();
                    }}
                  />
                ) : null}

                {query.trim().length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={6}>
                    <Text style={{fontSize: 12, color: palette.brandDark}}>
                      مسح البحث «{query}»
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading && error == null && productsError == null ? (
            query.trim().length > 0 ? (
              <EmptyState
                icon="search"
                title="لا نتائج داخل المتجر"
                body={`لم نجد «${query}» في هذا المتجر — جرّب البحث في كل المتاجر`}
                actionLabel="بحث في كل المول"
                onAction={() => navigation.navigate('Search', {initialQuery: query.trim()})}
              />
            ) : (
              <EmptyState
                icon="emptyBag"
                title="لا منتجات منشورة بعد"
                body="يزامن التاجر كتالوج متجره كل 15 دقيقة — عد لاحقاً"
              />
            )
          ) : null
        }
        ListFooterComponent={
          <View>
            {loadingMore ? (
              <View style={{paddingVertical: spacing.lg}}>
                <Loader label="نجلب المزيد…" />
              </View>
            ) : !loading && !productsError && !filtersActive && query.trim().length === 0 && products.length >= PRODUCTS_PAGE_SIZE && exhausted ? (
              <EndOfList label={`وصلت إلى كل منتجات ${store?.name ?? 'المتجر'}`} />
            ) : null}
            {/* v3.2: تذييل واضح حين تُرشّح القائمة — لا لودر بلا نهاية */}
            {!loading && !loadingMore && (filtersActive || query.trim().length > 0) && visible.length > 0 ? (
              <EndOfList label="كل نتائج هذه الفلترة" />
            ) : null}
          </View>
        }
        renderItem={({item}) => (
          <View style={gridStyles.cell}>
            <ProductCard
              product={item}
              storeRef={storeRef}
              onPress={() => navigation.navigate('Product', {product: item, storeRef})}
            />
          </View>
        )}
        style={{backgroundColor: palette.bg}}
      />
    </Screen>
  );
}

/* v3.2: رقاقة فلترة سريعة — نفس لغة الرقائق (بلا ripple — v3.3). */
function FilterChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: 'tag' | 'clock' | 'sort';
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: active}}
      style={[
        filterStyles.chip,
        {
          backgroundColor: active ? palette.brand : palette.surface,
          borderColor: active ? palette.brand : palette.line,
        },
      ]}>
      {icon ? (
        <Icon
          name={icon}
          size={12}
          color={active ? palette.onBrand : palette.brandDark}
        />
      ) : null}
      <Text
        style={[
          {fontSize: 11.5, fontFamily: active ? fonts.bold : fonts.medium},
          {color: active ? palette.onBrand : palette.inkSoft},
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const stickyStyles = StyleSheet.create({
  /* v3.4: الشريط اللاصق — طبقة مطلقة أعلى الشاشة تظهر بعد تجاوز
   * التروسة. تنفيذ بحالة عادية بلا أي وحدات أصلية (سبب الإصلاح). */
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
});

const heroStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  ring: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 26,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  /* v3.2: زر الرجوع يسار الشاشة (اتجاه سهم «‹»). */
  backBtn: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  /* v4.0: زر مشاركة المتجر — بجانب زر الرجوع على نفس الارتفاع. */
  shareBtn: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg + 48,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  badgeOnBrand: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeOnBrandText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: fonts.bold,
  },
  ratingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  ratingRowText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fonts.medium,
  },
});

/* v3.2: أزرار الاتصال/واتساب — 38px مدمجة بدل أزرار 44 الكبيرة
 * التي كانت تزاحم أعلى الصفحة. */
const actionStyles = StyleSheet.create({
  btn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
});

/* v4.0 (الجولة 68): شريط أرقام المتجر — كبسولات ملونة دلالياً
 * (منتجات/عروض/توصيل/تقييم) نظرة واحدة على جاهزية المتجر. */
const statsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
  },
});

const regionStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});

/* v4.1: offerStyles القديمة أزيلت — بطاقات العروض صارت StoreOfferCard
 * كاملة الصورة والصفقة (الجولة 69). */

/* v3.2: كاروسيل المراجعات المدمج. */
const reviewStyles = StyleSheet.create({
  summary: {
    width: 168,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  summaryNum: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fonts.black,
  },
  summaryCount: {
    fontSize: 11,
    color: '#78716C',
    fontFamily: fonts.medium,
  },
  card: {
    width: 264,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  verifiedChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
});

const filterStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  divider: {
    width: 1,
    height: 18,
    alignSelf: 'center',
  },
});

/* v3.5 (الجولة 65): هندسة شبكة منتجات المتجر — نفس نمط الجولة 63
 * المُجرّب على جهاز المستخدم في شاشة البحث: الخلية مسقوفة بنصف
 * العرض، فالبطاقة الوحيدة في صفها تبقى بنفس عرض بطاقات الشبكة
 * ولا تتمدد شريطاً ضخماً بكامل السطر (شكوى: «بطاقة المنتجات غير
 * صحيحة وفي الصف الواحد تصبح كبيرة لمنتج واحد وشكلها مقرف»). */
const gridStyles = StyleSheet.create({
  cell: {flex: 1, maxWidth: '50%'},
});
