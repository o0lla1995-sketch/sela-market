/**
 * App.tsx — جذر تطبيق سيلا ماركت:
 * RTL عربي قسري + ثيم (المود) + حدود الأخطاء + شريط انقطاع الإنترنت
 * + بدء مستطلع الطلبات + طلب إذن الإشعارات عند أول تشغيل بعد التسجيل.
 *
 * v3.6 (الجولة 66): شريط الانقطاع صار طبقة عائمة داخل الإطار الآمن
 * — كان عنصراً عادياً فوق جذر التنقل فيُرسم عند حافة الشاشة خارج
 * إطار التطبيق (خلف شريط الحالة) ويُزيح جذر التنقل بطوله فيولّد
 * هامشاً سفلياً كبيراً (شكوى المستخدم). الآن: position:absolute أعلى
 * الشاشة + paddingTop بإخلاء شريط الحالة + زوايا سفلية دائرية +
 * حركة انزلاق ناعمة، ولا يُزيح أي محتوى إطلاقاً (pointerEvents:none).
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  I18nManager,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
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
      <RootNavigator />
      {/* v3.6: الطبقة العائمة فوق كل شيء — لا تُزيح المحتوى. */}
      {offline ? <OfflineBanner /> : null}
      <Toaster />
    </View>
  );
}

function OfflineBanner() {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  /* v3.6: انزلاق ناعم من أعلى لحظة الظهور. */
  const slide = useRef(new Animated.Value(-90)).current;
  useEffect(() => {
    Animated.spring(slide, {toValue: 0, useNativeDriver: true, friction: 8}).start();
  }, [slide]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.offline,
        {
          backgroundColor: palette.warningSoft,
          borderColor: palette.warning,
          /* داخل الإطار الآمن — تحت شريط الحالة لا خارجه. */
          paddingTop: insets.top + 6,
          transform: [{translateY: slide}],
        },
      ]}>
      <Icon name="wifiOff" size={15} color={palette.warning} />
      <Text style={[{fontSize: 12, color: palette.warning, fontFamily: fonts.medium}]}>
        لا يوجد اتصال بالإنترنت — أعد المحاولة بعد استعادة الشبكة
      </Text>
    </Animated.View>
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
  /* v3.6: شريط عائم أعلى الشاشة داخل الإطار — بلا إزاحة للمحتوى
   * وبزوايا سفلية دائرية كجزء من إطار التطبيق. */
  offline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    elevation: 90,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
});
