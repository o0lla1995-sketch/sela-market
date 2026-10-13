/**
 * ui.tsx — طقم مكونات سيلا ماركت الأساسي.
 * كل مكون يستهلك الثيم من ThemeProvider (فاتح/داكن) ويحترم الـ RTL
 * (I18nManager.forceRTL مفعل من App) وقاعدة «صفر إيموجي».
 */
import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../theme/ThemeProvider';
import {radius, shadowFor, spacing, type, fonts, type Palette} from '../theme/tokens';
import {Icon, type IconName} from './Icon';
import {useToastStore} from '../stores/toastStore';

/* ═══════════════ Screen ═══════════════ */

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  onRefresh,
  refreshing,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const {palette} = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.grow, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brand}
            colors={[palette.brand]}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.grow, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: palette.bg}, style]}
      edges={['top', 'right', 'left']}>
      {body}
    </SafeAreaView>
  );
}

/* ═══════════════ AppHeader ═══════════════ */

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  big = false,
  transparent = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  big?: boolean;
  /** v3.0: خلفية شفافة — للترويسات داخل أشرطة ملونة (صفحة التصنيف). */
  transparent?: boolean;
}) {
  const {palette} = useTheme();
  return (
    <View
      style={[
        headerStyles.row,
        {
          backgroundColor: transparent ? 'transparent' : palette.bg,
          paddingHorizontal: spacing.lg,
        },
      ]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={[headerStyles.backBtn, {backgroundColor: palette.surface, borderColor: palette.line}]}>
          <Icon
            name={I18nManager.isRTL ? 'back' : 'forward'}
            size={20}
            color={palette.ink}
          />
        </Pressable>
      ) : null}
      <View style={headerStyles.titles}>
        <Text
          style={[
            big ? type.h1 : type.h3,
            {color: palette.ink},
          ]}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.small, {color: palette.muted, marginTop: 2}]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {flex: 1, alignItems: 'flex-start'},
});

/* ═══════════════ Button ═══════════════ */

type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost' | 'danger' | 'success';

export function Button({
  label,
  onPress,
  variant = 'solid',
  icon,
  disabled = false,
  loading = false,
  small = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const {palette} = useTheme();

  const colors = useMemo(() => {
    switch (variant) {
      case 'soft':
        return {bg: palette.brandSoft, fg: palette.brandDark, border: 'transparent'};
      case 'outline':
        return {bg: 'transparent', fg: palette.ink, border: palette.lineStrong};
      case 'ghost':
        return {bg: 'transparent', fg: palette.inkSoft, border: 'transparent'};
      case 'danger':
        return {bg: palette.danger, fg: '#FFFFFF', border: 'transparent'};
      case 'success':
        return {bg: palette.success, fg: '#FFFFFF', border: 'transparent'};
      default:
        return {bg: palette.brand, fg: palette.onBrand, border: 'transparent'};
    }
  }, [variant, palette]);

  /* v2.8 (الجولة 59): 44/36 بدل 50/38 — طلب التاجر: الأزرار
   * تأخذ مساحة كبيرة بلا داعٍ. أزرار المتاجر العالمية (أمازون/
   * نون) 40–44px للفعل الأساسي — مساحة أكبر للمحتوى. */
  const height = small ? 36 : 44;
  const opacity = disabled ? 0.45 : 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed: p}) => [
        btnStyles.base,
        {
          height,
          borderRadius: radius.lg,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity,
          transform: [{scale: p && !disabled ? 0.98 : 1}],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={colors.fg} /> : null}
          <Text
            style={[
              small ? type.smallMedium : type.bodyMedium,
              {color: colors.fg, fontFamily: fonts.bold},
            ]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  base: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
  },
});

