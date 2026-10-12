/**
 * SearchScreen.tsx — البحث العابر للمتاجر (خادم v4.1: q على
 * /api/market/products): بحث فوري أثناء الكتابة + سجل البحث الحديث +
 * أقسام مقترحة. النتائج بشبكة لا نهائية مع اسم متجر كل منتج.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  EmptyState,
  ErrorState,
  Loader,
  Screen,
  SearchBar,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {getCrossProducts} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import type {CrossProduct} from '../../core/types';
import {useRecentsStore} from '../../stores/recentsStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Search'>;

export function SearchScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const initialQuery = route.params?.initialQuery ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);

  const recent = useRecentsStore(s => s.searches);
  const addRecent = useRecentsStore(s => s.add);
  const removeRecent = useRecentsStore(s => s.remove);
  const clearRecent = useRecentsStore(s => s.clear);

  const search = useCallback(async (q: string, pageNo = 1) => {
    const clean = q.trim();
    if (clean.length < 2) {
      setResults([]);
      setSubmittedQuery('');
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const products = await getCrossProducts({q: clean, page: pageNo, per: PRODUCTS_PAGE_SIZE});
      setResults(prev => (pageNo === 1 ? products : [...prev, ...products]));
      setPage(pageNo);
      setSubmittedQuery(clean);
      if (pageNo === 1) {
        addRecent(clean);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر البحث');
    } finally {
      setSearching(false);
    }
  }, [addRecent]);

  /* بحث تلقائي عند التوقف عن الكتابة */
  useEffect(() => {
    const t = setTimeout(() => {
      void search(query, 1);
    }, 400);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    if (initialQuery) {
      void search(initialQuery, 1);
    }
  }, [initialQuery, search]);

  const loadMore = useCallback(async () => {
    if (loadingMore || searching || submittedQuery.length < 2) {
      return;
    }
    setLoadingMore(true);
    try {
      await search(submittedQuery, page + 1);
    } catch {
      /* صمت */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, searching, submittedQuery, page, search]);

  const showRecent = query.trim().length < 2 && recent.length > 0;

  return (
    <Screen>
      <View style={{padding: spacing.lg, paddingBottom: spacing.md}}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          autoFocus={!initialQuery}
          onSubmit={() => void search(query, 1)}
        />
      </View>

      {showRecent ? (
        <FlatList
          data={recent}
          keyExtractor={r => r}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.xs}}
          ListHeaderComponent={
            <View style={recentStyles.head}>
              <Text style={[type.h3, {color: palette.ink}]}>بحثك الأخير</Text>
              <Pressable onPress={clearRecent} hitSlop={8}>
                <Text style={[{fontSize: 12, color: palette.danger}]}>مسح الكل</Text>
              </Pressable>
            </View>
          }
          renderItem={({item}) => (
            <Pressable
              onPress={() => setQuery(item)}
              style={({pressed}) => [
                recentStyles.row,
                {backgroundColor: pressed ? palette.surfaceAlt : palette.surface, borderColor: palette.line},
              ]}>
              <Icon name="clock" size={16} color={palette.muted} />
              <Text style={[type.small, {color: palette.ink, flex: 1, textAlign: 'right'}]}>
                {item}
              </Text>
              <Pressable onPress={() => removeRecent(item)} hitSlop={10}>
                <Icon name="close" size={15} color={palette.muted} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : searching && results.length === 0 ? (
        <Loader label={`نبحث عن «${query.trim()}» في كل المتاجر…`} />
      ) : error != null ? (
        <ErrorState message={error} onRetry={() => void search(query, 1)} />
      ) : submittedQuery.length >= 2 && results.length === 0 ? (
        <EmptyState
          icon="search"
          title={`لا نتائج لـ «${submittedQuery}»`}
          body="تأكد من الإملاء أو جرّب كلمة أعم — البحث يشمل أسماء المنتجات في كل متاجر المول المنشورة"
          actionLabel="تصفح المتاجر"
          onAction={() => navigation.navigate('Stores')}
        />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={item => `${item.store_id}:${item.id}`}
          numColumns={2}
          columnWrapperStyle={{gap: spacing.md, width: '100%'}}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            <Text style={[{fontSize: 12, color: palette.muted, fontFamily: fonts.medium}]}>
              نتائج «{submittedQuery}» من كل متاجر المول ({results.length}
              {loadingMore ? '+' : ''})
            </Text>
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
      ) : (
        <EmptyState
          icon="search"
          title="ابحث في كل متاجر المول"
          body="اكتب حرفين على الأقل — مثلاً: أرز، زيت، طماطم… والنتائج من كل المتاجر المنشورة"
        />
      )}
    </Screen>
  );
}

const recentStyles = StyleSheet.create({
  head: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
});
