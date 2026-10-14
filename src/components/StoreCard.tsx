/**
 * StoreCard.tsx — بطاقات المتاجر (v2.0):
 *  • CircleStoreCard — بطاقة دائرية مختصرة للشريط الأفقي في الرئيسية
 *    (طلب المستخدم صراحة: مختصرة وبشكل دائري واحترافية): حلقة هوية
 *    حول دائرة بحرف المتجر + النمط + التقييم.
 *  • StoreCard — صف كامل لدليل المتاجر: تقييم، منطقة، رسوم التوصيل
 *    لمنطقتك عند توفرها، وشارة «يخدم منطقتك».
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
import {Icon, type IconName} from './Icon';
import {Stars} from './RatingSheet';
import {formatMoney} from '../core/money';
import {absoluteUrl} from '../api/client';
import type {Store} from '../core/types';

/** نوع المتجر — أيقونة دلالية لكل نشاط (مطاعم، ملابس، بقالة،
 * صيدلية، كافيه…) تُشتق من حقل التصنيف الحر الذي يحدده التاجر. */
export function storeTypeInfo(
  category: string | null | undefined,
): {icon: IconName; label: string} {
  const c = (category ?? '').trim();
  if (/مطعم|مطاعم|شاورما|برجر|فلافل|وجبات|حلويات|معجنات|فطور/.test(c)) {
    return {icon: 'store', label: 'مطعم'};
  }
  if (/كافيه|كافيها|قهوة|مقهى|عصير|بوظة/.test(c)) {
    return {icon: 'box', label: 'كافيه'};
  }
  if (/ملابس|ألبسة|البسة|أزياء|أحذية/.test(c)) {
    return {icon: 'tag', label: 'ملابس'};
  }
  if (/صيدلي|أدوية|دواء/.test(c)) {
    return {icon: 'shield', label: 'صيدلية'};
  }
  if (/خضار|فواكه|خضراوات/.test(c)) {
    return {icon: 'scale', label: 'خضار وفواكه'};
  }
  if (/لحوم|دجاج|أسماك|اسماك/.test(c)) {
    return {icon: 'cash', label: 'لحوم'};
  }
  if (/بقال|سوبر|ماركت|تموين|غذائ/.test(c)) {
    return {icon: 'bag', label: 'بقالة'};
  }
  return {icon: 'grid', label: c.length > 0 ? c : 'متجر'};
}

/** دائرة هوية المتجر — تُستخدم في البطاقات الدائرية وصفحة المتجر.
 *  v2.1: تعرض شعار المتجر الحقيقي المرفوع من تطبيق نقطة البيع عند
 *  توفره (logo_url من الخادم) — وإلا حرف المتجر كالحروف الأولى. */
export function StoreAvatar({
  name,
  size = 46,
  circular = true,
  logoUrl,
}: {
  name: string;
  size?: number;
  circular?: boolean;
  logoUrl?: string | null;
}) {
  const {palette} = useTheme();
  const first = name.trim().charAt(0) || 'س';
  const resolved = absoluteUrl(logoUrl ?? null);
  if (resolved != null) {
    return (
      <Image
        source={{uri: resolved}}
        style={[
          avatarStyles.wrap,
          avatarStyles.logo,
          {
            width: size,
            height: size,
            borderRadius: circular ? size / 2 : size * 0.34,
            borderColor: palette.brandBorder,
          },
        ]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        avatarStyles.wrap,
        {
          width: size,
          height: size,
          borderRadius: circular ? size / 2 : size * 0.34,
          backgroundColor: palette.brandSoft,
          borderColor: palette.brandBorder,
        },
      ]}>
      <Text
        style={[
          {fontSize: size * 0.46, color: palette.brandDark, fontFamily: fonts.black},
        ]}>
        {first}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logo: {
    backgroundColor: '#FFFFFF',
  },
});

/* ═══════════════ البطاقة الدائرية المختصرة (الرئيسية) ═══════════════ */

