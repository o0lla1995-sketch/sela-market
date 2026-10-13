/**
 * AddressBookScreen.tsx — دفتر عناوين المستخدم (v2.0 — خادم 4.4).
 * عناوين محفوظة على الخادم (حتى 10): بطاقة لكل عنوان بلقبه (منزل/
 * عمل) وعنوان سطر واحد + افتراضي + تحرير/حذف. للزائر: بوابة دخول
 * لطيفة تشرح لماذا العنوان يحسّن التسوق. المنطقة تُختار من مناطق
 * التوصيل الحقيقية المتاحة عبر المول (GET /api/market/regions).
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loader,
  Screen,
} from '../../components/ui';
import {deleteAddress, setDefaultAddress} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {addressLine, type Address} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useLocationStore} from '../../stores/locationStore';
import {useToastStore} from '../../stores/toastStore';
import type {AccountStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<AccountStackParamList, 'AddressBook'>;

const LABEL_ICONS: Record<string, string> = {
  'المنزل': 'pin',
  'العمل': 'box',
};

export function AddressBookScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const token = useAuthStore(s => s.token);
  const addresses = useLocationStore(s => s.addresses);
  const applyAddresses = useLocationStore(s => s.applyAddresses);
  const syncFromServer = useLocationStore(s => s.syncFromServer);
  const toast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (token == null) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await syncFromServer();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل العناوين');
    } finally {
      setLoading(false);
    }
  }, [token, syncFromServer]);

  useEffect(() => {
    void load();
  }, [load]);

  const makeDefault = async (address: Address) => {
    if (token == null || address.is_default === 1) {
      return;
    }
    try {
      const updated = await setDefaultAddress(token, address.id);
      applyAddresses(
        addresses.map(a => ({...a, is_default: a.id === updated.id ? 1 : 0})),
      );
      toast(`أصبح «${updated.label}» عنوانك الافتراضي`, 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'تعذر تغيير العنوان الافتراضي', 'danger');
    }
  };

  const remove = (address: Address) => {
    Alert.alert(
      'حذف العنوان',
      `هل تريد حذف «${address.label}»؟`,
      [
        {text: 'إلغاء', style: 'cancel'},
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            if (token == null) {
              return;
            }
            try {
              await deleteAddress(token, address.id);
              const rest = addresses.filter(a => a.id !== address.id);
              // الخادم يرقّي أول متبقٍ لافتراضي — نحاكيه محلياً.
              if (address.is_default === 1 && rest.length > 0) {
                rest[0] = {...rest[0], is_default: 1};
              }
              applyAddresses(rest);
              toast('حُذف العنوان', 'info');
            } catch (e) {
              toast(e instanceof ApiError ? e.message : 'تعذر حذف العنوان', 'danger');
            }
          },
        },
      ],
    );
  };

  if (token == null) {
    return (
      <Screen>
        <AppHeader title="عناويني" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="pin"
          title="سجّل عنوانك لمتابعة تسوق أذكى"
          body="عنوانك يفعّل قسم «متاجر تخدم منطقتك»، مقارنة رسوم التوصيل بين المتاجر، وإتمام الطلب بلمسة واحدة — بحسابك فقط"
          actionLabel="تسجيل الدخول"
          onAction={() =>
            navigation.navigate('Settings') /* الحساب يفتح بوابة الدخول */
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="عناويني"
        subtitle={`${addresses.length} من 10`}
        onBack={() => navigation.goBack()}
      />

      {loading && addresses.length === 0 ? (
        <Loader label="نجلب عناوينك…" />
      ) : error != null && addresses.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={a => String(a.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: stackClearance}}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <EmptyState
              icon="pin"
              title="لا عناوين بعد"
              body="أضف عنوانك الأول («المنزل» مثلاً) وسيظهر هنا ولدى إتمام أي طلب"
            />
          }
          ListFooterComponent={
            addresses.length < 10 ? (
              <Button
                label="إضافة عنوان جديد"
                icon="plus"
                onPress={() => navigation.navigate('AddressForm', {})}
              />
            ) : (
              <Text style={[type.tiny, {color: palette.muted, textAlign: 'center'}]}>
                وصلت الحد الأقصى (10 عناوين) — احذف واحداً لإضافة آخر
              </Text>
            )
          }
          renderItem={({item}) => (
            <Card style={{gap: spacing.sm}}>
              <View style={cardStyles.topRow}>
                <View style={[cardStyles.iconWrap, {backgroundColor: palette.brandSoft}]}>
                  <Icon
                    name={(LABEL_ICONS[item.label] as never) ?? 'pin'}
                    size={19}
                    color={palette.brandDark}
                  />
                </View>
                <View style={{flex: 1, gap: 2}}>
                  <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
                    <Text style={[type.h3, {color: palette.ink}]}>{item.label}</Text>
                    {item.is_default === 1 ? (
                      <View style={[cardStyles.defaultChip, {backgroundColor: palette.successSoft}]}>
                        <Icon name="checkCircle" size={10} color={palette.success} />
                        <Text style={{fontSize: 10, color: palette.success, fontFamily: fonts.bold}}>
                          الافتراضي
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20}]}>
                    {addressLine(item)}
                  </Text>
                  <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4}}>
                    <Icon name="pin" size={11} color={palette.muted} />
                    <Text style={{fontSize: 11, color: palette.muted}}>
                      منطقة التوصيل: {item.region}
                    </Text>
                  </View>
                  {item.phone ? (
                    <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4}}>
                      <Icon name="phone" size={11} color={palette.muted} />
                      <Text style={{fontSize: 11, color: palette.muted}}>{item.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={cardStyles.actions}>
                <Pressable
                  onPress={() => makeDefault(item)}
                  disabled={item.is_default === 1}
                  style={({pressed}) => [
                    cardStyles.actionBtn,
                    {backgroundColor: palette.surfaceAlt, opacity: item.is_default === 1 ? 0.4 : pressed ? 0.7 : 1},
                  ]}>
                  <Icon name="checkCircle" size={14} color={palette.inkSoft} />
                  <Text style={{fontSize: 11.5, color: palette.inkSoft, fontFamily: fonts.medium}}>
                    تعيين افتراضي
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('AddressForm', {address: item})}
                  style={({pressed}) => [
                    cardStyles.actionBtn,
                    {backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.7 : 1},
                  ]}>
                  <Icon name="note" size={14} color={palette.inkSoft} />
                  <Text style={{fontSize: 11.5, color: palette.inkSoft, fontFamily: fonts.medium}}>
                    تحرير
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(item)}
                  style={({pressed}) => [
                    cardStyles.actionBtn,
                    {backgroundColor: palette.dangerSoft, opacity: pressed ? 0.7 : 1},
                  ]}>
                  <Icon name="trash" size={14} color={palette.danger} />
                  <Text style={{fontSize: 11.5, color: palette.danger, fontFamily: fonts.medium}}>
                    حذف
                  </Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const cardStyles = StyleSheet.create({
  topRow: {flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md},
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  actions: {flexDirection: 'row-reverse', gap: spacing.sm},
  actionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.md,
    paddingVertical: 9,
  },
});
