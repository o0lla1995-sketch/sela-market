/**
 * RootNavigator.tsx — بنية التنقل:
 * شاشة ترحيب أولى (مرة واحدة) ← 5 تبويبات سفلية (الرئيسية/المتاجر/
 * السلة/طلباتي/حسابي) + شاشتا الدخول والتسجيل كنوافذ منبثقة من أي
 * مكان (بوابة إتمام الطلب للزوار).
 */
import React, {useCallback, useEffect, useRef} from 'react';
import {Animated, AppState, I18nManager, StyleSheet, View} from 'react-native';
import {
  NavigationContainer,
  useNavigation,
  useNavigationContainerRef,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NavigatorScreenParams} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useSettingsStore} from '../stores/settingsStore';
import {shouldSuppressReLock} from '../services/biometrics';
import {useAuthStore} from '../stores/authStore';
import {useCartStore} from '../stores/cartStore';
import {useNotificationsStore} from '../stores/notificationsStore';
import {useToastStore} from '../stores/toastStore';
import {useTheme} from '../theme/ThemeProvider';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Badge} from '../components/ui';
import {fonts} from '../theme/tokens';
import Svg, {Circle, Path} from 'react-native-svg';
import {usePop} from '../core/motion';
import type {Address, Order, Product, StoreRef} from '../core/types';

/* ─── الشاشات ─── */
import {WelcomeScreen} from '../screens/onboarding/WelcomeScreen';
import {LoginScreen} from '../screens/auth/LoginScreen';
import {BiometricGateScreen} from '../screens/auth/BiometricGateScreen';
import {RegisterScreen} from '../screens/auth/RegisterScreen';
import {HomeScreen} from '../screens/home/HomeScreen';
import {StoresScreen} from '../screens/stores/StoresScreen';
import {StoreScreen} from '../screens/stores/StoreScreen';
import {StoreTypeScreen} from '../screens/stores/StoreTypeScreen';
import {SearchScreen} from '../screens/search/SearchScreen';
import {CategoryScreen} from '../screens/category/CategoryScreen';
import {ProductScreen} from '../screens/product/ProductScreen';
import {CartScreen} from '../screens/cart/CartScreen';
import {OrderSuccessScreen} from '../screens/checkout/OrderSuccessScreen';
import {OrdersScreen} from '../screens/orders/OrdersScreen';
import {OrderDetailScreen} from '../screens/orders/OrderDetailScreen';
import {WishlistScreen} from '../screens/wishlist/WishlistScreen';
import {NotificationsScreen} from '../screens/notifications/NotificationsScreen';
import {ProfileScreen} from '../screens/profile/ProfileScreen';
import {AddressBookScreen} from '../screens/profile/AddressBookScreen';
import {AddressFormScreen} from '../screens/profile/AddressFormScreen';
import {SettingsScreen} from '../screens/settings/SettingsScreen';
import {AboutScreen} from '../screens/settings/AboutScreen';
import {PrivacyScreen} from '../screens/settings/PrivacyScreen';
import {TermsScreen} from '../screens/settings/TermsScreen';
import {NetworkDiagnosticsScreen} from '../screens/settings/NetworkDiagnosticsScreen';

/* ─── الأنواع ─── */

export type ShopStackParamList = {
  Home: undefined;
  Stores: undefined;
  Store: {storeId: number; storeName?: string};
  /* v3.4 (الجولة 64): تصفح منتجات قسم كامل حسب نوع المتجر —
   * «مطاعم، بقالة، ملابس…» من الرئيسية. */
  StoreType: {type: string};
  Product: {product: Product; storeRef: StoreRef; storeName?: string};
  /* v4.0 (الجولة 68): offers — فتح البحث مفلتراً بالعروض فقط
   * (زر «كل العروض» من قسم عروض الأسبوع في الرئيسية). */
  Search: {initialQuery?: string; browse?: boolean; offers?: boolean} | undefined;
  Category: {category: string};
  Notifications: undefined;
  Wishlist: undefined;
  Settings: undefined;
  About: undefined;
  Privacy: undefined;
  Terms: undefined;
  NetworkDiagnostics: undefined;
  AddressBook: undefined;
  AddressForm: {address?: Address} | undefined;
};

