/**
 * RegisterScreen.tsx — إنشاء حساب: رقم هوية فريد + الاسم + الجوال +
 * كلمة مرور (v1.1 — كل حساب محمي).
 * ─────────────────────────────────────────────────────────────────
 *  • v3.4 (الجولة 64): إعادة تصميم عصرية بطلب المستخدم — حُذفت كل
 *    الملاحظات الثانوية المزعزة تحت الحقول (رقم الهوية معرّفك،
 *    الجوال للتوصيل، لا تشارك كلمة المرور…) وبقي التحقق الفعلي
 *    عند اللمس فقط. سطر واحد مختصر للشروط بدل الفقرة الطويلة،
 *    وعلامة علامة + عنوان ضخم مثل شاشة الدخول. المنطق لم يُمس.
 *  • مؤشر قوة كلمة المرور والتأكيد يمنعان الأخطاء قبل الإرسال،
 *    والتحقق المسبق يطابق قواعد الخادم.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Button, Field, Screen, SecureField} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useToastStore} from '../../stores/toastStore';
import {passwordProblem, passwordStrength} from '../../api/endpoints';
import {
  cleanIdNumber,
  cleanPhone,
  validateIdNumber,
  validateName,
  validatePhone,
} from '../../core/validation';
import {primeAndStart} from '../../services/ordersSync';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({navigation}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const register = useAuthStore(s => s.register);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const toast = useToastStore(s => s.show);

  const [idNumber, setIdNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  // v1.2: سلسلة تعبئة — «التالي» على كل لوحة ينقل للحقل التالي
  // و«إنشاء الحساب» على الأخير يرسل مباشرة بلا أزرار وسيطة.
  const idRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', clearError);
    return unsub;
  }, [navigation, clearError]);

  const idError = touched ? validateIdNumber(idNumber) : null;
  const nameError = touched ? validateName(name) : null;
  const phoneError = touched ? validatePhone(phone) : null;
  const strength = passwordStrength(password);
  const pwProblem = touched ? passwordProblem(password) : null;
  const confirmError =
    touched && confirm !== password ? 'كلمتا المرور غير متطابقتين' : null;

  const submit = async () => {
    setTouched(true);
    if (
      validateIdNumber(idNumber) ||
      validateName(name) ||
      validatePhone(phone) ||
      passwordProblem(password) != null ||
      confirm !== password
    ) {
      return;
    }
    const ok = await register(
      cleanIdNumber(idNumber),
      name.trim(),
      cleanPhone(phone),
      password,
    );
    if (ok) {
      primeAndStart();
      toast(`أهلاً ${name.trim().split(' ')[0]} في سيلا ماركت`, 'success');
      /* v3.1 (الجولة 61): نفس إصلاح شاشة الدخول — التسجيل من شاشة
       * الترحيب لم يكن يغادر الترحيب (أُزيلت من المكدس لحظة
       * setOnboarded) — قفزة نظيفة إلى الرئيسية بدل goBack لعوز. */
      const state = navigation.getState();
      const below =
        state != null && state.routes.length >= 2
          ? state.routes[state.routes.length - 2]?.name
          : null;
      if (!navigation.canGoBack() || below === 'Welcome') {
        navigation.reset({index: 0, routes: [{name: 'Main'}]});
      } else {
        navigation.goBack();
      }
    }
  };

  return (
    <Screen style={{paddingBottom: insets.bottom}}>
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={regStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* ── شريط علوي: مقبض النافذة + زر الإغلاق ── */}
          <View style={regStyles.topRow}>
            <View style={{width: 36}} />
            <View style={[regStyles.grab, {backgroundColor: palette.lineStrong}]} />
            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
              style={({pressed}) => [
                regStyles.closeBtn,
                {backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.7 : 1},
              ]}>
              <Icon name="close" size={17} color={palette.ink} strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* ── علامة العلامة + عنوان ── */}
          <View style={regStyles.markWrap}>
            <View style={[regStyles.markBadge, {backgroundColor: palette.brand}]}>
              <Icon name="user" size={26} color="#FFFFFF" strokeWidth={2} />
            </View>
            <Text style={[type.h1, {color: palette.ink, fontFamily: fonts.black}]}>
              حساب جديد
            </Text>
            <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
              دقيقة واحدة وتتسوق من كل متاجر المول
            </Text>
          </View>

          {/* ── الحقول — بلا ملاحظات ثانوية (v3.4) ── */}
          <View style={{gap: spacing.lg}}>
            <Field
              label="الاسم الكامل"
              value={name}
              onChangeText={t => {
                setName(t);
                clearError();
              }}
              placeholder="مثال: أحمد الخطيب"
              maxLength={60}
              icon="user"
              error={nameError}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => idRef.current?.focus()}
            />
            <Field
              label="رقم الهوية"
              value={idNumber}
              onChangeText={t => {
                setIdNumber(t);
                clearError();
              }}
              placeholder="9 أرقام"
              keyboardType="numeric"
              numericOnly
              maxLength={9}
              icon="doc"
              error={idError}
              inputRef={idRef}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <Field
              label="رقم الجوال"
              value={phone}
              onChangeText={t => {
                setPhone(t);
                clearError();
              }}
              placeholder="05xxxxxxxx"
              keyboardType="phone-pad"
              numericOnly
              maxLength={15}
              icon="phone"
              error={phoneError}
              inputRef={phoneRef}
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
            <SecureField
              label="كلمة المرور"
              value={password}
              onChangeText={t => {
                setPassword(t);
                clearError();
              }}
              placeholder="8 أحرف على الأقل — رقماً وحرفاً"
              error={pwProblem}
              showStrength
              strength={strength}
              inputRef={pwRef}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <SecureField
              label="تأكيد كلمة المرور"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="أعد كتابة كلمة المرور"
              error={confirmError}
              inputRef={confirmRef}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            {error ? (
              <View style={[regStyles.errorCard, {backgroundColor: palette.dangerSoft}]}>
                <Icon name="warning" size={15} color={palette.danger} />
                <Text style={{fontSize: 12.5, color: palette.danger, flex: 1, fontFamily: fonts.medium}}>
                  {error}
                </Text>
              </View>
            ) : null}
            <Button
              label={busy ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب'}
              onPress={submit}
              loading={busy}
            />
            {/* v3.4: سطر واحد مختصر بدل فقرة الشروط الطويلة */}
            <Text style={{fontSize: 11, color: palette.muted, textAlign: 'center', lineHeight: 17}}>
              بإنشاء الحساب توافق على شروط الاستخدام وسياسة الخصوصية
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ═══ v3.4: لغة التصميم الموحدة لشاشات الدخول ═══ */
const regStyles = StyleSheet.create({
  body: {padding: spacing.lg, gap: spacing.xl},
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  grab: {width: 44, height: 5, borderRadius: 999},
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrap: {alignItems: 'center', gap: spacing.sm},
  markBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
});
