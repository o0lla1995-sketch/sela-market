/**
 * RegisterScreen.tsx — إنشاء حساب على مرحلتين (v3.7 — الجولة 67).
 * ─────────────────────────────────────────────────────────────────
 *  • المرحلة الأولى «البيانات»: الاسم + رقم الهوية + الجوال — زر
 *    «متابعة» لا يفتح المرحلة الثانية إلا بعد صلاحية الحقول الثلاثة.
 *  • المرحلة الثانية «كلمة المرور»: كلمة المرور + تأكيدها مع مؤشر
 *    القوة، وبطاقة ملخّص البيانات المدخلة مع زر «تعديل البيانات».
 *  • شريط مراحل أعلى الشاشة (١ البيانات → ٢ كلمة المرور) يوضح موقع
 *    المستخدم: الدائرة النشطة برتقالية، المكتملة علامة صح، والوصلة
 *    بينهما تتلون بتقدّم المستخدم.
 *  • زر الرجوع في أندرويد على المرحلة الثانية يعود للمرحلة الأولى
 *    (قبل الانسحاب من الشاشة) — beforeRemove مع preventDefault.
 *  • المنطق الأصلي محفوظ حرفياً: نفس دوال التحقق، نفس استدعاء
 *    register، نفس وسم onboarding والقفزة النظيفة إلى الرئيسية.
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
import {useSettingsStore} from '../../stores/settingsStore';
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

/** دائرة مرحلة: نشطة (برتقالية) / مكتملة (صح) / قادمة (باهتة). */
function StepBadge({
  n,
  label,
  state,
}: {
  n: number;
  label: string;
  state: 'active' | 'done' | 'todo';
}) {
  const {palette} = useTheme();
  const circleBg =
    state === 'active'
      ? palette.brand
      : state === 'done'
        ? palette.brandSoft
        : palette.surfaceAlt;
  return (
    <View style={regStyles.stepBadge}>
      <View style={[regStyles.stepCircle, {backgroundColor: circleBg}]}>
        {state === 'done' ? (
          <Icon name="check" size={14} color={palette.brandDark} strokeWidth={3} />
        ) : (
          <Text
            style={{
              fontSize: 13.5,
              fontFamily: fonts.bold,
              color: state === 'active' ? '#FFFFFF' : palette.muted,
            }}>
            {n}
          </Text>
        )}
      </View>
      <Text
        style={[
          type.tiny,
          {
            color:
              state === 'active'
                ? palette.brand
                : state === 'done'
                  ? palette.brandDark
                  : palette.muted,
            fontFamily: state === 'active' ? fonts.bold : fonts.medium,
          },
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function RegisterScreen({navigation}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const register = useAuthStore(s => s.register);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const toast = useToastStore(s => s.show);

  /* ── المرحلة الحالية: 1 = البيانات، 2 = كلمة المرور ── */
  const [stage, setStage] = useState<1 | 2>(1);

  const [idNumber, setIdNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  // سلسلة تعبئة داخل كل مرحلة: «التالي» ينقل للحقل التالي وآخر حقل
  // يرسل زر المرحلة مباشرة.
  const idRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // رجوع أندرويد على المرحلة الثانية = عودة للمرحلة الأولى (لا خروج
  // من الشاشة) + تنظيف خطأ الخادم عند أي انسحاب.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', e => {
      clearError();
      if (stage === 2) {
        e.preventDefault();
        setStage(1);
      }
    });
    return unsub;
  }, [navigation, clearError, stage]);

  const idError = touched ? validateIdNumber(idNumber) : null;
  const nameError = touched ? validateName(name) : null;
  const phoneError = touched ? validatePhone(phone) : null;
  const strength = passwordStrength(password);
  const pwProblem = touched ? passwordProblem(password) : null;
  const confirmError =
    touched && confirm !== password ? 'كلمتا المرور غير متطابقتين' : null;

  /* المرحلة الأولى → الثانية: تفتح فقط ببيانات صحيحة كاملة. */
  const goStage2 = () => {
    setTouched(true);
    if (
      validateName(name) ||
      validateIdNumber(idNumber) ||
      validatePhone(phone)
    ) {
      return;
    }
    setStage(2);
  };

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
      /* v3.6: وسم onboarding بعد نجاح التسجيل فقط — كانت الترحيب
       * تُحرق قبل فتح النافذة فيهبط إغلاقها على الرئيسية زائراً
       * بدل العودة للترحيب (نفس إصلاح شاشة الدخول). */
      useSettingsStore.getState().setOnboarded();
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

          {/* ── علامة العلامة + عنوان ديناميكي بالمرحلة ── */}
          <View style={regStyles.markWrap}>
            <View style={[regStyles.markBadge, {backgroundColor: palette.brand}]}>
              <Icon
                name={stage === 1 ? 'user' : 'lock'}
                size={26}
                color="#FFFFFF"
                strokeWidth={2}
              />
            </View>
            <Text style={[type.h1, {color: palette.ink, fontFamily: fonts.black}]}>
              حساب جديد
            </Text>
            <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
              {stage === 1
                ? 'دقيقة واحدة وتتسوق من كل متاجر المول'
                : 'آخر خطوة — حمِّ حسابك بكلمة مرور قوية'}
            </Text>
          </View>

          {/* ── شريط المراحل: ١ البيانات ← ٢ كلمة المرور ── */}
          <View style={regStyles.stepsRow}>
            <StepBadge n={1} label="البيانات" state={stage === 1 ? 'active' : 'done'} />
            <View
              style={[
                regStyles.stepLine,
                {backgroundColor: stage === 2 ? palette.brand : palette.line},
              ]}
            />
            <StepBadge n={2} label="كلمة المرور" state={stage === 2 ? 'active' : 'todo'} />
          </View>

          {stage === 1 ? (
            /* ═══ المرحلة الأولى: البيانات الشخصية ═══ */
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
                returnKeyType="done"
                onSubmitEditing={goStage2}
              />
              {error ? (
                <View style={[regStyles.errorCard, {backgroundColor: palette.dangerSoft}]}>
                  <Icon name="warning" size={15} color={palette.danger} />
                  <Text style={{fontSize: 12.5, color: palette.danger, flex: 1, fontFamily: fonts.medium}}>
                    {error}
                  </Text>
                </View>
              ) : null}
              <Button label="متابعة" onPress={goStage2} icon="forward" />
            </View>
          ) : (
            /* ═══ المرحلة الثانية: كلمة المرور وتأكيدها ═══ */
            <View style={{gap: spacing.lg}}>
              {/* ملخّص بيانات المرحلة الأولى + تعديل سريع */}
              <View
                style={[
                  regStyles.summaryCard,
                  {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder},
                ]}>
                <View style={regStyles.summaryRow}>
                  <Icon name="check" size={15} color={palette.brandDark} strokeWidth={2.6} />
                  <View style={{flex: 1, gap: 2}}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: palette.ink,
                        fontFamily: fonts.bold,
                      }}>
                      {name.trim()}
                    </Text>
                    <Text style={{fontSize: 11.5, color: palette.muted, fontFamily: fonts.medium}}>
                      {cleanPhone(phone)} · هوية {cleanIdNumber(idNumber)}
                    </Text>
                  </View>
                  <Button
                    label="تعديل"
                    variant="soft"
                    small
                    onPress={() => setStage(1)}
                  />
                </View>
              </View>

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
                autoFocus
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ═══ v3.7: لغة التصميم الموحدة لشاشات الدخول + مراحل التسجيل ═══ */
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
  /* ── شريط المراحل ── */
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -spacing.xs,
  },
  stepBadge: {alignItems: 'center', gap: 6},
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {flex: 1, height: 2.5, borderRadius: 2, marginHorizontal: spacing.md},
  /* ── بطاقة ملخّص البيانات (المرحلة الثانية) ── */
  summaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
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