export type CartStackParamList = {
  Cart: undefined;
  /* v2.8 (الجولة 59): شاشة «إتمام الطلب» الوسيطة حُذفت من
   * التدفق — السلة نفسها تكمل الطلب مباشرة (عنوان + توصيل + زر).
   * الخطوات: صفحة المنتج (كمية/وزن/مواصفة) ← السلة ← تم. */
  OrderSuccess: {order: Order};
  AddressBook: undefined;
  AddressForm: {address?: Address} | undefined;
};

export type OrdersStackParamList = {
  Orders: undefined;
  OrderDetail: {orderId: number; order?: Order};
};

export type AccountStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Wishlist: undefined;
  Notifications: undefined;
  About: undefined;
  Privacy: undefined;
  Terms: undefined;
  NetworkDiagnostics: undefined;
  Store: {storeId: number; storeName?: string};
  StoreType: {type: string};
  Product: {product: Product; storeRef: StoreRef; storeName?: string};
  Search: {initialQuery?: string; browse?: boolean; offers?: boolean} | undefined;
  AddressBook: undefined;
  AddressForm: {address?: Address} | undefined;
};

export type MainTabParamList = {
  Shop: NavigatorScreenParams<ShopStackParamList> | undefined;
  Stores: NavigatorScreenParams<ShopStackParamList> | undefined;
  Cart: NavigatorScreenParams<CartStackParamList> | undefined;
  Orders: NavigatorScreenParams<OrdersStackParamList> | undefined;
  Account: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Login: {reason?: 'checkout' | 'orders' | 'profile'} | undefined;
  Register: {reason?: 'checkout' | 'orders' | 'profile'} | undefined;
  BiometricGate: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

/** ملاح جذري موحّد للشاشات العلوية (الدخول/التسجيل) من أي مستوى. */
export function useRootNav() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

/* ══ v2.6: بوابة العمليات للزائر ══════════════════════════════
 * قرار المستخدم الصريح: الزائر يتصفّح ويرى فقط — أي عملية
 * (إضافة للسلة/مفضلة/إتمام طلب/تقييم) تتطلب تسجيل دخول.
 * الدالة تفتح نافذة الدخول مع سبب وتعيد false حتى لا تنفّذ
 * العملية قبل الدخول؛ بعد الدخول يعود المستخدم للشاشة نفسها
 * ويعيد الضغطة — لا شيء يضيع. */
export function useRequireAuth() {
  const rootNav = useRootNav();
  const toast = useToastStore(s => s.show);
  return useCallback(
    (action: () => void, reason: 'checkout' | 'orders' | 'profile' = 'checkout') => {
      if (useAuthStore.getState().token != null) {
        action();
        return true;
      }
      toast('سجّل الدخول أولاً — التسجيل مرة واحدة فقط', 'info');
      rootNav.navigate('Login', {reason});
      return false;
    },
    [rootNav, toast],
  );
}
const ShopStack = createNativeStackNavigator<ShopStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const screenOptions = {
  headerShown: false,
  animation: 'slide_from_left' as const, // RTL: الدفع من اليسار
  /* v4.0 (الجولة 68): إيقاع انتقال أسرع وأنعم — الافتراضي في
   * أندرويد (‎~400ms) كان يبدو «جامداً وثقيلاً» (شكوى المستخدم
   * من قسوة الانتقالات). ‎300ms هو إيقاع المتاجر العالمية. */
  animationDuration: 300,
};

/* ─── مكدس المتاجر المشترك (لتبويبي الرئيسية والمتاجر) ─── */

function ShopStackScreens({initial = 'Home'}: {initial?: 'Home' | 'Stores'}) {
  return (
    <ShopStack.Navigator initialRouteName={initial} screenOptions={screenOptions}>
      <ShopStack.Screen name="Home" component={HomeScreen} />
      <ShopStack.Screen name="Stores" component={StoresScreen} />
      <ShopStack.Screen name="Store" component={StoreScreen} />
      <ShopStack.Screen name="StoreType" component={StoreTypeScreen} />
      <ShopStack.Screen name="Product" component={ProductScreen} />
      <ShopStack.Screen name="Search" component={SearchScreen} />
      <ShopStack.Screen name="Category" component={CategoryScreen} />
      <ShopStack.Screen name="Notifications" component={NotificationsScreen} />
      <ShopStack.Screen name="Wishlist" component={WishlistScreen} />
      <ShopStack.Screen name="Settings" component={SettingsScreen} />
      <ShopStack.Screen name="About" component={AboutScreen} />
      <ShopStack.Screen name="Privacy" component={PrivacyScreen} />
      <ShopStack.Screen name="Terms" component={TermsScreen} />
      <ShopStack.Screen name="NetworkDiagnostics" component={NetworkDiagnosticsScreen} />
      <ShopStack.Screen name="AddressBook" component={AddressBookScreen} />
      <ShopStack.Screen name="AddressForm" component={AddressFormScreen} />
    </ShopStack.Navigator>
  );
}

function CartStackScreens() {
  return (
    <CartStack.Navigator screenOptions={screenOptions}>
      <CartStack.Screen name="Cart" component={CartScreen} />
      <CartStack.Screen
        name="OrderSuccess"
        component={OrderSuccessScreen}
        options={{animation: 'fade', gestureEnabled: false}}
      />
      <CartStack.Screen name="AddressBook" component={AddressBookScreen} />
      <CartStack.Screen name="AddressForm" component={AddressFormScreen} />
    </CartStack.Navigator>
  );
}

function OrdersStackScreens() {
  return (
    <OrdersStack.Navigator screenOptions={screenOptions}>
      <OrdersStack.Screen name="Orders" component={OrdersScreen} />
      {/* v3.3 (الجولة 63): تفاصيل الطلب كنافذة منبثقة تنزلق من الأسفل —
       * نفس لغة العرض النمطية المعتمدة في بقية نوافذ التطبيق. */}
      <OrdersStack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{presentation: 'modal', animation: 'slide_from_bottom'}}
      />
    </OrdersStack.Navigator>
  );
}

