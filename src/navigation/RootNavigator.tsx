/**
 * RootNavigator.tsx — بنية التنقل:
 * شاشة ترحيب أولى (مرة واحدة) ← 5 تبويبات سفلية (الرئيسية/المتاجر/
 * السلة/طلباتي/حسابي) + شاشتا الدخول والتسجيل كنوافذ منبثقة من أي
 * مكان (بوابة إتمام الطلب للزوار).
 */
import React from 'react';
import {I18nManager, StyleSheet, View} from 'react-native';
import {NavigationContainer, useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NavigatorScreenParams} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useSettingsStore} from '../stores/settingsStore';
import {useCartStore} from '../stores/cartStore';
import {useNotificationsStore} from '../stores/notificationsStore';
import {useTheme} from '../theme/ThemeProvider';
import {Icon, type IconName} from '../components/Icon';
import {Badge} from '../components/ui';
import {fonts} from '../theme/tokens';
import type {Address, Order, Product, StoreRef} from '../core/types';

/* ─── الشاشات ─── */
import {WelcomeScreen} from '../screens/onboarding/WelcomeScreen';
import {LoginScreen} from '../screens/auth/LoginScreen';
import {RegisterScreen} from '../screens/auth/RegisterScreen';
import {HomeScreen} from '../screens/home/HomeScreen';
import {StoresScreen} from '../screens/stores/StoresScreen';
import {StoreScreen} from '../screens/stores/StoreScreen';
import {SearchScreen} from '../screens/search/SearchScreen';
import {CategoryScreen} from '../screens/category/CategoryScreen';
import {ProductScreen} from '../screens/product/ProductScreen';
import {CartScreen} from '../screens/cart/CartScreen';
import {CheckoutScreen} from '../screens/checkout/CheckoutScreen';
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

/* ─── الأنواع ─── */

export type ShopStackParamList = {
  Home: undefined;
  Stores: undefined;
  Store: {storeId: number; storeName?: string};
  Product: {product: Product; storeRef: StoreRef; storeName?: string};
  Search: {initialQuery?: string} | undefined;
  Category: {category: string};
  Notifications: undefined;
  Wishlist: undefined;
  Settings: undefined;
  About: undefined;
  Privacy: undefined;
  Terms: undefined;
  AddressBook: undefined;
  AddressForm: {address?: Address} | undefined;
};

export type CartStackParamList = {
  Cart: undefined;
  Checkout: {storeId: number};
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
  Store: {storeId: number; storeName?: string};
  Product: {product: Product; storeRef: StoreRef; storeName?: string};
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
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

/** ملاح جذري موحّد للشاشات العلوية (الدخول/التسجيل) من أي مستوى. */
export function useRootNav() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}
const ShopStack = createNativeStackNavigator<ShopStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const screenOptions = {
  headerShown: false,
  animation: 'slide_from_left' as const, // RTL: الدفع من اليسار
};

/* ─── مكدس المتاجر المشترك (لتبويبي الرئيسية والمتاجر) ─── */

function ShopStackScreens({initial = 'Home'}: {initial?: 'Home' | 'Stores'}) {
  return (
    <ShopStack.Navigator initialRouteName={initial} screenOptions={screenOptions}>
      <ShopStack.Screen name="Home" component={HomeScreen} />
      <ShopStack.Screen name="Stores" component={StoresScreen} />
      <ShopStack.Screen name="Store" component={StoreScreen} />
      <ShopStack.Screen name="Product" component={ProductScreen} />
      <ShopStack.Screen name="Search" component={SearchScreen} />
      <ShopStack.Screen name="Category" component={CategoryScreen} />
      <ShopStack.Screen name="Notifications" component={NotificationsScreen} />
      <ShopStack.Screen name="Wishlist" component={WishlistScreen} />
      <ShopStack.Screen name="Settings" component={SettingsScreen} />
      <ShopStack.Screen name="About" component={AboutScreen} />
      <ShopStack.Screen name="Privacy" component={PrivacyScreen} />
      <ShopStack.Screen name="Terms" component={TermsScreen} />
      <ShopStack.Screen name="AddressBook" component={AddressBookScreen} />
      <ShopStack.Screen name="AddressForm" component={AddressFormScreen} />
    </ShopStack.Navigator>
  );
}

