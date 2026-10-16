/**
 * ProductCards.tsx — عائلة البطاقات المتنوعة (v4.0 — الجولة 68).
 * ─────────────────────────────────────────────────────────────────
 * طلب المستخدم: «أشكال البطاقات الخاصة بالمنتجات تكون متنوعة على
 * حسب الأفضل في الشكل لكل قسم ماذا يحتاج واستغلال المساحات».
 *
 * القاعدة: لكل سياق عرض بطاقته الأنسب — لا قالب واحد لكل شيء:
 *  • ProductCard (الأصلية) — شبكات المتجر وشبكة 2×2: بطاقة كاملة
 *    بصف الرقائق والمعلومات التفصيلية (البقاء كما هو).
 *  • ProductRailCard — أشرطة الرئيسية الأفقية (أنواع المتاجر +
 *    مقترحات لك): بطاقة مضغوطة «تنقيّة سريعة» — صورة مربعة، اسم
 *    بسطر واحد، سعر فقط، وقلب صغير — مساحة أقل لبطاقة أكثر في
 *    الشاشة الواحدة واستغلال أمثل للعرض الأفقي.
 *  • WeeklyOfferCard — قسم «عروض هذا الأسبوع»: بطاقة أفقية بلغة
 *    «صفقة» كاملة (نسبة الخصم الكبيرة + السعر الجديد/القديم +
 *    سطر التوفير + المتجر) — أوسع وأوضح من بطاقة التصفح لأن قرار
 *    «الصفقة» يحتاج معلومة كاملة بنظرة واحدة.
 *
 * كل البطاقات: ضغط حي (scale 0.97) بلا ripple (محظور منذ v3.3)
 * + نبضة قلب المفضلة (usePop) — نفس لغة الحركة الموحّدة.
 */
import React from 'react';
import {Animated, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {
  radius,
  shadowFor,
  fonts,
  cardBorderFor,
} from '../theme/tokens';
import {hapticLight} from '../core/haptics';
import {usePop} from '../core/motion';
import {Icon} from './Icon';
import {absoluteUrl} from '../api/client';
import {formatMoney} from '../core/money';
import {effectiveMinor, hasDiscount} from '../core/discount';
import type {CrossProduct, Product, StoreRef} from '../core/types';
import {useWishlistStore} from '../stores/wishlistStore';
import {useToastStore} from '../stores/toastStore';
import {useRequireAuth} from '../navigation/RootNavigator';

/* ─── مشترك صغير: قلب المفضلة النابض ─── */
function HeartButton({
  product,
  storeName,
  size = 15,
}: {
  product: Product | CrossProduct;
  storeName: string;
  size?: number;
}) {
  const {palette} = useTheme();
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);
  const toast = useToastStore(s => s.show);
  const requireAuth = useRequireAuth();
  const heart = usePop();
  return (
    <Pressable
      onPress={() =>
        requireAuth(() => {
          hapticLight();
          heart.pop();
          const added = toggleWishlist(product, storeName);
          toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'info');
        })
      }
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={wishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
      style={[heartStyles.btn, {backgroundColor: palette.surface}]}>
      <Animated.View style={heart.style}>
        <Icon
          name={wishlisted ? 'heartFilled' : 'heart'}
          size={size}
          color={wishlisted ? palette.danger : palette.muted}
        />
      </Animated.View>
    </Pressable>
  );
}

const heartStyles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 27,
    height: 27,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: {width: 0, height: 1},
    elevation: 2,
  },
});

/* ═══════════════ ProductRailCard ═══════════════
 * بطاقة الشريط الأفقي المضغوطة — صورة مربعة 1:1، اسم واحد، سعر،
 * شارة خصم إن وجدت — لا رقائق معلومات ولا متجر (الشريط كله من
 * متجر واحد غالباً) — بطاقتان ونصف في عرض الشاشة بدل بطاقة. */
export function ProductRailCard({
  product,
  storeName,
  storeRef: _storeRef,
  onPress,
  width = 148,
}: {
  product: CrossProduct | Product;
  storeName?: string;
  storeRef: StoreRef;
  onPress: () => void;
  width?: number;
}) {
  const {palette} = useTheme();
  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const displayName = storeName ?? (product as CrossProduct).store_name ?? '';
  const discounted = hasDiscount(product);
  const finalPrice = effectiveMinor(product);
  const firstImage = absoluteUrl(product.images?.[0]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({pressed}) => [
        railStyles.card,
        {width},
        {
          backgroundColor: palette.surface,
          borderColor: cardBorderFor(palette.isDark),
          opacity: pressed ? 0.92 : 1,
          transform: [{scale: pressed ? 0.97 : 1}],
        },
        shadowFor(palette.isDark),
      ]}>
      <View style={railStyles.photoWrap}>
        {firstImage != null ? (
          <Image
            source={{uri: firstImage}}
            style={railStyles.photo}
            resizeMode="cover"
            resizeMethod="resize"
            progressiveRenderingEnabled
          />
        ) : (
          <View
            style={[
              railStyles.photo,
              {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder, borderWidth: 1},
            ]}>
            <Text
              style={{
                fontSize: 30,
                fontFamily: fonts.black,
                color: palette.brandDark,
                opacity: 0.4,
              }}>
              {product.name.trim().charAt(0) || '؟'}
            </Text>
          </View>
        )}
        <HeartButton product={product} storeName={displayName} size={14} />
        {outOfStock ? (
          <View style={[railStyles.stockVeil, {backgroundColor: palette.overlay}]}>
            <Text style={{fontSize: 10.5, color: '#FFFFFF', fontFamily: fonts.bold}}>
              نفدت
            </Text>
          </View>
        ) : null}
      </View>

      <View style={railStyles.texts}>
        <Text
          style={{fontSize: 12.5, color: palette.ink, fontFamily: fonts.medium, lineHeight: 17}}
          numberOfLines={1}>
          {product.name}
        </Text>
        <View style={railStyles.priceRow}>
          {discounted ? (
            <>
              <Text style={{fontSize: 15, color: palette.danger, fontFamily: fonts.bold}}>
                {formatMoney(finalPrice)}
              </Text>
              <Text
                style={{
                  fontSize: 10.5,
                  color: palette.muted,
                  fontFamily: fonts.medium,
                  textDecorationLine: 'line-through',
                }}>
                {formatMoney(product.price_minor)}
              </Text>
            </>
          ) : (
            <Text style={{fontSize: 15, color: palette.brandDark, fontFamily: fonts.bold}}>
              {formatMoney(product.price_minor)}
            </Text>
          )}
          {soldByWeight ? (
            <Text style={{fontSize: 9.5, color: palette.muted}}>/كيلو</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const railStyles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 7,
    gap: 7,
  },
  photoWrap: {position: 'relative'},
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockVeil: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  texts: {gap: 3},
  priceRow: {flexDirection: 'row-reverse', alignItems: 'baseline', gap: 5},
});

