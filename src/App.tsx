/**
 * App.tsx — جذر تطبيق سيلا ماركت:
 * RTL عربي قسري + ثيم (المود) + حدود الأخطاء + شريط انقطاع الإنترنت
 * + بدء مستطلع الطلبات + طلب إذن الإشعارات عند أول تشغيل بعد التسجيل.
 */
import React, {useEffect, useState} from 'react';
import {
  I18nManager,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider, useTheme} from './theme/ThemeProvider';
import {ErrorBoundary} from './components/ErrorBoundary';
import {Toaster} from './components/ui';
import {Icon} from './components/Icon';
import {RootNavigator} from './navigation/RootNavigator';
import {useAuthStore} from './stores/authStore';
import {useLocationStore} from './stores/locationStore';
import {primeAndStart} from './services/ordersSync';
import {fonts} from './theme/tokens';

/* عربي أولاً: اتجاه RTL لكل الواجهة (الكوتلن يفرض ar على النشاط
 * الأصلي أيضاً — دفاع مزدوج مثل تطبيق نقطة البيع سيلا). */
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

function InnerApp() {
  const {palette, resolved} = useTheme();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  /* استئناف استطلاع الطلبات لجلسة محفوظة من تشغيل سابق. */
  useEffect(() => {
    if (useAuthStore.getState().token != null) {
      primeAndStart();
    }
  }, []);

  /* v2.0: مزامنة منطقة/عناوين المستخدم مع الجلسة — عند الدخول تُجلب
   * عناوين الحساب (وتصبح منطقة الافتراضي «منطقتي»)، وعند الخروج
   * تُمسح بيانات الحساب وتبقى منطقة الزائر المحلية. */
  useEffect(() => {
    let lastToken = useAuthStore.getState().token;
    if (lastToken != null) {
      void useLocationStore.getState().syncFromServer();
    }
    const unsub = useAuthStore.subscribe(state => {
      // فقط عند تغيّر الرمز نفسه (لا كل تحديث busy/error).
      if (state.token !== lastToken) {
        lastToken = state.token;
        if (state.token != null) {
          void useLocationStore.getState().syncFromServer();
        } else {
          useLocationStore.getState().reset();
        }
      }
    });
    return unsub;
  }, []);

  return (
    <View style={[styles.root, {backgroundColor: palette.bg}]}>
      <StatusBar
        barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {offline ? <OfflineBanner /> : null}
      <RootNavigator />
      <Toaster />
    </View>
  );
}

function OfflineBanner() {
  const {palette} = useTheme();
  return (
    <View style={[styles.offline, {backgroundColor: palette.warningSoft, borderColor: palette.warning}]}>
      <Icon name="wifiOff" size={15} color={palette.warning} />
      <Text style={[{fontSize: 12, color: palette.warning, fontFamily: fonts.medium}]}>
        لا يوجد اتصال بالإنترنت — أعد المحاولة بعد استعادة الشبكة
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <InnerApp />
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  offline: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});
