/**
 * SettingsScreen.tsx — الإعدادات:
 * • المظهر (المود): فاتح / داكن / حسب النظام — فوري بلا إعادة تشغيل.
 * • الإشعارات: تفعيل/تعطيل + طلب إذن النظام (Android 13+).
 * • الحساب: تغيير كلمة المرور (يتطلب الحالية).
 *
 * v1.1: حُذف قسم «متقدم — خادم سيلا» نهائياً بطلب صريح — الخادم
 * الرسمي الوحيد مضبوط في التطبيق ولا شيء يخص المستخدم فيه.
 */
import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {
  AppHeader,
  Button,
  Card,
  Field,
  Screen,
  SectionTitle,
  Segmented,
  SwitchRow,
} from '../../components/ui';
import {useSettingsStore} from '../../stores/settingsStore';
import {useAuthStore} from '../../stores/authStore';
import {passwordProblem} from '../../api/endpoints';
import {
  areNotificationsEnabled,
  requestNotificationsPermission,
} from '../../services/localNotifications';
import {useToastStore} from '../../stores/toastStore';
import type {ThemeMode} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Settings'>;

export function SettingsScreen({navigation}: Props) {
  const {palette, mode, setMode} = useTheme();
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(s => s.setNotificationsEnabled);
  const user = useAuthStore(s => s.user);
  const setPassword = useAuthStore(s => s.setPassword);
  const toast = useToastStore(s => s.show);

  const [osPermission, setOsPermission] = useState(true);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    void areNotificationsEnabled().then(setOsPermission);
  }, []);

  const onToggleNotifications = async (v: boolean) => {
    if (v) {
      // تأكد من إذن النظام أولاً (Android 13+).
      const granted = await requestNotificationsPermission();
      setOsPermission(granted);
      if (!granted) {
        toast('امنح إذن الإشعارات من إعدادات النظام أولاً', 'danger');
        return;
      }
    }
    setNotificationsEnabled(v);
  };

  const changePassword = async () => {
    const problem = passwordProblem(newPw);
    if (problem != null) {
      toast(problem, 'danger');
      return;
    }
    if (currentPw.trim().length === 0) {
      toast('أدخل كلمة المرور الحالية', 'danger');
      return;
    }
    setSavingPw(true);
    const ok = await setPassword(newPw, currentPw);
    setSavingPw(false);
    if (ok) {
      setCurrentPw('');
      setNewPw('');
      toast('غُيّرت كلمة المرور بنجاح', 'success');
    } else {
      toast('تعذر تغيير كلمة المرور — تحقق من الحالية', 'danger');
    }
  };

  return (
    <Screen>
      <AppHeader
        title="الإعدادات"
        onBack={() => navigation.goBack()}
        big
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} showsVerticalScrollIndicator={false}>
        {/* المظهر */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="المظهر" />
          <Segmented<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              {value: 'light', label: 'فاتح', icon: 'sun'},
              {value: 'dark', label: 'داكن', icon: 'moon'},
              {value: 'system', label: 'حسب النظام', icon: 'autoTheme'},
            ]}
          />
          <Text style={[{fontSize: 11.5, color: palette.muted, lineHeight: 18}]}>
            {mode === 'system'
              ? 'يتبع التطبيق وضع جهازك فاتحاً أو داكناً تلقائياً'
              : mode === 'light'
                ? 'الوضع الفاتح — مناسب للتصفح النهاري'
                : 'الوضع الداكن — مريح للعينين في المساء'}
          </Text>
        </View>

        {/* الإشعارات */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="الإشعارات" />
          <Card padded={false} style={{paddingHorizontal: spacing.md}}>
            <SwitchRow
              icon={osPermission ? 'bell' : 'bellOff'}
              label="إشعارات تحديثات الطلبات"
              description={
                osPermission
                  ? 'تنبيه محلي عند قبول المتجر طلبك أو إرساله أو تسليمه'
                  : 'إذن الإشعارات معطّل في النظام — فعّله من إعدادات الجهاز'
              }
              value={notificationsEnabled && osPermission}
              onValueChange={onToggleNotifications}
            />
          </Card>
        </View>

        {/* الحساب: تغيير كلمة المرور */}
        {user != null && (
          <View style={{gap: spacing.md}}>
            <SectionTitle title="الحساب" />
            <Card style={{gap: spacing.md}}>
              <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20}]}>
                حسابك محمي بكلمة مرور. يمكنك تغييرها في أي وقت — ستحتاج
                كلمتك الحالية لتأكيد التغيير.
              </Text>
              <Field
                label="كلمة المرور الحالية"
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder="••••••••"
                icon="lock"
                secure
              />
              <Field
                label="كلمة المرور الجديدة"
                value={newPw}
                onChangeText={setNewPw}
                placeholder="8 أحرف على الأقل — رقماً وحرفاً"
                icon="lock"
                secure
              />
              <Button
                label={savingPw ? 'جارٍ الحفظ…' : 'تغيير كلمة المرور'}
                small
                disabled={savingPw}
                onPress={() => void changePassword()}
              />
            </Card>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
