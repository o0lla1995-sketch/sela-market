/**
 * BiometricGateScreen.tsx — بوابة الدخول بالبصمة (v2.1).
 * ─────────────────────────────────────────────────────────────────
 * تظهر عند بدء التطبيق عندما توجد جلسة محفوظة (token) وفُعّل خيار
 * «الدخول بالبصمة» من الإعدادات. بصمة واحدة تفتح التطبيق على جلسة
 * المستخدم — أو «استخدام كلمة المرور» يسقط إلى شاشة الدخول.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Button} from '../../components/ui';
import {authenticateBiometric, fingerprintEnrolled} from '../../services/biometrics';
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
    try {
      const ok = await authenticateBiometric('افتح جلسة سيلا ماركت المحفوظة');
      if (ok) {
        navigation.replace('Main');
      } else {
        toast('أُلغي الدخول بالبصمة — استخدم كلمة المرور', 'info');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, navigation, toast]);

  return (
    <SafeAreaView style={[gateStyles.wrap, {backgroundColor: palette.bg}]}>
      <View style={[gateStyles.card, {backgroundColor: palette.surface, borderColor: palette.line}]}>
        <View style={[gateStyles.printCircle, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
          <Icon name="shield" size={40} color={palette.brandDark} />
        </View>
        <Text style={[type.h2, {color: palette.ink, fontFamily: fonts.black}]}>
          الدخول بالبصمة
        </Text>
        <Text style={[type.small, {color: palette.muted, textAlign: 'center', lineHeight: 21}]}>
          جلسة حسابك محفوظة على هذا الجهاز. افتحها ببصمتك مباشرة — أسرع
          من كتابة كلمة المرور في كل مرة.
        </Text>
        {hasPrint === false ? (
          <Text style={{fontSize: 11, color: palette.warning, fontFamily: fonts.medium, textAlign: 'center'}}>
            لم نجد بصمة مسجلة — سجّل بصمة من إعدادات جهازك أولاً؛ يعمل الخيار أيضاً برمز القفل
          </Text>
        ) : null}
        <Button
          label={busy ? 'جارٍ الفتح…' : 'فتح بالبصمة الآن'}
          icon="shield"
          onPress={run}
          disabled={busy}
        />
        <Pressable
          onPress={() => navigation.replace('Main')}
          hitSlop={8}
          style={{paddingVertical: 6}}>
          <Text style={{fontSize: 12.5, color: palette.brandDark, fontFamily: fonts.medium}}>
            الدخول لاحقاً بدون بصمة
          </Text>
        </Pressable>
      </View>
      <View style={{paddingBottom: insets.bottom + 12}}>
        <Text style={{fontSize: 11, color: palette.muted, textAlign: 'center'}}>
          يمكنك تعطيل البوابة من الإعدادات · الأمان
        </Text>
      </View>
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
    width: 86,
    height: 86,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
