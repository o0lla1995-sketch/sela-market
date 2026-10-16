/**
 * motion.tsx — عدّة الحركة الناعمة لسيلا ماركت (v4.0 — الجولة 68).
 * ─────────────────────────────────────────────────────────────────
 * طلب المستخدم: «أشعر أن التطبيق جامد وغير متجاوب — موشن لطيفة
 * لا تؤثر على التطبيق وانتقالات سلسة». هذه العدّة تقدّم الحركة
 * بمعمارية آمنة مئة بالمئة مستفيدة من دروس هذا المستودع:
 *
 *  • v3.4 (الدرس الأهم): Animated.event بـ useNativeDriver:true على
 *    حدث التمرير كان يُفجّر انهياراً أصلياً فورياً على معمارية
 *    Fabric عند فتح صفحة المتجر — حُذف كلياً يومها. القاعدة هنا:
 *    كل حركة مرتبطة بالتمرير تُدار بمحرك JS (useNativeDriver:false)
 *    عبر onScroll عادي ← scrollY.setValue — لا أي عقدة أصلية في
 *    مسار التمرير، والدفع البصري سلس لأن التحديثات تمس transform
 *    وopacity فقط.
 *  • v3.3: android_ripple محظور للأبد (انهيار فوري عند كل لمسة).
 *    رجوع اللمسة هنا scale فقط على Pressable — بلا أي ripple.
 *  • كل الحركات «لطيفة لا تؤثر»: مدّتها 180–420 ملي ثانية، وتقف
 *    تلقائياً عند القيم النهائية فلا أي عمل في الخلفية بعد اكتمالها.
 *
 * المكوّنات:
 *  • PressableScale — بطاقة/زر بحركة ضغط (scale 0.97) بلا ripple.
 *  • useEntrance — دخول البطاقات والأقسام (ظهور + ارتفاع ناعم)
 *    بتأخير متدرج يولّد إيقاع cascade كالمتاجر العالمية.
 *  • usePop — نبضة تكبير لحظة التفعيل (قلب المفضلة، شارة السلة).
 *  • useCollapseHeader — قيم interpolation جاهزة لتروسة تنطفي عند
 *    التمرير مع شريط مضغوط يظهر محلّها (الرئيسية وصفحة المتجر).
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

/* ─── نوابض موحّدة: إيقاع واحد لكل التطبيق ───
 * friction/overshootClamping مضبوطة لتشعر «حيّة» لا «مرتدة بعنف». */
export const SPRING = {
  gentle: {friction: 9, tension: 160},
  pop: {friction: 6, tension: 220},
} as const;

export const TIMING = {
  entrance: 300,
  quick: 180,
} as const;

/* ═══════════════ PressableScale ═══════════════
 * بديل Pressable الآمن بلا ripple (محظور منذ v3.3) — ضغط خفيف
 * بالحجم + شفافية اختيارية، بلا أي حالة React (النمط الوظيفي
 * للضغط) فلا إعادة رندر إطلاقاً أثناء اللمسة. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  opacityTo = 1,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  /** نمط Pressable الأصلي نفسه — ثابت أو دالة حالة (pressed). */
  style?: PressableProps['style'];
  /** مقدار التصغير عند الضغط — 0.97 للمس الكبير، 0.98 للأزرار. */
  scaleTo?: number;
  /** شفافية الضغط — 1 = بلا تغيير، 0.85 للبطاقات الصغيرة. */
  opacityTo?: number;
}) {
  return (
    <Pressable
      {...rest}
      style={state => [
        {
          transform: [{scale: state.pressed ? scaleTo : 1}],
          opacity: state.pressed ? opacityTo : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}>
      {children}
    </Pressable>
  );
}

/* ═══════════════ useEntrance ═══════════════
 * دخول ناعم (شفافية 0→1 + ارتفاع +14→0) بنتيجة ready يُمرَّر
 * للنمط. المؤثر مرة واحدة عند التركيب — بطاقة الدخول لا تعيد
 * الظهور مع كل رندر (مفاتيح القوائم، الفلترة…). */
export function useEntrance(delayMs = 0, enabled = true) {
  const v = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const [done, setDone] = useState(!enabled);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(v, {
          toValue: 1,
          duration: TIMING.entrance,
          useNativeDriver: false,
        }),
      ]).start(() => setDone(true));
    }, delayMs);
    return () => clearTimeout(t);
  }, [v, delayMs, enabled]);
  const style = useMemo(
    () => ({
      opacity: v,
      transform: [
        {
          translateY: v.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
      ],
    }),
    [v],
  );
  return {style, done};
}

