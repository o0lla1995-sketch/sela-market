/**
 * StoreScreen.tsx — صفحة المتجر: ترويسة (الاسم/التصنيف/المنطقة/اتصال)،
 * مناطق التوصيل مع أرقامها، وبحث داخل المتجر + شبكة منتجاته بترقيم
 * صفحات لا نهائي.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, Linking, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loader,
  Screen,
  SearchBar,
  SectionTitle,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreAvatar} from '../../components/StoreCard';
import {getStoreDetail, getStoreProducts} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import {formatMoney} from '../../core/money';
import type {DeliveryRegion, Product, StoreDetail} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Store'>;

export function StoreScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const {storeId, storeName} = route.params;

  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const d = await getStoreDetail(storeId);
      setDetail(d);
      const p = await getStoreProducts(storeId, {per: PRODUCTS_PAGE_SIZE});
      setProducts(p);
      setPage(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل المتجر');
    } finally {
      setLoading(false);
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
    setLoadingMore(true);
    try {
      const next = await getStoreProducts(storeId, {page: page + 1, per: PRODUCTS_PAGE_SIZE});
      if (next.length > 0) {
        setProducts(prev => [...prev, ...next.filter(n => !prev.some(p => p.id === n.id))]);
        setPage(p => p + 1);
      }
    } catch {
      /* صمت */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, query, page, storeId]);

  const store = detail?.store;
  const regions: DeliveryRegion[] = detail?.deliveryRegions ?? [];

  return (
    <Screen>
      <AppHeader
        title={store?.name ?? storeName ?? 'المتجر'}
        subtitle={store ? `${store.store_number} · ${store.category ?? 'متجر'}` : undefined}
        onBack={() => navigation.goBack()}
      />

      {loading && detail == null ? (
        <Loader label="ندخل المتجر…" />
      ) : error != null && detail == null ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{gap: spacing.md, width: '100%'}}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            <View style={{gap: spacing.lg}}>
              {/* بطاقة المتجر */}
              <Card style={{gap: spacing.md}}>
                <View style={storeStyles.topRow}>
                  <StoreAvatar name={store?.name ?? 'س'} size={62} />
                  <View style={{flex: 1, gap: 3, alignItems: 'flex-start'}}>
                    <Text style={[type.h2, {color: palette.ink}]}>{store?.name}</Text>
                    <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
                      {store?.region ? (
                        <>
                          <Icon name="pin" size={13} color={palette.muted} />
                          <Text style={[{fontSize: 12, color: palette.muted}]}>
                            {store.region}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
                {store?.description ? (
                  <Text style={[type.small, {color: palette.inkSoft, lineHeight: 21}]}>
                    {store.description}
                  </Text>
                ) : null}
                {/* اتصال */}
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
              </Card>

              {/* مناطق التوصيل */}
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

              {/* بحث داخل المتجر */}
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder={`ابحث داخل ${store?.name ?? 'المتجر'}…`}
              />
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'}}>
                <SectionTitle title={`المنتجات (${products.length}${loadingMore ? '+' : ''})`} />
                {query.trim().length > 0 ? (
                  <Chip label="مسح البحث" icon="close" onPress={() => setQuery('')} />
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
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
              storeRef={{
                id: storeId,
                name: store?.name ?? storeName ?? 'المتجر',
                storeNumber: store?.store_number,
              }}
              onPress={() =>
                navigation.navigate('Product', {
                  product: item,
                  storeRef: {
                    id: storeId,
                    name: store?.name ?? storeName ?? 'المتجر',
                    storeNumber: store?.store_number,
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

const storeStyles = StyleSheet.create({
  topRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
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