/* ═══════════════ Card ═══════════════ */

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padded?: boolean;
}) {
  const {palette} = useTheme();
  const base: ViewStyle[] = [
    {
      backgroundColor: palette.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.line,
    },
    ...(padded ? [{padding: spacing.lg}] : []),
    ...(style ? (Array.isArray(style) ? style : [style]) : []),
  ];
  if (onPress != null) {
    return (
      <Pressable onPress={onPress} style={({pressed}) => [base, pressed ? {opacity: 0.85} : null]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

/* ═══════════════ Chip ═══════════════ */

export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress == null}
      style={[
        chipStyles.base,
        {
          backgroundColor: active ? palette.brand : palette.surface,
          borderColor: active ? palette.brand : palette.line,
        },
      ]}>
      {icon ? (
        <Icon name={icon} size={15} color={active ? palette.onBrand : palette.muted} />
      ) : null}
      <Text
        style={[
          type.smallMedium,
          {color: active ? palette.onBrand : palette.inkSoft},
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  base: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
});

/* ═══════════════ Badge ═══════════════ */

export function Badge({count}: {count: number}) {
  const {palette} = useTheme();
  if (count <= 0) {
    return null;
  }
  return (
    <View style={[badgeStyles.base, {backgroundColor: palette.brand}]}>
      <Text style={[badgeStyles.text, {color: palette.onBrand}]} numberOfLines={1}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  base: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {fontSize: 10.5, fontFamily: fonts.bold},
});

/* ═══════════════ Field ═══════════════ */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  secure = false,
  multiline = false,
  icon,
  maxLength,
  hint,
  autoFocus,
  returnKeyType = 'default',
  onSubmitEditing,
  inputRef,
  numericOnly = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string | null;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  secure?: boolean;
  multiline?: boolean;
  icon?: IconName;
  maxLength?: number;
  hint?: string;
  autoFocus?: boolean;
  returnKeyType?: 'default' | 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  /** v1.2: قبول الأرقام فقط (هوية/جوال) — يمنع لصق الحروف. */
  numericOnly?: boolean;
}) {
  const {palette} = useTheme();
  return (
    <View style={fieldStyles.wrap}>
      <Text style={[type.smallMedium, {color: palette.inkSoft}]}>{label}</Text>
      <View
        style={[
          fieldStyles.box,
          {
            backgroundColor: palette.surface,
            borderColor: error ? palette.danger : palette.line,
          },
          multiline ? {height: 96, alignItems: 'flex-start'} : null,
        ]}>
        {icon ? <Icon name={icon} size={19} color={palette.muted} /> : null}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={t => onChangeText(numericOnly ? t.replace(/[^0-9]/g, '') : t)}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          keyboardType={keyboardType}
          secureTextEntry={secure}
          multiline={multiline}
          maxLength={maxLength}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={returnKeyType !== 'next' && !multiline}
          autoCorrect={false}
          autoCapitalize="none"
          textContentType="none"
          importantForAutofill="no"
          style={[
            type.body,
            fieldStyles.input,
            {color: palette.ink},
            multiline ? {textAlignVertical: 'top', paddingTop: 0} : null,
          ]}
        />
      </View>
      {error ? (
        <Text style={[type.tiny, {color: palette.danger, marginTop: 4}]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.tiny, {color: palette.muted, marginTop: 4}]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {gap: 7},
  box: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  input: {flex: 1, padding: 0, textAlign: 'right', writingDirection: 'rtl'},
});

/* ═══════════════ SearchBar ═══════════════ */

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'ابحث عن منتج أو متجر…',
  onSubmit,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const {palette} = useTheme();
  return (
    <View
      style={[
        searchStyles.box,
        {backgroundColor: palette.surface, borderColor: palette.line},
      ]}>
      <Icon name="search" size={19} color={palette.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[type.body, searchStyles.input, {color: palette.ink}]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Icon name="close" size={16} color={palette.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const searchStyles = StyleSheet.create({
  box: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  input: {flex: 1, padding: 0, textAlign: 'right'},
});

/* ═══════════════ Segmented ═══════════════ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: {value: T; label: string; icon?: IconName}[];
  value: T;
  onChange: (v: T) => void;
}) {
  const {palette} = useTheme();
  return (
    <View
      style={[
        segStyles.box,
        {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
      ]}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              segStyles.opt,
              active && {backgroundColor: palette.surface, ...shadowFor(palette.isDark)},
            ]}>
            {opt.icon ? (
              <Icon
                name={opt.icon}
                size={17}
                color={active ? palette.brand : palette.muted}
              />
            ) : null}
            <Text
              style={[
                type.smallMedium,
                {color: active ? palette.ink : palette.muted},
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  box: {
    flexDirection: 'row-reverse',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  opt: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm + 1,
    paddingVertical: 9,
  },
});

/* ═══════════════ SwitchRow ═══════════════ */

export function SwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
}: {
  icon: IconName;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const {palette} = useTheme();
  return (
    <View style={switchStyles.row}>
      <View style={[switchStyles.iconChip, {backgroundColor: palette.brandSoft}]}>
        <Icon name={icon} size={20} color={palette.brandDark} />
      </View>
      <View style={switchStyles.texts}>
        <Text style={[type.bodyMedium, {color: palette.ink}]}>{label}</Text>
        {description ? (
          <Text style={[type.tiny, {color: palette.muted, marginTop: 2}]}>{description}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onValueChange(!value)}
        style={[
          switchStyles.track,
          {backgroundColor: value ? palette.brand : palette.lineStrong},
        ]}>
        <View
          style={[
            switchStyles.thumb,
            {backgroundColor: '#FFFFFF'},
            value ? {alignSelf: 'flex-start'} : {alignSelf: 'flex-end'},
          ]}
        />
      </Pressable>
    </View>
  );
}

const switchStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {flex: 1, alignItems: 'flex-start'},
  track: {width: 50, height: 30, borderRadius: 15, padding: 3},
  thumb: {width: 24, height: 24, borderRadius: 12},
});

/* ═══════════════ QtyStepper ═══════════════ */

export function QtyStepper({
  qty,
  soldByWeight,
  onIncrease,
  onDecrease,
  onRemove,
  compact = false,
  max,
}: {
  qty: number;
  soldByWeight: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove?: () => void;
  compact?: boolean;
  /** v2.8 (الجولة 59): الحد الأقصى المتاح (المخزون) — يوقف الزيادة
   * عند الحد ويظهر «الحد الأقصى» بدل ترك المستخدم يطلب أكثر من
   * المتوفر (طلب التاجر بالنص). undefined = بلا حد معلوم. */
  max?: number;
}) {
  const {palette} = useTheme();
  const unit = soldByWeight ? (qty < 1 ? 'نصف' : 'كيلو') : 'قطعة';
  /* الحد يُطبّق فقط إن كان رقماً منطقياً أكبر من صفر. */
  const cap = max != null && Number.isFinite(max) && max > 0 ? max : null;
  const atMax = cap != null && qty >= cap - 0.0001;
  return (
    <View
      style={[
        stepperStyles.box,
        {backgroundColor: palette.brandSoft, borderColor: atMax ? palette.warning : palette.brandBorder},
        compact && stepperStyles.compact,
      ]}>
      <Pressable
        onPress={atMax ? undefined : onIncrease}
        hitSlop={8}
        disabled={atMax}
        style={stepperStyles.btn}>
        <Icon
          name="plus"
          size={compact ? 15 : 17}
          color={atMax ? palette.muted : palette.brandDark}
          strokeWidth={2.4}
        />
      </Pressable>
      <View style={stepperStyles.value}>
        <Text style={[type.smallMedium, {color: palette.brandDark, fontFamily: fonts.bold}]}>
          {soldByWeight ? (qty % 1 === 0 ? String(qty) : String(qty)) : String(qty)}
        </Text>
        {!compact ? (
          <Text style={[{fontSize: 10, color: atMax ? palette.warning : palette.brandDark, fontFamily: fonts.medium}]}>
            {atMax ? 'الحد الأقصى' : unit}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onDecrease} hitSlop={8} style={stepperStyles.btn}>
        <Icon name="minus" size={compact ? 15 : 17} color={palette.brandDark} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  box: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
  },
  compact: {paddingHorizontal: 4},
  btn: {width: 30, height: 30, alignItems: 'center', justifyContent: 'center'},
  value: {minWidth: 44, alignItems: 'center'},
});

/* ═══════════════ EmptyState ═══════════════ */

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const {palette} = useTheme();
  return (
    <View style={emptyStyles.box}>
      <View style={[emptyStyles.iconWrap, {backgroundColor: palette.surfaceAlt}]}>
        <Icon name={icon} size={34} color={palette.muted} />
      </View>
      <Text style={[type.h3, {color: palette.ink, marginTop: spacing.lg}]}>{title}</Text>
      {body ? (
        <Text
          style={[
            type.small,
            {color: palette.muted, marginTop: spacing.sm, textAlign: 'center'},
          ]}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{marginTop: spacing.lg}}>
          <Button label={actionLabel} onPress={onAction} variant="soft" small />
        </View>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  box: {alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxxl * 1.6},
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ═══════════════ ErrorState ═══════════════ */

export function ErrorState({message, onRetry}: {message: string; onRetry?: () => void}) {
  const {palette} = useTheme();
  return (
    <View style={emptyStyles.box}>
      <View style={[emptyStyles.iconWrap, {backgroundColor: palette.dangerSoft}]}>
        <Icon name="warning" size={34} color={palette.danger} />
      </View>
      <Text style={[type.h3, {color: palette.ink, marginTop: spacing.lg}]}>
        تعذر تحميل البيانات
      </Text>
      <Text
        style={[
          type.small,
          {color: palette.muted, marginTop: spacing.sm, textAlign: 'center'},
        ]}>
        {message}
      </Text>
      {onRetry ? (
        <View style={{marginTop: spacing.lg}}>
          <Button label="إعادة المحاولة" onPress={onRetry} variant="soft" icon="refresh" small />
        </View>
      ) : null}
    </View>
  );
}

/* ═══════════════ Loader ═══════════════ */

export function Loader({label = 'جارٍ التحميل…'}: {label?: string}) {
  const {palette} = useTheme();
  return (
    <View style={loaderStyles.box}>
      <ActivityIndicator size="large" color={palette.brand} />
      <Text style={[type.small, {color: palette.muted, marginTop: spacing.md}]}>
        {label}
      </Text>
    </View>
  );
}

const loaderStyles = StyleSheet.create({
  box: {alignItems: 'center', paddingVertical: spacing.xxxl * 1.5},
});

/* ═══════════════ Skeleton ═══════════════ */

export function Skeleton({style}: {style?: ViewStyle}) {
  const {palette} = useTheme();
  return <View style={[{backgroundColor: palette.skeleton, borderRadius: radius.md}, style]} />;
}

/** شبكة بطاقات منتجات هيكلية أثناء التحميل (شكل النتيجة النهائية). */
export function ProductGridSkeleton({count = 6}: {count?: number}) {
  const rows = Math.ceil(count / 2);
  return (
    <View style={{gap: spacing.lg}}>
      {Array.from({length: rows}).map((_, r) => (
        <View key={r} style={{flexDirection: 'row', gap: spacing.lg}}>
          {[0, 1].map(c => (
            <View key={c} style={{flex: 1, gap: spacing.sm}}>
              <Skeleton style={{height: 150, borderRadius: radius.lg}} />
              <Skeleton style={{height: 14, borderRadius: 6, width: '85%'}} />
              <Skeleton style={{height: 14, borderRadius: 6, width: '45%'}} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** صفّان أفقيان هيكليان (تصنيفات/متاجر) أثناء التحميل. */
export function RowSkeleton() {
  return (
    <View style={{gap: spacing.md}}>
      <View style={{flexDirection: 'row', gap: spacing.md}}>
        {Array.from({length: 4}).map((_, i) => (
          <Skeleton
            key={i}
            style={{width: 76, height: 92, borderRadius: radius.lg}}
          />
        ))}
      </View>
    </View>
  );
}

/* ═══════════════ SecureField (كلمة المرور) ═══════════════ */

/** حقل كلمة مرور مع زر إظهار/إخفاء وشارحة القوة (التسجيل). */
export function SecureField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  showStrength = false,
  strength,
  autoFocus,
  returnKeyType = 'done',
  onSubmitEditing,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  showStrength?: boolean;
  /** 0–3 من passwordStrength(). */
  strength?: 0 | 1 | 2 | 3;
  autoFocus?: boolean;
  returnKeyType?: 'default' | 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
}) {
  const {palette} = useTheme();
  const [visible, setVisible] = useState(false);
  const levels = showStrength ? STRENGTH_LABELS[strength ?? 0] : null;
  return (
    <View style={{gap: 7}}>
      <Text style={[type.smallMedium, {color: palette.inkSoft}]}>{label}</Text>
      <View
        style={[
          fieldStyles.box,
          {
            backgroundColor: palette.surface,
            borderColor: error ? palette.danger : palette.line,
          },
        ]}>
        <Icon name="lock" size={19} color={palette.muted} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          secureTextEntry={!visible}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit
          autoCorrect={false}
          autoCapitalize="none"
          textContentType="none"
          importantForAutofill="no"
          style={[type.body, fieldStyles.input, {color: palette.ink}]}
        />
        <Pressable
          onPress={() => setVisible(v => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
          <Icon
            name={visible ? 'eyeOff' : 'eye'}
            size={19}
            color={palette.muted}
          />
        </Pressable>
      </View>
      {showStrength && levels != null && value.length > 0 ? (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2}}>
          <View style={{flex: 1, flexDirection: 'row', gap: 4, height: 4}}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={{
                  flex: 1,
                  borderRadius: 4,
                  backgroundColor:
                    i <= (strength ?? 0)
                      ? strengthColor(strength ?? 0, palette)
                      : palette.surfaceSunken,
                }}
              />
            ))}
          </View>
          <Text
            style={[
              type.tiny,
              {color: strengthColor(strength ?? 0, palette)},
            ]}>
            {levels}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text style={[type.tiny, {color: palette.danger, marginTop: 2}]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.tiny, {color: palette.muted, marginTop: 2}]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const STRENGTH_LABELS = ['قصيرة جداً', 'مقبولة', 'جيدة', 'قوية'] as const;

function strengthColor(level: 0 | 1 | 2 | 3, palette: Palette): string {
  switch (level) {
    case 0:
      return palette.danger;
    case 1:
      return palette.warning;
    default:
      return palette.success;
  }
}

/* ═══════════════ SectionTitle ═══════════════ */

export function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  /** v2.8: سطر تفسيري صغير تحت العنوان — سبب التوصية مثلاً. */
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const {palette} = useTheme();
  return (
    <View style={sectionStyles.row}>
      <View style={{gap: 1, flex: 1, alignItems: 'flex-start'}}>
        <Text style={[type.h2, {color: palette.ink}]}>{title}</Text>
        {subtitle ? (
          <Text style={{fontSize: 10.5, color: palette.muted}} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[type.smallMedium, {color: palette.brandDark}]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});

/* ═══════════════ Toaster ═══════════════ */

export function Toaster() {
  const {palette} = useTheme();
  const toasts = useToastStore(s => s.toasts);
  const dismiss = useToastStore(s => s.dismiss);
  if (toasts.length === 0) {
    return null;
  }
  return (
    <View style={toastStyles.wrap} pointerEvents="box-none">
      {toasts.slice(-3).map(t => {
        /* v2.1: نغمات التنبيه من هوية الثيم نفسها — البرتقالي العلامة
         * بدقّة بدل الأزرق الافتراضي الذي كان يبدو غريباً عن الهوية. */
        const tone =
          t.tone === 'success' ? palette.success :
          t.tone === 'danger' ? palette.danger : palette.brand;
        return (
          <Pressable
            key={t.id}
            onPress={() => dismiss(t.id)}
            style={[
              toastStyles.toast,
              {
                backgroundColor: palette.surface,
                borderColor: palette.line,
                borderRightColor: tone,
              },
              shadowFor(palette.isDark),
            ]}>
            <View style={[toastStyles.toneDot, {backgroundColor: tone}]} />
            <Text style={[type.smallMedium, {color: palette.ink}]}>{t.text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 54,
    left: spacing.lg,
    right: spacing.lg,
    gap: 8,
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderRightWidth: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  toneDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
});

/* ═══════════════ BottomFixed ═══════════════ */

/** حاوية مثبتة أسفل الشاشة فوق محتوى قابل للتمرير (أزرار الشراء).
 *
 * v3.0 (الجولة 60) — إعادة بناء جذرية بعد شكوى «لا تظهر أي أزرار
 * في صفحة المنتج»: النسخة القديمة كانت عنصراً عادياً في عمود flex
 * بعد ScrollView — أي رؤيتها رهينة بسلوك Yoga في تحجيم اللا-مرن.
 * أي خلل في تلخيص الارتفاعات (قوائم طويلة/لوحات مفاتيح/شاشات
 * صغيرة) كان يدفعها خارج الشاشة بصمت = المستخدم لا يرى زر
 * الشراء إطلاقاً.
 *
 * الآن: شريط مُثبّت مثبتاً مطلقاً (position:absolute، bottom:0،
 * يمين:0، يسار:0) فوق الشاشة كلها — يستحيل هندسياً أن يُدفَع خارج
 * الرؤية، مهما كان حجم المحتوى أو سلوك flexbox. الشاشات التي
 * تستخدمه تعطي قائمة تمريرها paddingBottom ≈ ارتفاع الشريط +
 * إخلاء النظام كي لا يختفي آخر عنصر خلفه. هذا هو نمط أمازون/نون/
 * سلة في كل تطبيقات التجزئة العالمية. */
export function BottomFixed({children}: {children: React.ReactNode}) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        fixedStyles.box,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
          paddingBottom: insets.bottom + 10,
        },
        shadowFor(palette.isDark),
        // ظل علوي واضح فوق المحتوى في الفاتح
        !palette.isDark && {
          shadowColor: '#1C1917',
          shadowOffset: {width: 0, height: -3},
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 14,
        },
      ]}>
      {children}
    </View>
  );
}

const fixedStyles = StyleSheet.create({
  box: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});

/* ═══════════════ EndOfList ═══════════════ */

/** تذييل «وصلت لنهاية القائمة» — بدل لودر يدور للأبد في أسفل
 * صفحة المتجر حين لا تبقى منتجات (شكوى الجولة 13 حرفياً). */
export function EndOfList({label = 'وصلت إلى كل المنتجات'}: {label?: string}) {
  const {palette} = useTheme();
  return (
    <View style={endStyles.wrap} pointerEvents="none">
      <View style={[endStyles.line, {backgroundColor: palette.line}]} />
      <Icon name="checkCircle" size={14} color={palette.muted} />
      <Text style={{fontSize: 11, color: palette.muted, fontFamily: fonts.medium}}>
        {label}
      </Text>
      <View style={[endStyles.line, {backgroundColor: palette.line}]} />
    </View>
  );
}

const endStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  line: {flex: 1, maxWidth: 70, height: 1},
});

/* ═══════════════ Global styles ═══════════════ */

const styles = StyleSheet.create({
  /* v3.0: flex:1 صريحة بدل flexGrow فقط — الحاوية الداخلية للشاشة
   * يجب أن تكون محدودة الارتفاع دائماً حتى تُلزَم قوائم التمرير
   * داخل حدودها (والشريط المثبت absolute يحتاج أماً محدوداً
   * كي يتموضع bottom:0 على حافة الشاشة نفسها لا أبعد). */
  safe: {flex: 1},
  grow: {flex: 1},
});

export {spacing, radius, type, fonts};
