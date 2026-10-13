/**
 * StoresScreen.tsx — دليل متاجر المول (v2.2): بحث محلي فوري + أقسام
 * حسب التصنيف + **فلترة مناطق ذكية**: شرائح كل مناطق التوصيل المتاحة
 * عبر المول (من الخادم) — أي مستخدم (زائر أو عضو، ومن دون تحديد
 * منطقته) يستطيع تصفح متاجر أي منطقة ومقارنة رسوم توصيلها؛ منطقة
 * المستخدم تُعلَّم بشارة «منطقتي» وتُقدَّم أولاً.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Chip, ErrorState, Loader, Screen, AppHeader, EmptyState} from '../../components/ui';
import {StoreCard} from '../../components/StoreCard';
import {getStores, getDeliveryRegions} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import type {Store} from '../../core/types';
import {useLocationStore} from '../../stores/locationStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useTabBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'Stores'>;

export function StoresScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const tabClearance = useTabBottomClearance();
  const myRegion = useLocationStore(s => s.myRegion);
  const [stores, setStores] = useState<Store[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [regionStores, setRegionStores] = useState<Store[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    // كاش أولاً: آخر لقطة تُعرض حتى عند فشل التحديث (بلا شاشة خطأ).
    const [allRes, regionsRes] = await Promise.all([
      cachedFetch('stores', () => getStores()),
      cachedFetch('market:regions', () => getDeliveryRegions()),
    ]);
    if (allRes.data != null) {
      setStores(allRes.data);
    } else if (allRes.error != null) {
      setError(allRes.error);
    }
    if (regionsRes.data != null) {
      setRegions(regionsRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* جلب متاجر المنطقة المختارة — كاش لكل منطقة على حدة. */
  useEffect(() => {
    let alive = true;
    if (selectedRegion == null) {
      setRegionStores([]);
      return;
    }
    setRegionLoading(true);
    (async () => {
      const res = await cachedFetch(`stores:region:${selectedRegion}`, () =>
        getStores({region: selectedRegion}),
      );
      if (alive) {
        if (res.data != null) {
          setRegionStores(res.data);
        } else {
          setRegionStores([]);
        }
        setRegionLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedRegion]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    stores.forEach(s => {
      if (s.category && s.category.trim()) {
        set.add(s.category.trim());
      }
    });
    return Array.from(set).slice(0, 12);
  }, [stores]);

  /* منطقة المستخدم أولاً ثم بقية المناطق أبجدياً — وصول أسرع
   * لأهم خيار دون فرضه على المستخدم. */
  const orderedRegions = useMemo(() => {
    if (myRegion == null || !regions.includes(myRegion)) {
      return regions;
    }
    return [myRegion, ...regions.filter(r => r !== myRegion)];
  }, [regions, myRegion]);

  const filtered = useMemo(() => {
    let list = selectedRegion != null ? regionStores : stores;
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
  }, [stores, regionStores, selectedRegion, category, query]);

  return (
    <Screen>
      <AppHeader
        title="متاجر المول"
        subtitle={
          selectedRegion != null
            ? `تخدم ${selectedRegion} — الأرخص توصيلاً أولاً`
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

        {/* v2.2: فلترة المناطق الذكية — كل المناطق بلا اشتراط تحديد
         * منطقة المستخدم؛ منطقته تُعلَّم وتُقدَّم أولاً. */}
        {regions.length > 0 ? (
          <FlatList
            horizontal
            data={orderedRegions}
            keyExtractor={r => r}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: spacing.sm, paddingVertical: spacing.xs}}
            renderItem={({item}) => {
              const active = selectedRegion === item;
              const mine = item === myRegion;
              return (
                <Pressable
                  onPress={() => setSelectedRegion(active ? null : item)}
                  style={({pressed}) => [
                    styles.regionChip,
                    {
                      backgroundColor: active ? palette.brand : palette.surface,
                      borderColor: active ? palette.brand : mine ? palette.brandBorder : palette.line,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  {mine ? (
                    <Icon
                      name="pin"
                      size={12}
                      color={active ? '#FFFFFF' : palette.brandDark}
                    />
                  ) : (
                    <Icon
                      name="truck"
                      size={12}
                      color={active ? '#FFFFFF' : palette.muted}
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bold,
                      color: active ? '#FFFFFF' : mine ? palette.brandDark : palette.inkSoft,
                    }}>
                    {item}
                    {mine ? ' · منطقتي' : ''}
                  </Text>
                </Pressable>
              );
            }}
          />
        ) : null}

        {categories.length > 0 ? (
          <FlatList
            horizontal
            data={categories}
            keyExtractor={c => c}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: spacing.sm, paddingVertical: spacing.xs}}
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
      ) : selectedRegion != null && regionLoading ? (
        <Loader label={`نجلب متاجر تخدم ${selectedRegion}…`} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: tabClearance}}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            selectedRegion != null && regionStores.length === 0 ? (
              <EmptyState
                icon="truck"
                title={`لا متاجر تخدم «${selectedRegion}» حالياً`}
                body="جرّب تصفح كل المتاجر أو اختر منطقة أخرى — التجار يضيفون مناطق توصيل جديدة باستمرار"
                actionLabel="تصفح كل المتاجر"
                onAction={() => setSelectedRegion(null)}
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
              myRegion={selectedRegion}
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
  regionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
