/**
 * LoginScreen.tsx — تسجيل الدخول: رقم الهوية + كلمة المرور.
 * ─────────────────────────────────────────────────────────────────
 *  • v3.4 (الجولة 64): إعادة تصميم كاملة بطلب المستخدم — «صفحات الدخول
 *    والتسجيل مقرفة وغير مودرن وممتلئة بالملاحظات غير المهمة». الآن:
 *    نافذة عصرية بعلامة العلامة التجارية (شارة + عنوان ضخم + سطر واحد)،
 *    حقول نظيفة بلا ملاحظات ثانوية، وأزرار واضحة — المنطق لم يُمس.
 *  • v2.3: «نسيت كلمة المرور؟» تحت إدارة المالك:
 *   • مغيّر من اللوحة (الافتراضي): الضغط عليه يعرض «تواصل مع
 *     الإدارة» مع رقم التواصل.
 *   • مفعّل من اللوحة: مسار رمز SMS — الهوية + الجوال المسجل
 *     يرسلان رمزاً للجوال، ثم الرمز + كلمة مرور جديدة.
 *  • بعد النجاح: إن كان الدخول بوابة إتمام طلب نعود للسلة مباشرة.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Button, Field, Screen, SecureField} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useSettingsStore} from '../../stores/settingsStore';
import {authenticateBiometric} from '../../services/biometrics';
import {useToastStore} from '../../stores/toastStore';
import {getMarketConfig, passwordProblem} from '../../api/endpoints';
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
  const forgotRequestCode = useAuthStore(s => s.forgotRequestCode);
  const forgotVerify = useAuthStore(s => s.forgotVerify);
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

  // v2.3: نسيان كلمة المرور المُدار — الإعدادات من الخادم + الخطوة.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'choose' | 'code' | 'contact'>('choose');
  const [forgotId, setForgotId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPw, setForgotPw] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', clearError);
    return unsub;
  }, [navigation, clearError]);

  const idError = touched ? validateIdNumber(idNumber) : null;

  /* v3.1 (الجولة 61): نهاية دخول ذكية — الشكوى الحرفية: «عند تسجيل
   * الدخول في شاشة الترحيب أبقى عالقاً في الصفحة كما هي». الجذر:
   * نافذة الدخول تُغلق بـ goBack لكن ما تحتها كان شاشة الترحيب التي
   * أُزيلت من المكدس لحظة setOnboarded() — فلا عودة إلى شيء. الآن:
   * إذا كان ما تحت النافذة هو الترحيب أو لا يوجد شيء تحتها، قفزة
   * نظيفة إلى الرئيسية (reset) بدل العودة للوراء.
   * v3.6 (الجولة 66): وسم onboarding انتقل إلى هنا — بعد نجاح الدخول
   * فعلاً. قبل ذلك كانت الترحيب تُحرق قبل فتح النافذة فيهبط إغلاقها
   * على الرئيسية زائراً بدل العودة للترحيب (شكوى المستخدم). */
  const finishLogin = (message?: string) => {
    useSettingsStore.getState().setOnboarded();
    primeAndStart();
    toast(message ?? 'أهلاً بعودتك', 'success');
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

  /* فتح الشيت: نقرأ إعدادات الخادم أولاً — الظهور من عدمه قرار
   * الإدارة (مفتاح في اللوحة). عند أي فشل شبكي نفتح وضع «تواصل
   * مع الإدارة» الأكثر أماناً (لا استعادة ذاتية). */
  const openForgot = async () => {
    setForgotOpen(true);
    setForgotStep('choose');
    setForgotCode('');
    setForgotPw('');
    setForgotBusy(true);
    try {
      const cfg = await getMarketConfig();
      setAdminPhone(cfg.contactPhone);
      setForgotStep(cfg.forgotPassword ? 'choose' : 'contact');
    } catch {
      setAdminPhone(null);
      setForgotStep('contact');
    } finally {
      setForgotBusy(false);
    }
  };

  /* الخطوة 1: إرسال الرمز للجوال المسجل. */
  const sendCode = async () => {
    if (validateIdNumber(forgotId) || validatePhone(forgotPhone)) {
      toast('راجع الحقول: الهوية 9 أرقام وجوال صحيح', 'danger');
      return;
    }
    setForgotBusy(true);
    const res = await forgotRequestCode(cleanIdNumber(forgotId), cleanPhone(forgotPhone));
    setForgotBusy(false);
    if (res.ok) {
      setForgotStep('code');
      toast('أرسلنا رمزاً إلى جوالك المسجل', 'success');
    } else {
      toast(res.error, 'danger');
    }
  };

  /* الخطوة 2: الرمز + كلمة المرور الجديدة — لا دخول تلقائي:
   * يسجل الدخول بكلمته الجديدة بنفسه (خطوة تحقق فعلية ثانية). */
  const verifyAndReset = async () => {
    if (
      forgotCode.trim().length !== 6 ||
      passwordProblem(forgotPw) != null
    ) {
      toast('راجع الحقول: الرمز 6 أرقام وكلمة مرور 8+ بأرقام وحروف', 'danger');
      return;
    }
    setForgotBusy(true);
    const ok = await forgotVerify(
      cleanIdNumber(forgotId),
      cleanPhone(forgotPhone),
      forgotCode.trim(),
      forgotPw,
    );
    setForgotBusy(false);
    if (ok) {
      setForgotOpen(false);
      toast('عُيّنت كلمة المرور الجديدة — سجّل الدخول بها', 'success');
    }
  };

  return (
    <Screen style={{paddingBottom: insets.bottom}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{flex: 1}}>
        <ScrollView
          contentContainerStyle={authStyles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* ── شريط علوي: مقبض النافذة + زر الإغلاق ── */}
          <View style={authStyles.topRow}>
            <View style={{width: 36}} />
            <View style={[authStyles.grab, {backgroundColor: palette.lineStrong}]} />
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
                authStyles.closeBtn,
                {backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.7 : 1},
              ]}>
              <Icon name="close" size={17} color={palette.ink} strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* ── علامة العلامة + عنوان الترحيب ── */}
          <View style={authStyles.markWrap}>
            <View style={[authStyles.markBadge, {backgroundColor: palette.brand}]}>
              <Icon name="bag" size={26} color="#FFFFFF" strokeWidth={2} />
            </View>
            <Text style={[type.h1, {color: palette.ink, fontFamily: fonts.black}]}>
              أهلاً بعودتك
            </Text>
            <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
              سجّل الدخول لمتابعة التسوق من متاجر المول
            </Text>
          </View>

          {/* ── الحقول ── */}
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
              onPress={() => void openForgot()}
              hitSlop={8}
              style={{alignSelf: 'flex-start', paddingVertical: 4}}>
              <Text style={[type.smallMedium, {color: palette.brand, fontFamily: fonts.bold}]}>
                نسيت كلمة المرور؟
              </Text>
            </Pressable>
          </View>

          {/* ── الزر الأساسي + الخطأ ── */}
          {error != null && !busy ? (
            <View style={[authStyles.errorCard, {backgroundColor: palette.dangerSoft}]}>
              <Icon name="warning" size={15} color={palette.danger} />
              <Text style={{fontSize: 12.5, color: palette.danger, flex: 1, fontFamily: fonts.medium}}>
                {error}
              </Text>
            </View>
          ) : null}
          <Button
            label={busy ? 'جارٍ الدخول…' : 'دخول'}
            disabled={busy}
            onPress={() => void submit()}
          />

          {/* v2.1: الدخول بالبصمة — جلسة محفوظة + الخيار مفعّل */}
          {savedSessionToken != null && biometricLoginEnabled ? (
            <View style={{gap: 6, alignItems: 'center'}}>
              <View style={authStyles.dividerRow}>
                <View style={[authStyles.dividerLine, {backgroundColor: palette.line}]} />
                <Text style={{fontSize: 10.5, color: palette.muted}}>أو</Text>
                <View style={[authStyles.dividerLine, {backgroundColor: palette.line}]} />
              </View>
              <Button
                label="الدخول بالبصمة"
                variant="soft"
                icon="fingerprint"
                disabled={bioBusy}
                onPress={() => {
                  setBioBusy(true);
                  void authenticateBiometric('افتح جلسة سيلا ماركت المحفوظة')
                    .then(ok => {
                      if (ok) {
                        // الجلسة المحفوظة ما زالت حية — الدخول بها مباشرة
                        finishLogin('فتحت جلستك بالبصمة');
                      } else {
                        toast('أُلغي الدخول بالبصمة', 'info');
                      }
                    })
                    .finally(() => setBioBusy(false));
                }}
              />
            </View>
          ) : null}

          {/* ── حساب جديد ── */}
          <Pressable
            onPress={() => navigation.navigate('Register', {reason})}
            hitSlop={8}
            style={{alignItems: 'center', paddingVertical: 6}}>
            <Text style={{fontSize: 12.5, color: palette.muted, fontFamily: fonts.medium}}>
              ليس لديك حساب؟{' '}
              <Text style={{color: palette.brandDark, fontFamily: fonts.bold}}>
                أنشئ حساباً جديداً
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* شيت استعادة كلمة المرور (v2.3 — مُدار من الإدارة) */}
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

            {forgotStep === 'contact' ? (
              <>
                <Text style={[type.h3, {color: palette.ink}]}>استعادة الحساب</Text>
                <Text style={[type.small, {color: palette.muted, lineHeight: 20}]}>
                  استعادة كلمة المرور تتم عبر إدارة سيلا ماركت — تواصل معنا
                  لإثبات ملكية حسابك.
                </Text>
                {adminPhone != null && adminPhone !== '' ? (
                  <Button
                    label={`اتصال بالإدارة${adminPhone ? ` · ${adminPhone}` : ''}`}
                    icon="phone"
                    variant="soft"
                    onPress={() => {
                      Linking.openURL(`tel:${adminPhone}`).catch(() => {
                        toast('تعذر فتح الاتصال — الرقم: ' + adminPhone, 'info');
                      });
                    }}
                  />
                ) : null}
                <Button
                  label="إغلاق"
                  variant="ghost"
                  onPress={() => setForgotOpen(false)}
                />
              </>
            ) : forgotStep === 'choose' ? (
              <>
                <Text style={[type.h3, {color: palette.ink}]}>استعادة كلمة المرور</Text>
                <Text style={[type.small, {color: palette.muted, lineHeight: 20}]}>
                  أدخل رقم الهوية والجوال المسجلين — سنرسل رمز تحقق إلى جوالك.
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
                <Button
                  label={forgotBusy ? 'جارٍ إرسال الرمز…' : 'إرسال رمز التحقق'}
                  disabled={forgotBusy}
                  onPress={() => void sendCode()}
                />
              </>
            ) : (
              <>
                <Text style={[type.h3, {color: palette.ink}]}>أدخل رمز التحقق</Text>
                <Text style={[type.small, {color: palette.muted, lineHeight: 20}]}>
                  أرسلنا رمزاً من 6 أرقام إلى الجوال المنتهي بـ
                  {' ' + (forgotPhone.length >= 3 ? forgotPhone.slice(-3) : '***')}.
                </Text>
                <Field
                  label="رمز التحقق"
                  value={forgotCode}
                  onChangeText={setForgotCode}
                  placeholder="6 أرقام"
                  keyboardType="numeric"
                  numericOnly
                  icon="shield"
                  maxLength={6}
                />
                <SecureField
                  label="كلمة المرور الجديدة"
                  value={forgotPw}
                  onChangeText={setForgotPw}
                  placeholder="8 أحرف على الأقل — رقماً وحرفاً"
                />
                <Button
                  label={forgotBusy ? 'جارٍ التحقق…' : 'تحقق وتعيين كلمة المرور'}
                  disabled={forgotBusy}
                  onPress={() => void verifyAndReset()}
                />
                <Pressable
                  onPress={() => void sendCode()}
                  hitSlop={8}
                  style={{alignSelf: 'center', paddingVertical: 6}}>
                  <Text style={{fontSize: 12.5, color: palette.brand}}>
                    لم يصلك الرمز؟ أعد الإرسال
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/* ═══ v3.4: لغة التصميم الموحدة لشاشات الدخول ═══ */
const authStyles = StyleSheet.create({
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
});

const styles = StyleSheet.create({
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
