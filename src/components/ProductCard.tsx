/**
 * ProductCard.tsx — بطاقة منتج (v3.2 — الجولة 62):
 * ─────────────────────────────────────────────────────────────────
 * طلب التاجر بالنص: «أزل النصوص/الأسعار المحفورة داخل صور المنتجات —
 * اعتمد على تصوير منتج نظيف ومعزول» + «حدود 1px بلون ‎#2A2A2A في
 * الوضع الداكن» + «تفاعلات لمسية (ripple + اهتزاز خفيف للمفضلة)».
 *
 *  • الصورة أصبحت نظيفة تماماً: لا شارات نصية فوقها إطلاقاً — كل
 *    المعلومات (الوحدة/الخيارات/الخصم/التوفر/في السلة) انتقلت لصف
 *    رقائق أسفل الصورة فوق السعر، كي لا تتكرر مع بطاقات السعر
 *    الأصلية ولا تحجب التصوير. الزر الوحيد الباقي فوق الصورة: قلب
 *    المفضلة (فعل لا نص).
 *  • بطاقة للتسوّق والاكتشاف فقط — الطلب يبدأ من صفحة المنتج
 *    (قرار معماري: سلة منفصلة لكل متجر — لا أزرار إضافة عامة).
 *  • الوضع الداكن: حدود ‎#2A2A2A + ظل خافت؛ الفاتح: ظل ناعم.
 *  • v3.3: أُزيل android_ripple كلياً — كان يفجّر انهياراً فورياً عند كل
 *    لمسة على أندرويد (السلوك المطابق لـ v3.1.0 المُجرّب والشغّال).
 *  • v3.5 (الجولة 65 — إصلاح «البطاقة الضخمة لمنتج واحد» في شبكات
 *    المتجر): البطاقة لم تعد تتمدد بـ flex:1 داخل صفوف الشبكة —
 *    كان ذلك يجعل المنتج الوحيد في صفه يفتح شريطاً بكامل عرض
 *    الشاشة بينما صورته بنصف العرض (شكل مقرف). الآن كل شبكة تضع
 *    البطاقة داخل خلية مسقوفة 50%، والصورة بلا photoWidth صريح
 *    تملأ عرض البطاقة كاملاً (وضع الملء) بدل معادلة العرض التقريبية —
 *    البطاقات متطابقة العرض تماماً كصفوف التجارة الحديثة.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {
  radius,
  shadowFor,
  spacing,
  type,
  fonts,
  cardBorderFor,
} from '../theme/tokens';
import {hapticLight} from '../core/haptics';
import {Icon} from './Icon';
import {absoluteUrl} from '../api/client';
import {formatMoney} from '../core/money';
import {effectiveMinor, hasDiscount} from '../core/discount';
import type {CrossProduct, Product, StoreRef} from '../core/types';
import {useCartStore} from '../stores/cartStore';
import {useWishlistStore} from '../stores/wishlistStore';
import {useToastStore} from '../stores/toastStore';
import {useRequireAuth} from '../navigation/RootNavigator';

/** بديل مرسوم عند غياب الصورة — حرف أول الاسم داخل إطار ناعم. */
function PhotoPlaceholder({
  name,
  tint,
  border,
  inkColor,
  width,
  height,
}: {
  name: string;
  tint: string;
  border: string;
  inkColor: string;
  width: number | '100%';
  height: number;
}) {
  const initial = name.trim().charAt(0) || '؟';
  return (
    <View style={[styles.photo, {backgroundColor: tint, borderColor: border, width, height}]}>
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
  photoWidth: photoWidthProp,
  photoHeight = 138,
}: {
  product: CrossProduct | Product;
  storeName?: string;
  storeRef: StoreRef;
  onPress: () => void;
  /** عرض الصورة للأشرطة ذات العرض الثابت (المشابهة/المقترحات) —
   *  بلا قيمة تدخل البطاقة «وضع الملء»: الصورة بعرض البطاقة كاملاً،
   *  والبطاقة بعرض خليتها في الشبكة (v3.5). */
  photoWidth?: number;
  /** v3.2: ارتفاع الصورة — نسخة مضغوطة (110) لشبكات الكاروسيل 2×2. */
  photoHeight?: number;
}) {
  const {palette} = useTheme();
  /* v3.5: وضع الملء — بلا photoWidth صريح تملأ الصورة عرض البطاقة
   * كاملاً؛ عرض البطاقة نفسه تحدده خلية الشبكة التي تحتويها، فتنتهي
   * معضلة «صورة بنصف العرض داخل بطاقة ضخمة بكامل العرض» التي
   * كانت تجعل بطاقة المنتج الوحيد في صفه شكلًا مقرفًا (شكوى الجولة 65). */
  const photoWidth: number | '100%' = photoWidthProp ?? '100%';
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
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({pressed}) => [
        styles.card,
        {
          backgroundColor: palette.surface,
          /* v3.2: حدود البطاقات — ‎#2A2A2A في الداكن (طلب التاجر)،
           * حدود الثيم + ظل ناعم في الفاتح. */
          borderColor: cardBorderFor(palette.isDark),
          opacity: pressed ? 0.92 : 1,
        },
        shadowFor(palette.isDark),
      ]}>
      {/* الصورة — نظيفة ومعزولة تماماً: زر المفضلة فقط فوقها */}
      <View style={styles.photoWrap}>
        {firstImage != null ? (
          <Image
            source={{uri: firstImage}}
            style={[styles.photo, {width: photoWidth, height: photoHeight}]}
            resizeMode="cover"
            resizeMethod="resize"
            progressiveRenderingEnabled
          />
        ) : (
          <PhotoPlaceholder
            name={product.name}
            tint={palette.brandSoft}
            border={palette.brandBorder}
            inkColor={palette.brandDark}
            width={photoWidth}
            height={photoHeight}
          />
        )}

        {/* قلب المفضلة — الفعل الوحيد فوق الصورة (بلا نص) */}
        <Pressable
          onPress={() =>
            requireAuth(() => {
              hapticLight();
              const added = toggleWishlist(product, displayName);
              toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'info');
            })
          }
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={wishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          style={[styles.heartBtn, {backgroundColor: palette.surface}]}>
          <Icon
            name={wishlisted ? 'heartFilled' : 'heart'}
            size={17}
            color={wishlisted ? palette.danger : palette.muted}
          />
        </Pressable>
      </View>

      {/* النصوص */}
      <View style={styles.texts}>
        <Text style={[type.smallMedium, {color: palette.ink}]} numberOfLines={2}>
          {product.name}
        </Text>
        {displayName ? (
          <Text
            style={[{fontSize: 10.5, color: palette.muted, fontFamily: fonts.medium}]}
            numberOfLines={1}>
            من {displayName}
          </Text>
        ) : null}
      </View>

      {/* v3.2: صف الرقائق المعلوماتية — كل ما كان محفوراً فوق الصورة
       * (وحدة/خيارات/خصم/توفر/في السلة/عدد الصور) صار هنا، فوق
       * السعر، بلا حجب للتصوير ولا تكرار مع بطاقة السعر. */}
      <View style={styles.chipsRow}>
        <View style={[styles.chip, {backgroundColor: palette.surfaceAlt}]}>
          <Icon
            name={soldByWeight ? 'scale' : 'box'}
            size={11}
            color={palette.inkSoft}
          />
          <Text style={[styles.chipText, {color: palette.inkSoft}]}>
            {soldByWeight ? 'بالوزن' : (product.unit_label ?? 'قطعة')}
          </Text>
        </View>
        {hasOptions ? (
          <View style={[styles.chip, {backgroundColor: palette.brandSoft}]}>
            <Icon name="sliders" size={11} color={palette.brandDark} />
            <Text style={[styles.chipText, {color: palette.brandDark, fontFamily: fonts.bold}]}>
              خيارات
            </Text>
          </View>
        ) : null}
        {discounted ? (
          <View style={[styles.chip, {backgroundColor: palette.dangerSoft}]}>
            <Icon name="tag" size={11} color={palette.danger} />
            <Text style={[styles.chipText, {color: palette.danger, fontFamily: fonts.bold}]}>
              خصم {Math.round(product.discount_pct ?? 0)}%
            </Text>
          </View>
        ) : null}
        {outOfStock ? (
          <View style={[styles.chip, {backgroundColor: palette.dangerSoft}]}>
            <Text style={[styles.chipText, {color: palette.danger, fontFamily: fonts.bold}]}>
              نفدت
            </Text>
          </View>
        ) : lowStock ? (
          <View style={[styles.chip, {backgroundColor: palette.warningSoft}]}>
            <Text style={[styles.chipText, {color: palette.warning, fontFamily: fonts.bold}]}>
              بقي القليل
            </Text>
          </View>
        ) : null}
        {inCart ? (
          <View style={[styles.chip, {backgroundColor: palette.brandSoft}]}>
            <Icon name="cart" size={11} color={palette.brandDark} />
            <Text style={[styles.chipText, {color: palette.brandDark, fontFamily: fonts.bold}]}>
              في السلة
            </Text>
          </View>
        ) : null}
        {imageCount > 1 ? (
          <View style={[styles.chip, {backgroundColor: palette.surfaceAlt}]}>
            <Icon name="photo" size={11} color={palette.inkSoft} />
            <Text style={[styles.chipText, {color: palette.inkSoft}]}>{imageCount}</Text>
          </View>
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
        {/* سهم «‹» — لمسة تفتح صفحة المنتج لاختيار الكمية والمواصفة */}
        <Icon name="chevronLeft" size={16} color={palette.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* v3.5: لا flex:1 بعد اليوم — البطاقة تملأ عرض الخلية الأم (تمدد
   * افتراضي في الحاويات العمودية)، فلا تتمدد وحدها بكامل الصف حين
   * تكون عنصراً وحيداً في صف شبكة ذي عدد فردي. */
  card: {
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
  texts: {gap: 2, minHeight: 38},
  /* v3.2: صف الرقائق المعلوماتية أسفل الصورة. */
  chipsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    minHeight: 20,
  },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  chipText: {
    fontSize: 9.5,
    fontFamily: fonts.medium,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {fontSize: 16.5, fontFamily: fonts.bold},
  photoIconWrap: {position: 'absolute', bottom: 8, left: 8},
});
