/**
 * StoreCard.tsx — بطاقة متجر: علامة «س» على برتقالي ناعم، الاسم،
 * التصنيف، المنطقة، ووصف مختصر. تنسيقان: صف كامل وبطاقة أفقية
 * للقائمة الأفقية في الرئيسية.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../theme/tokens';
import {Icon} from './Icon';
import type {Store} from '../core/types';

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
  chip: {borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2},
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
