/**
 * StoreTypeScreen.tsx — قسم حسب نوع المتجر (v3.4 — الجولة 64):
 * ─────────────────────────────────────────────────────────────────
 *  • طلب المستخدم الأهم: «تقسيم لأنواع المتاجر حيث يمكن الانتقال
 *    لتصفح منتجات القسم بالكامل» — هذه شاشة التصفح الكامل لقسم
 *    واحد (مطاعم / بقالة / ملابس …).
 *  • شريط علوي: بطاقات دائرية لمتاجر القسم (انتقال مباشر لأي متجر).
 *  • شبكة منتجات القسم: جلب دوّار عادل بين متاجر القسم — كل جولة
 *    تجلب دفعة من المتجر الأقل جلباً (تدوير عادل يخلط المنتجات
 *    بين المتاجر بدل كتلة متجر واحد ثم كتلة آخر)، حتى استنفاد
 *    كل متاجر القسم بتذييل واضح.
 *  • لا أي منظومة أصلية خاصة: نفس آليات v3.1.0 المُثبتة فقط.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing} from '../../theme/tokens';
import {
  AppHeader,
  EmptyState,
  EndOfList,
  ErrorState,
  Loader,
  ProductGridSkeleton,
  Screen,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {CircleStoreCard, storeTypeInfo} from '../../components/StoreCard';
import {getStores, getStoreProducts} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import type {Product, Store} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'StoreType'>;

/** عنصر الشبكة: المنتج + متجره الأصلي (لبناء storeRef للبطاقة). */
type Entry = {key: string; product: Product; store: Store};

const FIRST_ROUND_PER = 6;
const MORE_PER = 8;

