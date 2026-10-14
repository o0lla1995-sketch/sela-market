/**
 * SearchScreen.tsx — البحث العابر للمتاجر (v1.1 — فلاتر احترافية):
 * بحث فوري أثناء الكتابة + سجل حديث + شيت فلاتر كامل:
 *   • التصنيف (من الخادم) والمتجر ونطاق السعر (شيكل) والوزن فقط
 *   • ترتيب: الأحدث / الأرخص / الأغلى / أبجدي
 * التصنيف والاستعلام على الخادم؛ البقية تُطبق محلياً على النتائج
 * المجلبة مع استمرار التمرير لجلب صفحات إضافية.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loader,
  ProductGridSkeleton,
  Screen,
  SearchBar,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {getCategories, getCrossProducts, getStores} from '../../api/endpoints';
import {cachedFetch} from '../../api/cached';
import {ApiError} from '../../api/client';
import {PRODUCTS_PAGE_SIZE} from '../../core/config';
import type {CategoryCount, CrossProduct, Store} from '../../core/types';
import {useRecentsStore} from '../../stores/recentsStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'Search'>;

type SortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'name';

interface Filters {
  category: string | null;
  storeId: number | null;
  minPrice: string;
  maxPrice: string;
  weightOnly: boolean;
  inStockOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  category: null,
  storeId: null,
  minPrice: '',
  maxPrice: '',
  weightOnly: false,
  inStockOnly: false,
};

const SORTS: {key: SortKey; label: string; icon: IconName}[] = [
  {key: 'newest', label: 'الأحدث', icon: 'clock'},
  {key: 'priceAsc', label: 'الأرخص', icon: 'sort'},
  {key: 'priceDesc', label: 'الأغلى', icon: 'sort'},
  {key: 'name', label: 'أبجدي', icon: 'list'},
];

function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.category != null) n += 1;
  if (f.storeId != null) n += 1;
  if (f.minPrice !== '' || f.maxPrice !== '') n += 1;
  if (f.weightOnly) n += 1;
  if (f.inStockOnly) n += 1;
  return n;
}

export function SearchScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const insets = useSafeAreaInsets();
  const initialQuery = route.params?.initialQuery ?? '';
  /* v3.2 (الجولة 62): وضع التصفح — «عرض الكل» من الرئيسية يفتح
   * كامل منتجات المول (بلا استعلام) مع نفس الفلاتر والترتيب
   * والجلب التدريجي. */
  const browse = route.params?.browse === true;
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [results, setResults] = useState<CrossProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('newest');

  const recent = useRecentsStore(s => s.searches);
  const addRecent = useRecentsStore(s => s.add);
  const removeRecent = useRecentsStore(s => s.remove);
  const clearRecent = useRecentsStore(s => s.clear);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // التصنيفات والمتاج للفلاتر (كاش — لا تُجلب إلا مرة)
  useEffect(() => {
    void (async () => {
      const [cats, sts] = await Promise.all([
        cachedFetch('categories', () => getCategories()),
        cachedFetch('stores', () => getStores()),
      ]);
      if (cats.data != null) {
        setCategories(cats.data);
      }
      if (sts.data != null) {
        setStores(sts.data);
      }
    })();
  }, []);

  const search = useCallback(async (q: string, f: Filters, pageNo = 1, seq?: number) => {
    const clean = q.trim();
    /* v3.2: في وضع التصفح يُجلب كل شيء بلا استعلام — «عرض الكل». */
    if (clean.length < 2 && f.category == null && !browse) {
      setResults([]);
      setSubmittedQuery('');
      setHasMore(false);
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const products = await getCrossProducts({
        q: clean.length >= 2 ? clean : undefined,
        category: f.category ?? undefined,
        page: pageNo,
        per: PRODUCTS_PAGE_SIZE,
      });
      /* حارس التسلسل: رد متقادم بعد كتابة أحدث — يُهمل بصمت. */
      if (seq != null && seq !== searchSeq.current) {
        return;
      }
      setResults(prev => (pageNo === 1 ? products : [...prev, ...products]));
      setPage(pageNo);
      setHasMore(products.length >= PRODUCTS_PAGE_SIZE);
      setSubmittedQuery(clean);
      if (pageNo === 1 && clean.length >= 2) {
        addRecent(clean);
      }
    } catch (e) {
      if (seq != null && seq !== searchSeq.current) {
        return;
      }
      if (pageNo === 1) {
        setResults([]);
      }
      setError(e instanceof ApiError ? e.message : 'تعذر البحث — حاول مجدداً');
    } finally {
      setSearching(false);
    }
  }, [addRecent, browse]);

  /* v3.0 (الجولة 60): debounce أطول (500ms) + حارس تسلسل صارم.
   * الشكوى: «عند البحث تظهر خطأ محاولات كثيرة وكأنه يرسل طلبات
   * كثيرة» — طبقة client تعيد المحاولة بذكاء على 429 الآن، وحارس
   * التسلسل هنا يضمن أن ردود الكتابة السريعة المتقاطعة لا تستبدل
   * بعضها ولا تُظهر نتائج استعلام قديم فوق الأحدث. */
  const searchSeq = useRef(0);
  useEffect(() => {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
    }
    const mySeq = ++searchSeq.current;
    debounceRef.current = setTimeout(() => {
      void search(query, filters, 1, mySeq);
    }, 500);
    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, filters, search]);

  const loadMore = useCallback(async () => {
    if (loadingMore || searching || !hasMore || error != null) {
      return;
    }
    setLoadingMore(true);
    try {
      const products = await getCrossProducts({
        q: submittedQuery.trim().length >= 2 ? submittedQuery.trim() : undefined,
        category: filters.category ?? undefined,
        page: page + 1,
        per: PRODUCTS_PAGE_SIZE,
      });
      setResults(prev => [...prev, ...products]);
      setPage(p => p + 1);
      setHasMore(products.length >= PRODUCTS_PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, searching, hasMore, error, page, submittedQuery, filters.category]);

  /** الفلاتر المحلية + الترتيب على النتائج المجلبة.
   * v3.2: فلترة محلية فورية بالاستعلام الحالي (قبل رد الخادم
   * المؤجل 500ms) — البحث يبدو لحظياً كما طلب التاجر، ثم يصحّحه
   * رد الخادم الدقيق عند وصوله. */
  const visible = useMemo(() => {
    let list = results;
    const qNow = query.trim();
    if (qNow.length > 0) {
      const ql = qNow.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(ql));
    }
    const minMinor = filters.minPrice !== '' ? Math.round(Number(filters.minPrice) * 100) || 0 : null;
    const maxMinor = filters.maxPrice !== '' ? Math.round(Number(filters.maxPrice) * 100) || 0 : null;
    if (filters.storeId != null) {
      list = list.filter(p => p.store_id === filters.storeId);
    }
    if (minMinor != null) {
      list = list.filter(p => p.price_minor >= minMinor);
    }
    if (maxMinor != null && maxMinor > 0) {
      list = list.filter(p => p.price_minor <= maxMinor);
    }
    if (filters.weightOnly) {
      list = list.filter(p => p.sold_by_weight === 1);
    }
    if (filters.inStockOnly) {
      list = list.filter(p => p.stock > 0);
    }
    switch (sort) {
      case 'priceAsc':
        return [...list].sort((a, b) => a.price_minor - b.price_minor);
      case 'priceDesc':
        return [...list].sort((a, b) => b.price_minor - a.price_minor);
      case 'name':
        return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      default:
        return list;
    }
  }, [results, filters, sort, query]);

  const filterCount = activeFilterCount(filters);
  const storeName = filters.storeId != null
    ? stores.find(s => s.id === filters.storeId)?.name ?? null
    : null;

  const openSheet = () => {
    setDraft(filters);
    setSheetOpen(true);
  };

  const applyDraft = () => {
    setFilters({...draft});
    setSheetOpen(false);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setDraft(EMPTY_FILTERS);
    setSort('newest');
    setSheetOpen(false);
  };

  return (
    <Screen>
      {/* شريط البحث + زر الفلاتر */}
      <View style={{padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md}}>
        <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md}}>
          <View style={{flex: 1}}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث عن منتج… اسم أو كلمة"
              /* v3.2: في وضع التصفح لا نقفز بلوحة المفاتيح — نية
               * المستخدم تصفّح القائمة الكاملة لا الكتابة. */
              autoFocus={initialQuery === '' && !browse}
            />
          </View>
          <Pressable onPress={openSheet} style={({pressed}) => [
            styles.filterBtn,
            {backgroundColor: filterCount > 0 ? palette.brand : palette.surface, opacity: pressed ? 0.85 : 1},
          ]}>
            <Icon name="sliders" size={19} color={filterCount > 0 ? '#FFFFFF' : palette.inkSoft} />
            {filterCount > 0 ? (
              <View style={[styles.filterCount, {backgroundColor: '#FFFFFF'}]}>
                <Text style={{fontSize: 9.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                  {filterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* v3.2: وسم نطاق البحث — يوضح أن البحث عابر لكل متاجر
         * المول من هذا المسار (وفي صفحة المتجر يكون scoped هناك). */}
        <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 5}}>
          <Icon name="store" size={12} color={palette.muted} />
          <Text style={{fontSize: 11, color: palette.muted, fontFamily: fonts.medium}}>
            {browse ? 'تصفح كل منتجات المول — رتّبها وصفّها كما تريد' : 'البحث يشمل كل متاجر المول'}
          </Text>
        </View>

        {/* الترتيب السريع */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.sm}}>
          {SORTS.map(s => (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              style={[
                styles.sortChip,
                {
                  backgroundColor: sort === s.key ? palette.brandSoft : palette.surface,
                  borderColor: sort === s.key ? palette.brandBorder : palette.line,
                },
              ]}>
              <Icon
                name={s.icon}
                size={13}
                color={sort === s.key ? palette.brandDark : palette.muted}
              />
              <Text
                style={[
                  {fontSize: 12, fontFamily: fonts.medium},
                  {color: sort === s.key ? palette.brandDark : palette.muted},
                ]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* رقائق الفلاتر النشطة */}
        {filterCount > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.sm}}>
            {filters.category != null ? (
              <ActiveChip
                label={filters.category}
                onRemove={() => setFilters(f => ({...f, category: null}))}
              />
            ) : null}
            {storeName != null ? (
              <ActiveChip
                label={storeName}
                onRemove={() => setFilters(f => ({...f, storeId: null}))}
              />
            ) : null}
            {filters.minPrice !== '' || filters.maxPrice !== '' ? (
              <ActiveChip
                label={`السعر: ${filters.minPrice || '0'}–${filters.maxPrice || '∞'} ₪`}
                onRemove={() => setFilters(f => ({...f, minPrice: '', maxPrice: ''}))}
              />
            ) : null}
            {filters.weightOnly ? (
              <ActiveChip label="بالوزن" onRemove={() => setFilters(f => ({...f, weightOnly: false}))} />
            ) : null}
            {filters.inStockOnly ? (
              <ActiveChip label="متوفر" onRemove={() => setFilters(f => ({...f, inStockOnly: false}))} />
            ) : null}
          </ScrollView>
        ) : null}
      </View>

      {/* النتائج */}
      {searching && results.length === 0 ? (
        <View style={{padding: spacing.lg}}>
          <ProductGridSkeleton count={6} />
        </View>
      ) : error != null && results.length === 0 ? (
        <View style={{padding: spacing.lg}}>
          <ErrorState message={error} onRetry={() => void search(query, filters, 1)} />
        </View>
      ) : submittedQuery.length < 2 && filters.category == null && !browse ? (
        /* الحالة الابتدائية: سجل البحث + تصنيفات مقترحة */
        <FlatList
          data={[]}
          keyExtractor={() => 'idle'}
          renderItem={() => null}
          ListHeaderComponent={
            <View style={{padding: spacing.lg, gap: spacing.xl}}>
              {recent.length > 0 ? (
                <View style={{gap: spacing.md}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                    <Text style={[type.h3, {color: palette.ink}]}>بحثك الأخير</Text>
                    <Pressable onPress={clearRecent} hitSlop={8}>
                      <Text style={[type.tiny, {color: palette.muted}]}>مسح السجل</Text>
                    </Pressable>
                  </View>
                  <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm}}>
                    {recent.map(r => (
                      <Pressable
                        key={r}
                        onPress={() => setQuery(r)}
                        style={[styles.recentChip, {backgroundColor: palette.surface, borderColor: palette.line}]}>
                        <Icon name="clock" size={13} color={palette.muted} />
                        <Text style={[{fontSize: 12.5, color: palette.inkSoft, fontFamily: fonts.medium}]}>{r}</Text>
                        <Pressable
                          onPress={() => removeRecent(r)}
                          hitSlop={8}>
                          <Icon name="close" size={12} color={palette.muted} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {categories.length > 0 ? (
                <View style={{gap: spacing.md}}>
                  <Text style={[type.h3, {color: palette.ink}]}>تصفّح التصنيفات</Text>
                  <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm}}>
                    {categories.slice(0, 12).map(c => (
                      <Pressable
                        key={c.category}
                        onPress={() => navigation.navigate('Category', {category: c.category})}
                        style={[styles.recentChip, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
                        <Text style={[{fontSize: 12.5, color: palette.brandDark, fontFamily: fonts.medium}]}>
                          {c.category}
                        </Text>
                        <Text style={{fontSize: 10.5, color: palette.muted}}>{c.n}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <EmptyState
                icon="search"
                title="ابحث في كل متاجر المول"
                body="اكتب حرفين على الأقل — النتائج من كتالوج كل متجر منشور، ويمكن ترشيحها بالتصنيف والمتجر والسعر."
              />
            </View>
          }
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => `${item.store_id}:${item.id}`}
          numColumns={2}
          /* v3.3: صف الشبكة يُطبّق دائماً — والخلية نفسها مسقوفة
           * بنصف العرض، فلا تتمدد النتيجة الوحيدة شريطاً عرضياً
           * بكامل الشاشة (شكوى الجولة 63: «تفتح بشكل عرضي ومقرف»). */
          columnWrapperStyle={gridStyles.row}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: stackClearance}}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="لا توجد منتجات مطابقة لبحثك"
              body={
                submittedQuery.trim().length >= 2
                  ? `لم نجد «${submittedQuery.trim()}» في أي متجر — جرّب كلمة أعم أو خفّف الفلاتر`
                  : 'جرّب تعديل الفلاتر — ربما تكون محدودة أكثر من اللازم'
              }
            />
          }
          ListHeaderComponent={
            <Text style={[{fontSize: 11.5, color: palette.muted}]}>
              {visible.length} منتجاً
              {submittedQuery.length >= 2 ? ` لـ«${submittedQuery}»` : ''}
              {filterCount > 0 ? ' · بعد الفلاتر' : ''}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{paddingVertical: spacing.lg}}>
                <Loader label="نجلب المزيد…" />
              </View>
            ) : hasMore && visible.length > 0 && visible.length < results.length * 0.5 && results.length >= 90 ? (
              <Text style={[type.tiny, {color: palette.muted, textAlign: 'center', paddingVertical: spacing.lg}]}>
                بعض النتائج المخفية بالفلاتر — مرّر للمزيد
              </Text>
            ) : null
          }
          renderItem={({item}) => (
            <View style={gridStyles.cell}>
              <ProductCard
                product={item}
                storeRef={{id: item.store_id, name: item.store_name, storeNumber: item.store_number}}
                onPress={() =>
                  navigation.navigate('Product', {
                    product: item,
                    storeRef: {id: item.store_id, name: item.store_name, storeNumber: item.store_number},
                  })
                }
              />
            </View>
          )}
        />
      )}

      {/* ─── شيت الفلاتر ─── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}>
        <View style={[styles.sheetOverlay, {backgroundColor: palette.overlay}]}>
          <Pressable style={{flex: 1}} onPress={() => setSheetOpen(false)} />
          <View
            style={[
              styles.sheet,
              {backgroundColor: palette.surface, paddingBottom: insets.bottom + spacing.lg},
            ]}>
            <View style={styles.sheetInner}>
              <View style={[styles.sheetHandle, {backgroundColor: palette.lineStrong}]} />
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                <Text style={[type.h3, {color: palette.ink}]}>الفلاتر</Text>
                <Pressable onPress={resetFilters} hitSlop={8}>
                  <Text style={[type.smallMedium, {color: palette.brand}]}>مسح الكل</Text>
                </Pressable>
              </View>

              {/* التصنيف */}
              {categories.length > 0 ? (
                <View style={{gap: spacing.sm}}>
                  <Text style={[type.smallMedium, {color: palette.inkSoft}]}>التصنيف</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.sm}}>
                    {categories.map(c => (
                      <Pressable
                        key={c.category}
                        onPress={() => setDraft(d => ({...d, category: d.category === c.category ? null : c.category}))}
                        style={[
                          styles.optionChip,
                          {
                            backgroundColor: draft.category === c.category ? palette.brandSoft : palette.surfaceAlt,
                            borderColor: draft.category === c.category ? palette.brandBorder : palette.line,
                          },
                        ]}>
                        <Text
                          style={[
                            {fontSize: 12.5, fontFamily: fonts.medium},
                            {color: draft.category === c.category ? palette.brandDark : palette.inkSoft},
                          ]}>
                          {c.category}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/* المتجر */}
              {stores.length > 1 ? (
                <View style={{gap: spacing.sm}}>
                  <Text style={[type.smallMedium, {color: palette.inkSoft}]}>المتجر</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.sm}}>
                    {stores.map(s => (
                      <Pressable
                        key={s.id}
                        onPress={() => setDraft(d => ({...d, storeId: d.storeId === s.id ? null : s.id}))}
                        style={[
                          styles.optionChip,
                          {
                            backgroundColor: draft.storeId === s.id ? palette.brandSoft : palette.surfaceAlt,
                            borderColor: draft.storeId === s.id ? palette.brandBorder : palette.line,
                          },
                        ]}>
                        <Text
                          style={[
                            {fontSize: 12.5, fontFamily: fonts.medium},
                            {color: draft.storeId === s.id ? palette.brandDark : palette.inkSoft},
                          ]}>
                          {s.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/* نطاق السعر */}
              <View style={{gap: spacing.sm}}>
                <Text style={[type.smallMedium, {color: palette.inkSoft}]}>نطاق السعر (₪)</Text>
                <View style={{flexDirection: 'row', gap: spacing.md}}>
                  <View style={{flex: 1}}>
                    <Field
                      label="من"
                      value={draft.minPrice}
                      onChangeText={t => setDraft(d => ({...d, minPrice: t.replace(/[^\d.]/g, '')}))}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <Field
                      label="إلى"
                      value={draft.maxPrice}
                      onChangeText={t => setDraft(d => ({...d, maxPrice: t.replace(/[^\d.]/g, '')}))}
                      placeholder="بلا حد"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* خيارات */}
              <View style={{gap: spacing.sm}}>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <Text style={[type.small, {color: palette.inkSoft}]}>منتجات الوزن فقط (بالكيلو)</Text>
                  <Switch
                    value={draft.weightOnly}
                    onValueChange={v => setDraft(d => ({...d, weightOnly: v}))}
                    trackColor={{true: palette.brand, false: palette.line}}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <Text style={[type.small, {color: palette.inkSoft}]}>المتوفر فقط (غير نافد)</Text>
                  <Switch
                    value={draft.inStockOnly}
                    onValueChange={v => setDraft(d => ({...d, inStockOnly: v}))}
                    trackColor={{true: palette.brand, false: palette.line}}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <Button label="تطبيق الفلاتر" onPress={applyDraft} icon="check" />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ActiveChip({label, onRemove}: {label: string; onRemove: () => void}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onRemove}
      style={[styles.activeChip, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
      <Text style={{fontSize: 12, color: palette.brandDark, fontFamily: fonts.medium}}>{label}</Text>
      <Icon name="close" size={12} color={palette.brandDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCount: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 15,
    height: 15,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  sortChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  recentChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  optionChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  sheetOverlay: {flex: 1, justifyContent: 'flex-end'},
  sheet: {
    borderTopRightRadius: radius.xl,
    borderTopLeftRadius: radius.xl,
  },
  sheetInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: spacing.sm,
  },
});

const gridStyles = StyleSheet.create({
  row: {gap: spacing.md, width: '100%'},
  /* v3.3: الخلية لا تتجاوز نصف العد أبداً — حتى لو كانت النتيجة
   * الوحيدة في صفها، فتبقى بنفس عرض بطاقات الشبكة الثنائية. */
  cell: {flex: 1, maxWidth: '50%'},
});
