/**
 * CategoryScreen.tsx — تصنيف واحد عبر كل المتاجر (v1.1):
 * فلتر category على الخادم + ترتيب محلي (الأحدث/الأرخص/الأغلى/
 * أبجدي) + كاش آخر لقطة عند ضعف الشبكة + شبكة بطاقات بالصور
 * لا نهائية التمرير.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {
  AppHeader,
  EmptyState,
  ErrorState,
  Loader,
  ProductGridSkeleton,
  Screen,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {getCrossProducts} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import type {CrossProduct} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'Category'>;

type SortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'name';

const SORTS: {key: SortKey; label: string; icon: IconName}[] = [
  {key: 'newest', label: 'الأحدث', icon: 'clock'},
  {key: 'priceAsc', label: 'الأرخص', icon: 'sort'},
  {key: 'priceDesc', label: 'الأغلى', icon: 'sort'},
  {key: 'name', label: 'أبجدي', icon: 'list'},
];

export function CategoryScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const {category} = route.params;

  const [products, setProducts] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const res = await cachedFetch(
      `category:${category}:p1`,
      () => getCrossProducts({category, page: 1, per: PRODUCTS_PAGE_SIZE}),
    );
    if (res.data != null) {
      setProducts(res.data);
      setPage(1);
      setStale(res.stale);
    } else if (res.error != null) {
      setError(res.error);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || error != null) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await getCrossProducts({category, page: page + 1, per: PRODUCTS_PAGE_SIZE});
      setProducts(prev => [...prev, ...next.filter(n => !prev.some(p => p.id === n.id && p.store_id === n.store_id))]);
      if (next.length > 0) {
        setPage(p => p + 1);
      }
    } catch {
      /* صمت */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, error, category, page]);

  const visible = useMemo(() => {
    switch (sort) {
      case 'priceAsc':
        return [...products].sort((a, b) => a.price_minor - b.price_minor);
      case 'priceDesc':
        return [...products].sort((a, b) => b.price_minor - a.price_minor);
      case 'name':
        return [...products].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      default:
        return products;
    }
  }, [products, sort]);

  return (
    <Screen>
      <AppHeader
        title={category}
        subtitle="من كل متاجر المول"
        onBack={() => navigation.goBack()}
        big
      />
      {/* الترتيب */}
      <View style={{paddingHorizontal: spacing.lg, paddingBottom: spacing.sm}}>
        <FlatList
          horizontal
          data={SORTS}
          keyExtractor={s => s.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap: spacing.sm}}
          renderItem={({item}) => (
            <Pressable
              onPress={() => setSort(item.key)}
              style={[
                styles.sortChip,
                {
                  backgroundColor: sort === item.key ? palette.brandSoft : palette.surface,
                  borderColor: sort === item.key ? palette.brandBorder : palette.line,
                },
              ]}>
              <Icon
                name={item.icon}
                size={13}
                color={sort === item.key ? palette.brandDark : palette.muted}
              />
              <Text
                style={[
                  {fontSize: 12, fontFamily: fonts.medium},
                  {color: sort === item.key ? palette.brandDark : palette.muted},
                ]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {stale && !loading ? (
        <View style={{paddingHorizontal: spacing.lg, paddingBottom: spacing.sm}}>
          <View style={[styles.staleNote, {backgroundColor: palette.warningSoft}]}>
            <Icon name="wifiOff" size={13} color={palette.warning} />
            <Text style={[type.tiny, {color: palette.inkSoft, flex: 1}]}>
              تعذّر التحديث — آخر لقطة محفوظة
            </Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={{padding: spacing.lg}}>
          <ProductGridSkeleton count={6} />
        </View>
      ) : error != null && products.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => `${item.store_id}:${item.id}`}
          numColumns={2}
          columnWrapperStyle={{gap: spacing.md, width: '100%', marginBottom: spacing.md, paddingHorizontal: spacing.lg}}
          contentContainerStyle={{paddingBottom: useStackBottomClearance()}}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            <Text style={[{fontSize: 11.5, color: palette.muted}, {paddingHorizontal: spacing.lg, marginBottom: spacing.sm}]}>
              {visible.length} منتجاً في «{category}»
            </Text>
          }
          ListEmptyComponent={
            <EmptyState
              icon="emptyBag"
              title="لا منتجات في هذا التصنيف حالياً"
              body="تُزامن المتاجر كتالوجاتها كل 15 دقيقة — عد لاحقاً"
              actionLabel="تصفح كل المتاجر"
              onAction={() => navigation.navigate('Stores')}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{paddingVertical: spacing.lg}}>
                <Loader label="نجلب المزيد…" />
              </View>
            ) : null
          }
          renderItem={({item}) => (
            <View style={{flex: 1, paddingHorizontal: 0}}>
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
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sortChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  staleNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