export function CircleStoreCard({
  store,
  onPress,
}: {
  store: Store;
  onPress: () => void;
}) {
  const {palette} = useTheme();
  const typeInfo = storeTypeInfo(store.category);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={store.name}
      android_ripple={{color: palette.ripple, borderless: false, foreground: true}}
      style={({pressed}) => [
        circleStyles.card,
        {backgroundColor: palette.surface, borderColor: cardBorderFor(palette.isDark)},
        shadowFor(palette.isDark),
        pressed ? {transform: [{scale: 0.95}]} : null,
      ]}>
      {/* حلقة الهوية حول الدائرة — لمسة علامة تجارية عالمية */}
      <View style={[circleStyles.ringWrap, {borderColor: palette.brandBorder}]}>
        <View style={[circleStyles.ringPad, {backgroundColor: palette.surface}]}>
          <StoreAvatar name={store.name} logoUrl={store.logo_url} size={64} />
        </View>
        {/* شارة نوع النشاط أسفل الدائرة */}
        <View
          style={[
            circleStyles.typeBadge,
            {backgroundColor: palette.brand, borderColor: palette.surface},
          ]}>
          <Icon name={typeInfo.icon} size={11} color="#FFFFFF" />
        </View>
      </View>
      <Text
        style={[type.smallMedium, {color: palette.ink, fontFamily: fonts.bold}]}
        numberOfLines={1}>
        {store.name}
      </Text>
      {/* التقييم أو النشاط — أقصى ضغط معلومي في مساحة صغيرة */}
      {store.rating != null && store.rating > 0 ? (
        <Stars rating={store.rating} count={store.ratingCount} size={12} compact />
      ) : (
        <Text style={{fontSize: 10.5, color: palette.muted}} numberOfLines={1}>
          {typeInfo.label}
        </Text>
      )}
    </Pressable>
  );
}

const circleStyles = StyleSheet.create({
  card: {
    width: 96,
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  ringWrap: {
    width: 74,
    height: 74,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPad: {
    width: 66,
    height: 66,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ═══════════════ صف المتجر الكامل (دليل المتاجر) ═══════════════ */

export function StoreCard({
  store,
  onPress,
  myRegion,
}: {
  store: Store;
  onPress: () => void;
  /** منطقة المستخدم — تفعّل شارة «يخدم منطقتك» ورسوم التوصيل. */
  myRegion?: string | null;
}) {
  const {palette} = useTheme();
  const typeInfo = storeTypeInfo(store.category);
  // deliveryFeeMinor لا يرد إلا عند الاستعلام بمنطقة المستخدم (?region=)
  // — وجوده يعني حرفياً «هذا المتجر يوصّل إلى منطقتي».
  const servesMe = myRegion != null && store.deliveryFeeMinor != null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={store.name}
      android_ripple={{color: palette.ripple, borderless: false, foreground: true}}
      style={({pressed}) => [
        vStyles.card,
        {
          backgroundColor: palette.surface,
          borderColor: servesMe
            ? palette.brandBorder
            : cardBorderFor(palette.isDark),
          opacity: pressed ? 0.9 : 1,
        },
        shadowFor(palette.isDark),
      ]}>
      <StoreAvatar name={store.name} size={54} />
      <View style={{flex: 1, gap: 3}}>
        <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
          <Text
            style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold, flex: 1}]}
            numberOfLines={1}>
            {store.name}
          </Text>
          {store.rating != null && store.rating > 0 ? (
            <Stars rating={store.rating} size={13} compact />
          ) : null}
        </View>
        <View style={vStyles.metaRow}>
          {store.category ? (
            <View style={[vStyles.chip, {backgroundColor: palette.brandSoft}]}>
              <Icon name={typeInfo.icon} size={10} color={palette.brandDark} />
              <Text style={[{fontSize: 10.5, color: palette.brandDark, fontFamily: fonts.medium}]}>
                {typeInfo.label}
              </Text>
            </View>
          ) : null}
          {store.region ? (
            <View style={vStyles.metaItem}>
              <Icon name="pin" size={12} color={palette.muted} />
              <Text style={[{fontSize: 11, color: palette.muted}]} numberOfLines={1}>
                {store.region}
              </Text>
            </View>
          ) : null}
        </View>
        {(servesMe || store.deliveryFeeMinor != null) && myRegion != null ? (
          <View style={vStyles.feeRow}>
            <Icon name="truck" size={12} color={palette.success} />
            <Text style={[{fontSize: 11, color: palette.success, fontFamily: fonts.medium}]}>
              يوصّل إلى {myRegion} · {formatMoney(store.deliveryFeeMinor ?? 0)}
            </Text>
          </View>
        ) : store.description ? (
          <Text style={[{fontSize: 12, color: palette.muted}]} numberOfLines={1}>
            {store.description}
          </Text>
        ) : null}
      </View>
      {/* v3.2: سهم «‹» في اتجاه الاستمرار (RTL) بدل «›» المعاكس. */}
      <Icon name="chevronLeft" size={18} color={palette.muted} />
    </Pressable>
  );
}

const vStyles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  metaRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap'},
  metaItem: {flexDirection: 'row-reverse', alignItems: 'center', gap: 3},
  feeRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: 4},
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
});
