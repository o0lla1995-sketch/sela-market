/**
 * StoreScreen.tsx — صفحة المتجر (v2.0 — إعادة تصميم احترافية):
 * ترويسة بطولية بتدرج الهوية + دائرة المتجر المتداخلة + التقييم
 * بنجومه + شارات النشاط والمنطقة، شريط إجراءات (اتصال/واتساب)،
 * شريط إحصاءات (منتج/مناطق/تقييم)، مناطق التوصيل بأسعارها، بحث
 * داخل المتجر، شبكة المنتجات، وقسم مراجعات المتجر الحقيقية من
 * المشترين (خادم 4.4) — بأسلوب متاجر التجزئة العالمية.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, I18nManager, Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, shadowFor, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  Button,
  EmptyState,
  EndOfList,
  ErrorState,
  Loader,
  Screen,
  SearchBar,
  SectionTitle,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreAvatar, storeTypeInfo} from '../../components/StoreCard';
import {Stars} from '../../components/RatingSheet';
import {getStoreDetail, getStoreProducts, getStoreProductsAdaptive, getStoreRatings} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {formatMoney} from '../../core/money';
import {relativeTime} from '../../core/time';
import {hasDiscount, effectiveMinor} from '../../core/discount';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {DeliveryRegion, Product, StoreDetail, StoreRatings} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Store'>;

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
  /* v2.1: خطأ المنتجات لم يعد يُبتلع — كان يظهر «0+» بلا سبب. */
  const [productsError, setProductsError] = useState<string | null>(null);
  /* v3.0 (الجولة 60): علم استنفاد الكتالوج — الشكوى الحرفية:
   * «يبقى في أسفل الصفحة لودر التحميل يعمل ويحاول جلب المزيد حتى
   * دون وجود المزيد». المنطق القديم كان يعيد النداء عند كل وصول
   * للنهاية ما دام الطول متساوياً (لا جديد لكن لا توقف أيضاً) —
   * لودر يدور للأبد + طلبات بلا نهاية تحرق محدد المعدل. الآن:
   * جلبة لا تُضيف جديدًا = قائمة مستنفدة نهائياً → تذييل «وصلت
   * إلى كل المنتجات» ولا يُرسل طلب واحد بعدها. */
  const [exhausted, setExhausted] = useState(false);

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
    // المنتجات بجلب متدرج (سلم 12→6 عند تعثر الشبكة) — وخطأها
    // يظهر داخل قسم المنتجات مع زر إعادة محاولة بدل عدّاد 0+ صامت.
    try {
      const p = await getStoreProductsAdaptive(storeId, PRODUCTS_PAGE_SIZE);
      setProducts(p);
      setPage(1);
      setProductsError(null);
      /* الاستنفاد الفوري: كتالوج أقصر من صفحة كاملة = لا «المزيد». */
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

  /* بحث داخل المتجر (q على الخادم — دقيق ومفهرس). v3.0: حارس
   * تسلسل يمنع الاستجابات القديمة من الكتابة فوق الأحدث عند
   * الكتابة السريعة، والنتائج الفارغة تعلن الاستنفاد (لا لودر
   * أبدياً أسفل نتائج البحث القصيرة). */
  const searchSeq = React.useRef(0);
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

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || query.trim().length > 0) {
      return;
    }
    /* v3.0: القائمة مستنفدة — لا محاولة إطلاقاً (قتل اللودر الأبدي). */
    if (exhausted) {
      return;
    }
    if (productsError != null) {
      // الجلب الأول تعثر — زر «المزيد» يعيد المحاولة بدل التكرار الأعمى
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
      // جلب شامل بجلب متدرج — يعيد القائمة الموسعة كاملة (idempotent)
      // بدل حساب الإزاحات مع أحجام per متغيرة.
      const next = await getStoreProductsAdaptive(
        storeId,
        products.length + PRODUCTS_PAGE_SIZE,
      );
      if (next.length > products.length) {
        setProducts(next);
        setPage(p => p + 1);
        /* صفحة غير مكتملة = نهاية الكتالوج — توقف نهائي. */
        setExhausted(next.length < products.length + PRODUCTS_PAGE_SIZE);
      } else {
        /* لا جديد إطلاقاً — استنفاد نهائي، لن نعيد المحاولة. */
        setExhausted(true);
      }
    } catch {
      /* فشل مؤقت — إسكات اللودر فقط، المحاولة القادمة عند تمرير جديد */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, products, productsError, storeId, exhausted]);

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

  /* v3.1: خلفية التروسة — برتقالي العلامة في الفاتح، وأعمق في الداكن. */
  const heroBg = palette.isDark ? '#C2410C' : '#EA580C';
  const reviewsWithText = (ratings?.reviews ?? []).filter(
    r => r.comment != null && r.comment.length > 0,
  );

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{gap: spacing.md, width: '100%'}}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 24, 96),
        }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View>
            {/* ─── الترويسة البطولية — v3.1: مدمجة بلون العلامة ───
             * كانت الترويسة فاتحة مزدحمة (تقييم في صندوق + شرح + شارات
             * + شريط إحصاءات مكرر) — طلب التاجر: «صفحة التاجر مقرفة
             * ومتداخلة ومتزاحمة خصوصاً عند وجود تقييمات». الآن: ترويسة
             * واحدة ملوّنة، التقييم سطر واحد، والإحصاءات حُذفت (مكررة
             * في عناوين الأقسام). */}
            <View
              style={[
                heroStyles.wrap,
                {backgroundColor: heroBg, paddingTop: spacing.xl},
              ]}>
              <View style={heroStyles.ring} />
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={10}
                style={heroStyles.backBtn}>
                <Icon
                  name={I18nManager.isRTL ? 'back' : 'forward'}
                  size={20}
                  color="#FFFFFF"
                />
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
              {/* التقييم — سطر واحد مدمج بدل صندوق كامل */}
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
                {/* ─── شريط الإجراءات ─── */}
                {store?.phone || store?.whatsapp ? (
                  <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                    {store?.phone ? (
                      <Button
                        label="اتصال"
                        variant="soft"
                        small
                        icon="phone"
                        style={{flex: 1}}
                        onPress={() => Linking.openURL(`tel:${store.phone}`)}
                      />
                    ) : null}
                    {store?.whatsapp ? (
                      <Button
                        label="واتساب"
                        variant="outline"
                        small
                        icon="whatsapp"
                        style={{flex: 1}}
                        onPress={() =>
                          Linking.openURL(
                            `https://wa.me/${store.whatsapp!.replace(/[^\d]/g, '')}`,
                          )
                        }
                      />
                    ) : null}
                  </View>
                ) : null}

                {/* v3.1: شريط الإحصاءات حُذف — كان تكراراً بصرياً (عدد
                 * المنتجات في عنوان القسم، التقييم في الترويسة، عدد
                 * المناطق في قسمها) يزحم أعلى الصفحة بلا معلومة جديدة. */}

                {/* ─── مناطق التوصيل — سطر أفقي واحد مدمج ─── */}
                {regions.length > 0 ? (
                  <View style={{gap: spacing.sm}}>
                    <SectionTitle title={`التوصيل إلى ${regions.length} مناطق`} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.sm, paddingVertical: 2}}>
                      {regions.map(r => (
                        <View
                          key={r.name}
                          style={[
                            regionStyles.chip,
                            {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
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

                {/* ─── عروض المتجر (v2.1 — تخفيضات التاجر من POS) ─── */}
                {offers.length > 0 ? (
                  <View style={{gap: spacing.sm}}>
                    <SectionTitle title={`عروض المتجر (${offers.length})`} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{gap: spacing.md, paddingBottom: 2}}>
                      {offers.map(p => (
                        <Pressable
                          key={`offer-${p.id}`}
                          onPress={() => navigation.navigate('Product', {product: p, storeRef})}
                          style={({pressed}) => [
                            offerStyles.card,
                            {
                              backgroundColor: palette.surface,
                              borderColor: palette.brandBorder,
                              opacity: pressed ? 0.9 : 1,
                            },
                            shadowFor(palette.isDark),
                          ]}>
                          <View style={[offerStyles.pct, {backgroundColor: palette.danger}]}>
                            <Text style={{fontSize: 12, color: '#FFFFFF', fontFamily: fonts.black}}>
                              {Math.round(p.discount_pct ?? 0)}%
                            </Text>
                          </View>
                          <Text
                            style={[type.smallMedium, {color: palette.ink, fontFamily: fonts.bold}]}
                            numberOfLines={1}>
                            {p.name}
                          </Text>
                          <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
                            <Text style={{fontSize: 11, color: palette.muted, textDecorationLine: 'line-through'}}>
                              {formatMoney(p.price_minor)}
                            </Text>
                            <Text style={{fontSize: 14, color: palette.brandDark, fontFamily: fonts.bold}}>
                              {formatMoney(effectiveMinor(p))}
                            </Text>
                          </View>
                          <Text style={{fontSize: 10, color: palette.success, fontFamily: fonts.medium}}>
                            توفّر {formatMoney(Math.max(0, p.price_minor - effectiveMinor(p)))}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* ─── بحث داخل المتجر ─── */}
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`ابحث داخل ${store?.name ?? 'المتجر'}…`}
                />
                <SectionTitle title={`المنتجات (${products.length})`} />

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
            ) : /* v3.0: تذييل نهاية القائمة — إشعار واضح أن الكتالوج
             * انتهى (لا لودر يدور بلا نهاية). */
            !loading && !productsError && products.length >= PRODUCTS_PAGE_SIZE && exhausted ? (
              <EndOfList label={`وصلت إلى كل منتجات ${store?.name ?? 'المتجر'}`} />
            ) : null}

            {/* ─── مراجعات المتجر — v3.1: انتقلت إلى أسفل المنتجات ───
             * كانت تُحقن بين عنوان «المنتجات» وشبكة المنتجات فتبدو
             * الصفحة «متداخلة ومتزاحمة خصوصاً عند وجود تقييمات».
             * الآن: المنتجات أولاً كأي متجر عالمي، والآراء أسفلها
             * ببطاقات مدمجة (سطر تعريف + سطر تعليق) بلا شرح مطوّل. */}
            {ratings != null && ratings.ratingCount > 0 && products.length > 0 ? (
              <View style={{padding: spacing.lg, gap: spacing.md, paddingTop: spacing.xl}}>
                <SectionTitle title={`آراء المشترين (${ratings.ratingCount})`} />
                <View
                  style={[
                    reviewStyles.summary,
                    {backgroundColor: palette.surface, borderColor: palette.line},
                  ]}>
                  <Stars rating={ratings.rating} count={ratings.ratingCount} size={15} />
                </View>
                {reviewsWithText.slice(0, 5).map((r, i) => (
                  <View
                    key={i}
                    style={[
                      reviewStyles.card,
                      {backgroundColor: palette.surface, borderColor: palette.line},
                    ]}>
                    <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm}}>
                      <Text style={{fontSize: 12.5, color: palette.ink, fontFamily: fonts.bold, flex: 1}} numberOfLines={1}>
                        {r.userName}
                      </Text>
                      <View style={[reviewStyles.verifiedChip, {backgroundColor: palette.successSoft}]}>
                        <Icon name="checkCircle" size={10} color={palette.success} />
                        <Text style={{fontSize: 9.5, color: palette.success, fontFamily: fonts.bold}}>
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
                    <Text style={[type.small, {color: palette.inkSoft, lineHeight: 19}]}>
                      {r.comment}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({item}) => (
          <ProductCard
            product={item}
            storeRef={storeRef}
            onPress={() => navigation.navigate('Product', {product: item, storeRef})}
          />
        )}
        style={{backgroundColor: palette.bg}}
      />
    </Screen>
  );
}

const heroStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  /* v3.1: حلقة زخرفية بيضاء شفافة فوق لون العلامة. */
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
  backBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
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

/* v2.1: بطاقة عرض داخل شريط «عروض المتجر» الأفقي */
const offerStyles = StyleSheet.create({
  card: {
    width: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
    alignItems: 'flex-start',
  },
  pct: {
    position: 'absolute',
    top: -10,
    left: 10,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

const reviewStyles = StyleSheet.create({
  summary: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  card: {
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
