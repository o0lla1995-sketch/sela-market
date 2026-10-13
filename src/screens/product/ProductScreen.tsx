/**
 * ProductScreen.tsx — صفحة المنتج (v3.0 — إعادة بناء كاملة، الجولة 60):
 * ─────────────────────────────────────────────────────────────────
 * طلب التاجر بالنص: «اسجل دخول وافتح صفحة المنتج ولا أرى أي أزرار
 * لطلب المنتج وتحديد ما أريده» — أعيدت الهيكلية من الصفر بمعيار
 * المتاجر العالمية (أمازون/نون/سلة):
 *
 *  • شريط الشراء السفلي أصبح مُثبَّتاً تثبيتاً مطلقاً (BottomFixed
 *    الجديد: position:absolute + bottom:0) — يستحيل هندسياً أن
 *    يُدفَع خارج الشاشة كما كان يحدث مع عمود flex القديم. العدّاد
 *    وزر «أضف للسلة» مع الإجمالي الحي مرئيان دائماً من أول لحظة.
 *  • معرض صور بعرض كامل بنسبة 4:5 (نون) مع نقاط وعدّاد وعارض
 *    ملء الشاشة.
 *  • بطاقة سعر ملوّنة: خصم + توفير + الوحدة، وشريحة تصنيف بلون
 *    البلاطة المخصص (نظام الألوان الغني الجديد).
 *  • خيارات الشراء (مقاس/لون) برقائق ملونة + حالة «مطلوب».
 *  • قسم كمية صريح داخل المحتوى مع سقف المخزون + الإجمالي الحي.
 *  • منتجات مشابهة بمحرك التوصية (نفس التصنيف/السعر/الخصم) مع
 *    كاش 60 ثانية لكل متجر — لا نداء متكرر لكل منتج يُفتح.
 *  • القائمة كلها تمرر فوق الشريط بـ paddingBottom = ارتفاع الشريط
 *    + إخلاء النظام: لا محتوى يختفي خلفه أبداً.
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
import {radius, spacing, type, fonts, tileFor} from '../../theme/tokens';
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
import {getStoreSimilarProducts} from '../../api/endpoints';
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
import {minQty, qtyStep} from '../../core/money';
import {recommendSimilar, RECOMMEND_LIMIT} from '../../core/recommend';

type Props = NativeStackScreenProps<ShopStackParamList, 'Product'>;

export function ProductScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const {width: screenWidth} = useWindowDimensions();
  const {product, storeRef} = route.params;

  /* هوكات مرتبة دائماً في القمة — بلا فروع شرطية (درس v2.6). */
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
  const catTile = tileFor(product.category, palette.isDark);

  /* الكمية تُختار قبل الإضافة والإجمالي يتحدث لحظياً (منطق v2.8
   * المثبت) — والحد الأقصى هو المخزون المتاح نفسه: لا طلب أكبر
   * من المتوفر لا من العدّاد ولا من السلة. */
  const [qty, setQty] = useState(() => minQty(soldByWeight));
  const maxQty =
    Number.isFinite(product.stock) && product.stock > 0
      ? Math.max(minQty(soldByWeight), Math.floor(product.stock * 1000) / 1000)
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
  /** أسطر أخرى لنفس المنتج بخيارات مختلفة (معلومة إضافية). */
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

  /* توصيات ذكية بمحرك core/recommend — عبر كاش المتجر (60 ث):
   * فتح عشرة منتجات من متجر واحد = نداء واحد لا عشرة. */
  const [similar, setSimilar] = useState<Product[]>([]);
  const [similarReason, setSimilarReason] = useState<string | null>(null);

  useEffect(() => {
    useInterestStore.getState().trackView(product.category);
  }, [product.id, product.category]);

  useEffect(() => {
    let alive = true;
    void getStoreSimilarProducts(storeRef.id, 40)
      .then(list => {
        if (!alive) {
          return;
        }
        const weights = useInterestStore.getState().categoryWeights();
        const picked = recommendSimilar(list, {current: product, categoryWeights: weights});
        setSimilar(picked.slice(0, RECOMMEND_LIMIT));
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
    /* الزائر لا يضيف للسلة — بوابة الدخول أولاً. */
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

  /* معرض بنسبة نون (4:5) بعرض كامل — الصورة أكبر مساحة بيع. */
  const galleryHeight = Math.round(screenWidth * 1.25);
  /* إخلاء المحتوى فوق الشريط المثبت: ارتفاع الشريط (عدّاد+زر ≈ 64 +
   * سطر الإجمالي 20 + حواشي 24) + إخلاء النظام. */
  const barClearance = insets.bottom + 132;

  return (
    <Screen>
      <AppHeader
        title={product.name}
        subtitle={`من ${storeRef.name}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{padding: spacing.md, gap: spacing.md, paddingBottom: barClearance}}
        showsVerticalScrollIndicator={false}>
        {/* ─── معرض الصور ─── */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                // RTL: إزاحات سالبة على أندرويد — القيمة المطلقة تعطي
                // الفهرس الصحيح دائماً.
                setSlide(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / screenWidth));
              }}
              style={{borderRadius: radius.xl, overflow: 'hidden'}}>
              {images.map((uri, i) => (
                <Pressable key={uri} onPress={() => setViewerIndex(i)}>
                  <Image
                    source={{uri}}
                    style={{width: screenWidth - spacing.md * 2, height: galleryHeight}}
                    resizeMode="cover"
                    resizeMethod="resize"
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
          /* بديل مرسوم عند غياب الصور — بلون بلاطة التصنيف */
          <View
            style={[
              galleryStyles.placeholder,
              {backgroundColor: catTile.soft, borderColor: catTile.solid + '55', height: galleryHeight * 0.62},
            ]}>
            <Icon name="photo" size={54} color={catTile.solid} />
            <Text style={[type.small, {color: catTile.ink, marginTop: spacing.md}]}>
              لا صور لهذا المنتج بعد — صوره تُرفع من نقطة بيع المتجر
            </Text>
          </View>
        )}

        {/* ─── بطاقة السعر الملوّنة ─── */}
        <Card style={{gap: spacing.sm}}>
          <View style={priceStyles.row}>
            <View style={{gap: 2, flex: 1, alignItems: 'flex-start'}}>
              <Text style={[type.h3, {color: palette.ink, fontFamily: fonts.bold}]}>
                {product.name}
              </Text>
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                {product.category ? (
                  <View style={[priceStyles.catChip, {backgroundColor: catTile.soft}]}>
                    <Text style={{fontSize: 10.5, color: catTile.ink, fontFamily: fonts.bold}}>
                      {product.category}
                    </Text>
                  </View>
                ) : null}
                <Text style={{fontSize: 10.5, color: palette.muted}}>
                  {soldByWeight ? 'بالكيلو — بأنصاف الكيلو' : product.unit_label ? `الوحدة: ${product.unit_label}` : 'يُباع بالقطعة'}
                </Text>
              </View>
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

          <View style={priceStyles.priceRow}>
            <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
              {formatMoney(effectiveMinor(product))}
            </Text>
            {hasDiscount(product) ? (
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                <Text
                  style={[type.small, {color: palette.muted, textDecorationLine: 'line-through'}]}>
                  {formatMoney(product.price_minor)}
                </Text>
                <View style={[priceStyles.pctChip, {backgroundColor: palette.danger}]}>
                  <Text style={{fontSize: 10, color: '#FFFFFF', fontFamily: fonts.bold}}>
                    خصم {Math.round(product.discount_pct ?? 0)}%
                  </Text>
                </View>
                <Text style={{fontSize: 11, color: palette.success, fontFamily: fonts.medium}}>
                  توفّر {formatMoney(Math.max(0, product.price_minor - effectiveMinor(product)))}
                </Text>
              </View>
            ) : null}
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
          </View>
        </Card>

        {/* ─── خيارات الشراء (مقاس/لون…) ─── */}
        {optionGroups.length > 0 ? (
          <Card style={{gap: spacing.sm}}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name="sliders" size={14} color={catTile.solid} />
              <Text style={[type.h3, {color: palette.ink}]}>اختياراتك</Text>
              {!complete ? (
                <View style={[optStyles.requiredChip, {backgroundColor: palette.dangerSoft, borderColor: palette.danger}]}>
                  <Text style={{fontSize: 9.5, color: palette.danger, fontFamily: fonts.bold}}>
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
                            backgroundColor: active ? catTile.solid : palette.surface,
                            borderColor: active ? catTile.solid : palette.lineStrong,
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

        {/* ─── الكمية — قسم صريح داخل المحتوى كما أمازون ─── */}
        {!outOfStock ? (
          <Card style={{gap: spacing.sm}}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name={soldByWeight ? 'scale' : 'box'} size={14} color={catTile.solid} />
              <Text style={[type.h3, {color: palette.ink}]}>
                {soldByWeight ? 'الوزن المطلوب' : 'الكمية المطلوبة'}
              </Text>
            </View>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'}}>
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
              <View style={{alignItems: 'flex-start', gap: 2}}>
                <Text style={{fontSize: 12.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                  الإجمالي {formatMoney(liveTotal)}
                </Text>
                <Text style={{fontSize: 10.5, color: palette.muted}}>
                  {formatMoney(unitFinalPrice)} × {formatQty(qty, soldByWeight)}
                  {soldByWeight ? ' كيلو' : ' قطعة'}
                  {maxQty < 999
                    ? ` · المتاح ${formatQty(maxQty, soldByWeight)}${soldByWeight ? ' كيلو' : ' قطعة'} فقط`
                    : ''}
                </Text>
              </View>
            </View>
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

        {/* المتجر — سطر مضغوط */}
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

        {/* منتجات مشابهة — توصية ذكية */}
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
                    photoWidth={134}
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

      {/* ─── شريط الشراء السفلي المثبّت — مرئي دائماً ───
       * v3.0: تثبيت مطلق (position:absolute bottom:0) — العدّاد وزر
       * الإضافة مع الإجمالي الحي لا يمكن أن يختفيا خلف المحتوى أياً
       * كان حجمه. هذا هو الزر الذي اشتكى التاجر من اختفائه. */}
      <BottomFixed>
        <View style={bottomStyles.row}>
          <QtyStepper
            qty={cartQty > 0 ? cartQty : qty}
            soldByWeight={soldByWeight}
            max={maxQty}
            onIncrease={() =>
              cartQty > 0
                ? increment(storeRef.id, activeLineKey)
                : setQty(q => Math.min(maxQty, Math.round((q + stepQty) * 1000) / 1000))
            }
            onDecrease={() =>
              cartQty > 0
                ? decrement(storeRef.id, activeLineKey)
                : setQty(q =>
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
                : cartQty > 0
                  ? `في السلة — ${formatMoney(effectiveMinor(product) * cartQty)}`
                  : !complete
                    ? 'اختر المواصفات أولاً'
                    : `أضف للسلة — ${formatMoney(liveTotal)}`
            }
            icon={complete && !outOfStock ? 'cart' : 'sliders'}
            style={{flex: 1}}
            onPress={() => {
              if (cartQty > 0) {
                navigation.getParent()?.navigate('Cart');
                return;
              }
              onAdd();
            }}
            disabled={outOfStock}
          />
        </View>
        <Text style={[bottomStyles.hint, {color: palette.muted}]}>
          {cartQty > 0
            ? `في سلة ${storeRef.name} — اضغط الزر لإتمام الطلب`
            : `${formatMoney(unitFinalPrice)} × ${formatQty(qty, soldByWeight)}${soldByWeight ? ' كيلو' : ' قطعة'} = ${formatMoney(liveTotal)}`
              + (otherVariantCount > 0 ? ` · لديك ${otherVariantCount} مواصفة أخرى في السلة` : '')}
        </Text>
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
                  resizeMethod="resize"
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
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  amount: {fontSize: 26, fontFamily: fonts.black},
  pctChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  catChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wishBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  hint: {
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 7,
  },
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
