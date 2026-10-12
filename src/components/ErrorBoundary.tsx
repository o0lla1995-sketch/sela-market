/**
 * ErrorBoundary.tsx — حدود الأخطاء: أي انهيار عرض داخل شجرة الواجهة
 * يُلتقط ويُعرض بلوحة عربية واضحة بدل الشاشة البيضاء/السوداء.
 */
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {spacing, type} from '../theme/tokens';
import {Button} from './ui';
import {Icon} from './Icon';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error) {
    // تسجيل صامت — لا يوجد طرف خارجي (خصوصية أولاً).
    console.warn('UI crash caught:', error?.message);
  }

  render() {
    if (this.state.error != null) {
      return <CrashScreen message={this.state.error.message} onRetry={() => this.setState({error: null})} />;
    }
    return this.props.children;
  }
}

function CrashScreen({message, onRetry}: {message: string; onRetry: () => void}) {
  const {palette} = useTheme();
  return (
    <View style={[styles.wrap, {backgroundColor: palette.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.iconWrap, {backgroundColor: palette.dangerSoft}]}>
          <Icon name="warning" size={36} color={palette.danger} />
        </View>
        <Text style={[type.h2, {color: palette.ink, textAlign: 'center'}]}>
          واجهة التطبيق تعثرت
        </Text>
        <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
          حدث خطأ غير متوقع أثناء عرض هذه الشاشة. بياناتك آمنة على الخادم —
          أعد المحاولة أو أغلق التطبيق وافتحه من جديد.
        </Text>
        <Text style={[{fontSize: 10, color: palette.muted, fontFamily: 'monospace'}]}>
          {String(message).slice(0, 140)}
        </Text>
        <View style={styles.btnRow}>
          <Button label="إعادة المحاولة" onPress={onRetry} icon="refresh" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1},
  content: {alignItems: 'center', padding: spacing.xxxl, gap: spacing.md},
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {width: 220, marginTop: spacing.sm},
});
