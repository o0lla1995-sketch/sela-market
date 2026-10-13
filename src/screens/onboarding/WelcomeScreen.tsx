/**
 * WelcomeScreen.tsx — شاشة الترحيب (v1.1 — إعادة تصميم كاملة).
 * ─────────────────────────────────────────────────────────────────
 * ثلاث لوحات برسوم SVG مرسومة يدوياً (لا صور نقطية) + شعار العلامة
 * + حركات دخول متدرجة + مؤشر تقدم متحرك — بجودة المتاجر العالمية
 * في أول لمسة. ثم: حساب جديد / دخول / تصفح كزائر.
 *
 * الرسوم: واجهات مول ثلاثية + عربة تسوق ممتلئة + شاحنة توصيل —
 * كلها بألوان الهوية (برتقالي 10% على محايدات 60/30).
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Button} from '../../components/ui';
import {Icon} from '../../components/Icon';
import {useSettingsStore} from '../../stores/settingsStore';
import type {RootStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
/* ─── شعار العلامة: حقيبة «س» ─── */
function BrandMark({size = 64, color = '#F97316', ink = '#17171C'}: {size?: number; color?: string; ink?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      {/* جسم الحقيبة */}
      <Path
        d="M18 34h60v40a10 10 0 0 1-10 10H28a10 10 0 0 1-10-10V34Z"
        fill={color}
      />
      {/* المقبض */}
      <Path
        d="M34 34v-8a14 14 0 0 1 28 0v8"
        stroke={ink}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
      {/* حرف السين المبسّط كشرطة داخلية */}
      <Path
        d="M36 58c6 5 18 5 24 0"
        stroke="#FFFFFF"
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ─── إطار الرسم: خلفية ناعمة + الرسمة ─── */
function ArtFrame({children, tint, border}: {children: React.ReactNode; tint: string; border: string}) {
  return (
    <View style={[styles.art, {backgroundColor: tint, borderColor: border}]}>
      {children}
    </View>
  );
}

/* ─── لوحة 1: مول بثلاث واجهات ─── */
function MallScene({brand, deep, ink, muted}: {brand: string; deep: string; ink: string; muted: string}) {
  return (
    <Svg width={196} height={150} viewBox="0 0 196 150">
      {/* واجهة يسار */}
      <Rect x="10" y="46" width="52" height="72" rx="8" fill={ink} opacity="0.9" />
      <Path d="M6 46h60l-8-16H14l-8 16Z" fill={deep} />
      <Rect x="20" y="62" width="32" height="12" rx="3" fill="#FFFFFF" opacity="0.85" />
      <Rect x="20" y="82" width="13" height="24" rx="3" fill={brand} opacity="0.9" />
      <Rect x="39" y="82" width="13" height="24" rx="3" fill="#FFFFFF" opacity="0.35" />
      {/* واجهة وسط (أعلى وأبرز) */}
      <Rect x="72" y="30" width="52" height="88" rx="8" fill={deep} />
      <Path d="M68 30h60l-8-18H76l-8 18Z" fill={brand} />
      <Rect x="82" y="46" width="32" height="14" rx="3" fill="#FFFFFF" opacity="0.9" />
      <Rect x="82" y="68" width="13" height="26" rx="3" fill="#FFFFFF" opacity="0.35" />
      <Rect x="101" y="68" width="13" height="26" rx="3" fill={brand} opacity="0.9" />
      {/* واجهة يمين */}
      <Rect x="134" y="46" width="52" height="72" rx="8" fill={ink} opacity="0.75" />
      <Path d="M130 46h60l-8-16H138l-8 16Z" fill={muted} />
      <Rect x="144" y="62" width="32" height="12" rx="3" fill="#FFFFFF" opacity="0.6" />
      <Rect x="144" y="82" width="13" height="24" rx="3" fill="#FFFFFF" opacity="0.35" />
      <Rect x="163" y="82" width="13" height="24" rx="3" fill={brand} opacity="0.75" />
      {/* شرارات */}
      <Circle cx="26" cy="20" r="3" fill={brand} />
      <Circle cx="172" cy="24" r="2.5" fill={deep} />
      <Circle cx="98" cy="10" r="2.5" fill={muted} />
    </Svg>
  );
}

/* ─── لوحة 2: عربة تسوق ممتلئة ─── */
function CartScene({brand, deep, ink, muted}: {brand: string; deep: string; ink: string; muted: string}) {
  return (
    <Svg width={190} height={150} viewBox="0 0 190 150">
      {/* محتويات العربة */}
      <Rect x="66" y="34" width="24" height="26" rx="4" fill={brand} transform="rotate(-8 78 47)" />
      <Rect x="94" y="26" width="22" height="34" rx="4" fill={deep} transform="rotate(6 105 43)" />
      <Path d="M120 56c0-8 10-8 10 0" stroke={muted} strokeWidth="7" fill="none" strokeLinecap="round" />
      <Rect x="118" y="52" width="18" height="22" rx="4" fill={ink} opacity="0.85" />
      {/* جسم العربة */}
      <Path
        d="M44 56h16l14 46h58l13-34h-66"
        stroke={ink}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* العجلات */}
      <Circle cx="82" cy="116" r="10" stroke={ink} strokeWidth="7" fill="#FFFFFF" />
      <Circle cx="128" cy="116" r="10" stroke={ink} strokeWidth="7" fill="#FFFFFF" />
      {/* شارة سعر */}
      <Rect x="18" y="24" width="42" height="24" rx="12" fill={brand} />
      <Circle cx="30" cy="36" r="3" fill="#FFFFFF" />
      <Rect x="36" y="33" width="18" height="6" rx="3" fill="#FFFFFF" opacity="0.85" />
    </Svg>
  );
}

/* ─── لوحة 3: شاحنة توصيل متحركة ─── */
function DeliveryScene({brand, deep, ink, muted}: {brand: string; deep: string; ink: string; muted: string}) {
  return (
    <Svg width={196} height={150} viewBox="0 0 196 150">
      {/* خطوط الحركة */}
      <Path d="M10 62h26M4 78h20M14 94h30" stroke={muted} strokeWidth="6" strokeLinecap="round" />
      {/* مقطورة */}
      <Rect x="46" y="38" width="84" height="56" rx="10" fill={brand} />
      <Rect x="58" y="52" width="26" height="20" rx="4" fill="#FFFFFF" opacity="0.9" />
      <Rect x="90" y="52" width="26" height="20" rx="4" fill="#FFFFFF" opacity="0.55" />
      {/* كابينة */}
      <Path d="M130 50h26l16 20v24h-42V50Z" fill={deep} />
      <Rect x="136" y="56" width="18" height="14" rx="3" fill="#FFFFFF" opacity="0.9" />
      {/* عجلات */}
      <Circle cx="70" cy="104" r="11" stroke={ink} strokeWidth="7" fill="#FFFFFF" />
      <Circle cx="112" cy="104" r="11" stroke={ink} strokeWidth="7" fill="#FFFFFF" />
      <Circle cx="154" cy="104" r="11" stroke={ink} strokeWidth="7" fill="#FFFFFF" />
      {/* دبوس موقع */}
      <Path d="M170 28c-7 0-12 5-12 11 0 8 12 19 12 19s12-11 12-19c0-6-5-11-12-11Z" fill={ink} />
      <Circle cx="170" cy="39" r="4" fill="#FFFFFF" />
    </Svg>
  );
}

const SLIDES = [
  {
    key: 'mall',
    title: 'كل متاجر حيّك… في مول واحد',
    body: 'مئات نقاط البيع الحقيقية وآلاف المنتجات في تطبيق واحد. قارن الأسعار بين المتاجر واختر الأفضل لطلبك.',
  },
  {
    key: 'cart',
    title: 'سلة لكل متجر — بلا تشابك',
    body: 'تسوّق من عدة متاجر في آن واحد: لكل متجر سلة وطلب ورسم توصيله، وتُحسب الأسعار دائماً من كتالوج المتجر نفسه.',
  },
  {
    key: 'delivery',
    title: 'طلباتك تصل… وتتتبعها لحظة بلحظة',
    body: 'من قبول المتجر حتى التسليم على بابك — إشعار بكل خطوة، والدفع نقداً عند الاستلام بلا أي بطاقات.',
  },
] as const;

export function WelcomeScreen({navigation}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const setOnboarded = useSettingsStore(s => s.setOnboarded);
  const [slide, setSlide] = useState(0);
  const width = Dimensions.get('window').width;
  const slideRef = useRef(slide);
  slideRef.current = slide;

  // حركات الدخول المتدرجة
  const artScale = useRef(new Animated.Value(0.82)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textShift = useRef(new Animated.Value(26)).current;
  const chromeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.parallel([
        Animated.timing(artScale, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {toValue: 1, duration: 420, useNativeDriver: true}),
        Animated.timing(textShift, {toValue: 0, duration: 420, useNativeDriver: true}),
      ]),
      Animated.timing(chromeOpacity, {toValue: 1, duration: 380, useNativeDriver: true}),
    ]).start();
  }, [artScale, textOpacity, textShift, chromeOpacity, slide]);

  /** يحدّث اللوحة النشطة — تُستدعى من onScroll المستمر فيتجاوب
   *  السحب البطيء بلا قذف (onMomentumScrollEnd وحده كان يترك اللوحة
   *  الجديدة فارغة لأن غير النشطة كانت تُرسم كعناصر غير مرئية). */
  const goToSlide = (i: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    if (clamped !== slideRef.current) {
      artScale.setValue(0.82);
      textOpacity.setValue(0);
      textShift.setValue(26);
      slideRef.current = clamped;
      setSlide(clamped);
    }
  };

  const start = (mode: 'guest' | 'login' | 'register') => {
    setOnboarded();
    if (mode === 'login') {
      navigation.navigate('Login');
    } else if (mode === 'register') {
      navigation.navigate('Register');
    }
  };

  const current = SLIDES[slide];

  return (
    <View style={[styles.wrap, {backgroundColor: palette.bg}]}>
      {/* الشعار + تخطّي */}
      <View style={[styles.top, {paddingTop: insets.top + spacing.lg}]}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.md}}>
          <BrandMark size={44} color={palette.brand} ink={palette.ink} />
          <View>
            <Text style={[type.h3, {color: palette.ink, fontFamily: fonts.black}]}>
              سيلا ماركت
            </Text>
            <Text style={[type.tiny, {color: palette.muted}]}>
              مول المتاجر العربية
            </Text>
          </View>
        </View>
        {slide < SLIDES.length - 1 ? (
          <Pressable onPress={() => goToSlide(SLIDES.length - 1)} hitSlop={10}>
            <Text style={[type.smallMedium, {color: palette.muted}]}>تخطّي</Text>
          </Pressable>
        ) : null}
      </View>

      {/* اللوحات — كل المحتوى مرسوم دائماً (لا عناصر مخفية تحفظ
          الارتفاع): السحب البطيء أو السريع يعرض لوحة مكتملة فوراً
          وحركات الدخول تُعاد للنشطة فقط. */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={e => {
          // RTL على أندرويد يعطي إزاحات سالبة (0، -width، …) — القيمة
          // المطلقة تصحح الفهرس في الاتجاهين.
          const i = Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width);
          if (i !== slideRef.current) {
            goToSlide(i);
          }
        }}
        style={{flex: 1}}>
        {SLIDES.map((s, i) => {
          const active = i === slide;
          return (
            <View key={s.key} style={[styles.slide, {width}]}>
              <Animated.View
                style={active ? {transform: [{scale: artScale}]} : undefined}>
                <ArtFrame tint={palette.brandSoft} border={palette.brandBorder}>
                  {s.key === 'mall' ? (
                    <MallScene brand={palette.brand} deep={palette.brandDeep} ink={palette.ink} muted={palette.muted} />
                  ) : s.key === 'cart' ? (
                    <CartScene brand={palette.brand} deep={palette.brandDeep} ink={palette.ink} muted={palette.muted} />
                  ) : (
                    <DeliveryScene brand={palette.brand} deep={palette.brandDeep} ink={palette.ink} muted={palette.muted} />
                  )}
                </ArtFrame>
              </Animated.View>
              <Animated.View
                style={[
                  styles.texts,
                  active
                    ? {opacity: textOpacity, transform: [{translateY: textShift}]}
                    : {opacity: 1},
                ]}>
                <Text style={[type.display, styles.title, {color: palette.ink}]}>
                  {s.title}
                </Text>
                <Text style={[type.body, {color: palette.muted, textAlign: 'center', lineHeight: 27}]}>
                  {s.body}
                </Text>
              </Animated.View>
            </View>
          );
        })}
      </ScrollView>

      {/* المؤشرات — قابلة للنقر للانتقال المباشر */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => goToSlide(i)}
            hitSlop={8}
            style={{padding: 3}}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: i === slide ? palette.brand : palette.line,
                  width: i === slide ? 26 : 8,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* الأزرار */}
      <Animated.View
        style={[
          styles.actions,
          {borderTopColor: palette.line, opacity: chromeOpacity, paddingBottom: insets.bottom + spacing.lg},
        ]}>
        <Button label="إنشاء حساب جديد" onPress={() => start('register')} icon="user" />
        <Button
          label="لديك حساب؟ تسجيل الدخول"
          onPress={() => start('login')}
          variant="outline"
          icon="forward"
        />
        <Pressable
          onPress={() => start('guest')}
          hitSlop={8}
          style={({pressed}) => [
            guestStyles.btn,
            {
              borderColor: palette.line,
              backgroundColor: palette.surface,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Icon name="bag" size={16} color={palette.inkSoft} />
          <Text style={[type.smallMedium, {color: palette.inkSoft, flex: 1, textAlign: 'center'}]}>
            الدخول كزائر والتجول في المول
          </Text>
        </Pressable>
        {/* v3.1: ملاحظة الزائر اختُصرت لسطر واحد — الشكوى: «الكثير من
         * الكلام والملاحظات غير المهمة». */}
        <Text style={[{fontSize: 10.5, color: palette.muted, textAlign: 'center'}]}>
          إتمام الطلب يتطلب تسجيلاً بسيطاً برقم الهوية
        </Text>
      </Animated.View>
    </View>
  );
}

const guestStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
});

const styles = StyleSheet.create({
  wrap: {flex: 1},
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.xl,
  },
  art: {
    width: 260,
    height: 212,
    borderRadius: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {alignItems: 'center', gap: spacing.md},
  title: {textAlign: 'center', maxWidth: 320},
  dots: {flexDirection: 'row', gap: 7, justifyContent: 'center', padding: spacing.lg},
  dot: {height: 8, borderRadius: 999},
  actions: {
    borderTopWidth: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
});