function AccountStackScreens() {
  return (
    <AccountStack.Navigator screenOptions={screenOptions}>
      <AccountStack.Screen name="Profile" component={ProfileScreen} />
      <AccountStack.Screen name="Settings" component={SettingsScreen} />
      <AccountStack.Screen name="Wishlist" component={WishlistScreen} />
      <AccountStack.Screen name="Notifications" component={NotificationsScreen} />
      <AccountStack.Screen name="About" component={AboutScreen} />
      <AccountStack.Screen name="Privacy" component={PrivacyScreen} />
      <AccountStack.Screen name="Terms" component={TermsScreen} />
      <AccountStack.Screen name="NetworkDiagnostics" component={NetworkDiagnosticsScreen} />
      <AccountStack.Screen name="Store" component={StoreScreen} />
      <AccountStack.Screen name="StoreType" component={StoreTypeScreen} />
      <AccountStack.Screen name="Product" component={ProductScreen} />
      <AccountStack.Screen name="AddressBook" component={AddressBookScreen} />
      <AccountStack.Screen name="AddressForm" component={AddressFormScreen} />
    </AccountStack.Navigator>
  );
}

/* ─── شارات التبويبات (اشتراك تفاعلي داخل الأيقونة) ─── */

/* v4.1 (الجولة 69): تطوير الهيدر السفلي بالكامل — طلب التاجر:
 * «أشعر أن الهيدر السفلي يحتاج إلى تطوير وأيقونات أفضل وأجمل».
 *
 * 1) أيقونات مزدوجة الطبقة (duotone): رسمة خطية كاملة الوضوح
 *    للجميع + طبقة تعبئة ناعمة 16% تظهر للتبويب النشط فقط —
 *    عمق بصري فوري يميز النشط عن غير النشط دون صراخ لوني.
 * 2) كبسولة الهوفر: خلفية brandSoft ناعمة + نبضة نابضة
 *    (usePop) لحظة التنشيط — إحساس حي عند كل تبديل.
 * 3) v4.2 (الجولة 70): الشريط نفسه عاد مثبتاً كما كان (رفض
 *    التاجر للشريط العائم الذي كان يغطي زر إضافة للسلة في
 *    صفحة المنتج) — بقيت الأيقونات والكبسولة فقط. */

