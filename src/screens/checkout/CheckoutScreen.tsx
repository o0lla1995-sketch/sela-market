/**
 * CheckoutScreen.tsx — إتمام طلب متجر واحد: اختيار منطقة التوصيل
 * (مع رسمها من الخادم)، العنوان (مع عناوين محفوظة)، ملاحظة للمتجر،
 * وملخص المبالغ. الزائر يُحوَّل لشاشة الدخول عند الضغط على الطلب.
 * الأسعار النهائية يحسبها الخادم من كتالوج المتجر نفسه.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  BottomFixed,
  Button,
  Card,
  ErrorState,
  Field,
  Loader,
  Screen,
  SectionTitle,
} from '../../components/ui';
import {getStoreDetail, placeOrder} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import {formatMoney, formatQty, lineTotal} from '../../core/money';
import {validateAddress} from '../../core/validation';
import {addressLine, type Address} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useCartStore} from '../../stores/cartStore';
import {useInterestStore} from '../../stores/interestStore';
import {useLocationStore} from '../../stores/locationStore';
import {useSettingsStore} from '../../stores/settingsStore';
import {useToastStore} from '../../stores/toastStore';
import type {DeliveryRegion} from '../../core/types';
import {useRootNav, type CartStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<CartStackParamList, 'Checkout'>;

export function CheckoutScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const {storeId} = route.params;
  const rootNav = useRootNav();

  const token = useAuthStore(s => s.token);
  const entry = useCartStore(s => s.carts[String(storeId)]);
  const clearStore = useCartStore(s => s.clearStore);
  const addAddress = useSettingsStore(s => s.addAddress);
  const savedAddresses = useSettingsStore(s => s.savedAddresses);
  const rememberRegion = useSettingsStore(s => s.rememberRegion);
  const lastRegion = useSettingsStore(s => s.lastRegionByStore[String(storeId)]);
  const serverAddresses = useLocationStore(s => s.addresses);
  const trackOrder = useInterestStore(s => s.trackOrder);
  const toast = useToastStore(s => s.show);

  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [storeName, setStoreName] = useState<string>('');
  const [regionName, setRegionName] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const detail = await getStoreDetail(storeId);
      setStoreName(detail.store.name);
      const enabled = detail.deliveryRegions.filter(r => r.enabled === 1);
      setRegions(enabled);
      // منطقة مسبقة من طلب سابق، وإلا منطقة عنوان المستخدم الافتراضي،
      // وإلا الأرخص.
      const remembered = enabled.find(
        r => r.name === lastRegion || r.name === useLocationStore.getState().myRegion,
      );
      setRegionName(
        remembered?.name ?? (enabled.length > 0 ? enabled[0].name : null),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذر تحميل بيانات المتجر');
    } finally {
      setLoading(false);
    }
  }, [storeId, lastRegion]);

  useEffect(() => {
    void load();
  }, [load]);

  /** اختيار عنوان محفوظ يعبّئ الحقل ويحدّد منطقته إن كان المتجر يخدمها. */
  const pickServerAddress = (a: Address) => {
    setSelectedAddressId(a.id === selectedAddressId ? null : a.id);
    setAddress(addressLine(a));
    const matches = regions.find(r => r.name === a.region);
    if (matches != null) {
      setRegionName(matches.name);
    }
  };

  const selectedRegion = useMemo(
    () => regions.find(r => r.name === regionName) ?? null,
    [regions, regionName],
  );

  const itemsSubtotal = useMemo(
    () => (entry?.lines ?? []).reduce((s, l) => s + lineTotal(l.priceMinor, l.quantity), 0),
    [entry],
  );
  const deliveryFee = selectedRegion?.fee_minor ?? 0;
  const total = itemsSubtotal + deliveryFee;

  if (loading) {
    return (
      <Screen>
        <AppHeader title="إتمام الطلب" onBack={() => navigation.goBack()} />
        <Loader label="نجلب مناطق التوصيل…" />
      </Screen>
    );
  }

  if (error != null) {
    return (
      <Screen>
        <AppHeader title="إتمام الطلب" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  if (entry == null || entry.lines.length === 0) {
    return (
      <Screen>
        <AppHeader title="إتمام الطلب" onBack={() => navigation.goBack()} />
        <ErrorState
          message="سلة هذا المتجر فارغة"
          onRetry={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const submit = async () => {
    if (token == null) {
      // زائر: بوابة الدخول ثم العودة لإتمام الطلب.
      rootNav.navigate('Login', {reason: 'checkout'});
      return;
    }
    if (regionName == null) {
      toast('اختر منطقة التوصيل أولاً', 'danger');
      return;
    }
    if (validateAddress(address) != null) {
      toast(validateAddress(address)!, 'danger');
      return;
    }
    setPlacing(true);
    try {
      const order = await placeOrder(token, {
        storeId,
        items: entry.lines.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          variant: l.variant ?? undefined,
        })),
        regionName,
        address: address.trim(),
        note: note.trim() || undefined,
      });
      clearStore(storeId);
      addAddress(address.trim());
      rememberRegion(storeId, regionName);
      // الطلب المكتمل يرفع وزن تصنيفاته في «مقترحات لك».
      trackOrder(entry.lines.map(l => l.category ?? null));
      navigation.replace('OrderSuccess', {order});
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'BAD_REGION' && Array.isArray(e.extra?.regions)) {
          // المناطق تغيّرت على الخادم — أعد التحميل وأبلغ.
          await load();
        }
        toast(e.message, 'danger');
      } else {
        toast('تعذر إرسال الطلب — تحقق من الإنترنت وحاول مجدداً', 'danger');
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="إتمام الطلب"
        subtitle={storeName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: 170}} showsVerticalScrollIndicator={false}>
        {/* منطقة التوصيل */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="منطقة التوصيل" />
          {regions.length === 0 ? (
            <Card>
              <Text style={[type.small, {color: palette.danger}]}>
                لم يضبط المتجر مناطق توصيل بعد — لا يمكن إتمام الطلب حالياً
              </Text>
            </Card>
          ) : (
            <View style={{gap: spacing.sm}}>
              {regions.map(r => {
                const active = r.name === regionName;
                return (
                  <Pressable
                    key={r.name}
                    onPress={() => setRegionName(r.name)}
                    style={[
                      regionStyles.row,
                      {
                        backgroundColor: active ? palette.brandSoft : palette.surface,
                        borderColor: active ? palette.brand : palette.line,
                      },
                    ]}>
                    <View style={regionStyles.right}>
                      <View
                        style={[
                          regionStyles.radio,
                          {
                            borderColor: active ? palette.brand : palette.lineStrong,
                            backgroundColor: active ? palette.brand : 'transparent',
                          },
                        ]}>
                        {active ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                      </View>
                      <Icon name="truck" size={17} color={active ? palette.brandDark : palette.muted} />
                      <Text
                        style={[
                          type.smallMedium,
                          {color: active ? palette.brandDark : palette.ink},
                        ]}>
                        {r.name}
                      </Text>
                    </View>
                    <Text
                      style={[
                        {fontSize: 13.5, fontFamily: fonts.bold},
                        {color: active ? palette.brandDark : palette.inkSoft},
                      ]}>
                      {formatMoney(r.fee_minor)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* العنوان */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="عنوان التسليم" />
          {/* عناوين الحساب المحفوظة على الخادم — لمسة واحدة تعبّئ كل شيء */}
          {token != null && serverAddresses.length > 0 ? (
            <View style={{gap: spacing.sm}}>
              {serverAddresses.map(a => {
                const active = selectedAddressId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => pickServerAddress(a)}
                    style={({pressed}) => [
                      addrStyles.row,
                      {
                        backgroundColor: active ? palette.brandSoft : palette.surface,
                        borderColor: active ? palette.brand : palette.line,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View
                      style={[
                        addrStyles.radio,
                        {
                          borderColor: active ? palette.brand : palette.lineStrong,
                          backgroundColor: active ? palette.brand : 'transparent',
                        },
                      ]}>
                      {active ? (
                        <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />
                      ) : null}
                    </View>
                    <View style={{flex: 1, gap: 2}}>
                      <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
                        <Text style={{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}}>
                          {a.label}
                        </Text>
                        {a.is_default === 1 ? (
                          <View style={[addrStyles.defChip, {backgroundColor: palette.successSoft}]}>
                            <Text style={{fontSize: 9.5, color: palette.success, fontFamily: fonts.bold}}>
                              الافتراضي
                            </Text>
                          </View>
                        ) : null}
                        <View style={[addrStyles.regionChip, {backgroundColor: palette.surfaceAlt}]}>
                          <Icon name="truck" size={10} color={palette.muted} />
                          <Text style={{fontSize: 10, color: palette.muted}}>{a.region}</Text>
                        </View>
                      </View>
                      <Text style={{fontSize: 11.5, color: palette.inkSoft}} numberOfLines={1}>
                        {addressLine(a)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => navigation.navigate('AddressBook')}
                hitSlop={6}
                style={{alignSelf: 'flex-start'}}>
                <Text style={{fontSize: 12, color: palette.brandDark, fontFamily: fonts.bold}}>
                  إدارة عناويني
                </Text>
              </Pressable>
            </View>
          ) : null}
          <Field
            label="العنوان"
            value={address}
            onChangeText={t => {
              setAddress(t);
              setSelectedAddressId(null);
            }}
            placeholder={selectedAddressId != null ? 'اخترت عنواناً محفوظاً — أو اكتب عنواناً آخر' : 'الحي، الشارع، رقم البناية…'}
            icon="pin"
            maxLength={200}
          />
          {selectedAddressId == null && savedAddresses.length > 0 ? (
            <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm}}>
              {savedAddresses.slice(0, 3).map(a => (
                <Pressable
                  key={a}
                  onPress={() => setAddress(a)}
                  style={[
                    regionStyles.savedChip,
                    {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
                  ]}>
                  <Icon name="clock" size={13} color={palette.muted} />
                  <Text style={[{fontSize: 11.5, color: palette.inkSoft}]} numberOfLines={1}>
                    {a.length > 30 ? `${a.slice(0, 30)}…` : a}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Field
            label="ملاحظة للمتجر (اختياري)"
            value={note}
            onChangeText={setNote}
            placeholder="مثال: الاتصال قبل الوصول بنصف ساعة"
            maxLength={300}
            multiline
            icon="note"
          />
        </View>

        {/* الملخص */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="ملخص الطلب" />
          <Card style={{gap: spacing.sm}}>
            {entry.lines.map(l => (
              <View key={l.key} style={regionStyles.summaryRow}>
                <View style={{flex: 1, alignItems: 'flex-start', gap: 2}}>
                  <Text style={[type.small, {color: palette.inkSoft}]} numberOfLines={1}>
                    {l.name} × {formatQty(l.quantity, l.soldByWeight)}
                    {l.soldByWeight ? 'ك' : ''}
                  </Text>
                  {l.variant != null ? (
                    <Text style={{fontSize: 10.5, color: palette.brandDark}} numberOfLines={1}>
                      {l.variant}
                    </Text>
                  ) : null}
                </View>
                <Text style={[{fontSize: 12.5, color: palette.ink, fontFamily: fonts.medium}]}>
                  {formatMoney(lineTotal(l.priceMinor, l.quantity))}
                </Text>
              </View>
            ))}
            <View style={[regionStyles.summaryRow, {borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.sm}]}>
              <Text style={[type.small, {color: palette.muted}]}>إجمالي المنتجات</Text>
              <Text style={[{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}]}>
                {formatMoney(itemsSubtotal)}
              </Text>
            </View>
            <View style={regionStyles.summaryRow}>
              <Text style={[type.small, {color: palette.muted}]}>
                التوصيل {selectedRegion ? `(${selectedRegion.name})` : ''}
              </Text>
              <Text style={[{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}]}>
                {formatMoney(deliveryFee)}
              </Text>
            </View>
            <View style={regionStyles.summaryRow}>
              <Text style={[type.h3, {color: palette.ink}]}>الإجمالي مع التوصيل</Text>
              <Text style={[{fontSize: 19, color: palette.brandDark, fontFamily: fonts.black}]}>
                {formatMoney(total)}
              </Text>
            </View>
            <View
              style={[
                regionStyles.codNote,
                {backgroundColor: palette.successSoft, borderColor: palette.success},
              ]}>
              <Icon name="cash" size={15} color={palette.success} />
              <Text style={[{fontSize: 11.5, color: palette.success, fontFamily: fonts.medium}]}>
                الدفع نقداً عند الاستلام — لا نطلب أي بطاقات
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      <BottomFixed>
        <Button
          label={placing ? 'جارٍ إرسال الطلب…' : `إرسال الطلب — ${formatMoney(total)}`}
          icon="cash"
          onPress={submit}
          loading={placing}
          disabled={regions.length === 0}
        />
        {token == null ? (
          <Text style={[{fontSize: 11, color: palette.muted, textAlign: 'center', marginTop: 8}]}>
            زائر؟ سيُطلب منك تسجيل دخول سريع برقم الهوية والجوال لإتمام الطلب
          </Text>
        ) : null}
      </BottomFixed>
    </Screen>
  );
}

const addrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defChip: {borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1},
  regionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
});

const regionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  right: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 200,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  codNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    marginTop: spacing.xs,
  },
});
