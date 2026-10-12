/**
 * StoresScreen.tsx — دليل متاجر المول (v2.0): بحث محلي فوري +
 * أقسام حسب التصنيف + فلتر منطقتك (متاجر تخدم منطقتك مرتبة برسم
 * التوصيل الأرخص أولاً مع رسم كل متجر — مقارنة حقيقية بين المتاجر).
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Chip, ErrorState, Loader, Screen, AppHeader, EmptyState} from '../../components/ui';
import {StoreCard} from '../../components/StoreCard';
import {getStores} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import {ApiError} from '../../api/client';
import type {Store} from '../../core/types';
import {useLocationStore} from '../../stores/locationStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Stores'>;

export function StoresScreen({navigation}: Props) {
  const {palette} = useTheme();
  const myRegion = useLocationStore(s => s.myRegion);
  const [stores, setStores] = useState<Store[]>([]);
  const [regionStores, setRegionStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [regionMode, setRegionMode] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    // كاش أولاً: آخر لقطة تُعرض حتى عند فشل التحديث (بلا شاشة خطأ).
    const [allRes, regionRes] = await Promise.all([
      cachedFetch('stores', () => getStores()),
      useLocationStore.getState().myRegion != null
        ? cachedFetch(
            `stores:region:${useLocationStore.getState().myRegion}`,
            () => getStores({region: useLocationStore.getState().myRegion!}),
          )
        : Promise.resolve(null),
    ]);
    if (allRes.data != null) {
      setStores(allRes.data);
    } else if (allRes.error != null) {
      setError(allRes.error);
    }
    if (regionRes?.data != null) {
      setRegionStores(regionRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* مزامنة قائمة المنطقة عند تغيّر منطقة المستخدم. */
  useEffect(() => {
    let alive = true;
    if (myRegion == null) {
      setRegionStores([]);
      if (regionMode) {
        setRegionMode(false);
      }
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
  }, [myRegion, regionMode]);

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
    // وضع منطقتي: متاجر تخدم منطقتي مرتبة من الخادم برسم التوصيل
    // الأرخص أولاً — مقارنة حقيقية بين المتاجر.
    let list = regionMode ? regionStores : stores;
    if (!regionMode && category != null) {
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
  }, [stores, regionStores, regionMode, category, query]);

  return (
    <Screen>
      <AppHeader
        title="متاجر المول"
        subtitle={
          regionMode
            ? `تخدم ${myRegion} — الأرخص توصيلاً أولاً`
            : `${stores.length} متجراً منشوراً الآن`
        }
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
        {/* فلتر منطقتي — متاح فقط عند تحديد منطقة */}
        {myRegion != null ? (
          <Pressable
            onPress={() => setRegionMode(!regionMode)}
            style={({pressed}) => [
              styles.regionToggle,
              {
                backgroundColor: regionMode ? palette.brand : palette.surface,
                borderColor: regionMode ? palette.brand : palette.line,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Icon
              name="truck"
              size={13}
              color={regionMode ? '#FFFFFF' : palette.brandDark}
            />
            <Text
              style={{
                fontSize: 12,
                fontFamily: fonts.bold,
                color: regionMode ? '#FFFFFF' : palette.brandDark,
              }}>
              تخدم منطقتي ({myRegion})
            </Text>
          </Pressable>
        ) : null}
        {!regionMode && categories.length > 0 ? (
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
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl}}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            regionMode && regionStores.length === 0 ? (
              <EmptyState
                icon="truck"
                title={`لا متاجر تخدم «${myRegion}» حالياً`}
                body="جرّب إلغاء فلتر المنطقة لتصفح كل متاجر المول، أو غيّر منطقتك من الرئيسية"
                actionLabel="تصفح كل المتاجر"
                onAction={() => setRegionMode(false)}
              />
            ) : (
              <EmptyState
                icon="store"
                title={stores.length === 0 ? 'لا متاجر منشورة بعد' : 'لا نتائج مطابقة'}
                body={
                  stores.length === 0
                    ? 'حالما يفعّل التجار البيع أونلاين من نقاط بيع سيلا ستظهر متاجرهم هنا فوراً'
                    : 'جرّب كلمة أبسط أو أزل فلتر التصنيف'
                }
              />
            )
          }
          renderItem={({item}) => (
            <StoreCard
              store={item}
              myRegion={regionMode ? myRegion : null}
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
  regionToggle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginVertical: 4,
  },
});