/* ─── طبقة الأيقونة المزدوجة: خط + تعبئة ─── */
type TabGlyphName = 'home' | 'store' | 'cart' | 'receipt' | 'user';

function TabGlyph({
  name,
  size,
  color,
  fill,
  duotone,
}: {
  name: TabGlyphName;
  size: number;
  color: string;
  fill: string;
  duotone: boolean;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  /* طبقات كل أيقونة: [مسارات الخطوط] + [مسار التعبئة duotone].
   * التعبئة ترسم أولاً (خلف الخطوط) وبشفافية 16% عند التفعيل. */
  const strokes: Record<TabGlyphName, React.ReactNode> = {
    /* البيت: سقف مزدوج الميل + جسم + باب مقوّس + نقطة نافذة. */
    home: (
      <>
        <Path d="M3.5 11 12 3.5 20.5 11" />
        <Path d="M5.5 10V20.5h13V10" />
        <Path d="M10 20.5V16a2 2 0 0 1 4 0v4.5" />
        <Circle cx="15.4" cy="13.4" r="0.5" fill={color} strokeWidth={0} />
      </>
    ),
    /* المتجر: مظلة متموّجة ثلاثية + واجهة + باب + خط رفّ داخلي. */
    store: (
      <>
        <Path d="M4 9.5 5.4 4h13.2L20 9.5" />
        <Path d="M4 9.5a2.6 2.6 0 0 0 5.2 0 2.65 2.65 0 0 0 5.3 0 2.6 2.6 0 0 0 5.2 0" />
        <Path d="M5.6 12.6V20h12.8v-7.4" />
        <Path d="M9.5 20v-4.2h5V20" />
        <Path d="M5.6 12.6h12.8" strokeWidth={1.6} />
        <Circle cx="7.4" cy="16.4" r="0.5" fill={color} strokeWidth={0} />
      </>
    ),
    /* السلة: مقبض + جسم + نسج أفقي مزدوج + عجلتان بنَبَّابتين. */
    cart: (
      <>
        <Path d="M3.5 4.5h2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.25L20.5 8H6.4" />
        <Path d="M8.6 11.4h9.5M9.4 15.2h8" strokeWidth={1.6} />
        <Circle cx="10" cy="20.2" r="1.4" />
        <Circle cx="16.6" cy="20.2" r="1.4" />
        <Circle cx="10" cy="20.2" r="0.45" fill={color} strokeWidth={0} />
        <Circle cx="16.6" cy="20.2" r="0.45" fill={color} strokeWidth={0} />
      </>
    ),
    /* الطلب: وصل مسنّن الأسفل (خمس أسنان) + سطور + فاصل منقّط. */
    receipt: (
      <>
        <Path d="M6 3.5h12v16l-2.4-1.2-2.4 1.2-2.4-1.2-2.4 1.2-2.4-1.2L6 19.5Z" />
        <Path d="M9 8h6M9 11.5h6" />
        <Path d="M9 15h1.3M11.6 15h1.3M14.2 15h1.3" strokeWidth={1.6} />
      </>
    ),
    /* الحساب: رأس + كتفان بإيقاع ناعم + طيّة ياقة صغيرة. */
    user: (
      <>
        <Circle cx="12" cy="8" r="3.6" />
        <Path d="M5 20.5c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
        <Path d="M9.6 15.9l2.4 1.9 2.4-1.9" strokeWidth={1.6} />
      </>
    ),
  };
  const fills: Record<TabGlyphName, string> = {
    home: 'M3.5 11 12 3.5 20.5 11 12 9.4Z',
    store: 'M4.6 8.2c1.2 1.5 3.4 1.5 4.6 0 1.2 1.5 3.5 1.5 4.7 0 1.2 1.5 3.4 1.5 4.6 0 1.2 1.5 3.4 1.5 4.6 0L20 9.5 5.4 4 4 9.5Z M5.6 12.6h12.8V20H9.5v-4.2h5V20H5.6Z',
    cart: 'M6.4 8h14.1l-1.35 6.9a1.6 1.6 0 0 1-1.6 1.25H9.5a1.6 1.6 0 0 1-1.6-1.3Z',
    receipt: 'M6 3.5h12v16l-2.4-1.2-2.4 1.2-2.4-1.2-2.4 1.2-2.4-1.2L6 19.5Z',
    user: 'M5 20.5c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4Z',
  };
  return (
    <Svg {...common}>
      {duotone ? (
        <Path d={fills[name]} fill={fill} fillOpacity={0.16} stroke="none" />
      ) : null}
      {strokes[name]}
    </Svg>
  );
}

/* ─── كبسولة الهوفر (التركيز) النابضة ───
 * v4.2 (الجولة 70): «شكل الهوفر» المطوّر — كبسولة حبّة أوفر
 * بزوايا كاملة الاستدارة تتنفّس حول الأيقونة (حشو أفقي 14)،
 * تظهر ببساطة عند التفعيل وتنبض نبضة نابض قصيرة (usePop)
 * لحظة التبديل فتلمس الإصبع أن التبويب «استقبل» الاختيار. */
function TabIconWrap({focused, children}: {focused: boolean; children: React.ReactNode}) {
  const {palette} = useTheme();
  const pop = usePop();
  const prev = useRef(focused);
  useEffect(() => {
    if (focused && !prev.current) {
      pop.pop();
    }
    prev.current = focused;
  }, [focused, pop]);
  return (
    <Animated.View
      style={[
        tabIconStyles.iconWrap,
        {backgroundColor: focused ? palette.brandSoft : 'transparent'},
        pop.style,
      ]}>
      {children}
    </Animated.View>
  );
}

function CartTabIcon({color, focused}: {color: string; focused: boolean}) {
  const {palette} = useTheme();
  const carts = useCartStore(s => s.carts);
  /* v2.6: تعقيم دفاعي — أي بنية تالفة (قرص قديم) لا تقتل التطبيق
   * عند الإقلاع (كانت حلقة الانهيار: e.lines.reduce على undefined). */
  const count = Object.values(carts ?? {}).reduce(
    (sum, e) =>
      Array.isArray(e?.lines)
        ? sum + e.lines.reduce((s, l) => s + (Number.isFinite(l?.quantity) ? l.quantity : 0), 0)
        : sum,
    0,
  );
  /* v4.0 (الجولة 68): قفزة الشارة — كل إضافة للسلة تُنبض الشارة
   * فيتأكد المستخدم بصرياً أن المنتج «وقع في السلة» حتى لو كان
   * في شاشة أخرى (موشن لطيفة بلا أي تأثير على الأداء). */
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) {
      badgeScale.setValue(0.7);
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 220,
        useNativeDriver: false,
      }).start();
    }
    prevCount.current = count;
  }, [count, badgeScale]);
  return (
    <TabIconWrap focused={focused}>
      <View style={tabIconStyles.wrap}>
        <TabGlyph
          name="cart"
          size={24}
          color={color}
          fill={palette.brand}
          duotone={focused}
        />
        {count > 0 ? (
          <View style={tabIconStyles.badgeSlot}>
            <Animated.View style={{transform: [{scale: badgeScale}]}}>
              <Badge count={Math.floor(count)} />
            </Animated.View>
          </View>
        ) : null}
      </View>
    </TabIconWrap>
  );
}

