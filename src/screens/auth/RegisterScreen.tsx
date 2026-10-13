/**
 * RegisterScreen.tsx — إنشاء حساب: رقم هوية فريد + الاسم + الجوال +
 * كلمة مرور (v1.1 — كل حساب محمي). مؤشر قوة كلمة المرور والتأكيد
 * يمنعان الأخطاء قبل الإرسال، والتحقق المسبق يطابق قواعد الخادم.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type} from '../../theme/tokens';
import {
  AppHeader,
  Button,
  Field,
  Screen,
  SecureField,
} from '../../components/ui';
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
      <AppHeader
        title="حساب جديد"
        subtitle="هوية واحدة تكفي للتسوق من كل المتاجر"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
              label="رقم الهوية (9 أرقام)"
              value={idNumber}
              onChangeText={t => {
                setIdNumber(t);
                clearError();
              }}
              placeholder="401234567"
              keyboardType="numeric"
              numericOnly
              maxLength={9}
              icon="doc"
              error={idError}
              hint="رقم الهوية هو معرّفك الوحيد على المنصة — مستخدم واحد لكل هوية"
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
              placeholder="0598765432"
              keyboardType="phone-pad"
              numericOnly
              maxLength={15}
              icon="phone"
              error={phoneError}
              hint="يستخدمه المتجر للتواصل معك عند التوصيل واستعادة كلمة المرور"
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
              hint="تحمي حسابك وطلباتك — لا تشاركها مع أحد"
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
              <Text style={[type.small, {color: palette.danger, textAlign: 'center'}]}>
                {error}
              </Text>
            ) : null}
            <Button
              label={busy ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب'}
              onPress={submit}
              loading={busy}
              icon="user"
            />
            <Text style={[{fontSize: 11, color: palette.muted, textAlign: 'center', lineHeight: 17}]}>
              بإنشائك الحساب فأنت توافق على شروط الاستخدام وسياسة الخصوصية —
              لا نطلب أي بطاقات دفع، والسداد نقداً عند الاستلام.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {padding: spacing.lg, gap: spacing.xxxl},
});
