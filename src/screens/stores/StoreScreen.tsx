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
    // المنتجات بجلب متدرج (سلم 12→6→3→1 عند تعثر الشبكة) — وخطأها
    // يظهر داخل قسم المنتجات مع زر إعادة محاولة بدل عدّاد 0+ صامت.
    try {
      const p = await getStoreProductsAdaptive(storeId, PRODUCTS_PAGE_SIZE);
      setProducts(p);
      setPage(1);
      setProductsError(null);
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

  /* بحث داخل المتجر (q على الخادم — دقيق ومفهرس). */
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const p = await getStoreProducts(storeId, {
          q: query.trim() || undefined,
          per: PRODUCTS_PAGE_SIZE,
        });
        setProducts(p);
        setPage(1);
      } catch {
        /* تجاهل أخطاء الكتابة السريعة */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, storeId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || query.trim().length > 0) {
      return;
    }
    if (productsError != null) {
      // الجلب الأول تعثر — زر «المزيد» يعيد المحاولة بدل التكرار الأعمى
      try {
        const p = await getStoreProductsAdaptive(storeId, PRODUCTS_PAGE_SIZE);
        setProducts(p);
        setPage(1);
        setProductsError(null);
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
      // v2.1: جلب شامل بجلب متدرج — يعيد القائمة الموسعة كاملة (idempotent)
      // بدل حساب الإزاحات مع أحجام per متغيرة.
      const next = await getStoreProductsAdaptive(
        storeId,
        products.length + PRODUCTS_PAGE_SIZE,
      );
      if (next.length > products.length) {
        setProducts(next);
        setPage(p => p + 1);
      }
    } catch {
      /* صمت */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, products, productsError, storeId]);

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
            {/* ─── الترويسة البطولية ─── */}
            <View style={[heroStyles.wrap, {backgroundColor: palette.brandSoft}]}>
              <View style={[heroStyles.ring, {borderColor: palette.brandBorder}]} />
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={10}
                style={[heroStyles.backBtn, {backgroundColor: palette.surface}]}>
                <Icon
                  name={I18nManager.isRTL ? 'back' : 'forward'}
                  size={20}
                  color={palette.ink}
                />
              </Pressable>
              <StoreAvatar name={store?.name ?? storeName ?? 'س'} logoUrl={store?.logo_url} size={86} />
              <Text style={[type.h1, {color: palette.ink, fontFamily: fonts.black}]}>
                {store?.name ?? storeName ?? 'المتجر'}
              </Text>
              <View style={heroStyles.badgesRow}>
                <View style={[heroStyles.badge, {backgroundColor: palette.surface}]}>
                  <Icon name={typeInfo.icon} size={12} color={palette.brandDark} />
                  <Text style={{fontSize: 11.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                    {typeInfo.label}
                  </Text>
                </View>
                {store?.region ? (
                  <View style={[heroStyles.badge, {backgroundColor: palette.surface}]}>
                    <Icon name="pin" size={12} color={palette.muted} />
                    <Text style={{fontSize: 11.5, color: palette.inkSoft}} numberOfLines={1}>
                      {store.region}
                    </Text>
                  </View>
                ) : null}
                {store?.store_number ? (
                  <View style={[heroStyles.badge, {backgroundColor: palette.surface}]}>
                    <Icon name="checkCircle" size={12} color={palette.success} />
                    <Text style={{fontSize: 11.5, color: palette.inkSoft}}>
                      موثّق · {store.store_number}
                    </Text>
                  </View>
                ) : null}
              </View>
              {/* التقييم */}
              {store?.rating != null && store.rating > 0 ? (
                <View style={[heroStyles.ratingBox, {backgroundColor: palette.surface}]}>
                  <Stars rating={store.rating} size={16} />
                  <Text style={{fontSize: 12, color: palette.muted}}>
                    {store.rating} من 5 · {store.ratingCount} تقييماً من مشترين حقيقيين
                  </Text>
                </View>
              ) : (
                <Text style={{fontSize: 11.5, color: palette.muted}}>
                  متجر جديد على المول — كن أول من يقيّمه بعد أول طلب
                </Text>
              )}
              {store?.description ? (
                <Text
                  style={[type.small, {color: palette.inkSoft, textAlign: 'center', lineHeight: 21}]}>
                  {store.description}
                </Text>
              ) : null}
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

                {/* ─── شريط الإحصاءات ─── */}
                <View style={[statsStyles.row, {backgroundColor: palette.surface, borderColor: palette.line}, shadowFor(palette.isDark)]}>
                  <View style={statsStyles.cell}>
                    <Text style={[type.h2, {color: palette.brandDark}]}>
                      {loading ? '…' : products.length}
                    </Text>
                    <Text style={{fontSize: 10.5, color: palette.muted}}>منتجاً</Text>
                  </View>
                  <View style={[statsStyles.divider, {backgroundColor: palette.line}]} />
                  <View style={statsStyles.cell}>
                    <Text style={[type.h2, {color: palette.brandDark}]}>{regions.length}</Text>
                    <Text style={{fontSize: 10.5, color: palette.muted}}>مناطق توصيل</Text>
                  </View>
                  <View style={[statsStyles.divider, {backgroundColor: palette.line}]} />
                  <View style={statsStyles.cell}>
                    <Text style={[type.h2, {color: palette.brandDark}]}>
                      {store?.rating != null && store.rating > 0 ? store.rating : 'جديد'}
                    </Text>
                    <Text style={{fontSize: 10.5, color: palette.muted}}>
                      {store?.rating != null && store.rating > 0 ? `من 5 (${store.ratingCount})` : 'تقييم'}
                    </Text>
                  </View>
                </View>

                {/* ─── مناطق التوصيل ─── */}
                {regions.length > 0 ? (
                  <View style={{gap: spacing.sm}}>
                    <SectionTitle title="مناطق التوصيل وأسعارها" />
                    <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm}}>
                      {regions.map(r => (
                        <View
                          key={r.name}
                          style={[
                            regionStyles.chip,
                            {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
                          ]}>
                          <Icon name="truck" size={14} color={palette.brandDark} />
                          <Text style={[{fontSize: 12.5, color: palette.ink, fontFamily: fonts.medium}]}>
                            {r.name}
                          </Text>
                          <Text style={[{fontSize: 12.5, color: palette.brandDark, fontFamily: fonts.bold}]}>
                            {formatMoney(r.fee_minor)}
                          </Text>
                        </View>
                      ))}
                    </View>
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

                {/* ─── مراجعات المتجر ─── */}
                {ratings != null && ratings.ratingCount > 0 ? (
                  <View style={{gap: spacing.md, marginTop: spacing.sm}}>
                    <SectionTitle title={`آراء المشترين (${ratings.ratingCount})`} />
                    <View
                      style={[
                        reviewStyles.summary,
                        {backgroundColor: palette.surface, borderColor: palette.line},
                        shadowFor(palette.isDark),
                      ]}>
                      <Stars rating={ratings.rating} count={ratings.ratingCount} size={17} />
                      <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
                        متوسط تقييم المتجر من طلبات مكتملة — التقييم بعد استلام
                        الطلب فقط لضمان آراء حقيقية
                      </Text>
                    </View>
                    {reviewsWithText.slice(0, 5).map((r, i) => (
                      <View
                        key={i}
                        style={[
                          reviewStyles.card,
                          {backgroundColor: palette.surface, borderColor: palette.line},
                        ]}>
                        <View style={{flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'}}>
                          <View style={{gap: 3}}>
                            <Text style={{fontSize: 12.5, color: palette.ink, fontFamily: fonts.bold}}>
                              {r.userName}
                            </Text>
                            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4}}>
                              <Stars rating={r.stars} size={12} compact />
                              <Text style={{fontSize: 10.5, color: palette.muted}}>
                                · {relativeTime(r.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <View style={[reviewStyles.verifiedChip, {backgroundColor: palette.successSoft}]}>
                            <Icon name="checkCircle" size={10} color={palette.success} />
                            <Text style={{fontSize: 9.5, color: palette.success, fontFamily: fonts.bold}}>
                              شراء موثّق
                            </Text>
                          </View>
                        </View>
                        <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20}]}>
                          {r.comment}
                        </Text>
                      </View>
                    ))}
                  </View>
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
          loadingMore ? (
            <View style={{paddingVertical: spacing.lg}}>
              <Loader label="نجلب المزيد…" />
            </View>
          ) : null
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
  ring: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 26,
    opacity: 0.5,
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
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ratingBox: {
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});

const statsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  cell: {flex: 1, alignItems: 'center', gap: 1},
  divider: {width: 1, height: 34},
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
