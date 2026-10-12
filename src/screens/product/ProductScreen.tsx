/**
 * ProductScreen.tsx — صفحة المنتج (v1.1 — معرض صور احترافي):
 * معرض صور أفقي بنقاط وعدّاد (صور التسجيل البصري الثلاث للمنتج من
 * نقطة البيع — مضغوطة WebP خفيفة) + عارض ملء الشاشة، بطاقة سعر
 * كبيرة، حالة المخزون، بطاقة المتجر، عدّاد كمية، إضافة للسلة
 * والمفضلة، وقسم «من نفس التصنيف» بذكاء محلي.
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
import {useCartStore} from '../../stores/cartStore';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useToastStore} from '../../stores/toastStore';
import type {Product} from '../../core/types';
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
  const cartQty = useCartStore(
    s => s.carts[String(storeRef.id)]?.lines.find(l => l.productId === product.id)?.quantity ?? 0,
  );
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);
  const toast = useToastStore(s => s.show);

  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;

  const images = useMemo(
    () => (product.images ?? []).map(absoluteUrl).filter((u): u is string => u != null),
    [product.images],
  );
  const [slide, setSlide] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // منتجات من نفس التصنيف داخل المتجر نفسه (اقتراح ذكي خفيف)
  const [similar, setSimilar] = useState<Product[]>([]);
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
    addProduct(storeRef, product);
    toast(`أُضيف «${product.name}» إلى سلة ${storeRef.name}`, 'success');
  };

  const galleryHeight = screenWidth * 0.86;

  return (
    <Screen>
      <AppHeader
        title={product.name}
        subtitle={`من ${storeRef.name}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} showsVerticalScrollIndicator={false}>
        {/* ─── معرض الصور ─── */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                setSlide(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
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

        {/* ─── بطاقة السعر ─── */}
        <Card style={{gap: spacing.md}}>
          <View style={priceStyles.row}>
            <View style={{gap: 2, flex: 1, alignItems: 'flex-start'}}>
              <Text style={[type.small, {color: palette.muted}]}>السعر</Text>
              <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
                {formatMoney(product.price_minor)}
              </Text>
              <Text style={[{fontSize: 12, color: palette.muted}]}>
                {soldByWeight
                  ? `لكل ${product.unit_label ?? 'كيلو'} (يُطلب بأنصاف الكيلو)`
                  : product.unit_label
                    ? `لكل ${product.unit_label}`
                    : 'للقطعة'}
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
                {fontSize: 12.5, fontFamily: fonts.medium},
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

      {/* شريط الإضافة السفلي */}
      <BottomFixed>
        {cartQty > 0 ? (
          <View style={bottomStyles.row}>
            <QtyStepper
              qty={cartQty}
              soldByWeight={soldByWeight}
              onIncrease={() => increment(storeRef.id, product.id)}
              onDecrease={() => decrement(storeRef.id, product.id)}
            />
            <Button
              label={`في السلة — ${formatMoney(product.price_minor * cartQty)}`}
              variant="soft"
              style={{flex: 1}}
              onPress={() => navigation.getParent()?.navigate('Cart')}
            />
          </View>
        ) : (
          <Button
            label={outOfStock ? 'غير متوفر حالياً' : 'إضافة إلى السلة'}
            icon="cart"
            onPress={onAdd}
            disabled={outOfStock}
          />
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