export function StoreTypeScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const stackClearance = useStackBottomClearance();
  const {type} = route.params;

  const [stores, setStores] = useState<Store[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* مؤشرات جلب دوّار عادل لكل متجر: الصفحة القادمة والعدد المُجلب
   * ومجموعة المستنفَدين — في مراجع بلا أي إعادة رندر عند التحديث. */
  const cursors = useRef<Map<number, number>>(new Map());
  const fetchedCounts = useRef<Map<number, number>>(new Map());
  const doneStores = useRef<Set<number>>(new Set());
  const seen = useRef<Set<string>>(new Set());

  const allExhausted = useMemo(
    () => stores.length > 0 && doneStores.current.size >= stores.length,
    [stores, entries],
  );

  /* جلب دفعة من متجر واحد وتحديث مؤشراته. */
  const fetchFromStore = useCallback(
    async (store: Store, per: number): Promise<Product[]> => {
      const page = cursors.current.get(store.id) ?? 1;
      const batch = await getStoreProducts(store.id, {page, per});
      cursors.current.set(store.id, page + 1);
      fetchedCounts.current.set(
        store.id,
        (fetchedCounts.current.get(store.id) ?? 0) + batch.length,
      );
      if (batch.length < per) {
        doneStores.current.add(store.id);
      }
      return batch;
    },
    [],
  );

  /* التحميل الأول: قائمة متاجر القسم + جولة افتتاحية من أفضل
   * ثلاثة متاجر (الأعلى تقييماً) بتفاعل دائري بينها. */
  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    cursors.current = new Map();
    fetchedCounts.current = new Map();
    doneStores.current = new Set();
    seen.current = new Set();
    setEntries([]);
    const res = await cachedFetch('stores', () => getStores());
    if (res.data == null) {
      setError(res.error ?? 'تعذر تحميل القسم');
      setLoading(false);
      return;
    }
    const sectionStores = res.data.filter(
      s => storeTypeInfo(s.category).label === type,
    );
    /* الأعلى تقييماً أولاً — «أحدث وأفضل» يبدأ من أفضل المتاجر. */
    sectionStores.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    setStores(sectionStores);
    if (sectionStores.length === 0) {
      setLoading(false);
      return;
    }
    try {
      const top = sectionStores.slice(0, 3);
      const batches = await Promise.all(
        top.map(s => fetchFromStore(s, FIRST_ROUND_PER).catch(() => [] as Product[])),
      );
      /* تدوير دائري: منتج من كل متجر بالتناوب — تنويع بصري فوري. */
      const merged: Entry[] = [];
      const maxLength = Math.max(...batches.map(b => b.length));
      for (let i = 0; i < maxLength; i += 1) {
        top.forEach((store, si) => {
          const p = batches[si]?.[i];
          if (p != null) {
            const key = `${store.id}:${p.id}`;
            if (!seen.current.has(key)) {
              seen.current.add(key);
              merged.push({key, product: p, store});
            }
          }
        });
      }
      setEntries(merged);
    } catch {
      /* الجولة الافتتاحية ليست حرجة — loadMore يكمل البقية */
    }
    setLoading(false);
  }, [type, fetchFromStore]);

  useEffect(() => {
    void load();
  }, [load]);

  /* جولة إضافية: المتجر غير المستنفد الأقل جلباً — عدالة التدوير. */
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || stores.length === 0) {
      return;
    }
    const candidates = stores.filter(s => !doneStores.current.has(s.id));
    if (candidates.length === 0) {
      return;
    }
    let pick = candidates[0];
    let minCount = fetchedCounts.current.get(pick.id) ?? 0;
    for (const s of candidates) {
      const c = fetchedCounts.current.get(s.id) ?? 0;
      if (c < minCount) {
        pick = s;
        minCount = c;
      }
    }
    setLoadingMore(true);
    try {
      const batch = await fetchFromStore(pick, MORE_PER);
      setEntries(prev => {
        const next = [...prev];
        for (const p of batch) {
          const key = `${pick.id}:${p.id}`;
          if (!seen.current.has(key)) {
            seen.current.add(key);
            next.push({key, product: p, store: pick});
          }
        }
        return next;
      });
    } catch {
      /* متجر متعثر لا يوقف القسم — علامته مستنفدة لتفادي التكرار */
      doneStores.current.add(pick.id);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, stores, fetchFromStore]);

  return (
    <Screen>
      <AppHeader
        title={type}
        subtitle={stores.length > 0 ? `${stores.length} متجراً في القسم` : undefined}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={{padding: spacing.lg}}>
          <ProductGridSkeleton />
        </View>
      ) : error != null && stores.length === 0 ? (
        <View style={{padding: spacing.lg}}>
          <ErrorState message={error} onRetry={load} />
        </View>
      ) : stores.length === 0 ? (
        <EmptyState
          icon="store"
          title="لا متاجر في هذا القسم بعد"
          body="حالما يفعّل تجار هذا النشاط البيع أونلاين ستظهر متاجرهم هنا"
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.key}
          numColumns={2}
          columnWrapperStyle={{gap: spacing.md, width: '100%'}}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: stackClearance,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            /* شريط متاجر القسم — انتقال مباشر لأي متجر من القسم */
            stores.length > 1 ? (
              <FlatList
                horizontal
                data={stores}
                keyExtractor={s => `s${s.id}`}
                showsHorizontalScrollIndicator={false}
                snapToInterval={78 + spacing.md}
                decelerationRate="fast"
                contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
                style={{marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg}}
                renderItem={({item}) => (
                  <CircleStoreCard
                    store={item}
                    onPress={() =>
                      navigation.navigate('Store', {storeId: item.id, storeName: item.name})
                    }
                  />
                )}
              />
            ) : null
          }
          ListEmptyComponent={
            !loading && error == null ? (
              <EmptyState
                icon="emptyBag"
                title="لا منتجات منشورة في هذا القسم"
                body="متاجر القسم لم تنشر منتجاتها بعد — عد لاحقاً"
              />
            ) : null
          }
          ListFooterComponent={
            <View>
              {loadingMore ? (
                <View style={{paddingVertical: spacing.lg}}>
                  <Loader label="نجلب المزيد…" />
                </View>
              ) : allExhausted && entries.length > 0 ? (
                <EndOfList label={`كل منتجات قسم ${type}`} />
              ) : null}
            </View>
          }
          renderItem={({item}) => (
            <ProductCard
              product={item.product}
              storeRef={{
                id: item.store.id,
                name: item.store.name,
                storeNumber: item.store.store_number,
              }}
              onPress={() =>
                navigation.navigate('Product', {
                  product: item.product,
                  storeRef: {
                    id: item.store.id,
                    name: item.store.name,
                    storeNumber: item.store.store_number,
                  },
                })
              }
            />
          )}
          style={{backgroundColor: palette.bg}}
        />
      )}
    </Screen>
  );
}