/* ═══════════════ WeeklyOfferCard ═══════════════
 * بطاقة «عرض الأسبوع» الأفقية — بلغة صفقة كاملة: نسبة الخصم في
 * قرص أحمر كبير، صورة مربعة، الاسم بسطرين، السعر الجديد بخط
 * كبير + القديم مشطوباً + سطر «وفّر» أخضر + سطر المتجر — كل
 * قرار الشراء بنظرة واحدة بلا ضغطات (أمازون/نون في بطاقات
 * الديلز الأفقية). */
export function WeeklyOfferCard({
  product,
  onPress,
  width = 252,
}: {
  product: CrossProduct | Product;
  onPress: () => void;
  width?: number;
}) {
  const {palette} = useTheme();
  const displayName = (product as CrossProduct).store_name ?? '';
  const discounted = hasDiscount(product);
  const finalPrice = effectiveMinor(product);
  const savedMinor = Math.max(0, product.price_minor - finalPrice);
  const discountPct = Math.round(product.discount_pct ?? 0);
  const firstImage = absoluteUrl(product.images?.[0]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`عرض: ${product.name}`}
      style={({pressed}) => [
        offerStyles.card,
        {width},
        {
          backgroundColor: palette.surface,
          borderColor: discounted ? palette.danger + '80' : cardBorderFor(palette.isDark),
          opacity: pressed ? 0.93 : 1,
          transform: [{scale: pressed ? 0.97 : 1}],
        },
        shadowFor(palette.isDark),
      ]}>
      {/* قرص نسبة الخصم — واجهة الصفقة الأبرز */}
      <View style={[offerStyles.pctDisc, {backgroundColor: palette.danger}]}>
        <Text style={{fontSize: 15, color: '#FFFFFF', fontFamily: fonts.black, lineHeight: 17}}>
          {discountPct > 0 ? `${discountPct}%` : 'عرض'}
        </Text>
        {discountPct > 0 ? (
          <Text style={{fontSize: 8, color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold}}>
            خصم
          </Text>
        ) : null}
      </View>

      <View style={offerStyles.photoWrap}>
        {firstImage != null ? (
          <Image
            source={{uri: firstImage}}
            style={offerStyles.photo}
            resizeMode="cover"
            resizeMethod="resize"
            progressiveRenderingEnabled
          />
        ) : (
          <View
            style={[
              offerStyles.photo,
              {backgroundColor: palette.dangerSoft, alignItems: 'center', justifyContent: 'center'},
            ]}>
            <Text style={{fontSize: 30, fontFamily: fonts.black, color: palette.danger, opacity: 0.35}}>
              {product.name.trim().charAt(0) || '؟'}
            </Text>
          </View>
        )}
      </View>

      <View style={offerStyles.texts}>
        <Text
          style={{fontSize: 13, color: palette.ink, fontFamily: fonts.bold, lineHeight: 18}}
          numberOfLines={2}>
          {product.name}
        </Text>
        <View style={{flexDirection: 'row-reverse', alignItems: 'baseline', gap: 6}}>
          <Text style={{fontSize: 18, color: palette.danger, fontFamily: fonts.black}}>
            {formatMoney(finalPrice)}
          </Text>
          <Text
            style={{
              fontSize: 11.5,
              color: palette.muted,
              fontFamily: fonts.medium,
              textDecorationLine: 'line-through',
            }}>
            {formatMoney(product.price_minor)}
          </Text>
        </View>
        {savedMinor > 0 ? (
          <Text style={{fontSize: 10.5, color: palette.success, fontFamily: fonts.bold}}>
            وفّر {formatMoney(savedMinor)}
          </Text>
        ) : null}
        {displayName ? (
          <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 1}}>
            <Icon name="store" size={10} color={palette.muted} />
            <Text style={{fontSize: 10, color: palette.muted}} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const offerStyles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    borderRadius: radius.lg,
    borderWidth: 1.25,
    padding: 10,
    gap: 10,
    alignItems: 'center',
  },
  pctDisc: {
    position: 'absolute',
    top: -10,
    right: 12,
    zIndex: 5,
    elevation: 5,
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
  },
  photoWrap: {position: 'relative'},
  photo: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  texts: {flex: 1, gap: 3, alignItems: 'flex-start'},
});
