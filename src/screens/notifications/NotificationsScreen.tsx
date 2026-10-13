/**
 * NotificationsScreen.tsx — مركز الإشعارات: تحديثات حالة الطلبات
 * محفوظة محلياً (آخر 100) مع وقت نسبي.
 * ─────────────────────────────────────────────────────────────────
 * v3.1 (الجولة 61): طلب التاجر بالنص: «عند فتحها تعلّم مقروءة
 * مباشرة» — الفتح يعلم كل الإشعارات مقروءة تلقائياً بعد لحظة
 * قصيرة (700ms) يرى فيها المستخدم النقاط البرتقالية للجديد، ثم
 * تختفي ومعها شارة العدّاد. لمس أي إشعار طلب يقفز إلى طلبياته.
 */
import React, {useEffect} from 'react';
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

  /* v3.1: الفتح = مقروءة مباشرة — بعد 700ms يميّز المستخدم الجديد
   * بنقاطه ثم تُمسح الشارات من تلقاء نفسها (لا زر يدوي). */
  useEffect(() => {
    if (unread === 0) {
      return;
    }
    const t = setTimeout(() => markAllRead(), 700);
    return () => clearTimeout(t);
  }, [unread, markAllRead]);

  return (
    <Screen>
      <AppHeader
        title="الإشعارات"
        subtitle={items.length > 0 ? `${items.length} إشعاراً${unread > 0 ? ` · ${unread} جديد` : ''}` : undefined}
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <Pressable onPress={clear} hitSlop={8}>
              <Text style={[{fontSize: 12, color: palette.danger}]}>مسح</Text>
            </Pressable>
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
              <Pressable
                onPress={() => {
                  /* v3.1: إشعار الطلب يقفز إلى طلبياتي لمتابعة الحالة. */
                  if (item.kind === 'order') {
                    navigation.getParent()?.navigate('Orders');
                  }
                }}
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
              </Pressable>
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
