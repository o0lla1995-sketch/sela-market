/**
 * PrivacyScreen.tsx — سياسة الخصوصية (نص عربي كامل داخل التطبيق —
 * متطلب نشر Google Play: سياسة واضحة + رابط ويب مستضاف).
 */
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
import {AppHeader, Card, Screen} from '../../components/ui';
import {APP_VERSION_LABEL} from '../../core/config';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Privacy'>;

const SECTIONS: {title: string; paras: string[]}[] = [
  {
    title: '١ — البيانات التي نجمعها',
    paras: [
      'عند إنشاء حساب نجمع ثلاث بيانات فقط: رقم الهوية (معرّفك الوحيد على المنصة)، الاسم الكامل، ورقم الجوال. لا نجمع أي شيء آخر — لا بريد إلكتروني، لا موقع جغرافي، لا جهات اتصال، لا معرفات إعلانية.',
      'عند إرسال طلب نخزّن منطقة التوصيل والعنوان والملاحظة التي أدخلتها مع الطلب لكي يسلّمه المتجر. تبقى هذه البيانات مرتبطة بالطلب لسجلات المتجر.',
      'نخزّن على جهازك فقط: سلة التسوق، المفضلة، عمليات بحثك الأخيرة، وتفضيلات المظهر — وتبقى على جهازك ولا تغادر إلا عند إرسال طلب.',
    ],
  },
  {
    title: '٢ — كيف نستخدم بياناتك',
    paras: [
      'رقم الهوية والجوال يُستخدمان لتسجيل الدخول ولإيصال الطلب إليك، ويراهما المتجر الذي طلبت منه فقط (ورقم الجوال للتواصل عند التوصيل).',
      'لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث إعلاني أو تحليلي — التطبيق لا يتضمن أي أدوات تتبع أو إعلانات.',
    ],
  },
  {
    title: '٣ — من يرى بياناتك',
    paras: [
      'أنت ترى طلباتك فقط، وكل متجر يرى طلباته وبيانات تواصل زبائن طلباته فقط — عزل كامل على مستوى الخادم.',
      'إدارة سيلا تصل إلى البيانات لأغراض تشغيل المنصة وحل المشكلات فقط وفق سجل تدقيق موثّق.',
    ],
  },
  {
    title: '٤ — الاحتفاظ والحذف',
    paras: [
      'يمكنك حذف حسابك في أي وقت من: حسابي ← حذف حسابي نهائياً. الحذف يمحو اسمك ورقم جوالك ويحرّر رقم هويتك فوراً وتُلغى كل جلسات الدخول.',
      'تبقى فواتير طلباتك السابقة لدى المتاجر كسجلات محاسبية قانونية، دون أي بيانات تعرّفك الشخصية — الطلب نفسه لا يحمل اسمك أو رقمك بعد الحذف.',
    ],
  },
  {
    title: '٥ — الأمان',
    paras: [
      'كل الاتصال بين التطبيق والخادم مشفّر عبر HTTPS، وجلساتك محمية برمز عشوائي صالح 90 يوماً يُلغى فور خروجك أو حذف حسابك.',
      'التطبيق لا يطلب أذونات حساسة: الإنترنت وحالة الشبكة والإشعارات المحلية فقط — لا كاميرا، لا موقع، لا ميكروفون، لا ملفات.',
    ],
  },
  {
    title: '٦ — الأطفال',
    paras: [
      'الخدمة موجهة للبالغين الذين يملكون رقم هوية رسمياً، ولا نجمع بيانات من الأطفال.',
    ],
  },
  {
    title: '٧ — حقوقك',
    paras: [
      'لك الحق في الوصول إلى بياناتك (مرئية في حسابك)، تصحيحها (عبر إعادة التسجيل بعد الحذف إن لزم)، وحذف حسابك بالكامل من داخل التطبيق دون التواصل مع أحد.',
      'لأي استفسار حول الخصوصية تواصل مع إدارة سيلا عبر قنوات الدعم المعلنة في صفحة الاتصال بالموقع الرسمي.',
    ],
  },
];

export function PrivacyScreen({navigation}: Props) {
  const {palette} = useTheme();
  return (
    <Screen>
      <AppHeader title="سياسة الخصوصية" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.md}} showsVerticalScrollIndicator={false}>
        <Text style={[type.small, {color: palette.muted}]}>
          آخر تحديث: أكتوبر 2026 · تطبيق سيلا ماركت {APP_VERSION_LABEL}
        </Text>
        {SECTIONS.map(s => (
          <Card key={s.title} style={{gap: spacing.md}}>
            <Text style={[type.h3, {color: palette.ink}]}>{s.title}</Text>
            {s.paras.map((p, i) => (
              <Text key={i} style={[{fontSize: 13, color: palette.inkSoft, lineHeight: 23, textAlign: 'right'}]}>
                {p}
              </Text>
            ))}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
