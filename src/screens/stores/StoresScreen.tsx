/**
 * StoresScreen.tsx — دليل متاجر المول: بحث محلي فوري (قائمة ≤500
 * محمّلة كاملة) + أقسام حسب التصنيف عبر فلاتر سريعة.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type} from '../../theme/tokens';
import {Chip, ErrorState, Loader, Screen, AppHeader, EmptyState} from '../../components/ui';
import {StoreCard} from '../../components/StoreCard';
import {getStores} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import {ApiError} from '../../api/client';
import type {Store} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Stores'>;

export function StoresScreen({navigation}: Props) {
  const {palette} = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    // كاش أولاً: آخر لقطة تُعرض حتى عند فشل التحديث (بلا شاشة خطأ).
    const res = await cachedFetch('stores', () => getStores());
    if (res.data != null) {
      setStores(res.data);
    } else if (res.error != null) {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    stores.forEach(s => {
      if (s.category && s.category.trim()) {
        set.add(s.category.trim());
      }
    });
    return Array.from(set).slice(0, 12);
  }, [stores]);

  const filtered = useMemo(() => {
    let list = stores;
    if (category != null) {
      list = list.filter(s => (s.category ?? '').trim() === category);
    }
    const q = query.trim();
    if (q.length > 0) {
      list = list.filter(
        s =>
          s.name.includes(q) ||
          (s.description ?? '').includes(q) ||
          (s.region ?? '').includes(q),
      );
    }
    return list;
  }, [stores, category, query]);

  return (
    <Screen>
      <AppHeader
        title="متاجر المول"
        subtitle={`${stores.length} متجراً منشوراً الآن`}
        big
      />
      <View style={styles.controls}>
        {/* بحث محلي */}
        <Chip
          label={query.length > 0 ? `بحث: ${query}` : 'اكتب للبحث عن متجر…'}
          icon="search"
          active={query.length > 0}
          onPress={() => navigation.navigate('Search')}
        />
        {categories.length > 0 ? (
          <FlatList
            horizontal
            data={categories}
            keyExtractor={c => c}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: spacing.sm, paddingVertical: spacing.sm}}
            renderItem={({item}) => (
              <Chip
                label={item}
                active={category === item}
                onPress={() => setCategory(category === item ? null : item)}
              />
            )}
          />
        ) : null}
      </View>

      {loading ? (
        <Loader label="نجلب المتاجر…" />
      ) : error != null ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md}}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="store"
              title={stores.length === 0 ? 'لا متاجر منشورة بعد' : 'لا نتائج مطابقة'}
              body={
                stores.length === 0
                  ? 'حالما يفعّل التجار البيع أونلاين من نقاط بيع سيلا ستظهر متاجرهم هنا فوراً'
                  : 'جرّب كلمة أبسط أو أزل فلتر التصنيف'
              }
            />
          }
          renderItem={({item}) => (
            <StoreCard
              store={item}
              onPress={() =>
                navigation.navigate('Store', {storeId: item.id, storeName: item.name})
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
});
