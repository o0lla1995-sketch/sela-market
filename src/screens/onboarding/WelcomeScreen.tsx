/**
 * WelcomeScreen.tsx — شاشة الترحيب الأولى (مرة واحدة): ثلاث لوحات
 * تعريفية بلمسة سحب، ثم دخول كزائر (تصفح كامل) أو تسجيل/دخول.
 */
import React, {useState} from 'react';
import {Dimensions, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon, type IconName} from '../../components/Icon';
import {Button} from '../../components/ui';
import {useSettingsStore} from '../../stores/settingsStore';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const SLIDES: {
  icon: IconName;
  title: string;
  body: string;
}[] = [
  {
    icon: 'store',
    title: 'كل متاجر حيّك في مكان واحد',
    body: 'سيلا ماركت مول كامل في جيبك: تصفح آلاف المنتجات من مئات نقاط البيع التجارية، قارن الأسعار بين المتاجر واطلب بضغطة واحدة.',
  },
  {
    icon: 'cart',
    title: 'سلة لكل متجر، وطلب لكل متجر',
    body: 'تسوّق من أكثر من متجر في آن واحد — كل متجر له سلة وطلبه ورسم توصيله الخاص، فلا تتداخل طلباتك بين التجار أبداً.',
  },
  {
    icon: 'truck',
    title: 'تتبّع طلبك خطوة بخطوة',
    body: 'من قبول المتجر لطلبك حتى التسليم على بابك — نُعلمك بكل تحديث، والدفع نقداً عند الاستلام بلا أي بطاقات.',
  },
];

export function WelcomeScreen({navigation}: Props) {
  const {palette} = useTheme();
  const setOnboarded = useSettingsStore(s => s.setOnboarded);
  const [slide, setSlide] = useState(0);
  const width = Dimensions.get('window').width;

  const start = (mode: 'guest' | 'login' | 'register') => {
    if (mode === 'guest') {
      setOnboarded();
    } else if (mode === 'login') {
      setOnboarded();
      navigation.navigate('Login');
    } else {
      setOnboarded();
      navigation.navigate('Register');
    }
  };

  return (
    <View style={[styles.wrap, {backgroundColor: palette.bg}]}>
      {/* شريط اللوحات */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setSlide(i);
        }}
        style={{flex: 1}}>
        {SLIDES.map(s => (
          <View key={s.title} style={[styles.slide, {width}]}>
            <View style={[styles.iconWrap, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
              <Icon name={s.icon} size={56} color={palette.brandDark} />
            </View>
            <Text style={[type.h1, {color: palette.ink, textAlign: 'center', marginTop: spacing.xxl}]}>
              {s.title}
            </Text>
            <Text
              style={[
                type.body,
                {color: palette.muted, textAlign: 'center', marginTop: spacing.md, lineHeight: 26},
              ]}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* المؤشرات */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {backgroundColor: i === slide ? palette.brand : palette.line},
            ]}
          />
        ))}
      </View>

      {/* الأزرار */}
      <View style={[styles.actions, {borderTopColor: palette.line}]}>
        <Button
          label="إنشاء حساب جديد"
          onPress={() => start('register')}
          icon="user"
        />
        <Button
          label="تسجيل الدخول"
          onPress={() => start('login')}
          variant="outline"
          icon="forward"
        />
        <Pressable onPress={() => start('guest')} hitSlop={8}>
          <Text style={[type.smallMedium, {color: palette.muted}]}>
            تصفّح كزائر — الطلب يحتاج تسليماً بسيطاً
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1},
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 132,
    height: 132,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {flexDirection: 'row', gap: 7, justifyContent: 'center', padding: spacing.lg},
  dot: {width: 8, height: 8, borderRadius: 4},
  actions: {
    borderTopWidth: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
});
