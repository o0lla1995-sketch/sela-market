/**
 * TermsScreen.tsx — شروط الاستخدام (نص عربي كامل داخل التطبيق).
 */
import React from 'react';
import {ScrollView, Text} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type} from '../../theme/tokens';
import {AppHeader, Card, Screen} from '../../components/ui';
import {APP_VERSION_LABEL} from '../../core/config';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Terms'>;

const SECTIONS: {title: string; paras: string[]}[] = [
  {
    title: '١ — طبيعة الخدمة',
    paras: [
      'سيلا ماركت منصة تعرض منتجات متاجر تجارية مستقلة تعمل بتطبيق نقاط البيع «سيلا». المتجر — لا المنصة — هو البائع الفعلي والمسؤول عن صحة بيانات منتجاته وأسعاره ومخزونه وجودة سلعه وتسليم طلباته.',
      'المنصة وسيط تقني: تنقل طلبك إلى المتجر وتتابع حالته، ولا تبيع شيئاً باسمها.',
    ],
  },
  {
    title: '٢ — الحساب',
    paras: [
      'الحساب برقم هوية فريد واسم ورقم جوال — مستخدم واحد لكل هوية، وأنت مسؤول عن سرية بيانات دخولك.',
      'يجب أن تكون البيانات صحيحة وحقيقية؛ يحق للإدارة تعطيل حسابات البيانات المزيفة.',
    ],
  },
  {
    title: '٣ — الطلبات والأسعار والدفع',
    paras: [
      'إرسال الطلب عرض شرائي للمتجر يحق له قبوله أو رفضه مع بيان السبب. لا يُلزم المتجر إلا بعد قبوله الطلب.',
      'السعر النهائي يحسبه الخادم من كتالوج المتجر لحظة الطلب؛ إن تغيّر سعر منتج أو نفد قبل القبول فسيلغي المتجر السطر أو الطلب ويخبرك.',
      'الدفع نقداً عند الاستلام بعملة الشيكل. رسم التوصيل يحدده كل متجر لكل منطقة ويظهر بوضوح قبل إرسال الطلب.',
    ],
  },
  {
    title: '٤ — الإلغاء والإرجاع والاستبدال',
    paras: [
      'يمكنك إلغاء طلبك من التطبيق ما دام «جديداً» أو «قيد التجهيز» — أي قبل أن يرسله المتجر.',
      'بعد الإرسال والإستلام: الإرجاع والاستبدال خاضعان لسياسة المتجر نفسه (ورقم فاتورته INV-O لديه) — تواصل معه مباشرة من صفحة الطلب.',
    ],
  },
  {
    title: '٥ — الاستخدام المقبول',
    paras: [
      'يُمنع استخدام التطبيق لأي غرض غير قانوني، أو إساءة الطلب المتكرر والإلغاء الذي يضر بالتجار، أو محاولة اختراق المنصة أو استخراج بياناتها آلياً.',
      'يحق للإدارة تقييد أو إيقاف أي حساب يخالف هذه الشروط.',
    ],
  },
  {
    title: '٦ — المسؤولية',
    paras: [
      'تُقدّم الخدمة «كما هي»، ولا تضمن المنصة توفر منتج بعينه أو متجر بعينه — فالنشر مربوط باشتراك التاجر النشط وقد يتوقف مؤقتاً.',
      'في الحدود التي يسمح بها القانون، لا تسأل المنصة عن أضرار ناشئة عن علاقتك الشرائية المباشرة مع المتجر، وتبقى حقوقك القانونية ضد البائع كاملة.',
    ],
  },
  {
    title: '٧ — تعديل الشروط',
    paras: [
      'قد تُحدَّث هذه الشروط مع تطور الخدمة، ويُعتبر استمرارك استخدام التطبيق بعد التحديث موافقة عليها. النسخة المعتمدة هي الأحدث المنشورة داخل التطبيق.',
    ],
  },
];

export function TermsScreen({navigation}: Props) {
  const {palette} = useTheme();
  return (
    <Screen>
      <AppHeader title="شروط الاستخدام" onBack={() => navigation.goBack()} />
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
