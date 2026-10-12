/**
 * AboutScreen.tsx — حول التطبيق: هوية سيلا ماركت، كيف يعمل المول،
 * الأسئلة الشائعة المختصرة، وروابط الخصوصية والشروط.
 */
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, Button, Card, Screen, SectionTitle} from '../../components/ui';
import {APP_VERSION_LABEL} from '../../core/config';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'About'>;

const FAQ: {q: string; a: string}[] = [
  {
    q: 'ما هو سيلا ماركت؟',
    a: 'مول تجاري كامل في تطبيق واحد: يعرض منتجات مئات نقاط البيع التجارية التي تعمل بتطبيق «سيلا» — كل متجر يدير كتالوجه ومخزونه وأسعاره ومناطق توصيله بنفسه، وأنت تتسوق من كل هذه المتاجر بمكان واحد.',
  },
  {
    q: 'كيف أدفع؟',
    a: 'الدفع نقداً عند الاستلام فقط — لا نطلب أي بطاقة أو معلومات دفع إطلاقاً.',
  },
  {
    q: 'لماذا لكل متجر طلب منفصل؟',
    a: 'كل طلب يجهزه متجر مختلف بتوقيده، فلا تتداخل الطلبات بين التجار — تتابع كل طلب بحالته ورسم توصيله الخاص.',
  },
  {
    q: 'هل الأسعار محدّثة؟',
    a: 'يزامن كل تاجر كتالوجه من نقطة البيع كل 15 دقيقة، والسعر النهائي يحسبه الخادم من كتالوج المتجر لحظة إرسال الطلب — لا مجال لخطأ.',
  },
  {
    q: 'هل يمكنني التسوق بلا حساب؟',
    a: 'نعم — تصفح كل شيء كزائر، ولا يُطلب منك التسجيل إلا عند إتمام أول طلب (رقم هوية + اسم + جوال فقط).',
  },
];

export function AboutScreen({navigation}: Props) {
  const {palette} = useTheme();
  return (
    <Screen>
      <AppHeader title="حول سيلا ماركت" onBack={() => navigation.goBack()} big />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} showsVerticalScrollIndicator={false}>
        {/* الهوية */}
        <View style={aboutStyles.hero}>
          <View style={[aboutStyles.logo, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
            <Text style={[{fontSize: 34, color: palette.brandDark, fontFamily: fonts.black}]}>س</Text>
          </View>
          <Text style={[type.h1, {color: palette.ink}]}>سيلا ماركت</Text>
          <Text style={[type.small, {color: palette.muted}]}>
            كل متاجر حيّك في مكان واحد · الإصدار {APP_VERSION_LABEL}
          </Text>
        </View>

        {/* كيف يعمل */}
        <Card style={{gap: spacing.md}}>
          <SectionTitle title="كيف يعمل المول؟" />
          {[
            {icon: 'store' as const, text: 'التجار يشغّلون متاجرهم الحقيقية بتطبيق نقاط بيع سيلا'},
            {icon: 'refresh' as const, text: 'المنتجات والأسعار والمخزون تُزامن تلقائياً كل 15 دقيقة'},
            {icon: 'cart' as const, text: 'أنت تجمع مشترياتك من أي عدد من المتاجر'},
            {icon: 'cash' as const, text: 'تدفع نقداً عند الاستلام لكل متجر على حدة'},
            {icon: 'truck' as const, text: 'تتابع كل طلب من قبوله حتى باب بيتك'},
          ].map((row, i) => (
            <View key={i} style={aboutStyles.flowRow}>
              <View style={[aboutStyles.flowIcon, {backgroundColor: palette.brandSoft}]}>
                <Icon name={row.icon} size={16} color={palette.brandDark} />
              </View>
              <Text style={[type.small, {color: palette.inkSoft, flex: 1, lineHeight: 20}]}>
                {row.text}
              </Text>
            </View>
          ))}
        </Card>

        {/* الأسئلة */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="أسئلة شائعة" />
          {FAQ.map(f => (
            <Card key={f.q} style={{gap: spacing.sm}}>
              <Text style={[type.smallMedium, {color: palette.ink, fontFamily: fonts.bold}]}>
                {f.q}
              </Text>
              <Text style={[{fontSize: 12.5, color: palette.inkSoft, lineHeight: 21}]}>
                {f.a}
              </Text>
            </Card>
          ))}
        </View>

        {/* الروابط */}
        <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
          <Button
            label="سياسة الخصوصية"
            variant="outline"
            small
            style={{flex: 1}}
            icon="shield"
            onPress={() => navigation.navigate('Privacy')}
          />
          <Button
            label="شروط الاستخدام"
            variant="outline"
            small
            style={{flex: 1}}
            icon="doc"
            onPress={() => navigation.navigate('Terms')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const aboutStyles = StyleSheet.create({
  hero: {alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl},
  logo: {
    width: 92,
    height: 92,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
  flowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
