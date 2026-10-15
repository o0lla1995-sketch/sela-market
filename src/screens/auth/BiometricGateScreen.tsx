/**
 * BiometricGateScreen.tsx — بوابة الدخول بالبصمة (v2.1).
 * ─────────────────────────────────────────────────────────────────
 *  • تظهر عند بدء التطبيق عندما توجد جلسة محفوظة (token) وفُعّل خيار
 *    «الدخول بالبصمة» من الإعدادات. بصمة واحدة تفتح التطبيق على جلسة
 *    المستخدم.
 *  • v3.4 (الجولة 64): إعادة تصميم عصرية بطلب المستخدم — دائرة بصمة
 *    كبيرة بأيقونة مخصصة جديدة، نصوص مختصرة بلا ملاحظات ثانوية،
 *    وزر أساسي واضح. المنطق (الفتح التلقائي وحارس إعادة القفل)
 *    لم يُمس إطلاقاً.
 *  • v3.6 (الجولة 66 — طلب المستخدم الصريح): أُزيل «الدخول بدون
 *    بصمة» كلياً — كان يفتح الجلسة المحفوظة بلا أي تحقق فيكسر غرض
 *    البوابة الأمني بالكامل. البديل: زر «تسجيل الخروج» — ينهي
 *    الجلسة المحفوظة نظيفاً (مع إيقاف مستطلع الطلبات) ويعيد
 *    التطبيق لوضع التصفح كزائر. المنطق المتبقي لم يُمس.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Button} from '../../components/ui';
import {
  authenticateBiometric,
  fingerprintEnrolled,
  markBiometricAuthEnded,
  markBiometricAuthStarted,
} from '../../services/biometrics';
import {useAuthStore} from '../../stores/authStore';
import {stopOrdersSync} from '../../services/ordersSync';
import {useToastStore} from '../../stores/toastStore';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricGate'>;

export function BiometricGateScreen({navigation}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToastStore(s => s.show);
  const [busy, setBusy] = useState(false);
  const [hasPrint, setHasPrint] = useState<boolean | null>(null);

  useEffect(() => {
    void fingerprintEnrolled().then(setHasPrint);
  }, []);

  const run = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    /* v2.5: تعليم بداية المحاولة — يمنع مستمع إعادة القفل من
     * إقفال التطبيق في وجه المستخدم لحظة نجاح بصمته (سباق
     * الخلفية/العودة مع النشاط الشفاف المستضيف للحوار). */
    markBiometricAuthStarted();
    try {
      const ok = await authenticateBiometric('افتح جلسة سيلا ماركت المحفوظة');
      markBiometricAuthEnded(ok);
      if (ok) {
        navigation.replace('Main');
      } else {
        /* v3.6: لا مسار التفافي بعد الآن — إما إعادة المحاولة أو
         * تسجيل الخروج (الزر أسفل البطاقة). */
        toast('أُلغي الدخول بالبصمة — أعد المحاولة أو سجّل الخروج', 'info');
      }
    } catch {
      markBiometricAuthEnded(false);
    } finally {
      setBusy(false);
    }
  }, [busy, navigation, toast]);

  /* v2.3: فتح تلقائي — نافذة البصمة تظهر فور فتح التطبيق بلا أي
   * ضغط (طلب المستخدم الصريح: «لا تظهر مباشرة عند فتح التطبيق
   * وهذا مزعج»). تأخير 450ms حتى تكتمل حركة الانتقال — نظام
   * أندرويد يلغي نافذة البصمة إن أُطلقت أثناء الانتقال. */
  const autoFired = useRef(false);
  useEffect(() => {
    if (autoFired.current) {
      return;
    }
    autoFired.current = true;
    const timer = setTimeout(() => {
      void run();
    }, 450);
    return () => clearTimeout(timer);
    // المرجع يمنع الإطلاق المزدوج؛ نعتمد أول نسخة من run فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* v3.6: تسجيل الخروج — بديل «الدخول بدون بصمة» المحذوف بطلب
   * المستخدم (كان يكسر غرض البصمة). يوقف مستطلع الطلبات، ينهي
   * الجلسة المحفوظة نظيفاً، ويعيد التطبيق لوضع التصفح كزائر. */
  const doLogout = useCallback(() => {
    stopOrdersSync();
    useAuthStore.getState().logout();
    toast('تم تسجيل الخروج — يمكنك التصفح كزائر', 'info');
    navigation.reset({index: 0, routes: [{name: 'Main'}]});
  }, [navigation, toast]);

  return (
    <SafeAreaView style={[gateStyles.wrap, {backgroundColor: palette.bg}]}>
      <View style={[gateStyles.card, {backgroundColor: palette.surface, borderColor: palette.line}]}>
        {/* v3.4: دائرة البصمة الكبيرة — أيقونة مخصصة بلون العلامة */}
        <View style={[gateStyles.printCircle, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
          <Icon name="fingerprint" size={44} color={palette.brandDark} strokeWidth={1.7} />
        </View>
        <Text style={[type.h2, {color: palette.ink, fontFamily: fonts.black, textAlign: 'center'}]}>
          الدخول بالبصمة
        </Text>
        <Text style={[type.small, {color: palette.muted, textAlign: 'center', lineHeight: 21}]}>
          جلسة حسابك محفوظة على هذا الجهاز — افتحها بلمسة واحدة
        </Text>
        {hasPrint === false ? (
          <Text style={{fontSize: 11, color: palette.warning, fontFamily: fonts.medium, textAlign: 'center'}}>
            لا توجد بصمة مسجلة في الجهاز — سجّلها من إعدادات الجهاز أو سجّل الخروج
          </Text>
        ) : null}
        <Button
          label={busy ? 'جارٍ الفتح…' : 'فتح بالبصمة'}
          icon="fingerprint"
          onPress={run}
          disabled={busy}
        />
        {/* v3.6: تسجيل الخروج — البديل الوحيد للبصمة (طلب المستخدم:
         * «قم بإزالة الدخول بدون بصمة لأنها تكسر البصمة واجعله
         * تسجيل الخروج من التطبيق»). */}
        <Pressable
          onPress={doLogout}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="تسجيل الخروج من التطبيق"
          style={({pressed}) => [gateStyles.logoutRow, {opacity: pressed ? 0.6 : 1}]}>
          <Icon name="logout" size={14} color={palette.muted} />
          <Text style={{fontSize: 12.5, color: palette.muted, fontFamily: fonts.medium}}>
            تسجيل الخروج من التطبيق
          </Text>
        </Pressable>
      </View>
      <View style={{paddingBottom: insets.bottom + 12}} />
    </SafeAreaView>
  );
}

const gateStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  printCircle: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* v3.6: صف تسجيل الخروج — هادئ ومتقن تحت الزر الأساسي. */
  logoutRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
});
