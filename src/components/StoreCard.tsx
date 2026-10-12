/**
 * StoreCard.tsx — بطاقة متجر: علامة «س» على برتقالي ناعم، الاسم،
 * التصنيف بأيقونة نوع المتجر (بقالة/مطعم/ملابس/صيدلية/كافيه…)،
 * المنطقة، ووصف مختصر. تنسيقان: صف كامل وبطاقة أفقية للقائمة
 * الأفقية في الرئيسية.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../theme/tokens';
import {Icon, type IconName} from './Icon';
import type {Store} from '../core/types';

/** v1.2: نوع المتجر — أيقونة دلالية لكل نشاط (مطاعم، ملابس، بقالة،
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
  if (/ملابس|ألبسة|البسة|أزياء| أحذية|أحذية|أحذية/.test(c)) {
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

export function StoreAvatar({name, size = 46}: {name: string; size?: number}) {
  const {palette} = useTheme();
  const first = name.trim().charAt(0) || 'س';
  return (
    <View
      style={[
        avatarStyles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size * 0.34,
          backgroundColor: palette.brandSoft,
          borderColor: palette.brandBorder,
        },
      ]}>
      <Text
        style={[
          {fontSize: size * 0.48, color: palette.brandDark, fontFamily: fonts.black},
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
});

export function StoreCard({
  store,
  onPress,
  horizontal = false,
}: {
  store: Store;
  onPress: () => void;
  horizontal?: boolean;
}) {
  const {palette} = useTheme();
  const typeInfo = storeTypeInfo(store.category);
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        horizontal ? hStyles.card : vStyles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.line,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <StoreAvatar name={store.name} size={horizontal ? 56 : 50} />
      <View style={{flex: 1, gap: 3}}>
        <Text
          style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]}
          numberOfLines={1}>
          {store.name}
        </Text>
        <View style={vStyles.metaRow}>
          {store.category ? (
            <View style={[vStyles.chip, {backgroundColor: palette.brandSoft}]}>
              <Icon name={typeInfo.icon} size={10} color={palette.brandDark} />
              <Text style={[{fontSize: 10.5, color: palette.brandDark, fontFamily: fonts.medium}]}>
                {store.category}
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
        {store.description && !horizontal ? (
          <Text style={[{fontSize: 12, color: palette.muted}]} numberOfLines={1}>
            {store.description}
          </Text>
        ) : null}
      </View>
      <Icon name="forward" size={18} color={palette.muted} />
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
  metaRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  metaItem: {flexDirection: 'row-reverse', alignItems: 'center', gap: 3},
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
});

const hStyles = StyleSheet.create({
  card: {
    width: 240,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
});
