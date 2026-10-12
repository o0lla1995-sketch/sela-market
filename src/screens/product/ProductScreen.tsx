/**
 * ProductScreen.tsx — صفحة المنتج (v1.2 — خيارات الشراء + شفافية الوحدة):
 * ─────────────────────────────────────────────────────────────────
 * معرض صور بنقاط وعدّاد + عارض ملء الشاشة، بطاقة سعر كبيرة تشرح
 * وحدة البيع (كيلو/قطعة/علبة…) بلا لبس، مجموعات خيارات الشراء
 * (مقاسات/ألوان) كرقائق إلزامية قبل الإضافة — المنتج نفسه بخيارين
 * سطران مستقلان في السلة، عدّاد كمية بأنصاف الكيلو للوزن مع إجمالي
 * حيّ يتحدث مع كل لمسة، حالة المخزون، بطاقة المتجر، و«المزيد من
 * التصنيف».
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
import {formatMoney} from '../../core/money';
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
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Product'>;

export function ProductScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const {width: screenWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {product, storeRef} = route.params;

  const addProduct = useCartStore(s => s.addProduct);
  const increment = useCartStore(s => s.increment);
  const decrement = useCartStore(s => s.decrement);
  const toast = useToastStore(s => s.show);
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);

  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const optionGroups: ProductOptionGroup[] = product.options ?? [];

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

  // منتجات من نفس التصنيف داخل المتجر نفسه (اقتراح ذكي خفيف)
  const [similar, setSimilar] = useState<Product[]>([]);

  // v2.0: مشاهدة المنتج ترفع وزن تصنيفه في «مقترحات لك» — إشارة
  // خفيفة (وزن 1) لا تُرسل لأي خادم (كل شيء محلي على الجهاز).
  useEffect(() => {
    useInterestStore.getState().trackView(product.category);
  }, [product.id, product.category]);
  useEffect(() => {
    let alive = true;
    if (product.category == null) {
      return;
    }
    void getStoreProducts(storeRef.id, {per: 40})
      .then(list => {
        if (!alive) {
          return;
        }
        setSimilar(
          list
            .filter(p => p.category === product.category && p.id !== product.id)
            .slice(0, 6),
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [product.category, product.id, storeRef.id]);

  const onAdd = () => {
    if (outOfStock) {
      toast('نفدت الكمية من المتجر حالياً', 'danger');
      return;
    }
    if (!complete) {
      toast(`اختر ${optionGroups.find(g => selection[g.name] == null)!.name} أولاً`, 'danger');
      return;
    }
    addProduct(storeRef, product, variantText);
    toast(`أُضيف «${product.name}» إلى سلة ${storeRef.name}`, 'success');
  };

  /** وحدة البيع المعروضة بلا لبس. */
  const unitText = soldByWeight
    ? `بالكيلو — يُطلب بأنصاف الكيلو (٠٫٥ كجم وأكثر)`
    : product.unit_label
      ? `الوحدة: ${product.unit_label}`
      : 'يُباع بالقطعة';

  const galleryHeight = screenWidth * 0.86;

  return (
    <Screen>
      <AppHeader
        title={product.name}
        subtitle={`من ${storeRef.name}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl}} showsVerticalScrollIndicator={false}>
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
                    style={{width: screenWidth - spacing.lg * 2, height: galleryHeight}}
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

        {/* ─── بطاقة السعر + وحدة البيع ─── */}
        <Card style={{gap: spacing.md}}>
          <View style={priceStyles.row}>
            <View style={{gap: 2, flex: 1, alignItems: 'flex-start'}}>
              <Text style={[type.small, {color: palette.muted}]}>السعر</Text>
              <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
                {formatMoney(product.price_minor)}
              </Text>
            </View>
            <View
              style={[
                priceStyles.bigIcon,
                {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder},
              ]}>
              <Icon
                name={soldByWeight ? 'scale' : 'box'}
                size={34}
                color={palette.brandDark}
              />
            </View>
            <Pressable
              onPress={() => {
                const added = toggleWishlist(product, storeRef.name);
                toast(added ? 'حُفظ في المفضلة' : 'أُزيل من المفضلة', 'info');
              }}
              hitSlop={10}
              style={[priceStyles.wishBtn, {backgroundColor: palette.surfaceAlt}]}>
              <Icon
                name={wishlisted ? 'heartFilled' : 'heart'}
                size={22}
                color={wishlisted ? palette.danger : palette.muted}
              />
            </Pressable>
          </View>

          {/* وحدة البيع — شفافية كاملة قبل الشراء */}
          <View
            style={[
              priceStyles.unitRow,
              {backgroundColor: palette.infoSoft, borderColor: palette.info},
            ]}>
            <Icon name={soldByWeight ? 'scale' : 'box'} size={16} color={palette.info} />
            <Text style={[{fontSize: 12.5, color: palette.info, fontFamily: fonts.medium, flex: 1}]}>
              {unitText}
            </Text>
          </View>

          {/* حالة المخزون */}
          <View
            style={[
              priceStyles.stockRow,
              outOfStock
                ? {backgroundColor: palette.dangerSoft, borderColor: palette.danger}
                : lowStock
                  ? {backgroundColor: palette.warningSoft, borderColor: palette.warning}
                  : {backgroundColor: palette.successSoft, borderColor: palette.success},
            ]}>
            <Icon
              name={outOfStock ? 'xCircle' : lowStock ? 'warning' : 'checkCircle'}
              size={16}
              color={outOfStock ? palette.danger : lowStock ? palette.warning : palette.success}
            />
            <Text
              style={[
                {fontSize: 12.5, fontFamily: fonts.medium, flex: 1},
                {color: outOfStock ? palette.danger : lowStock ? palette.warning : palette.success},
              ]}>
              {outOfStock
                ? 'نفدت الكمية حالياً — جرّب متجراً آخر أو عد لاحقاً'
                : lowStock
                  ? `بقي القليل (${product.stock}${soldByWeight ? ' كيلو' : ' قطعة'} تقريباً)`
                  : `متوفر (${Math.floor(product.stock)}${soldByWeight ? ' كيلو' : ' قطعة'} تقريباً)`}
            </Text>
          </View>

          {/* التصنيف */}
          {product.category ? (
            <Pressable
              onPress={() => navigation.navigate('Category', {category: product.category!})}
              style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name="tag" size={14} color={palette.muted} />
              <Text style={[{fontSize: 12.5, color: palette.brand, fontFamily: fonts.medium}]}>
                {product.category}
              </Text>
            </Pressable>
          ) : null}
        </Card>

        {/* ─── خيارات الشراء (مقاس/لون…) ─── */}
        {optionGroups.length > 0 ? (
          <Card style={{gap: spacing.md}}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name="sliders" size={16} color={palette.brandDark} />
              <Text style={[type.h3, {color: palette.ink}]}>اختياراتك</Text>
              {!complete ? (
                <View style={[optStyles.requiredChip, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
                  <Text style={{fontSize: 10, color: palette.brandDark, fontFamily: fonts.bold}}>
                    مطلوب
                  </Text>
                </View>
              ) : null}
            </View>
            {optionGroups.map(group => (
              <View key={group.name} style={{gap: spacing.sm}}>
                <Text style={[type.smallMedium, {color: palette.inkSoft}]}>
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
                          style={[
                            {fontSize: 13},
                            {
                              color: active ? '#FFFFFF' : palette.ink,
                              fontFamily: active ? fonts.bold : fonts.medium,
                            },
                          ]}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {variantText != null ? (
              <Text style={[{fontSize: 11.5, color: palette.muted}]}>
                ستُضاف بالمواصفة: {variantText}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* الوصف */}
        {product.description ? (
          <Card style={{gap: spacing.sm}}>
            <Text style={[type.h3, {color: palette.ink}]}>عن المنتج</Text>
            <Text style={[type.small, {color: palette.inkSoft, lineHeight: 22}]}>
              {product.description}
            </Text>
          </Card>
        ) : null}

        {/* المتجر */}
        <Pressable onPress={() => navigation.navigate('Store', {storeId: storeRef.id, storeName: storeRef.name})}>
          <Card style={{gap: spacing.md}}>
            <View style={priceStyles.row}>
              <StoreAvatar name={storeRef.name} size={52} />
              <View style={{flex: 1, gap: 2, alignItems: 'flex-start'}}>
                <Text style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]}>
                  {storeRef.name}
                </Text>
                {storeRef.storeNumber ? (
                  <Text style={[{fontSize: 11.5, color: palette.muted}]}>{storeRef.storeNumber}</Text>
                ) : null}
              </View>
              <Icon name="forward" size={18} color={palette.muted} />
            </View>
            <Text style={[{fontSize: 12, color: palette.muted}]}>
              اضغط لزيارة المتجر وتصفح كل منتجاته ومناطق توصيله
            </Text>
          </Card>
        </Pressable>

        {/* من نفس التصنيف */}
        {similar.length > 0 ? (
          <View style={{gap: spacing.md}}>
            <SectionTitle
              title={`المزيد من ${product.category ?? 'التصنيف'}`}
              actionLabel="كل التصنيف"
              onAction={() =>
                navigation.navigate('Category', {category: product.category ?? ''})
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
                <View style={{width: 168}}>
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

      {/* شريط الإضافة السفلي — إجمالي حيّ + خيارات قبل الإضافة */}
      <BottomFixed>
        {cartQty > 0 ? (
          <View style={bottomStyles.row}>
            <QtyStepper
              qty={cartQty}
              soldByWeight={soldByWeight}
              onIncrease={() => increment(storeRef.id, activeLineKey)}
              onDecrease={() => decrement(storeRef.id, activeLineKey)}
            />
            <Button
              label={`في السلة — ${formatMoney(product.price_minor * cartQty)}`}
              variant="soft"
              style={{flex: 1}}
              onPress={() => navigation.getParent()?.navigate('Cart')}
            />
          </View>
        ) : (
          <View style={{gap: 6}}>
            <Button
              label={
                outOfStock
                  ? 'غير متوفر حالياً'
                  : !complete
                    ? 'اختر المواصفات أولاً'
                    : 'إضافة إلى السلة'
              }
              icon={complete ? 'cart' : 'sliders'}
              onPress={onAdd}
              disabled={outOfStock}
            />
            {otherVariantCount > 0 ? (
              <Text style={[{fontSize: 11, color: palette.muted, textAlign: 'center'}]}>
                لديك {otherVariantCount} مواصفة أخرى من هذا المنتج في السلة
              </Text>
            ) : null}
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
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
  amount: {fontSize: 30, fontFamily: fonts.black},
  bigIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  stockRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
});

const optStyles = StyleSheet.create({
  valuesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  valueChip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    minWidth: 52,
    alignItems: 'center',
  },
  requiredChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
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
