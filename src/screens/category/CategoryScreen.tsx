/**
 * CategoryScreen.tsx — تصنيف واحد عبر كل المتاجر (فلتر category على
 * /api/market/products — خادم v4.1) بشبكة لا نهائية.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type} from '../../theme/tokens';
import {EmptyState, ErrorState, Loader, Screen, AppHeader} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {getCrossProducts} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import type {CrossProduct} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Category'>;

export function CategoryScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const {category} = route.params;

  const [products, setProducts] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setProducts(await getCrossProducts({category, page: 1, per: PRODUCTS_PAGE_SIZE}));
      setPage(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل التصنيف');
    } finally {
      setLoading(false);
    }
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

  return (
    <Screen>
      <AppHeader
        title={category}
        subtitle="من كل متاجر المول"
        onBack={() => navigation.goBack()}
        big
      />
      {loading ? (
        <Loader />
      ) : error != null ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => `${item.store_id}:${item.id}`}
          numColumns={2}
          columnWrapperStyle={{gap: spacing.md, width: '100%'}}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            <EmptyState
              icon="emptyBag"
              title="لا منتجات في هذا التصنيف حالياً"
              body="يزامن التجار كتالوجاتهم كل 15 دقيقة — عد لاحقاً"
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
