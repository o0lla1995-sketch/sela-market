/**
 * SettingsScreen.tsx — الإعدادات (v2.0 — تصميم مجموعات احترافي):
 * مجموعات بطاقات بأسلوب متاجر التجزئة العالمية: المظهر، الإشعارات،
 * التسوق الذكي (منطقتي)، الحساب (تغيير كلمة المرور)، وحول التطبيق
 * (حول/الخصوصية/الشروط) + تذييل الإصدار بالعلامة.
 *
 * v1.1: حُذف قسم «متقدم — خادم سيلا» نهائياً بطلب صريح.
 */
import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {
  AppHeader,
  Button,
  Card,
  Field,
  Screen,
  Segmented,
  SwitchRow,
} from '../../components/ui';
import {useSettingsStore} from '../../stores/settingsStore';
import {useAuthStore} from '../../stores/authStore';
import {useLocationStore} from '../../stores/locationStore';
import {passwordProblem} from '../../api/endpoints';
import {
  areNotificationsEnabled,
  requestNotificationsPermission,
} from '../../services/localNotifications';
import {useToastStore} from '../../stores/toastStore';
import {authenticateBiometric, biometricsSupported} from '../../services/biometrics';
import {APP_VERSION_LABEL} from '../../core/config';
import type {ThemeMode} from '../../core/types';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'Settings'>;

/* عنوان مجموعة — سطر أيقونة + نص فوق البطاقة */
function GroupTitle({icon, title}: {icon: IconName; title: string}) {
  const {palette} = useTheme();
  return (
    <View style={groupStyles.titleRow}>
      <View style={[groupStyles.titleIcon, {backgroundColor: palette.brandSoft}]}>
        <Icon name={icon} size={15} color={palette.brandDark} />
      </View>
      <Text style={[type.h3, {color: palette.ink, fontFamily: fonts.bold}]}>{title}</Text>
    </View>
  );
}

/* صف رابط داخل مجموعة (حول/الخصوصية/الشروط…) */
function LinkRow({
  icon,
  label,
  description,
  onPress,
  last = false,
}: {
  icon: IconName;
  label: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        groupStyles.row,
        !last && {borderBottomWidth: 1, borderBottomColor: palette.line},
        pressed && {backgroundColor: palette.surfaceAlt},
      ]}>
      <View style={[groupStyles.rowIcon, {backgroundColor: palette.brandSoft}]}>
        <Icon name={icon} size={17} color={palette.brandDark} />
      </View>
      <View style={{flex: 1, gap: 1, alignItems: 'flex-start'}}>
        <Text style={[type.smallMedium, {color: palette.ink}]}>{label}</Text>
        <Text style={{fontSize: 11, color: palette.muted}} numberOfLines={1}>
          {description}
        </Text>
      </View>
      <Icon name="forward" size={15} color={palette.muted} />
    </Pressable>
  );
}

