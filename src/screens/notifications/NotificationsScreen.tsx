/**
 * NotificationsScreen.tsx — مركز الإشعارات: تحديثات حالة الطلبات
 * محفوظة محلياً (آخر 100) مع وقت نسبي وزر تعليم الكل كمقروء.
 */
import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts, toneColors} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, EmptyState, Screen} from '../../components/ui';
import {relativeTime} from '../../core/time';
import {useNotificationsStore} from '../../stores/notificationsStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'Notifications'>;

export function NotificationsScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const items = useNotificationsStore(s => s.items);
  const unread = useNotificationsStore(s => s.unread);
  const markAllRead = useNotificationsStore(s => s.markAllRead);
  const clear = useNotificationsStore(s => s.clear);

  return (
    <Screen>
      <AppHeader
        title="الإشعارات"
        subtitle={items.length > 0 ? `${items.length} إشعاراً${unread > 0 ? ` · ${unread} جديد` : ''}` : undefined}
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
              {unread > 0 ? (
                <Pressable onPress={markAllRead} hitSlop={8}>
                  <Text style={[{fontSize: 12, color: palette.brandDark}]}>تعليم الكل كمقروء</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={clear} hitSlop={8}>
                <Text style={[{fontSize: 12, color: palette.danger}]}>مسح</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        big
      />

      {items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="لا إشعارات بعد"
          body="ستصلك هنا تحديثات طلباتك: قبول المتجر، خروج الطلب للتوصيل، والتسليم"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: stackClearance}}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => {
            const c = toneColors(palette, item.kind === 'order' ? 'brand' : 'info');
            return (
              <View
                style={[
                  notifStyles.card,
                  {
                    backgroundColor: item.read ? palette.surface : palette.brandSoft,
                    borderColor: item.read ? palette.line : palette.brandBorder,
                  },
                ]}>
                <View style={[notifStyles.icon, {backgroundColor: c.bg, borderColor: c.border}]}>
                  <Icon name={item.kind === 'order' ? 'truck' : 'info'} size={18} color={c.fg} />
                </View>
                <View style={{flex: 1, gap: 3, alignItems: 'flex-start'}}>
                  <Text
                    style={[
                      type.smallMedium,
                      {color: palette.ink, fontFamily: fonts.bold},
                    ]}
                    numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[{fontSize: 12, color: palette.inkSoft, lineHeight: 18}]}>
                    {item.body}
                  </Text>
                  <Text style={[{fontSize: 10.5, color: palette.muted}]}>
                    {relativeTime(item.ts)}
                  </Text>
                </View>
                {!item.read ? (
                  <View style={[notifStyles.dot, {backgroundColor: palette.brand}]} />
                ) : null}
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const notifStyles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 9, height: 9, borderRadius: 5},
});
