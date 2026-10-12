/**
 * LoginScreen.tsx — تسجيل الدخول: رقم الهوية + كلمة المرور (v1.1 —
 * كل حساب محمي بكلمة مرور). يتضمن:
 *  • «نسيت كلمة المرور؟» — استعادة برقم الهوية + الجوال المسجل.
 *  • مسار ترحيل للحسابات القديمة (أنشئت قبل كلمات المرور): الدخول
 *    بالهاتف مرة واحدة ثم فرض شاشة تعيين كلمة مرور فوراً.
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
import {Icon} from '../../components/Icon';
import {useAuthStore} from '../../stores/authStore';
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
  const legacyLogin = useAuthStore(s => s.legacyLogin);
  const setPassword = useAuthStore(s => s.setPassword);
  const resetPassword = useAuthStore(s => s.resetPassword);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const toast = useToastStore(s => s.show);
  const reason = route.params?.reason;

  const [idNumber, setIdNumber] = useState('');
  const [password, setPasswordField] = useState('');
  const [legacyPhone, setLegacyPhone] = useState('');
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

  // ترحيل: بعد دخول حساب قديم بلا كلمة مرور → تعيين إلزامي
  const [migrating, setMigrating] = useState(false);
  const [migratePw, setMigratePw] = useState('');

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
      if (result.mustSetPassword) {
        setMigrating(true);
        return;
      }
      finishLogin();
    }
  };

  /** دخول حساب قديم بالهاتف (قبل تعيين كلمة مرور). */
  const submitLegacy = async () => {
    setTouched(true);
    if (validateIdNumber(idNumber) || validatePhone(legacyPhone)) {
      return;
    }
    const result = await legacyLogin(cleanIdNumber(idNumber), cleanPhone(legacyPhone));
    if (result.ok) {
      if (result.mustSetPassword) {
        setMigrating(true);
        return;
      }
      finishLogin();
    }
  };

  const completeMigration = async () => {
    const problem = passwordProblem(migratePw);
    if (problem != null) {
      toast(problem, 'danger');
      return;
    }
    const ok = await setPassword(migratePw);
    if (ok) {
      setMigrating(false);
      finishLogin('أُمّن حسابك بكلمة مرور — أهلاً بك');
    } else {
      toast('تعذر حفظ كلمة المرور — حاول مجدداً', 'danger');
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
        title={migrating ? 'تأمين حسابك' : 'تسجيل الدخول'}
        onBack={() => {
          if (migrating) {
            // الترحيل إلزامي قبل المتابعة — خروج كامل من الشاشة
            setMigrating(false);
            useAuthStore.getState().logout();
          }
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
          {!migrating ? (
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

              {/* مسار الترحيل: حساب أنشئ قبل كلمات المرور */}
              <View
                style={[
                  styles.legacyBox,
                  {backgroundColor: palette.infoSoft, borderColor: palette.info},
                ]}>
                <View style={{flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start'}}>
                  <Icon name="info" size={18} color={palette.info} />
                  <View style={{flex: 1, gap: spacing.md}}>
                    <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20}]}>
                      أنشأت حسابك قبل التحديث الأخير؟ ادخل مرة واحدة برقم
                      الجوال المسجل وسنطلب منك تعيين كلمة مرور فوراً.
                    </Text>
                    <Field
                      label="رقم الجوال المسجل"
                      value={legacyPhone}
                      onChangeText={setLegacyPhone}
                      placeholder="05xxxxxxxx"
                      keyboardType="phone-pad"
                      numericOnly
                      icon="phone"
                      error={touched ? validatePhone(legacyPhone) : null}
                      maxLength={16}
                      returnKeyType="go"
                      onSubmitEditing={() => void submitLegacy()}
                    />
                    <Button
                      label="دخول الحسابات القديمة"
                      small
                      variant="outline"
                      disabled={busy}
                      onPress={() => void submitLegacy()}
                    />
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={{gap: spacing.lg}}>
              <View
                style={[
                  styles.legacyBox,
                  {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder},
                ]}>
                <View style={{flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start'}}>
                  <Icon name="shield" size={20} color={palette.brand} />
                  <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20, flex: 1}]}>
                    حسابك أنشئ قبل إضافة كلمات المرور. اختر كلمة مرور
                    الآن لحماية حسابك — خطوة واحدة ولن تُطلب مجدداً.
                  </Text>
                </View>
              </View>
              <SecureField
                label="كلمة المرور الجديدة"
                value={migratePw}
                onChangeText={setMigratePw}
                placeholder="8 أحرف على الأقل — رقماً وحرفاً"
                showStrength
                strength={
                  migratePw.length === 0 ? 0 : passwordProblem(migratePw) != null ? 1 : 2
                }
              />
              <Button
                label={busy ? 'جارٍ الحفظ…' : 'حفظ ومتابعة'}
                disabled={busy}
                onPress={() => void completeMigration()}
              />
            </View>
          )}

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
  legacyBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
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