export function SettingsScreen({navigation}: Props) {
  const {palette, mode, setMode} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(s => s.setNotificationsEnabled);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const setPassword = useAuthStore(s => s.setPassword);
  const myRegion = useLocationStore(s => s.myRegion);
  const addresses = useLocationStore(s => s.addresses);
  const toast = useToastStore(s => s.show);

  const [osPermission, setOsPermission] = useState(true);
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  /* v2.1: الدخول بالبصمة */
  const biometricLoginEnabled = useSettingsStore(s => s.biometricLoginEnabled);
  const setBiometricLoginEnabled = useSettingsStore(s => s.setBiometricLoginEnabled);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    void areNotificationsEnabled().then(setOsPermission);
    void biometricsSupported().then(setBioSupported);
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
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.xl, paddingBottom: stackClearance}} showsVerticalScrollIndicator={false}>
        {/* ─── المظهر ─── */}
        <View style={{gap: spacing.md}}>
          <GroupTitle icon="sun" title="المظهر" />
          <Card style={{gap: spacing.md}}>
            <Segmented<ThemeMode>
              value={mode}
              onChange={setMode}
              options={[
                {value: 'light', label: 'فاتح', icon: 'sun'},
                {value: 'dark', label: 'داكن', icon: 'moon'},
                {value: 'system', label: 'النظام', icon: 'autoTheme'},
              ]}
            />
            <Text style={[{fontSize: 11.5, color: palette.muted, lineHeight: 18}]}>
              {mode === 'system'
                ? 'يتبع التطبيق وضع جهازك فاتحاً أو داكناً تلقائياً'
                : mode === 'light'
                  ? 'الوضع الفاتح — مناسب للتصفح النهاري'
                  : 'الوضع الداكن — مريح للعينين في المساء'}
            </Text>
          </Card>
        </View>

        {/* ─── الإشعارات ─── */}
        <View style={{gap: spacing.md}}>
          <GroupTitle icon="bell" title="الإشعارات" />
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

        {/* ─── التسوق الذكي ─── */}
        <View style={{gap: spacing.md}}>
          <GroupTitle icon="pin" title="التسوق الذكي" />
          <Card padded={false} style={{overflow: 'hidden'}}>
            <LinkRow
              icon="pin"
              label="منطقة التوصيل وعناويني"
              description={
                myRegion != null
                  ? `منطقتك الحالية: ${myRegion}${token != null && addresses.length > 0 ? ` · ${addresses.length} ${addresses.length === 1 ? 'عنوان' : 'عناوين'}` : ''}`
                  : 'حدّد منطقتك لعرض المتاجر التي توصّل إليك'
              }
              onPress={() => navigation.navigate('AddressBook')}
            />
          </Card>
          <Text style={[{fontSize: 11, color: palette.muted, lineHeight: 17, textAlign: 'center'}]}>
            «مقترحات لك» في الرئيسية تعمل من تصفحاتك ومفضلتك وطلباتك — بيانات
            محلية على جهازك فقط ولا تُرسل لأي خادم
          </Text>
        </View>

        {/* ─── الحساب ─── */}
        {user != null ? (
          <View style={{gap: spacing.md}}>
            <GroupTitle icon="lock" title="الحساب والأمان" />
            <Card style={{gap: spacing.md}}>
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm}}>
                <View style={[groupStyles.shield, {backgroundColor: palette.successSoft}]}>
                  <Icon name="shield" size={16} color={palette.success} />
                </View>
                <Text style={[type.smallMedium, {color: palette.ink, flex: 1}]}>
                  حسابك محمي بكلمة مرور
                </Text>
              </View>
              {/* v2.1: الدخول بالبصمة مباشرة عند فتح التطبيق */}
              <SwitchRow
                icon="shield"
                label="الدخول بالبصمة"
                description={
                  bioSupported
                    ? 'عند فتح التطبيق: بصمة واحدة تفتح جلستك المحفوظة بدل كلمة المرور'
                    : 'الجهاز لا يدعم ذلك — فعّل قفل البصمة من إعدادات الجهاز أولاً'
                }
                value={biometricLoginEnabled && bioSupported}
                onValueChange={v => {
                  if (v) {
                    // تأكيد فوري ببصمة واحدة قبل التفعيل
                    setBioBusy(true);
                    void authenticateBiometric('تأكيد تفعيل الدخول بالبصمة').then(ok => {
                      setBioBusy(false);
                      if (ok) {
                        setBiometricLoginEnabled(true);
                        toast('فُعّل الدخول بالبصمة — ستراها عند فتح التطبيق', 'success');
                      } else {
                        toast('أُلغيت البصمة — لم يُفعّل الخيار', 'info');
                      }
                    });
                  } else {
                    setBiometricLoginEnabled(false);
                    toast('أُلغي الدخول بالبصمة', 'info');
                  }
                }}
              />
              {showPwForm ? (
                <>
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
                  <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                    <Button
                      label={savingPw ? 'جارٍ الحفظ…' : 'حفظ'}
                      small
                      style={{flex: 1}}
                      disabled={savingPw}
                      onPress={() => void changePassword()}
                    />
                    <Button
                      label="إلغاء"
                      small
                      variant="outline"
                      style={{flex: 1}}
                      onPress={() => setShowPwForm(false)}
                    />
                  </View>
                </>
              ) : (
                <Button
                  label="تغيير كلمة المرور"
                  variant="soft"
                  small
                  icon="lock"
                  onPress={() => setShowPwForm(true)}
                />
              )}
            </Card>
          </View>
        ) : null}

        {/* ─── حول التطبيق ─── */}
        <View style={{gap: spacing.md}}>
          <GroupTitle icon="help" title="حول التطبيق" />
          <Card padded={false} style={{overflow: 'hidden'}}>
            <LinkRow
              icon="help"
              label="عن سيلا ماركت"
              description="مول المتاجر العربية من مئات نقاط البيع"
              onPress={() => navigation.navigate('About')}
            />
            <LinkRow
              icon="refresh"
              label="تشخيص الشبكة"
              description="اعرض كل طلبات التطبيق وافحص تحميل المنتجات"
              onPress={() => navigation.navigate('NetworkDiagnostics')}
            />
            <LinkRow
              icon="shield"
              label="سياسة الخصوصية"
              description="ما نجمعه (لا شيء تقريباً) وكيف نحميه"
              onPress={() => navigation.navigate('Privacy')}
            />
            <LinkRow
              icon="doc"
              label="شروط الاستخدام"
              description="قواعد التسوق والطلبات والتوصيل"
              onPress={() => navigation.navigate('Terms')}
              last
            />
          </Card>
        </View>

        {/* ─── تذييل الإصدار ─── */}
        <View style={groupStyles.footer}>
          <View style={[groupStyles.footerLogo, {backgroundColor: palette.brand}]}>
            <Icon name="bag" size={16} color="#FFFFFF" />
          </View>
          <Text style={[type.smallMedium, {color: palette.inkSoft, fontFamily: fonts.bold}]}>
            سيلا ماركت
          </Text>
          <Text style={{fontSize: 10.5, color: palette.muted}}>
            الإصدار {APP_VERSION_LABEL} — يتصل بخادم سيلا الرسمي مباشرة
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const groupStyles = StyleSheet.create({
  titleRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  titleIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shield: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {alignItems: 'center', gap: 3, paddingTop: spacing.sm},
  footerLogo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