function OrdersTabIcon({color, focused}: {color: string; focused: boolean}) {
  const {palette} = useTheme();
  const unread = useNotificationsStore(s => s.unread);
  return (
    <TabIconWrap focused={focused}>
      <View style={tabIconStyles.wrap}>
        <TabGlyph
          name="receipt"
          size={24}
          color={color}
          fill={palette.brand}
          duotone={focused}
        />
        {unread > 0 ? (
          <View style={tabIconStyles.badgeSlot}>
            <Badge count={unread} />
          </View>
        ) : null}
      </View>
    </TabIconWrap>
  );
}

const tabIconStyles = StyleSheet.create({
  iconWrap: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: {width: 42, height: 30, alignItems: 'center', justifyContent: 'center'},
  badgeSlot: {position: 'absolute', top: -3, left: -3},
});

/* ─── التبويبات ─── */

function ShopTab() {
  return <ShopStackScreens initial="Home" />;
}

function StoresTab() {
  return <ShopStackScreens initial="Stores" />;
}

function MainTabs() {
  const {palette} = useTheme();
  /* v3.2 (الجولة 62): تباين أيقونات الشريط السفلي — طلب التاجر:
   * «الأيقونات غير النشطة باهتة أكثر من اللازم». غير النشط يرتقي
   * من muted الباهت إلى inkSoft الواضح (‎#44403C فاتح / ‎#D6D3D1
   * داكن)، والنشط بلون العلامة العميق مع الكبسولة الناعمة. */
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brandDeep,
        tabBarInactiveTintColor: palette.inkSoft,
        /* v4.2 (الجولة 70): عودة الشريط السفلي مثبتاً كما كان — طلب
         * التاجر: «ارجع الهيدر السفلي للتطبيق كما كان». الشريط العائم
         * (position absolute) كان يمر المحتوى تحته فيغطي زر إضافة
         * للسلة في صفحة المنتج. عاد الشريط عادياً بأرضية صلبة وخط
         * شعرة علوي (نمط v4.0 المجرب) وبقيت الأيقونات المزدوجة
         * الطبقة (duotone) وكبسولة الهوفر الناعمة بنبضتها — «فقط
         * طور الأيقونات وشكل الهوفر فيها». */
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.line,
          paddingTop: 6,
        },
        // لوحة المفاتيح تغطي الشريط في نماذج الإدخال — تجربة أوسع.
        tabBarHideOnKeyboard: true,
        /* v3.2: ارتفاع ثابت للتسمية يمنع أي انزياح تخطيطي عند
         * التبديل + خط متوسط واضح بحجم مقروء. */
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
          lineHeight: 14,
          height: 14,
          marginTop: 1,
        },
        tabBarLabelPosition: 'below-icon',
      }}>
      <Tabs.Screen
        name="Shop"
        component={ShopTab}
        options={{
          title: 'الرئيسية',
          tabBarAccessibilityLabel: 'الرئيسية',
          tabBarIcon: ({color, focused}) => (
            <TabIconWrap focused={focused}>
              <HomeTabGlyph color={color} focused={focused} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="Stores"
        component={StoresTab}
        options={{
          title: 'المتاجر',
          tabBarAccessibilityLabel: 'دليل المتاجر',
          tabBarIcon: ({color, focused}) => (
            <TabIconWrap focused={focused}>
              <StoreTabGlyph color={color} focused={focused} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="Cart"
        component={CartStackScreens}
        options={{
          title: 'السلة',
          tabBarAccessibilityLabel: 'سلة المشتريات',
          tabBarIcon: CartTabIcon,
        }}
      />
      <Tabs.Screen
        name="Orders"
        component={OrdersStackScreens}
        options={{
          title: 'طلباتي',
          tabBarAccessibilityLabel: 'طلباتي',
          tabBarIcon: OrdersTabIcon,
        }}
      />
      <Tabs.Screen
        name="Account"
        component={AccountStackScreens}
        options={{
          title: 'حسابي',
          tabBarAccessibilityLabel: 'حسابي',
          tabBarIcon: ({color, focused}) => (
            <TabIconWrap focused={focused}>
              <UserTabGlyph color={color} focused={focused} />
            </TabIconWrap>
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

/* v4.1: أغلفة أيقونات التبويبات الثابتة (بيت/متجر/حساب) —
 * تمرّر ألوان الطبقة المزدوجة إلى TabGlyph. */
function HomeTabGlyph({color, focused}: {color: string; focused: boolean}) {
  const {palette} = useTheme();
  return <TabGlyph name="home" size={24} color={color} fill={palette.brand} duotone={focused} />;
}
function StoreTabGlyph({color, focused}: {color: string; focused: boolean}) {
  const {palette} = useTheme();
  return <TabGlyph name="store" size={24} color={color} fill={palette.brand} duotone={focused} />;
}
function UserTabGlyph({color, focused}: {color: string; focused: boolean}) {
  const {palette} = useTheme();
  return <TabGlyph name="user" size={24} color={color} fill={palette.brand} duotone={focused} />;
}

/* ─── الجذر ─── */

export function RootNavigator() {
  const onboarded = useSettingsStore(s => s.onboarded);
  const biometricLoginEnabled = useSettingsStore(s => s.biometricLoginEnabled);
  const sessionToken = useAuthStore(s => s.token);
  const {palette} = useTheme();

  /* v2.1: بوابة البصمة — جلسة محفوظة + الخيار مفعّل ⇒ نبدأ عندها. */
  const needsGate = onboarded && biometricLoginEnabled && sessionToken != null;

  /* v2.2: إصلاح اختفاء شاشة الترحيب — كانت تُسجَّل في المكدس لكن
   * initialRouteName يبدأ دائماً من Main، فلا تُعرض أبداً لمستخدم
   * جديد. الترتيب الصحيح: الترحيب أولاً لغير المُهيَّئين، ثم بوابة
   * البصمة، وإلا الرئيسية. */
  const initialRoute = !onboarded
    ? 'Welcome'
    : needsGate
      ? 'BiometricGate'
      : 'Main';

  const navigationRef = useNavigationContainerRef();

  /* v2.3: إعادة القفل بالبصمة عند كل عودة من الخلفية — أندرويد
   * يبقي عملية التطبيق حية فلا يُعاد تقييم initialRouteName عند
   * إعادة الفتح من المشغّل، فكانت البصمة لا تظهر «إلا بعد قتل
   * التطبيق». الآن: دخول الخلفية ثم العودة ⇒ بوابة البصمة مجدداً
   * (إن كانت الجلسة قائمة والخيار مفعلاً). القفل يُطبّق فقط بعد
   * تواجد فعلي في الخلفية — لا عند ومضات انتقالية. */
  useEffect(() => {
    let wentBackground = false;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        wentBackground = true;
      } else if (state === 'active' && wentBackground) {
        wentBackground = false;
        const s = useSettingsStore.getState();
        const token = useAuthStore.getState().token;
        /* v2.5: لا إعادة قفل أثناء مصادقة جارية أو بعد فتح ناجح
         * قبل لحظات — حوار البصمة نشاط منفصل يمرر التطبيق
         * بالخلفية/العودة، وبدون هذا الحارس يُقفل التطبيق في وجه
         * المستخدم لحظة نجاح بصمته (ثاني أسباب «الشاشة العالقة»). */
        if (
          s.onboarded &&
          s.biometricLoginEnabled &&
          token != null &&
          !shouldSuppressReLock()
        ) {
          const root = navigationRef.current?.getRootState();
          const topRoute = root?.routes[root.routes.length - 1]?.name;
          if (topRoute !== 'BiometricGate') {
            navigationRef.current?.reset({
              index: 0,
              routes: [{name: 'BiometricGate'}],
            });
          }
        }
      }
    });
    return () => sub.remove();
  }, [navigationRef]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: palette.isDark,
        colors: {
          primary: palette.brand,
          background: palette.bg,
          card: palette.surface,
          text: palette.ink,
          border: palette.line,
          notification: palette.brand,
        },
      }}>
      <RootStack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{headerShown: false}}>
        {!onboarded ? (
          <RootStack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{gestureEnabled: false, animation: 'fade'}}
          />
        ) : null}
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen
          name="Login"
          component={LoginScreen}
          options={{presentation: 'modal', animation: 'slide_from_bottom'}}
        />
        <RootStack.Screen
          name="Register"
          component={RegisterScreen}
          options={{presentation: 'modal', animation: 'slide_from_bottom'}}
        />
        <RootStack.Screen
          name="BiometricGate"
          component={BiometricGateScreen}
          options={{gestureEnabled: false, animation: 'fade'}}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
