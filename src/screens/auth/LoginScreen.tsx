/**
 * LoginScreen.tsx — تسجيل الدخول: رقم الهوية + كلمة المرور.
 * v2.2: أُزيل مسار الدخول برقم الهاتف (الحسابات القديمة) بطلب
 * صريح من المالك — التطبيق غير منشور للعلن ولا مستخدمين حقيقيين،
 * وكل حساب يُنشأ بكلمة مرور منذ v1.1. يتضمن:
 *  • «نسيت كلمة المرور؟» — استعادة برقم الهوية + الجوال المسجل.
 * بعد النجاح: إن كان الدخول بوابة إتمام طلب نعود للسلة مباشرة.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import {radius, spacing, type} from '../../theme/tokens';
import {
  AppHeader,
  Button,
  Field,
  Screen,
  SecureField,
} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useSettingsStore} from '../../stores/settingsStore';
import {authenticateBiometric} from '../../services/biometrics';
import {useToastStore} from '../../stores/toastStore';
import {passwordProblem} from '../../api/endpoints';
import {cleanIdNumber, cleanPhone, validateIdNumber, validatePhone} from '../../core/validation';
import {primeAndStart} from '../../services/ordersSync';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const login = useAuthStore(s => s.login);
  /* v2.1: الدخول بالبصمة — توفرها فقط عند جلسة محفوظة + الخيار مفعّل */
  const savedSessionToken = useAuthStore(s => s.token);
  const biometricLoginEnabled = useSettingsStore(s => s.biometricLoginEnabled);
  const [bioBusy, setBioBusy] = useState(false);
  const resetPassword = useAuthStore(s => s.resetPassword);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const toast = useToastStore(s => s.show);
  const reason = route.params?.reason;

  const [idNumber, setIdNumber] = useState('');
  const [password, setPasswordField] = useState('');
  const [touched, setTouched] = useState(false);

  // v1.2: سلسلة تعبئة — الهوية ← كلمة المرور ← دخول (لوحة المفاتيح
  // الرقمية للهوية، «التالي» ينقل للكلمة، «دخول» يرسل مباشرة).
  const passwordRef = useRef<TextInput>(null);

  // نسيان كلمة المرور
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotPw, setForgotPw] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', clearError);
    return unsub;
  }, [navigation, clearError]);

  const idError = touched ? validateIdNumber(idNumber) : null;

  const finishLogin = (message?: string) => {
    primeAndStart();
    toast(message ?? 'أهلاً بعودتك', 'success');
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const submit = async () => {
    setTouched(true);
    if (validateIdNumber(idNumber) || password.length === 0) {
      return;
    }
    const result = await login(cleanIdNumber(idNumber), password);
    if (result.ok) {
      finishLogin();
    }
  };

  const submitForgot = async () => {
    if (
      validateIdNumber(forgotId) ||
      validatePhone(forgotPhone) ||
      passwordProblem(forgotPw) != null
    ) {
      toast('راجع الحقول: الهوية 9 أرقام، جوال صحيح، وكلمة مرور 8+ بأرقام وحروف', 'danger');
      return;
    }
    setForgotBusy(true);
    const ok = await resetPassword(
      cleanIdNumber(forgotId),
      cleanPhone(forgotPhone),
      forgotPw,
    );
    setForgotBusy(false);
    if (ok) {
      setForgotOpen(false);
      finishLogin('استُعيدت كلمة المرور وسجّلنا دخولك');
    }
  };

  return (
    <Screen style={{paddingBottom: insets.bottom}}>
      <AppHeader
        title="تسجيل الدخول"
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
        big
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{flex: 1}}>
        <ScrollView
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <>
              <View style={{gap: spacing.md}}>
                <Field
                  label="رقم الهوية"
                  value={idNumber}
                  onChangeText={setIdNumber}
                  placeholder="9 أرقام"
                  keyboardType="numeric"
                  numericOnly
                  icon="user"
                  error={idError}
                  maxLength={9}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <SecureField
                  label="كلمة المرور"
                  value={password}
                  onChangeText={setPasswordField}
                  placeholder="كلمة مرور حسابك"
                  inputRef={passwordRef}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  onPress={() => setForgotOpen(true)}
                  hitSlop={8}
                  style={{alignSelf: 'flex-start', paddingVertical: 4}}>
                  <Text style={[type.smallMedium, {color: palette.brand}]}>
                    نسيت كلمة المرور؟
                  </Text>
                </Pressable>
              </View>

              <Button
                label={busy ? 'جارٍ الدخول…' : 'دخول'}
                disabled={busy}
                onPress={() => void submit()}
              />

              {/* v2.1: الدخول بالبصمة — جلسة محفوظة + الخيار مفعّل */}
              {savedSessionToken != null && biometricLoginEnabled ? (
                <View style={{gap: 6, alignItems: 'center'}}>
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, {backgroundColor: palette.line}]} />
                    <Text style={{fontSize: 10.5, color: palette.muted}}>أو</Text>
                    <View style={[styles.dividerLine, {backgroundColor: palette.line}]} />
                  </View>
                  <Button
                    label="الدخول بالبصمة"
                    variant="soft"
                    icon="shield"
                    disabled={bioBusy}
                    onPress={() => {
                      setBioBusy(true);
                      void authenticateBiometric('افتح جلسة سيلا ماركت المحفوظة')
                        .then(ok => {
                          if (ok) {
                            // الجلسة المحفوظة ما زالت حية — الدخول بها مباشرة
                            navigation.replace('Main');
                          } else {
                            toast('أُلغي الدخول بالبصمة', 'info');
                          }
                        })
                        .finally(() => setBioBusy(false));
                    }}
                  />
                </View>
              ) : null}

            </>

          {error != null && !busy ? (
            <Text style={[type.small, {color: palette.danger, textAlign: 'center'}]}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* شيت استعادة كلمة المرور */}
      <Modal
        visible={forgotOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setForgotOpen(false)}>
        <View style={[styles.sheetOverlay, {backgroundColor: palette.overlay}]}>
          <Pressable style={{flex: 1}} onPress={() => setForgotOpen(false)} />
          <View
            style={[
              styles.sheet,
              {backgroundColor: palette.surface, paddingBottom: insets.bottom + spacing.lg},
            ]}>
            <View style={[styles.sheetHandle, {backgroundColor: palette.lineStrong}]} />
            <Text style={[type.h3, {color: palette.ink}]}>استعادة كلمة المرور</Text>
            <Text style={[type.small, {color: palette.muted, lineHeight: 20}]}>
              أدخل رقم الهوية والجوال المسجلان في حسابك، واختر كلمة مرور
              جديدة. ستُسجَّل خروجاً من كل الأجهزة الأخرى.
            </Text>
            <Field
              label="رقم الهوية"
              value={forgotId}
              onChangeText={setForgotId}
              placeholder="9 أرقام"
              keyboardType="numeric"
              numericOnly
              icon="user"
              maxLength={9}
            />
            <Field
              label="رقم الجوال المسجل"
              value={forgotPhone}
              onChangeText={setForgotPhone}
              placeholder="05xxxxxxxx"
              keyboardType="phone-pad"
              numericOnly
              icon="phone"
              maxLength={16}
            />
            <SecureField
              label="كلمة المرور الجديدة"
              value={forgotPw}
              onChangeText={setForgotPw}
              placeholder="8 أحرف على الأقل — رقماً وحرفاً"
              returnKeyType="go"
              onSubmitEditing={() => void submitForgot()}
            />
            <Button
              label={forgotBusy ? 'جارٍ الاستعادة…' : 'استعادة وتسجيل الدخول'}
              disabled={forgotBusy}
              onPress={() => void submitForgot()}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  sheetOverlay: {flex: 1, justifyContent: 'flex-end'},
  sheet: {
    borderTopRightRadius: radius.xl,
    borderTopLeftRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
});