function CartStackScreens() {
  return (
    <CartStack.Navigator screenOptions={screenOptions}>
      <CartStack.Screen name="Cart" component={CartScreen} />
      <CartStack.Screen name="Checkout" component={CheckoutScreen} />
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
      <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} />
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
      <AccountStack.Screen name="Store" component={StoreScreen} />
      <AccountStack.Screen name="Product" component={ProductScreen} />
      <AccountStack.Screen name="AddressBook" component={AddressBookScreen} />
      <AccountStack.Screen name="AddressForm" component={AddressFormScreen} />
    </AccountStack.Navigator>
  );
}

/* ─── شارات التبويبات (اشتراك تفاعلي داخل الأيقونة) ─── */

function CartTabIcon({color}: {color: string}) {
  const carts = useCartStore(s => s.carts);
  const count = Object.values(carts).reduce(
    (sum, e) => sum + e.lines.reduce((s, l) => s + l.quantity, 0),
    0,
  );
  return (
    <View style={tabIconStyles.wrap}>
      <Icon name="cart" size={23} color={color} />
      {count > 0 ? (
        <View style={tabIconStyles.badgeSlot}>
          <Badge count={Math.floor(count)} />
        </View>
      ) : null}
    </View>
  );
}

function OrdersTabIcon({color}: {color: string}) {
  const unread = useNotificationsStore(s => s.unread);
  return (
    <View style={tabIconStyles.wrap}>
      <Icon name="receipt" size={23} color={color} />
      {unread > 0 ? (
        <View style={tabIconStyles.badgeSlot}>
          <Badge count={unread} />
        </View>
      ) : null}
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: {width: 40, height: 26, alignItems: 'center', justifyContent: 'center'},
  badgeSlot: {position: 'absolute', top: -4, left: -2},
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
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brandDark,
        tabBarInactiveTintColor: palette.muted,
        // ارتفاع الشريط تلقائي: 49 للمحتوى + insets.bottom للنظام
        // (edge-to-edge على Android 15). الارتفاع الثابت 62 كان يبتلع
        // مساحة الأيقونات والنصوص على أجهزة أزرار التنقل الثلاثة
        // فتختفي التسميات أسفل الشريط — بلا ارتفاع مخصص لا يحدث أبداً.
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
          paddingTop: 6,
        },
        // لوحة المفاتيح تغطي الشريط في نماذج الإدخال — تجربة أوسع.
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
        tabBarLabelPosition: 'below-icon',
      }}>
      <Tabs.Screen
        name="Shop"
        component={ShopTab}
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({color}) => <Icon name="home" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Stores"
        component={StoresTab}
        options={{
          title: 'المتاجر',
          tabBarIcon: ({color}) => <Icon name="store" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Cart"
        component={CartStackScreens}
        options={{
          title: 'السلة',
          tabBarIcon: CartTabIcon,
        }}
      />
      <Tabs.Screen
        name="Orders"
        component={OrdersStackScreens}
        options={{
          title: 'طلباتي',
          tabBarIcon: OrdersTabIcon,
        }}
      />
      <Tabs.Screen
        name="Account"
        component={AccountStackScreens}
        options={{
          title: 'حسابي',
          tabBarIcon: ({color}) => <Icon name="user" size={23} color={color} />,
        }}
      />
    </Tabs.Navigator>
  );
}

/* ─── الجذر ─── */

export function RootNavigator() {
  const onboarded = useSettingsStore(s => s.onboarded);
  const {palette} = useTheme();

  return (
    <NavigationContainer
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
      <RootStack.Navigator screenOptions={{headerShown: false}}>
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
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
