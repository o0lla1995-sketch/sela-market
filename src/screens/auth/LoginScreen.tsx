/**
 * LoginScreen.tsx — تسجيل الدخول: رقم الهوية + رقم الجوال (نفس زوج
 * التسجيل). بعد النجاح: إن كان الدخول بوابة إتمام طلب نعود للسلة
 * مباشرة، وإلا فالرئيسية.
 */
import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type} from '../../theme/tokens';
import {AppHeader, Button, Field, Screen} from '../../components/ui';
import {useAuthStore} from '../../stores/authStore';
import {useToastStore} from '../../stores/toastStore';
import {cleanIdNumber, cleanPhone, validateIdNumber, validatePhone} from '../../core/validation';
import {primeAndStart} from '../../services/ordersSync';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const login = useAuthStore(s => s.login);
  const busy = useAuthStore(s => s.busy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const toast = useToastStore(s => s.show);
  const reason = route.params?.reason;

  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', clearError);
    return unsub;
  }, [navigation, clearError]);

  const idError = touched ? validateIdNumber(idNumber) : null;
  const phoneError = touched ? validatePhone(phone) : null;

  const submit = async () => {
    setTouched(true);
    if (validateIdNumber(idNumber) || validatePhone(phone)) {
      return;
    }
    const ok = await login(cleanIdNumber(idNumber), cleanPhone(phone));
    if (ok) {
      primeAndStart();
      toast('أهلاً بعودتك', 'success');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  };

  return (
    <Screen style={{paddingBottom: insets.bottom}}>
      <AppHeader
        title="تسجيل الدخول"
        subtitle="برقم الهوية ورقم الجوال المسجلين لدينا"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? undefined : 'padding'} style={{flex: 1}}>
        <View style={styles.body}>
          <View style={{gap: spacing.lg}}>
            <Field
              label="رقم الهوية (9 أرقام)"
              value={idNumber}
              onChangeText={t => {
                setIdNumber(t);
                clearError();
              }}
              placeholder="مثال: 401234567"
              keyboardType="numeric"
              maxLength={12}
              icon="user"
              error={idError}
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
              maxLength={15}
              icon="phone"
              error={phoneError}
            />
            {error ? (
              <Text style={[type.small, {color: palette.danger, textAlign: 'center'}]}>
                {error}
              </Text>
            ) : null}
            <Button
              label={busy ? 'جارٍ الدخول…' : 'دخول'}
              onPress={submit}
              loading={busy}
              icon="forward"
            />
          </View>

          <View style={styles.footer}>
            <Text style={[type.small, {color: palette.muted}]}>
              ليس لديك حساب على سيلا ماركت؟
            </Text>
            <Button
              label="إنشاء حساب جديد"
              variant="ghost"
              small
              onPress={() => navigation.replace('Register', {reason})}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.xxxl,
  },
  footer: {alignItems: 'center', gap: spacing.xs, marginTop: 'auto'},
});
