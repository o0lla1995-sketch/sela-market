/**
 * SettingsScreen.tsx — الإعدادات:
 * • المظهر (المود): فاتح / داكن / حسب النظام — فوري بلا إعادة تشغيل.
 * • الإشعارات: تفعيل/تعطيل + طلب إذن النظام (Android 13+).
 * • متقدم: رابط خادم سيلا (قابل للتجاوز للاختبار).
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
import {
  areNotificationsEnabled,
  requestNotificationsPermission,
} from '../../services/localNotifications';
import {useToastStore} from '../../stores/toastStore';
import {DEFAULT_SERVER_URL} from '../../core/config';
import type {ThemeMode} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Settings'>;

export function SettingsScreen({navigation}: Props) {
  const {palette, mode, setMode} = useTheme();
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(s => s.setNotificationsEnabled);
  const serverUrl = useSettingsStore(s => s.serverUrl);
  const setServerUrl = useSettingsStore(s => s.setServerUrl);
  const toast = useToastStore(s => s.show);

  const [osPermission, setOsPermission] = useState(true);
  const [serverDraft, setServerDraft] = useState(serverUrl);

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

  const saveServer = () => {
    const clean = serverDraft.trim().replace(/\/+$/, '');
    if (clean.length === 0) {
      setServerUrl('');
      setServerDraft('');
      toast('عودة للخادم الرسمي', 'success');
      return;
    }
    if (!/^https?:\/\/.+\..+/.test(clean)) {
      toast('الرابط يجب أن يبدأ بـ http:// أو https://', 'danger');
      return;
    }
    setServerUrl(clean);
    toast('حُدّث رابط الخادم', 'success');
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

        {/* الخادم */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="متقدم — خادم سيلا" />
          <Card style={{gap: spacing.md}}>
            <Text style={[type.small, {color: palette.inkSoft, lineHeight: 20}]}>
              يتفاهم التطبيق مع خادم سيلا الرسمي. لا تغيّر هذا إلا بأمر من
              الإدارة (لأغراض الاختبار على خادم بديل).
            </Text>
            <Field
              label="رابط الخادم"
              value={serverDraft}
              onChangeText={setServerDraft}
              placeholder={DEFAULT_SERVER_URL}
              icon="server"
              hint={serverUrl ? `الحالي: ${serverUrl}` : 'الحالي: الخادم الرسمي'}
            />
            <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
              <Button label="حفظ" small style={{flex: 1}} onPress={saveServer} />
              <Button
                label="استعادة الافتراضي"
                small
                variant="outline"
                style={{flex: 1}}
                onPress={() => {
                  setServerDraft('');
                  setServerUrl('');
                  toast('عودة للخادم الرسمي', 'success');
                }}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
