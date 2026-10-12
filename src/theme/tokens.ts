/**
 * tokens.ts — رموز نظام تصميم سيلا ماركت.
 * المصدر: ملف الهوية الأم (الجولة 57) — «60% محايد فاتح / 30% حبر
 * ومحايدات / 10% برتقالي فقط» مع قطبية معاكسة لنقطة البيع: تطبيق
 * نهاري فاتح أولاً، ووضع داكن كامل بجودة متطابقة.
 */

/** لوحة الألوان الكاملة لوضع واحد. */
export interface Palette {
  isDark: boolean;
  /* الأسطح */
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  /* الحبر */
  ink: string;
  inkSoft: string;
  muted: string;
  onBrand: string;
  /* الخطوط والحدود */
  line: string;
  lineStrong: string;
  /* العلامة */
  brand: string;
  brandDeep: string;
  brandDark: string;
  brandSoft: string;
  brandBorder: string;
  /* الدلالات */
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  purple: string;
  purpleSoft: string;
  /* إضافات */
  skeleton: string;
  overlay: string;
  ripple: string;
}

const LIGHT: Palette = {
  isDark: false,
  bg: '#FBFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F4',
  surfaceSunken: '#EFEEEC',
  ink: '#17171C',
  inkSoft: '#44403C',
  muted: '#78716C',
  onBrand: '#FFFFFF',
  line: '#E7E5E4',
  lineStrong: '#D6D3D1',
  brand: '#F97316',
  brandDeep: '#EA580C',
  brandDark: '#C2410C',
  brandSoft: '#FFF7ED',
  brandBorder: '#FED7AA',
  success: '#15803D',
  successSoft: '#F0FDF4',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  purple: '#7E22CE',
  purpleSoft: '#FAF5FF',
  skeleton: '#EFEEEC',
  overlay: 'rgba(23,23,28,0.45)',
  ripple: 'rgba(249,115,22,0.12)',
};

const DARK: Palette = {
  isDark: true,
  bg: '#121216',
  surface: '#1B1B21',
  surfaceAlt: '#232329',
  surfaceSunken: '#2A2A31',
  ink: '#F5F5F4',
  inkSoft: '#D6D3D1',
  muted: '#A8A29E',
  onBrand: '#FFFFFF',
  line: '#2E2E36',
  lineStrong: '#3D3D46',
  brand: '#FB923C',
  brandDeep: '#F97316',
  brandDark: '#C2410C',
  brandSoft: '#2E1C0D',
  brandBorder: '#5C341A',
  success: '#4ADE80',
  successSoft: '#0E2A1B',
  danger: '#F87171',
  dangerSoft: '#331717',
  warning: '#FBBF24',
  warningSoft: '#33270E',
  info: '#93C5FD',
  infoSoft: '#14213A',
  purple: '#C084FC',
  purpleSoft: '#2B1A3D',
  skeleton: '#232329',
  overlay: 'rgba(0,0,0,0.6)',
  ripple: 'rgba(251,146,60,0.16)',
};

export function paletteFor(mode: 'light' | 'dark'): Palette {
  return mode === 'dark' ? DARK : LIGHT;
}

/* ─── الخطوط ───
 * Tajawal مضمّنة في android/app/src/main/assets/fonts. */
export const fonts = {
  regular: 'Tajawal-Regular',
  medium: 'Tajawal-Medium',
  bold: 'Tajawal-Bold',
  black: 'Tajawal-Black',
} as const;

/** سلّم الخطوط (عربي أولاً — أحجام مريحة للقراءة على الهاتف). */
export const type = {
  display: {fontSize: 28, lineHeight: 38, fontFamily: fonts.black},
  h1: {fontSize: 23, lineHeight: 32, fontFamily: fonts.bold},
  h2: {fontSize: 19, lineHeight: 28, fontFamily: fonts.bold},
  h3: {fontSize: 16.5, lineHeight: 24, fontFamily: fonts.bold},
  body: {fontSize: 15, lineHeight: 23, fontFamily: fonts.regular},
  bodyMedium: {fontSize: 15, lineHeight: 23, fontFamily: fonts.medium},
  small: {fontSize: 13, lineHeight: 19, fontFamily: fonts.regular},
  smallMedium: {fontSize: 13, lineHeight: 19, fontFamily: fonts.medium},
  tiny: {fontSize: 11.5, lineHeight: 16, fontFamily: fonts.medium},
} as const;

/* ─── الشبكة والمسافات (4pt grid) ─── */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
} as const;

/* ─── الانحناءات ─── */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/* ─── الظلال (خفيفة جداً في الفاتح، حدود في الداكن) ─── */
export function shadowFor(isDark: boolean) {
  return isDark
    ? {
        shadowColor: '#000000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 2,
      }
    : {
        shadowColor: '#1C1917',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      };
}

/** نبرات الشرائح الدلالية — تُحوّل إلى ألوان ملموسة في المكونات. */
export type Tone =
  | 'brand'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'muted'
  | 'purple';

export function toneColors(p: Palette, tone: Tone) {
  switch (tone) {
    case 'brand':
      return {fg: p.brandDark, bg: p.brandSoft, border: p.brandBorder, solid: p.brand};
    case 'success':
      return {fg: p.success, bg: p.successSoft, border: p.success, solid: p.success};
    case 'danger':
      return {fg: p.danger, bg: p.dangerSoft, border: p.danger, solid: p.danger};
    case 'warning':
      return {fg: p.warning, bg: p.warningSoft, border: p.warning, solid: p.warning};
    case 'info':
      return {fg: p.info, bg: p.infoSoft, border: p.info, solid: p.info};
    case 'purple':
      return {fg: p.purple, bg: p.purpleSoft, border: p.purple, solid: p.purple};
    default:
      return {fg: p.muted, bg: p.surfaceAlt, border: p.line, solid: p.muted};
  }
}
