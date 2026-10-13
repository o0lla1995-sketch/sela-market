/**
 * ProductCard.tsx — بطاقة منتج (v2.8 — الجولة 59):
 * البطاقة للتسوّق والاكتشاف فقط — الطلب يبدأ من صفحة المنتج
 * (طلب التاجر بالنص: «لا أريد الطلب من زر إضافة في بطاقة المنتج»).
 * كما أمازون ونون: لمسة البطاقة تفتح صفحة المنتج لاختيار الكمية/
 * الوزن/المواصفة هناك. شارة «في السلة» تخبر المستخدم بما أضافه.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {radius, shadowFor, spacing, type, fonts} from '../theme/tokens';
import {Icon} from './Icon';
import {absoluteUrl} from '../api/client';
import {formatMoney} from '../core/money';
import {effectiveMinor, hasDiscount} from '../core/discount';
import type {CrossProduct, Product, StoreRef} from '../core/types';
import {useCartStore} from '../stores/cartStore';
import {useWishlistStore} from '../stores/wishlistStore';
import {useToastStore} from '../stores/toastStore';
import {useRequireAuth} from '../navigation/RootNavigator';

/** بديل مرسوم عند غياب الصورة — سهم أول الاسم داخل إطار ناعم. */
function PhotoPlaceholder({name, tint, border, inkColor}: {name: string; tint: string; border: string; inkColor: string}) {
  const initial = name.trim().charAt(0) || '؟';
  return (
    <View style={[styles.photo, {backgroundColor: tint, borderColor: border}]}>
      <Text style={{fontSize: 40, fontFamily: fonts.black, color: inkColor, opacity: 0.35}}>
        {initial}
      </Text>
      <View style={styles.photoIconWrap}>
        <Icon name="photo" size={14} color={inkColor} />
      </View>
    </View>
  );
}

