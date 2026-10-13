/**
 * AddressFormScreen.tsx — إضافة/تحرير عنوان (v2.0).
 * نموذج قصير ذكي: لقب جاهز (منزل/عمل/منزل الأهل…)، منطقة تُختار من
 * مناطق التوصيل الحقيقية (رقيقة أفقية من الخادم — لا كتابة حرة
 * تخطئ الأسماء)، وحقول توصيف دقيقة اختيارية (مدينة/شارع/بناية/
 * طابق/شقة/هاتف/ملاحظة). «التالي» يتنقل بين الحقول والإرسال من
 * الأخير — نفس أسلوب v1.2 المريح.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {TextInput as TextInputType} from 'react-native';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  Button,
  Card,
  Field,
  Loader,
  Screen,
  SectionTitle,
  SwitchRow,
} from '../../components/ui';
import {getDeliveryRegions, saveAddress} from '../../api/endpoints';
import {ApiError} from '../../api/client';
import type {Address} from '../../core/types';
import {useAuthStore} from '../../stores/authStore';
import {useLocationStore} from '../../stores/locationStore';
import {useToastStore} from '../../stores/toastStore';
import type {AccountStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<AccountStackParamList, 'AddressForm'>;

const LABEL_PRESETS = ['المنزل', 'العمل', 'منزل الأهل', 'أخرى'];

export function AddressFormScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const editing = route.params?.address;
  const token = useAuthStore(s => s.token);
  const addresses = useLocationStore(s => s.addresses);
  const applyAddresses = useLocationStore(s => s.applyAddresses);
  const toast = useToastStore(s => s.show);

  const [label, setLabel] = useState(editing?.label ?? 'المنزل');
  const [customLabel, setCustomLabel] = useState(
    LABEL_PRESETS.includes(editing?.label ?? '') ? '' : (editing?.label ?? ''),
  );
  const [region, setRegion] = useState<string | null>(editing?.region ?? null);
  const [regions, setRegions] = useState<string[]>([]);
  const [city, setCity] = useState(editing?.city ?? '');
  const [street, setStreet] = useState(editing?.street ?? '');
  const [building, setBuilding] = useState(editing?.building ?? '');
  const [floor, setFloor] = useState(editing?.floor ?? '');
  const [apartment, setApartment] = useState(editing?.apartment ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [isDefault, setIsDefault] = useState(editing?.is_default === 1 || addresses.length === 0);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [saving, setSaving] = useState(false);

  const cityRef = useRef<TextInputType>(null);
  const streetRef = useRef<TextInputType>(null);
  const buildingRef = useRef<TextInputType>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getDeliveryRegions();
        if (alive) {
          setRegions(list);
          // عنوان قائم بمنطقة لم تعد متاحة؟ نبقيها مختارة ويظهر
          // تحذير لطيف بجانب القائمة.
          if (editing != null && !list.includes(editing.region)) {
            setRegions(prev => [editing.region, ...prev]);
          }
        }
      } catch {
        /* مناطق غير متاحة الآن — الكتابة تُختار عند إعادة المحاولة */
      } finally {
        if (alive) {
          setLoadingRegions(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [editing]);

  const effectiveLabel = useMemo(
    () => (label === 'أخرى' ? customLabel.trim() : label),
    [label, customLabel],
  );

  const canSave =
    !saving &&
    region != null &&
    effectiveLabel.length > 0 &&
    effectiveLabel.length <= 24;

  const submit = useCallback(async () => {
    if (!canSave || token == null || region == null) {
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAddress(token, {
        id: editing?.id,
        label: effectiveLabel,
        region,
        city: city.trim() || undefined,
        street: street.trim() || undefined,
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        apartment: apartment.trim() || undefined,
        phone: phone.replace(/[\s-]/g, '') || undefined,
        notes: notes.trim() || undefined,
        isDefault,
      });
      const rest = addresses.filter(a => a.id !== saved.id);
      const next = [saved, ...rest]
        .map(a => ({...a, is_default: a.id === saved.id ? saved.is_default : isDefault ? 0 : a.is_default}))
        .sort((a, b) => b.is_default - a.is_default || b.updated_at - a.updated_at);
      applyAddresses(next);
      toast(editing != null ? 'حُدّث العنوان' : 'أُضيف العنوان إلى دفترك', 'success');
      navigation.goBack();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'تعذر حفظ العنوان — حاول مجدداً', 'danger');
    } finally {
      setSaving(false);
    }
  }, [
    canSave, token, region, editing, effectiveLabel, city, street, building,
    floor, apartment, phone, notes, isDefault, addresses, applyAddresses,
    toast, navigation,
  ]);

  return (
    <Screen>
      <AppHeader
        title={editing != null ? 'تحرير العنوان' : 'عنوان جديد'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: stackClearance}}
        showsVerticalScrollIndicator={false}>
        {/* اللقب */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="لقب العنوان" />
          <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm}}>
            {LABEL_PRESETS.map(p => {
              const active = label === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setLabel(p)}
                  style={[
                    formStyles.preset,
                    {
                      backgroundColor: active ? palette.brand : palette.surface,
                      borderColor: active ? palette.brand : palette.line,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.medium,
                      color: active ? '#FFFFFF' : palette.ink,
                    }}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {label === 'أخرى' ? (
            <Field
              label="اسم العنوان"
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder="مثال: المحل"
              icon="tag"
              maxLength={24}
            />
          ) : null}
        </View>

        {/* منطقة التوصيل */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="منطقة التوصيل" />
          <Text style={[type.tiny, {color: palette.muted}]}>
            مناطق حقيقية يغطيها متاجر المول — تُحدَّث من الخادم
          </Text>
          {loadingRegions ? (
            <Loader label="نجلب المناطق…" />
          ) : regions.length === 0 ? (
            <Card>
              <Text style={[type.small, {color: palette.warning}]}>
                تعذر جلب المناطق الآن — تحقق من اتصالك واسحب للتحديث لاحقاً
              </Text>
            </Card>
          ) : (
            <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm}}>
              {regions.map(r => {
                const active = region === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRegion(r)}
                    style={[
                      formStyles.region,
                      {
                        backgroundColor: active ? palette.brandSoft : palette.surface,
                        borderColor: active ? palette.brand : palette.line,
                      },
                    ]}>
                    <Icon
                      name="truck"
                      size={13}
                      color={active ? palette.brandDark : palette.muted}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: active ? fonts.bold : fonts.medium,
                        color: active ? palette.brandDark : palette.ink,
                      }}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* التوصيف */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="تفاصيل العنوان (تساعد المندوب)" />
          <Field
            label="المدينة / المخيم"
            value={city}
            onChangeText={setCity}
            inputRef={cityRef}
            onSubmitEditing={() => streetRef.current?.focus()}
            returnKeyType="next"
            placeholder="مثال: غزة"
            icon="pin"
            maxLength={60}
          />
          <Field
            label="الشارع / الحي"
            value={street}
            onChangeText={setStreet}
            inputRef={streetRef}
            onSubmitEditing={() => buildingRef.current?.focus()}
            returnKeyType="next"
            placeholder="مثال: النصر"
            icon="pin"
            maxLength={80}
          />
          <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
            <View style={{flex: 1}}>
              <Field
                label="رقم البناية"
                value={building}
                onChangeText={setBuilding}
                inputRef={buildingRef}
                returnKeyType="next"
                placeholder="12"
                icon="box"
                maxLength={24}
              />
            </View>
            <View style={{flex: 1}}>
              <Field
                label="الطابق"
                value={floor}
                onChangeText={setFloor}
                keyboardType="numeric"
                numericOnly
                returnKeyType="next"
                placeholder="3"
                icon="grid"
                maxLength={12}
              />
            </View>
            <View style={{flex: 1}}>
              <Field
                label="الشقة"
                value={apartment}
                onChangeText={setApartment}
                keyboardType="numeric"
                numericOnly
                returnKeyType="next"
                placeholder="5"
                icon="grid"
                maxLength={12}
              />
            </View>
          </View>
          <Field
            label="هاتف للتواصل (اختياري)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            numericOnly
            returnKeyType="next"
            placeholder="059XXXXXXX"
            icon="phone"
            maxLength={16}
          />
          <Field
            label="ملاحظة للمندوب (اختياري)"
            value={notes}
            onChangeText={setNotes}
            placeholder="مثال: الجرس معطل — الاتصال عند الوصول"
            icon="note"
            maxLength={200}
            multiline
          />
        </View>

        <SwitchRow
          icon="pin"
          label="تعيينه عنواني الافتراضي"
          description="المنطقة الافتراضية تفعّل قسم «متاجر تخدم منطقتك» في الرئيسية"
          value={isDefault}
          onValueChange={setIsDefault}
        />

        <Button
          label={saving ? 'جارٍ الحفظ…' : editing != null ? 'حفظ التعديلات' : 'حفظ العنوان'}
          icon="check"
          onPress={submit}
          loading={saving}
          disabled={!canSave}
        />
      </ScrollView>
    </Screen>
  );
}

const formStyles = StyleSheet.create({
  preset: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  region: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
});
