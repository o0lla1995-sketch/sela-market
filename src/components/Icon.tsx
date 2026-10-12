/**
 * Icon.tsx — عائلة أيقونات سيلا ماركت: 40+ رمزاً مرسوماً يدوياً
 * (SVG / stroke 2 / زوايا دائرية) بلون واحد currentColor — قاعدة
 * ملف الهوية: صفر إيموجي، أيقونات خطية متسقة على كل الشاشات.
 */
import React from 'react';
import Svg, {Circle, G, Path, Rect} from 'react-native-svg';

export type IconName =
  | 'home'
  | 'store'
  | 'cart'
  | 'receipt'
  | 'user'
  | 'search'
  | 'back'
  | 'forward'
  | 'close'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'heart'
  | 'heartFilled'
  | 'bell'
  | 'bellOff'
  | 'filter'
  | 'refresh'
  | 'phone'
  | 'whatsapp'
  | 'pin'
  | 'check'
  | 'checkCircle'
  | 'info'
  | 'warning'
  | 'xCircle'
  | 'bag'
  | 'tag'
  | 'grid'
  | 'scale'
  | 'box'
  | 'clock'
  | 'truck'
  | 'cash'
  | 'star'
  | 'shield'
  | 'gear'
  | 'moon'
  | 'sun'
  | 'autoTheme'
  | 'logout'
  | 'userX'
  | 'help'
  | 'doc'
  | 'server'
  | 'wifiOff'
  | 'list'
  | 'chevronDown'
  | 'note'
  | 'emptyBag'
  | 'flame'
  | 'lock'
  | 'eye'
  | 'eyeOff'
  | 'sliders'
  | 'photo'
  | 'chevronLeft'
  | 'sort';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({name, size = 22, color = '#17171C', strokeWidth = 2}: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'home':
      return (
        <Svg {...common}>
          <Path d="M4 11.5 12 4l8 7.5" />
          <Path d="M6 10.5V20h12v-9.5" />
          <Path d="M10 20v-5.5h4V20" />
        </Svg>
      );
    case 'store':
      return (
        <Svg {...common}>
          <Path d="M4 9.5 5.4 4h13.2L20 9.5" />
          <Path d="M4 9.5a2.6 2.6 0 0 0 5.2 0 2.65 2.65 0 0 0 5.3 0 2.6 2.6 0 0 0 5.2 0" />
          <Path d="M5.6 12v8h12.8v-8" />
          <Path d="M9.5 20v-4.5h5V20" />
        </Svg>
      );
    case 'cart':
      return (
        <Svg {...common}>
          <Path d="M3.5 4.5h2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.25L20.5 8H6.4" />
          <Circle cx="10" cy="20.2" r="1.4" />
          <Circle cx="16.6" cy="20.2" r="1.4" />
        </Svg>
      );
    case 'receipt':
      return (
        <Svg {...common}>
          <Path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z" />
          <Path d="M9 8h6M9 11.5h6M9 15h4" />
        </Svg>
      );
    case 'user':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="8" r="3.6" />
          <Path d="M5 20.5c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
        </Svg>
      );
    case 'search':
      return (
        <Svg {...common}>
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="m20 20-4.4-4.4" />
        </Svg>
      );
    case 'back':
      /* RTL: السهم «رجوع» يشير يميناً في الواجهة العربية. */
      return (
        <Svg {...common}>
          <Path d="m9.5 5 7 7-7 7" />
        </Svg>
      );
    case 'forward':
      return (
        <Svg {...common}>
          <Path d="m14.5 5-7 7 7 7" />
        </Svg>
      );
    case 'close':
      return (
        <Svg {...common}>
          <Path d="M6 6l12 12M18 6 6 18" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...common}>
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      );
    case 'minus':
      return (
        <Svg {...common}>
          <Path d="M5 12h14" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg {...common}>
          <Path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
          <Path d="M6.5 6.5 7.4 19a1.7 1.7 0 0 0 1.7 1.6h5.8A1.7 1.7 0 0 0 16.6 19l.9-12.5" />
          <Path d="M10 10.5v6M14 10.5v6" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg {...common}>
          <Path d="M12 20s-7.5-4.6-9-9.2C1.9 7.3 4 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3 0 5.1 2.8 4 6.3-1.5 4.6-9 9.2-9 9.2Z" />
        </Svg>
      );
    case 'heartFilled':
      return (
        <Svg {...common} fill={color} strokeWidth={0}>
          <Path d="M12 20s-7.5-4.6-9-9.2C1.9 7.3 4 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3 0 5.1 2.8 4 6.3-1.5 4.6-9 9.2-9 9.2Z" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common}>
          <Path d="M6 16.5v-5a6 6 0 0 1 12 0v5l1.8 2.2H4.2L6 16.5Z" />
          <Path d="M10 21.2a2.2 2.2 0 0 0 4 0" />
        </Svg>
      );
    case 'bellOff':
      return (
        <Svg {...common}>
          <Path d="M6 16.5v-5a6 6 0 0 1 9.4-5M18 12.5v4l1.8 2.2H4.2" />
          <Path d="M10 21.2a2.2 2.2 0 0 0 4 0M4 4l16 16" />
        </Svg>
      );
    case 'filter':
      return (
        <Svg {...common}>
          <Path d="M4.5 6.5h15M7.5 12h9M10.5 17.5h3" />
        </Svg>
      );
    case 'refresh':
      return (
        <Svg {...common}>
          <Path d="M20 12a8 8 0 1 1-2.4-5.7" />
          <Path d="M20 3.5V7h-3.5" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg {...common}>
          <Path d="M5.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5L14.5 12l4 1.5v3a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4Z" />
        </Svg>
      );
    case 'whatsapp':
      return (
        <Svg {...common}>
          <Path d="M12 3.8a8.2 8.2 0 0 0-7 12.4L3.8 20.2l4.1-1.1A8.2 8.2 0 1 0 12 3.8Z" />
          <Path d="M9 9.2c.3 2.6 2.6 4.9 5.2 5.2l.9-1.5-2-1-.9.7c-.7-.4-1.2-.9-1.6-1.6l.7-.9-1-2L9 9.2Z" strokeWidth={0} fill={color} />
        </Svg>
      );
    case 'pin':
      return (
        <Svg {...common}>
          <Path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" />
          <Circle cx="12" cy="10" r="2.4" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common}>
          <Path d="m5 12.5 4.5 4.5L19 7.5" />
        </Svg>
      );
    case 'checkCircle':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
          <Path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
        </Svg>
      );
    case 'info':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
          <Path d="M12 11v5" />
          <Circle cx="12" cy="8" r="0.6" fill={color} strokeWidth={0} />
        </Svg>
      );
    case 'warning':
      return (
        <Svg {...common}>
          <Path d="M12 4 21 19.5H3L12 4Z" />
          <Path d="M12 10v4.2" />
          <Circle cx="12" cy="17" r="0.6" fill={color} strokeWidth={0} />
        </Svg>
      );
    case 'xCircle':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
          <Path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
        </Svg>
      );
    case 'bag':
      return (
        <Svg {...common}>
          <Path d="M6 8h12l1 12H5L6 8Z" />
          <Path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
        </Svg>
      );
    case 'emptyBag':
      return (
        <Svg {...common}>
          <Path d="M6 8h12l1 12H5L6 8Z" />
          <Path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
          <Path d="m9.5 14 5 4M14.5 14l-5 4" />
        </Svg>
      );
    case 'tag':
      return (
        <Svg {...common}>
          <Path d="M4 12.5V5a1 1 0 0 1 1-1h7.5L20 11.5 12.5 19 4 12.5Z" />
          <Circle cx="8.2" cy="8.2" r="1.3" />
        </Svg>
      );
    case 'grid':
      return (
        <Svg {...common}>
          <Rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
          <Rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
          <Rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
          <Rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
        </Svg>
      );
    case 'scale':
      return (
        <Svg {...common}>
          <Path d="M12 4v16M6 20h12" />
          <Path d="M12 6 5 8m7-2 7 2" />
          <Path d="M2.5 13a2.5 2.5 0 0 0 5 0L5 8l-2.5 5Zm14 0a2.5 2.5 0 0 0 5 0L19 8l-2.5 5Z" />
        </Svg>
      );
    case 'box':
      return (
        <Svg {...common}>
          <Path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
          <Path d="m4 7.2 8 4.3 8-4.3M12 11.5V21" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
          <Path d="M12 7.5V12l3 2.2" />
        </Svg>
      );
    case 'truck':
      return (
        <Svg {...common}>
          <Path d="M2.5 6h11v10h-11V6Z" />
          <Path d="M13.5 9.5h4l3 3.2V16h-7" />
          <Circle cx="7" cy="17.5" r="1.8" />
          <Circle cx="16.5" cy="17.5" r="1.8" />
        </Svg>
      );
    case 'cash':
      return (
        <Svg {...common}>
          <Rect x="3" y="6.5" width="18" height="11" rx="2" />
          <Circle cx="12" cy="12" r="2.6" />
          <Path d="M6.4 9.6v4.8M17.6 9.6v4.8" />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...common} fill={color} strokeWidth={0}>
          <Path d="m12 3.5 2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6L3.8 9.4l5.7-.7L12 3.5Z" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...common}>
          <Path d="M12 3.5 5 6v6c0 4.4 3 7.4 7 8.5 4-1.1 7-4.1 7-8.5V6l-7-2.5Z" />
          <Path d="m9 11.8 2.2 2.2 4-4.2" />
        </Svg>
      );
    case 'gear':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1" />
        </Svg>
      );
    case 'moon':
      return (
        <Svg {...common}>
          <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
        </Svg>
      );
    case 'sun':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="4" />
          <Path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
        </Svg>
      );
    case 'autoTheme':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
          <Path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill={color} strokeWidth={0} />
        </Svg>
      );
    case 'logout':
      return (
        <Svg {...common}>
          <Path d="M14 4.5H7a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 7 19.5h7" />
          <Path d="M10.5 12h9m0 0-3-3m3 3-3 3" />
        </Svg>
      );
    case 'userX':
      return (
        <Svg {...common}>
          <Circle cx="10.5" cy="8" r="3.4" />
          <Path d="M4 20.5c.7-3.4 3.3-5.1 6.5-5.1 1.2 0 2.3.2 3.3.7" />
          <Path d="m16 16.5 4.5 4.5m0-4.5-4.5 4.5" />
        </Svg>
      );
    case 'help':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
          <Path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.2.9-1.2 1.8" />
          <Circle cx="12" cy="16.6" r="0.6" fill={color} strokeWidth={0} />
        </Svg>
      );
    case 'doc':
      return (
        <Svg {...common}>
          <Path d="M6.5 3.5h7L18.5 8v12.5h-12V3.5Z" />
          <Path d="M13.5 3.5V8h5M9 12.5h6M9 16h4" />
        </Svg>
      );
    case 'server':
      return (
        <Svg {...common}>
          <Rect x="3.5" y="4" width="17" height="6.5" rx="1.6" />
          <Rect x="3.5" y="13.5" width="17" height="6.5" rx="1.6" />
          <Path d="M7 7.2h.01M7 16.7h.01" />
        </Svg>
      );
    case 'wifiOff':
      return (
        <Svg {...common}>
          <Path d="M4 9a13.5 13.5 0 0 1 16 0M7 12.4a9 9 0 0 1 10 0M10 15.7a4.5 4.5 0 0 1 4 0M12 19h.01" />
          <Path d="M4 4l16 16" />
        </Svg>
      );
    case 'list':
      return (
        <Svg {...common}>
          <Path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" />
          <Circle cx="4.7" cy="6.5" r="0.8" fill={color} strokeWidth={0} />
          <Circle cx="4.7" cy="12" r="0.8" fill={color} strokeWidth={0} />
          <Circle cx="4.7" cy="17.5" r="0.8" fill={color} strokeWidth={0} />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg {...common}>
          <Path d="m6 9.5 6 6 6-6" />
        </Svg>
      );
    case 'note':
      return (
        <Svg {...common}>
          <Path d="M5 4.5h14v15H5v-15Z" />
          <Path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4" />
        </Svg>
      );
    case 'flame':
      return (
        <Svg {...common}>
          <Path d="M12 3.5s5 3.8 5 9a5 5 0 0 1-10 0c0-2 1-3.4 2.2-4.6.2 1.5.9 2.4 2 2.6-.6-2.6 0-5.5.8-7Z" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg {...common}>
          <Rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
          <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          <Circle cx="12" cy="15.2" r="1.1" />
        </Svg>
      );
    case 'eye':
      return (
        <Svg {...common}>
          <Path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
          <Circle cx="12" cy="12" r="3" />
        </Svg>
      );
    case 'eyeOff':
      return (
        <Svg {...common}>
          <Path d="M4 4l16 16" />
          <Path d="M9.9 6.2A9.6 9.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3 3.5" />
          <Path d="M6.4 8A16.9 16.9 0 0 0 2.5 12S6 18.2 12 18.2a9.4 9.4 0 0 0 3.4-.6" />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </Svg>
      );
    case 'sliders':
      return (
        <Svg {...common}>
          <Path d="M5 5v6M5 15v4M12 5v3M12 12v7M19 5v9M19 18v1" />
          <Circle cx="5" cy="13" r="2" />
          <Circle cx="12" cy="10" r="2" />
          <Circle cx="19" cy="16" r="2" />
        </Svg>
      );
    case 'photo':
      return (
        <Svg {...common}>
          <Rect x="3" y="5" width="18" height="14" rx="2.5" />
          <Circle cx="9" cy="10.5" r="1.6" />
          <Path d="M4.5 17.5 9.8 13l3.4 3 2.6-2.2 3.7 3.7" />
        </Svg>
      );
    case 'chevronLeft':
      return (
        <Svg {...common}>
          <Path d="M14.5 5.5 8 12l6.5 6.5" />
        </Svg>
      );
    case 'sort':
      return (
        <Svg {...common}>
          <Path d="M7 5v14M7 19l-3-3M7 19l3-3" />
          <Path d="M13.5 7h7M13.5 12h5M13.5 17h3" />
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" />
        </Svg>
      );
  }
}