export function ProductCard({
  product,
  storeName,
  storeRef,
  onPress,
}: {
  product: CrossProduct | Product;
  storeName?: string;
  storeRef: StoreRef;
  onPress: () => void;
}) {
  const {palette} = useTheme();
  /* v2.8: لا إضافة سريعة من البطاقة — عدّاد السلة معلوماتي فقط
   * (شارة «في السلة»)، والطلب كله من صفحة المنتج. */
  const cartQtyForProduct = useCartStore(
    s =>
      (s.carts[String(storeRef.id)]?.lines ?? [])
        .filter(l => l.productId === product.id)
        .reduce((sum, l) => sum + l.quantity, 0),
  );
  const hasOptions = (product.options ?? []).length > 0;
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);
  const toast = useToastStore(s => s.show);
  /* v2.6: الزائر يتصفح فقط — المفضلة تتطلب دخولاً. */
  const requireAuth = useRequireAuth();

  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const displayName = storeName ?? (product as CrossProduct).store_name ?? '';
  const imageCount = product.images?.length ?? 0;
  const firstImage = absoluteUrl(product.images?.[0]);
  // v2.1: خصم التاجر — السعر المعروض هو بعد الخصم، والأصلي مشطوب
  const discounted = hasDiscount(product);
  const finalPrice = effectiveMinor(product);
  const inCart = cartQtyForProduct > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.line,
          opacity: pressed ? 0.92 : 1,
        },
        shadowFor(palette.isDark),
      ]}>
      {/* الصورة + الشارات */}
      <View style={styles.photoWrap}>
        {firstImage != null ? (
          <Image
            source={{uri: firstImage}}
            style={styles.photo}
            resizeMode="cover"
            progressiveRenderingEnabled
          />
        ) : (
          <PhotoPlaceholder
            name={product.name}
            tint={palette.brandSoft}
            border={palette.brandBorder}
            inkColor={palette.brandDark}
          />
        )}

        {/* شارة الوحدة أعلى الصورة */}
        <View
          style={[styles.unitChip, {backgroundColor: palette.overlay}]}>
          <Icon
            name={soldByWeight ? 'scale' : 'box'}
            size={12}
            color="#FFFFFF"
          />
          <Text style={{fontSize: 10, color: '#FFFFFF', fontFamily: fonts.medium}}>
            {soldByWeight ? 'بالوزن' : (product.unit_label ?? 'قطعة')}
          </Text>
        </View>

        {/* شارة خيارات (مقاس/لون) — المنتج يحتاج اختيار مواصفة */}
        {hasOptions ? (
          <View style={[styles.optionsChip, {backgroundColor: palette.brand}]}>
            <Icon name="sliders" size={11} color="#FFFFFF" />
            <Text style={{fontSize: 9.5, color: '#FFFFFF', fontFamily: fonts.bold}}>
              خيارات
            </Text>
          </View>
        ) : null}

        {/* قلب المفضلة */}
        <Pressable
          onPress={() =>
            requireAuth(() => {
              const added = toggleWishlist(product, displayName);
              toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'info');
            })
          }
          hitSlop={10}
          style={[styles.heartBtn, {backgroundColor: palette.surface}]}>
          <Icon
            name={wishlisted ? 'heartFilled' : 'heart'}
            size={17}
            color={wishlisted ? palette.danger : palette.muted}
          />
        </Pressable>

        {/* شارات حالة على الصورة */}
        {discounted ? (
          <View style={[styles.discountBadge, {backgroundColor: palette.danger}]}>
            <Icon name="tag" size={10} color="#FFFFFF" />
            <Text style={styles.stockBadgeText}>
              خصم {Math.round(product.discount_pct ?? 0)}%
            </Text>
          </View>
        ) : null}
        {outOfStock ? (
          <View style={[styles.stockBadge, {backgroundColor: palette.danger}]}>
            <Text style={styles.stockBadgeText}>نفدت</Text>
          </View>
        ) : lowStock ? (
          <View style={[styles.stockBadge, {backgroundColor: palette.warning}]}>
            <Text style={styles.stockBadgeText}>بقي القليل</Text>
          </View>
        ) : null}

        {/* شارة «في السلة» — معلوماتية، والتعديل من صفحة المنتج */}
        {inCart ? (
          <View style={[styles.cartBadge, {backgroundColor: palette.brand}]}>
            <Icon name="cart" size={10} color="#FFFFFF" />
            <Text style={{fontSize: 9.5, color: '#FFFFFF', fontFamily: fonts.bold}}>
              في السلة
            </Text>
          </View>
        ) : null}

        {/* عدّاد الصور */}
        {imageCount > 1 ? (
          <View style={[styles.countChip, {backgroundColor: palette.overlay}]}>
            <Icon name="photo" size={10} color="#FFFFFF" />
            <Text style={{fontSize: 9.5, color: '#FFFFFF', fontFamily: fonts.medium}}>
              {imageCount}
            </Text>
          </View>
        ) : null}
      </View>

      {/* النصوص */}
      <View style={styles.texts}>
        <Text style={[type.smallMedium, {color: palette.ink}]} numberOfLines={2}>
          {product.name}
        </Text>
        {displayName ? (
          <Text style={[{fontSize: 10.5, color: palette.muted, fontFamily: fonts.medium}]} numberOfLines={1}>
            من {displayName}
          </Text>
        ) : null}
      </View>

      {/* السعر — والإشارة إلى صفحة المنتج للاختيار */}
      <View style={styles.bottomRow}>
        <View style={{gap: 0, alignItems: 'flex-start', flex: 1}}>
          {discounted ? (
            <>
              <Text
                style={[
                  styles.priceStruck,
                  {color: palette.muted, textDecorationLine: 'line-through'},
                ]}>
                {formatMoney(product.price_minor)}
              </Text>
              <Text style={[styles.price, {color: palette.brandDark}]}>
                {formatMoney(finalPrice)}
              </Text>
            </>
          ) : (
            <Text style={[styles.price, {color: palette.brandDark}]}>
              {formatMoney(product.price_minor)}
            </Text>
          )}
        </View>
        {/* v2.8: زر الإضافة حُذف من البطاقة (طلب التاجر) — سهم صغير
         * يوحى بأن اللمسة تفتح صفحة المنتج للاختيار والطلب. */}
        <View style={styles.openHint}>
          {hasOptions ? (
            <View style={[styles.optionsHintChip, {backgroundColor: palette.brandSoft}]}>
              <Icon name="sliders" size={11} color={palette.brandDark} />
              <Text style={{fontSize: 9.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                خيارات
              </Text>
            </View>
          ) : null}
          <Icon name="chevronLeft" size={16} color={palette.muted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  priceStruck: {
    fontSize: 11,
    fontFamily: fonts.medium,
    lineHeight: 14,
  },
  photoWrap: {position: 'relative'},
  photo: {
    width: '100%',
    height: 138,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  unitChip: {
    position: 'absolute',
    top: 7,
    right: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  heartBtn: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadge: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockBadgeText: {fontSize: 10, color: '#FFFFFF', fontFamily: fonts.bold},
  discountBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionsChip: {
    position: 'absolute',
    top: 7,
    left: 44,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  countChip: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  texts: {gap: 2, minHeight: 38},
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {fontSize: 16.5, fontFamily: fonts.bold},
  /* v2.8: إحالة بصرية صغيرة — لا زر إضافة في البطاقة. */
  openHint: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  optionsHintChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cartBadge: {
    position: 'absolute',
    top: 7,
    right: 64,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  photoIconWrap: {position: 'absolute', bottom: 8, left: 8},
});
