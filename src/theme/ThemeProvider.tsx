/**
 * ThemeProvider.tsx — إدارة المود (فاتح / داكن / حسب النظام).
 * - يقرأ الوضع من settingsStore ويستمع لوضع النظام عند «تلقائي».
 * - يوفر اللوحة الجاهزة عبر useTheme() لكل مكون.
 */
import React, {useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import {useSettingsStore} from '../stores/settingsStore';
import {paletteFor, type Palette} from './tokens';

interface ThemeContextValue {
  palette: Palette;
  /** الوضع الفعلي المُستخدم (فاتح/داكن) بعد حل «تلقائي». */
  resolved: 'light' | 'dark';
  /** الوضع الذي اختاره المستخدم (قد يكون system). */
  mode: 'light' | 'dark' | 'system';
  setMode: (m: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const mode = useSettingsStore(s => s.themeMode);
  const setThemeMode = useSettingsStore(s => s.setThemeMode);
  // نحسم الوضع مرة واحدة عند الإقلاع؛ التغيير الحي لوضع النظام يستوجب
  // إعادة تحميل تطبيقات RN القديمة على بعض الأجهزة، لكن useColorScheme
  // في RN 0.77 يحدّث القيمة حياً — نتابعها بالحالة المحلية.
  const [systemDark, setSystemDark] = useState(systemScheme === 'dark');
  useEffect(() => {
    setSystemDark(systemScheme === 'dark');
  }, [systemScheme]);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved: 'light' | 'dark' = mode === 'system'
      ? (systemDark ? 'dark' : 'light')
      : mode;
    return {
      palette: paletteFor(resolved),
      resolved,
      mode,
      setMode: setThemeMode,
    };
  }, [mode, systemDark, setThemeMode]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx == null) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