/** غلاف جاهز: قسم كامل يدخل بتأخير — للرئيسية والقوائم الطويلة. */
export function Entrance({
  children,
  delay = 0,
  enabled = true,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  enabled?: boolean;
  style?: ViewStyle;
}) {
  const {style: anim} = useEntrance(delay, enabled);
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

/* ═══════════════ usePop ═══════════════
 * نبضة تكبير قصيرة عند «الفعل» — تُستدعى يدوياً لحظة التبديل
 * (قلب المفضلة يمتلئ، شارة السلة تقفز عند الإضافة). تعود إلى 1
 * بنابض ناعم — لا حالة تبقى شغّالة بعد النبضة. */
export function usePop() {
  const v = useRef(new Animated.Value(1)).current;
  const pop = useCallback(() => {
    v.setValue(0.7);
    Animated.spring(v, {
      toValue: 1,
      ...SPRING.pop,
      useNativeDriver: false,
    }).start();
  }, [v]);
  const style = useMemo(() => ({transform: [{scale: v}]}), [v]);
  return {pop, style};
}

/* ═══════════════ useCollapseHeader ═══════════════
 * محرّك التروسة المنطوية — كل تروسة رئيسية تحتاج قيمتين:
 *  1. طبقة التروسة الكاملة: تنزلق لأعلى ببطء (parallax 0.45×)
 *     وتتلاشى كلما ابتعدت.
 *  2. الشريط المضغوط: يظهر بالانزلاق والتلاشي بين عتبتين.
 *
 * التنفيذ: onScroll عادي يستدعي scrollY.setValue (محرك JS حصراً —
 * قاعدة v3.4) ثم interpolation خالصة للقيمتين. threshold يُستخدم
 * لحالة ثنائية وحيدة (pointerEvents للشريط) لا تتغير إلا عند
 * تجاوز العتبة فلا إعادة رندر أثناء التمرير السلس.
 */
export function useCollapseHeader(opts?: {
  /** ارتفاع التروسة الكاملة — لمسافة الانزلاق البارالاكس. */
  heroHeight?: number;
  /** عتبة بدء ظهور الشريط المضغوط. */
  collapseFrom?: number;
  /** عتبة اكتمال ظهور الشريط المضغوط. */
  collapseTo?: number;
}) {
  const heroHeight = opts?.heroHeight ?? 148;
  const collapseFrom = opts?.collapseFrom ?? 56;
  const collapseTo = opts?.collapseTo ?? 132;

  const scrollY = useRef(new Animated.Value(0)).current;
  const [compactActive, setCompactActive] = useState(false);

  /* حالة ثنائية وحيدة: تفعيل اللمس على الشريط المضغوط — تتبدل
   * فقط عند عبور منتصف العتبة (React يتخطى setState المتطابق). */
  const onScroll = useCallback(
    (y: number) => {
      scrollY.setValue(y);
      const active = y > (collapseFrom + collapseTo) / 2;
      setCompactActive(prev => (prev === active ? prev : active));
    },
    [scrollY, collapseFrom, collapseTo],
  );

  /* طبقة التروسة: تنزلق لأعلى ببطء (تبقى مرئية أطول من المحتوى)
   * وتتلاشى مبكراً كي لا «تقطع» أثناء انزلاقها. */
  const heroStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: scrollY.interpolate({
            inputRange: [0, heroHeight],
            outputRange: [0, -heroHeight * 0.55],
            extrapolate: 'clamp',
          }),
        },
      ],
      opacity: scrollY.interpolate({
        inputRange: [0, heroHeight * 0.7],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    }),
    [scrollY, heroHeight],
  );

  /* الشريط المضغوط: يظهر بين العتبتين بانزلاق صغير من أعلى. */
  const compactStyle = useMemo(
    () => ({
      opacity: scrollY.interpolate({
        inputRange: [collapseFrom, collapseTo],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: scrollY.interpolate({
            inputRange: [collapseFrom, collapseTo],
            outputRange: [-10, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [scrollY, collapseFrom, collapseTo],
  );

  return {scrollY, onScroll, heroStyle, compactStyle, compactActive};
}
