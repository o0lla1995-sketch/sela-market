/**
 * ProductScreen.tsx — صفحة المنتج (v2.7 — كثافة احترافية):
 * ─────────────────────────────────────────────────────────────────
 * دراسة معايير المتاجر العالمية (أمازون/نون/طلبات): كثافة أعلى
 * وعناصر أصغر — طلب التاجر بالنص: «أحجام العناصر بها كبيرة وغير
 * عملية». v2.7:
 *  • معرض صور مدمج (60% من العرض بدل 86%) + عناصر سعر أصغر
 *    (21px بدل 30px) وإلغاء صندوق الأيقونة 76px.
 *  • بطاقات مدمجة: السعر+الوحدة+المخزون+التصنيف في بطاقة واحدة؛
 *     المتجر سطر مضغوط؛ الاقتراحات 150px.
 *  • إصلاح جوهري: الهامش السفلي — آخر المحتوى كان يختفي خلف
 *    شريط الشراء الثابت (شكوى «هامش أسفل الصفحة»)؛ أصبح
 *    stackClearance + 140.
 *  • خيارات الشراء + عدّاد الكمية + الإجمالي الحي كما هي (v2.6)
 *    — المنطق المثبت لم يُمس.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  BottomFixed,
  Button,
  Card,
  QtyStepper,
  Screen,
  SectionTitle,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreAvatar} from '../../components/StoreCard';
import {absoluteUrl} from '../../api/client';
import {getStoreProducts} from '../../api/endpoints';
import {formatMoney, formatQty} from '../../core/money';
import {effectiveMinor, hasDiscount} from '../../core/discount';
import {
  lineKeyOf,
  optionsComplete,
  variantTextOf,
  type Product,
  type ProductOptionGroup,
} from '../../core/types';
import {useCartStore} from '../../stores/cartStore';
import {useInterestStore} from '../../stores/interestStore';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useToastStore} from '../../stores/toastStore';
import {useRequireAuth, type ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';
import {minQty, qtyStep} from '../../core/money';
import {recommendSimilar, RECOMMEND_LIMIT} from '../../core/recommend';

type Props = NativeStackScreenProps<ShopStackParamList, 'Product'>;

export function ProductScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {product, storeRef} = route.params;

  const addProduct = useCartStore(s => s.addProduct);
  const increment = useCartStore(s => s.increment);
  const decrement = useCartStore(s => s.decrement);
  const toast = useToastStore(s => s.show);
  const requireAuth = useRequireAuth();
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);

  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const optionGroups: ProductOptionGroup[] = product.options ?? [];

  /* v2.6: الكمية تُختار قبل الإضافة (لا بعدها) — العدّاد يعمل
   * مباشرة على الشاشة والإجمالي يتحدث مع كل لمسة، كما في تطبيقات
   * التسوق العالمية. v2.8 (الجولة 59): الحد الأقصى = المخزون
   * المتاح نفسه — طلب التاجر: «لماذا يستطيع المستخدم طلب أكبر
   * منها؟» — لا طلب أكبر من المتوفر، لا من العدّاد ولا من السلة. */
  const [qty, setQty] = useState(() => minQty(soldByWeight));
  const maxQty =
    Number.isFinite(product.stock) && product.stock > 0
      ? /* وزن كسري (٢٫٥ كيلو مثلاً) يبقى كسرياً — لا تقريب لأسفل
         * يحرم المستخدم من نصف كيلو متاح فعلاً. */
        Math.max(minQty(soldByWeight), Math.floor(product.stock * 1000) / 1000)
      : 999;
  const stepQty = qtyStep(soldByWeight);
  const unitFinalPrice = effectiveMinor(product);
  const liveTotal = Math.round(unitFinalPrice * qty);

  /** اختيار المستخدم لكل مجموعة خيارات (اسم المجموعة → القيمة). */
  const [selection, setSelection] = useState<Record<string, string>>({});
  const variantText = variantTextOf(optionGroups, selection);
  const complete = optionsComplete(optionGroups, selection);
  const activeLineKey = lineKeyOf(product.id, variantText);

  const cartLine = useCartStore(
    s => s.carts[String(storeRef.id)]?.lines.find(l => l.key === activeLineKey),
  );
  const cartQty = cartLine?.quantity ?? 0;
  /** أسطر أخرى لنفس المنتج بخيارات مختلفة (كم إضافة معلوماتية). */
  const otherVariantCount = useCartStore(
    s =>
      (s.carts[String(storeRef.id)]?.lines ?? []).filter(
        l => l.productId === product.id && l.key !== activeLineKey,
      ).length,
  );

  const images = useMemo(
    () => (product.images ?? []).map(absoluteUrl).filter((u): u is string => u != null),
    [product.images],
  );
  const [slide, setSlide] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  /* v2.8 (الجولة 59): توصيات ذكية احترافية — طلب التاجر بالنص
   * «في صفحة المنتج يقترح على المستخدم منتجات أخرى مشابهة بشكل
   * ذكي واحترافي». المحرك (core/recommend) يدمج: نفس التصنيف +
   * التوفر + قرب السعر + الخصم النشط + أوزان اهتمام المستخدم +
   * تشابه الاسم — كما أنظمة التوصيات العالمية. */
  const [similar, setSimilar] = useState<Product[]>([]);
  const [similarReason, setSimilarReason] = useState<string | null>(null);

  // v2.0: مشاهدة المنتج ترفع وزن تصنيفه في «مقترحات لك» — إشارة
  // خفيفة (وزن 1) لا تُرسل لأي خادم (كل شيء محلي على الجهاز).
  useEffect(() => {
    useInterestStore.getState().trackView(product.category);
  }, [product.id, product.category]);
  useEffect(() => {
    let alive = true;
    /* بلا تصنيف ولا مرشحين؟ المحرك ما زال يعمل بتشابه الاسم —
     * نجهز المرشحين دائماً ونترك الترتيب للدرجات. */
    void getStoreProducts(storeRef.id, {per: 40})
      .then(list => {
        if (!alive) {
          return;
        }
        const weights = useInterestStore.getState().categoryWeights();
        const picked = recommendSimilar(list, {current: product, categoryWeights: weights});
        setSimilar(picked.slice(0, RECOMMEND_LIMIT));
        /* سبب التوصية يُشرح للمستخدم كما تفعل المتاجر العالمية
         * («من نفس التصنيف» / «عروض قد تعجبك» / «من متجر …»). */
        const sameCat = picked.filter(p => p.category != null && p.category === product.category).length;
        const discounted = picked.filter(p => (p.discount_pct ?? 0) > 0).length;
        if (sameCat >= 3) {
          setSimilarReason(`من نفس التصنيف — ${product.category}`);
        } else if (discounted >= Math.ceil(picked.length / 2)) {
          setSimilarReason('عروض قد تعجبك من نفس المتجر');
        } else if (picked.length > 0) {
          setSimilarReason(`المزيد من ${storeRef.name}`);
        } else {
          setSimilarReason(null);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [product.id, product.category, storeRef.id, storeRef.name, product]);

  const onAdd = () => {
    if (outOfStock) {
      toast('نفدت الكمية من المتجر حالياً', 'danger');
      return;
    }
    if (!complete) {
      toast(`اختر ${optionGroups.find(g => selection[g.name] == null)!.name} أولاً`, 'danger');
      return;
    }
    /* v2.6: الزائر لا يضيف للسلة — بوابة الدخول أولاً. */
    requireAuth(() => {
      addProduct(storeRef, product, variantText, qty);
      toast(`أُضيف «${product.name}» (${formatQty(qty, soldByWeight)}) إلى سلة ${storeRef.name}`, 'success');
    });
  };

  const onWishlist = () => {
    requireAuth(() => {
      const added = toggleWishlist(product, storeRef.name);
      toast(added ? 'حُفظ في المفضلة' : 'أُزيل من المفضلة', 'info');
    });
  };

  const galleryHeight = screenWidth * 0.6;

  return (
    <Screen>
      <AppHeader
        title={product.name}
        subtitle={`من ${storeRef.name}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{padding: spacing.md, gap: spacing.md, paddingBottom: stackClearance + 140}} showsVerticalScrollIndicator={false}>
        {/* ─── معرض الصور ─── */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                // RTL: إزاحات سالبة على أندرويد — القيمة المطلقة
                // تعطي الفهرس الصحيح دائماً.
                setSlide(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / screenWidth));
              }}
              style={{borderRadius: radius.xl, overflow: 'hidden'}}>
              {images.map((uri, i) => (
                <Pressable key={uri} onPress={() => setViewerIndex(i)}>
                  <Image
                    source={{uri}}
                    style={{width: screenWidth - spacing.md * 2, height: galleryHeight}}
                    resizeMode="cover"
                    progressiveRenderingEnabled
                  />
                </Pressable>
              ))}
            </ScrollView>

            {/* العدّاد + النقاط */}
            <View style={galleryStyles.dotsRow}>
              {images.map((uri, i) => (
                <View
                  key={uri}
                  style={[
                    galleryStyles.dot,
                    {
                      backgroundColor: i === slide ? palette.brand : palette.lineStrong,
                      width: i === slide ? 20 : 7,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={[galleryStyles.countChip, {backgroundColor: palette.overlay}]}>
              <Icon name="photo" size={11} color="#FFFFFF" />
              <Text style={{fontSize: 10.5, color: '#FFFFFF', fontFamily: fonts.medium}}>
                {slide + 1} / {images.length}
              </Text>
            </View>
          </View>
        ) : (
          /* بديل مرسوم عند غياب الصور */
          <View
            style={[
              galleryStyles.placeholder,
              {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder, height: galleryHeight * 0.8},
            ]}>
            <Icon name="photo" size={54} color={palette.brandDark} />
            <Text style={[type.small, {color: palette.muted, marginTop: spacing.md}]}>
              لا صور لهذا المنتج بعد — صوره تُرفع من نقطة بيع المتجر
            </Text>
          </View>
        )}

        {/* ─── بطاقة السعر + الوحدة + المخزون + التصنيف (مدمجة v2.7) ─── */}
        <Card style={{gap: spacing.sm}}>
          <View style={priceStyles.row}>
            <View style={{gap: 1, flex: 1, alignItems: 'flex-start'}}>
              {hasDiscount(product) ? (
                <>
                  <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
                    <Text
                      style={[type.small, {color: palette.muted, textDecorationLine: 'line-through'}]}>
                      {formatMoney(product.price_minor)}
                    </Text>
                    <View style={[priceStyles.pctChip, {backgroundColor: palette.danger}]}>
                      <Text style={{fontSize: 9.5, color: '#FFFFFF', fontFamily: fonts.bold}}>
                        خصم {Math.round(product.discount_pct ?? 0)}%
                      </Text>
                    </View>
                    <Text style={{fontSize: 10.5, color: palette.success, fontFamily: fonts.medium}}>
                      توفّر {formatMoney(Math.max(0, product.price_minor - effectiveMinor(product)))}
                    </Text>
                  </View>
                  <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
                    {formatMoney(effectiveMinor(product))}
                  </Text>
                </>
              ) : (
                <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
                  {formatMoney(product.price_minor)}
                </Text>
              )}
              <Text style={{fontSize: 10.5, color: palette.muted}}>
                {soldByWeight ? 'بالكيلو — بأنصاف الكيلو' : product.unit_label ? `الوحدة: ${product.unit_label}` : 'يُباع بالقطعة'}
                {product.category ? ` · ${product.category}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={onWishlist}
              hitSlop={10}
              style={[priceStyles.wishBtn, {backgroundColor: palette.surfaceAlt}]}>
              <Icon
                name={wishlisted ? 'heartFilled' : 'heart'}
                size={19}
                color={wishlisted ? palette.danger : palette.muted}
              />
            </Pressable>
          </View>
          <View style={priceStyles.chipsRow}>
            <View
              style={[
                priceStyles.infoChip,
                {
                  backgroundColor: outOfStock ? palette.dangerSoft : lowStock ? palette.warningSoft : palette.successSoft,
                  borderColor: outOfStock ? palette.danger : lowStock ? palette.warning : palette.success,
                },
              ]}>
              <Icon
                name={outOfStock ? 'xCircle' : lowStock ? 'warning' : 'checkCircle'}
                size={12}
                color={outOfStock ? palette.danger : lowStock ? palette.warning : palette.success}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.medium,
                  color: outOfStock ? palette.danger : lowStock ? palette.warning : palette.success,
                }}>
                {outOfStock
                  ? 'نفدت الكمية'
                  : lowStock
                    ? `بقي القليل (${Math.floor(product.stock)}${soldByWeight ? ' كيلو' : ' قطعة'})`
                    : `متوفر (${Math.floor(product.stock)}${soldByWeight ? ' كيلو' : ' قطعة'})`}
              </Text>
            </View>
            {product.category ? (
              <Pressable
                onPress={() => navigation.navigate('Category', {category: product.category!})}>
                <Text style={{fontSize: 11, color: palette.brand, fontFamily: fonts.medium}}>
                  {product.category} ›
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {/* ─── خيارات الشراء (مقاس/لون…) — مضغوطة v2.7 ─── */}
        {optionGroups.length > 0 ? (
          <Card style={{gap: spacing.sm}}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name="sliders" size={14} color={palette.brandDark} />
              <Text style={[type.h3, {color: palette.ink}]}>اختياراتك</Text>
              {!complete ? (
                <View style={[optStyles.requiredChip, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
                  <Text style={{fontSize: 9.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                    مطلوب
                  </Text>
                </View>
              ) : null}
            </View>
            {optionGroups.map(group => (
              <View key={group.name} style={{gap: 5}}>
                <Text style={{fontSize: 11.5, color: palette.inkSoft, fontFamily: fonts.medium}}>
                  {group.name}
                </Text>
                <View style={optStyles.valuesWrap}>
                  {group.values.map(value => {
                    const active = selection[group.name] === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() =>
                          setSelection(prev => ({...prev, [group.name]: value}))
                        }
                        style={({pressed}) => [
                          optStyles.valueChip,
                          {
                            backgroundColor: active ? palette.brand : palette.surface,
                            borderColor: active ? palette.brand : palette.lineStrong,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: active ? '#FFFFFF' : palette.ink,
                            fontFamily: active ? fonts.bold : fonts.medium,
                          }}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {variantText != null ? (
              <Text style={{fontSize: 10.5, color: palette.muted}}>
                ستُضاف بالمواصفة: {variantText}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* الوصف */}
        {product.description ? (
          <Card style={{gap: 4, paddingVertical: 10}}>
            <Text style={{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}}>عن المنتج</Text>
            <Text style={{fontSize: 12, color: palette.inkSoft, lineHeight: 19}}>
              {product.description}
            </Text>
          </Card>
        ) : null}

        {/* المتجر — سطر مضغوط v2.7 */}
        <Pressable onPress={() => navigation.navigate('Store', {storeId: storeRef.id, storeName: storeRef.name})}>
          <Card style={{paddingVertical: 10, gap: 4}}>
            <View style={priceStyles.row}>
              <StoreAvatar name={storeRef.name} logoUrl={storeRef.logoUrl} size={38} />
              <View style={{flex: 1, gap: 1, alignItems: 'flex-start'}}>
                <Text style={{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}}>
                  {storeRef.name}
                </Text>
                <Text style={{fontSize: 10.5, color: palette.muted}}>
                  {storeRef.storeNumber ? `${storeRef.storeNumber} · ` : ''}زيارة المتجر وتصفح منتجاته ومناطق توصيله ›
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>

        {/* من نفس التصنيف */}
        {similar.length > 0 ? (
          <View style={{gap: spacing.md}}>
            <SectionTitle
              title="منتجات مشابهة قد تعجبك"
              subtitle={similarReason ?? undefined}
              actionLabel={product.category ? 'كل التصنيف' : undefined}
              onAction={
                product.category
                  ? () => navigation.navigate('Category', {category: product.category!})
                  : undefined
              }
            />
            <FlatList
              horizontal
              data={similar}
              keyExtractor={p => String(p.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
              style={{marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg}}
              renderItem={({item}) => (
                <View style={{width: 150}}>
                  <ProductCard
                    product={item}
                    storeName={storeRef.name}
                    storeRef={storeRef}
                    onPress={() =>
                      navigation.push('Product', {product: item, storeRef})
                    }
                  />
                </View>
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* ─── شريط الشراء السفلي — الكمية + الإجمالي الحي قبل الإضافة ───
       * v2.6: العدّاد انتقل من «بعد الإضافة» إلى الشاشة نفسها:
       * المستخدم يرى الكمية والإجمالي يتحدثان لحظياً ثم يضيف —
       * لا إضافة عمياء ثم تعديل. */}
      <BottomFixed>
        {cartQty > 0 ? (
          <View style={{gap: 8}}>
            <View style={bottomStyles.row}>
              <QtyStepper
                qty={cartQty}
                soldByWeight={soldByWeight}
                /* v2.8: سقف المخزون يعمل هنا أيضاً — الزيادة تتوقف
                 * عند المتاح ولا يتجاوزها أحد. */
                max={maxQty}
                onIncrease={() => increment(storeRef.id, activeLineKey)}
                onDecrease={() => decrement(storeRef.id, activeLineKey)}
              />
              <Button
                label={`في السلة — ${formatMoney(effectiveMinor(product) * cartQty)}`}
                variant="soft"
                style={{flex: 1}}
                onPress={() => navigation.getParent()?.navigate('Cart')}
              />
            </View>
            {otherVariantCount > 0 ? (
              <Text style={[{fontSize: 11, color: palette.muted, textAlign: 'center'}]}>
                لديك {otherVariantCount} مواصفة أخرى من هذا المنتج في السلة
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{gap: 8}}>
            <View style={bottomStyles.row}>
              <QtyStepper
                qty={qty}
                soldByWeight={soldByWeight}
                max={maxQty}
                onIncrease={() =>
                  setQty(q => Math.min(maxQty, Math.round((q + stepQty) * 1000) / 1000))
                }
                onDecrease={() =>
                  setQty(q =>
                    q - stepQty < minQty(soldByWeight)
                      ? minQty(soldByWeight)
                      : Math.round((q - stepQty) * 1000) / 1000,
                  )
                }
              />
              <Button
                label={
                  outOfStock
                    ? 'غير متوفر حالياً'
                    : !complete
                      ? 'اختر المواصفات أولاً'
                      : `أضف للسلة — ${formatMoney(liveTotal)}`
                }
                icon={complete && !outOfStock ? 'cart' : 'sliders'}
                style={{flex: 1}}
                onPress={onAdd}
                disabled={outOfStock}
              />
            </View>
            <Text style={[{fontSize: 11, color: palette.muted, textAlign: 'center'}]}>
              {formatMoney(unitFinalPrice)} × {formatQty(qty, soldByWeight)}
              {soldByWeight ? ' كيلو' : ' قطعة'} = {formatMoney(liveTotal)}
              {maxQty < 999
                ? ` · المتاح ${formatQty(maxQty, soldByWeight)}${soldByWeight ? ' كيلو' : ' قطعة'} فقط`
                : ''}
            </Text>
          </View>
        )}
      </BottomFixed>

      {/* ─── عارض ملء الشاشة ─── */}
      <Modal visible={viewerIndex != null} transparent animationType="fade"
        onRequestClose={() => setViewerIndex(null)}>
        <View style={[viewerStyles.wrap, {backgroundColor: '#000000'}]}>
          <Pressable
            onPress={() => setViewerIndex(null)}
            style={[viewerStyles.closeBtn, {top: insets.top + spacing.md}]}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
          {viewerIndex != null && images.length > 0 ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, i) => ({
                length: screenWidth,
                offset: screenWidth * i,
                index: i,
              })}
              keyExtractor={item => item}
              onMomentumScrollEnd={e => {
                // RTL: إزاحة سالبة — القيمة المطلقة تصحح الفهرس.
                setViewerIndex(
                  Math.round(Math.abs(e.nativeEvent.contentOffset.x) / screenWidth),
                );
              }}
              renderItem={({item}) => (
                <Image
                  source={{uri: item}}
                  style={{width: screenWidth, height: '100%'}}
                  resizeMode="contain"
                />
              )}
            />
          ) : null}
          <View style={[viewerStyles.counter, {bottom: insets.bottom + spacing.xl}]}>
            <Text style={{color: '#FFFFFF', fontSize: 12, fontFamily: fonts.medium}}>
              {(viewerIndex ?? 0) + 1} / {images.length}
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const galleryStyles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  dot: {height: 7, borderRadius: 999},
  countChip: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  placeholder: {
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});

const priceStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  /* v2.7: 21px بدل 30px — كثافة احترافية بلا صراخ. */
  amount: {fontSize: 21, fontFamily: fonts.black},
  pctChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  /* v2.7: صندوق الأيقونة 76px حُذف — الوحدة نصاً تحت السعر. */
  wishBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* v2.6: رقائق معلوماتية مدمجة بدل الصناديق الملوّنة الكبيرة */
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
});

const optStyles = StyleSheet.create({
  valuesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  /* v2.7: رقائق أضيق — لمسة أسرع ومساحة أقل. */
  valueChip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 46,
    alignItems: 'center',
  },
  requiredChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
});

const bottomStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
});

const viewerStyles = StyleSheet.create({
  wrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  closeBtn: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
