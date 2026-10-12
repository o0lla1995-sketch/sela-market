/**
 * ProfileScreen.tsx — حسابي: بطاقة المستخدم (أو بوابة دخول للزائر)،
 * مداخل سريعة (طلباتي/المفضلة/الإشعارات/الإعدادات/حول)، تسجيل خروج،
 * وحذف الحساب (متطلب سياسة جوجل بلاي).
 */
import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {AppHeader, Button, Card, Screen} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useNotificationsStore} from '../../stores/notificationsStore';
import {useCartStore} from '../../stores/cartStore';
import {useWishlistStore} from '../../stores/wishlistStore';
import {maskIdNumber} from '../../core/validation';
import {APP_VERSION_LABEL} from '../../core/config';
import {stopOrdersSync} from '../../services/ordersSync';
import {useToastStore} from '../../stores/toastStore';
import {useRootNav, type AccountStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

export function ProfileScreen({navigation}: Props) {
  const {palette} = useTheme();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const busy = useAuthStore(s => s.busy);
  const toast = useToastStore(s => s.show);

  const unread = useNotificationsStore(s => s.unread);
  const wishCount = Object.keys(useWishlistStore(s => s.items)).length;
  const cartStores = Object.keys(useCartStore(s => s.carts)).length;

  const rootNav = useRootNav();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doLogout = () => {
    stopOrdersSync();
    logout();
    toast('تم تسجيل الخروج — بانتظار عودتك', 'info');
  };

  const doDelete = async () => {
    const ok = await deleteAccount();
    if (ok) {
      setConfirmDelete(false);
      stopOrdersSync();
      toast('حُذف الحساب نهائياً ومُسحت بياناتك الشخصية', 'success');
    }
  };

  return (
    <Screen>
      <AppHeader title="حسابي" big />

      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} showsVerticalScrollIndicator={false}>
        {/* بطاقة المستخدم */}
        {token != null && user != null ? (
          <Card style={{gap: spacing.md}}>
            <View style={profileStyles.userRow}>
              <View style={[profileStyles.avatar, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
                <Text style={[{fontSize: 24, color: palette.brandDark, fontFamily: fonts.black}]}>
                  {user.name.charAt(0)}
                </Text>
              </View>
              <View style={{flex: 1, gap: 2, alignItems: 'flex-start'}}>
                <Text style={[type.h3, {color: palette.ink}]}>{user.name}</Text>
                <Text style={[{fontSize: 12, color: palette.muted}]}>
                  هوية: {maskIdNumber(user.idNumber)}
                </Text>
              </View>
            </View>
            <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
              <MiniStat label="طلبات" value="—" palette={palette} />
              <MiniStat label="مفضلة" value={String(wishCount)} palette={palette} />
              <MiniStat label="سلال" value={String(cartStores)} palette={palette} />
            </View>
          </Card>
        ) : (
          <Card style={{gap: spacing.md, alignItems: 'center'}}>
            <View style={[profileStyles.avatar, {backgroundColor: palette.surfaceAlt}]}>
              <Icon name="user" size={28} color={palette.muted} />
            </View>
            <Text style={[type.h3, {color: palette.ink}]}>أنت تتسوق كزائر</Text>
            <Text style={[type.small, {color: palette.muted, textAlign: 'center', lineHeight: 20}]}>
              سجّل الدخول برقم الهوية والجوال لمتابعة طلباتك وتتبعها من كل المتاجر
            </Text>
            <View style={{flexDirection: 'row-reverse', gap: spacing.md, width: '100%'}}>
              <Button
                label="تسجيل الدخول"
                small
                style={{flex: 1}}
                onPress={() => rootNav.navigate('Login', {reason: 'profile'})}
              />
              <Button
                label="حساب جديد"
                small
                variant="outline"
                style={{flex: 1}}
                onPress={() => rootNav.navigate('Register', {reason: 'profile'})}
              />
            </View>
          </Card>
        )}

        {/* المداخل */}
        <Card padded={false} style={{overflow: 'hidden'}}>
          <Row
            icon="receipt"
            label="طلباتي"
            description="تتبع كل طلباتك من كل المتاجر"
            onPress={() => navigation.getParent()?.navigate('Orders')}
            palette={palette}
          />
          <Row
            icon="heart"
            label="المفضلة"
            description={`${wishCount} منتجاً محفوظاً`}
            onPress={() => navigation.navigate('Wishlist')}
            palette={palette}
          />
          <Row
            icon="bell"
            label="الإشعارات"
            description={unread > 0 ? `${unread} إشعاراً جديداً` : 'تحديثات طلباتك'}
            onPress={() => navigation.navigate('Notifications')}
            palette={palette}
            badge={unread > 0 ? unread : undefined}
          />
          <Row
            icon="gear"
            label="الإعدادات"
            description="المظهر والإشعارات والخادم"
            onPress={() => navigation.navigate('Settings')}
            palette={palette}
          />
          <Row
            icon="help"
            label="حول سيلا ماركت"
            description={`الإصدار ${APP_VERSION_LABEL}`}
            onPress={() => navigation.navigate('About')}
            palette={palette}
            last
          />
        </Card>

        {/* خروج / حذف */}
        {token != null ? (
          <View style={{gap: spacing.md}}>
            <Button label="تسجيل الخروج" variant="outline" icon="logout" onPress={doLogout} />
            {confirmDelete ? (
              <Card style={{gap: spacing.md, borderColor: palette.danger}}>
                <Text style={[type.small, {color: palette.inkSoft, lineHeight: 21}]}>
                  حذف الحساب يمحو اسمك ورقمك من الخادم نهائياً ويُلغي كل جلساتك.
                  تبقى فواتير المتاجر للتجار دون أي بيانات تعرّفك. لا يمكن التراجع.
                </Text>
                <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                  <Button
                    label={busy ? 'جارٍ الحذف…' : 'تأكيد الحذف النهائي'}
                    variant="danger"
                    small
                    style={{flex: 1}}
                    loading={busy}
                    onPress={doDelete}
                  />
                  <Button
                    label="تراجع"
                    variant="outline"
                    small
                    style={{flex: 1}}
                    onPress={() => setConfirmDelete(false)}
                  />
                </View>
              </Card>
            ) : (
              <Pressable onPress={() => setConfirmDelete(true)} hitSlop={8} style={{alignItems: 'center', padding: spacing.sm}}>
                <Text style={[{fontSize: 12.5, color: palette.danger}]}>حذف حسابي نهائياً</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MiniStat({label, value, palette}: {label: string; value: string; palette: ReturnType<typeof useTheme>['palette']}) {
  return (
    <View
      style={[
        profileStyles.mini,
        {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
      ]}>
      <Text style={[{fontSize: 15, color: palette.ink, fontFamily: fonts.bold}]}>{value}</Text>
      <Text style={[{fontSize: 10.5, color: palette.muted}]}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  description,
  onPress,
  palette,
  badge,
  last = false,
}: {
  icon: IconName;
  label: string;
  description: string;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
  badge?: number;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        profileStyles.row,
        !last && {borderBottomWidth: 1, borderBottomColor: palette.line},
        pressed && {backgroundColor: palette.surfaceAlt},
      ]}>
      <View style={[profileStyles.rowIcon, {backgroundColor: palette.brandSoft}]}>
        <Icon name={icon} size={19} color={palette.brandDark} />
      </View>
      <View style={{flex: 1, gap: 1, alignItems: 'flex-start'}}>
        <Text style={[type.bodyMedium, {color: palette.ink}]}>{label}</Text>
        <Text style={[{fontSize: 11.5, color: palette.muted}]}>{description}</Text>
      </View>
      {badge != null ? (
        <View style={[profileStyles.rowBadge, {backgroundColor: palette.brand}]}>
          <Text style={[{fontSize: 10.5, color: '#FFFFFF', fontFamily: fonts.bold}]}>{badge}</Text>
        </View>
      ) : null}
      <Icon name="forward" size={17} color={palette.muted} />
    </Pressable>
  );
}

const profileStyles = StyleSheet.create({
  userRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mini: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
