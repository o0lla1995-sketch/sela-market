/**
 * NetworkDiagnosticsScreen.tsx — تشخيص الشبكة (v2.4).
 * ─────────────────────────────────────────────────────────────────
 * وُلدت هذه الشاشة من سبع جولات من «المنتجات لا تظهر» بلا قدرة
 * على الرؤية: المستخدم لا يملك أدوات التقاط الحزم، والاتصال
 * مشفّر HTTPS فلا يظهر في برامج المراقبة العادية. هنا يجد المستخدم
 * والمالك الحقيقة كاملة داخل التطبيق نفسه:
 *  • «فحص شامل» يطلق السلسلة الحرجة كاملة (إعدادات → متاجر →
 *    تفاصيل → منتجات المتجر → منتجات المول) ويعرض كل خطوة:
 *    هل خرج الطلب؟ ماذا رجع؟ بأي حجم؟ في كم ملي ثانية؟
 *  • سجل حي لآخر 200 نداء خرجت من التطبيق منذ فتحه.
 *  • شرح مكتوب مباشرة: ماذا يعني كل رمز خطأ وماذا يفعل به.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, Button, Card, Loader, Screen, SectionTitle} from '../../components/ui';
import {
  getCallLog,
  runNetworkProbe,
  subscribeCallLog,
  type ApiCallRecord,
  type ProbeDef,
  type ProbeReport,
} from '../../api/client';
/* v2.5: الفحص يستدعي الدوال الحقيقية نفسها التي تستخدمها الشاشات —
 * لا مسارات نصية جاهزة. هكذا لو انكسر أي مسار (بناء استعلام، تحويل
 * نوع، غياب API في Hermes) يظهر في التقرير باسمه، بدل فحص شبكة
 * سليم يخفي خللاً في طبقة الكود (ما حدث فعلاً في الجولات السابقة). */
import {
  getCategories,
  getCrossProducts,
  getMarketConfig,
  getStoreDetail,
  getStoreProducts,
  getStores,
} from '../../api/endpoints';
import {PRIMARY_SERVER_URL, FALLBACK_SERVER_URL, APP_VERSION_LABEL} from '../../core/config';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'NetworkDiagnostics'>;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function shortPath(path: string): string {
  return path.length > 42 ? path.slice(0, 39) + '…' : path;
}

export function NetworkDiagnosticsScreen({navigation}: Props) {
  const {palette} = useTheme();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [log, setLog] = useState<readonly ApiCallRecord[]>([]);

  useEffect(() => {
    setLog(getCallLog());
    return subscribeCallLog(() => setLog(getCallLog()));
  }, []);

  const runProbe = useCallback(async () => {
    setRunning(true);
    setReport(null);
    try {
      /* v2.5: كل خطوة تمر عبر الكود الحقيقي — نفس الدوال التي تستهلكها
       * شاشات المتجر والرئيسية والبحث. منتجات المتجر تُجلب عبر نقطة
       * نهاية "مست" حقيقية (متجر موجود فعلاً) لا معرّف ثابت. */
      let realStoreId = 1;
      let realStoreName = 'متجر (1)';
      try {
        const stores = await getStores();
        if (stores.length > 0) {
          realStoreId = stores[0].id;
          realStoreName = stores[0].name.slice(0, 18);
        }
      } catch {
        /* بلا متاجر — نستخدم 1 مثل السابق */
      }
      const defs: ProbeDef[] = [
        {label: 'الإعدادات العامة', path: '/api/market/config', run: () => getMarketConfig()},
        {label: 'قائمة المتاجر', path: '/api/market/stores', run: () => getStores()},
        {label: 'التصنيفات', path: '/api/market/categories', run: () => getCategories()},
        {
          label: `تفاصيل المتجر (${realStoreName})`,
          path: `/api/market/stores/${realStoreId}`,
          run: () => getStoreDetail(realStoreId),
        },
        {
          label: 'منتجات المتجر — المسار الحقيقي',
          path: `/api/market/stores/${realStoreId}/products?per=12`,
          run: () => getStoreProducts(realStoreId, {per: 12}),
        },
        {
          label: 'منتجات المول — المسار الحقيقي',
          path: '/api/market/products?per=12',
          run: () => getCrossProducts({per: 12}),
        },
      ];
      const r = await runNetworkProbe(defs);
      setReport(r);
    } finally {
      setRunning(false);
    }
  }, []);

  const okCount = report ? report.steps.filter(s => s.ok).length : 0;
  const productStep = report?.steps.find(
    s => s.label.includes('منتجات المتجر') || s.label.includes('منتجات المول'),
  );

  return (
    <Screen>
      <AppHeader title="تشخيص الشبكة" onBack={() => navigation.goBack()} big />
      <ScrollView
        contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}
        showsVerticalScrollIndicator={false}>
        {/* ─── الشرح ─── */}
        <Card style={{gap: spacing.sm}}>
          <Text style={[type.smallMedium, {color: palette.ink, fontFamily: fonts.bold}]}>
            ما هذه الشاشة؟
          </Text>
          <Text style={{fontSize: 12.5, color: palette.inkSoft, lineHeight: 21}}>
            تعرض كل طلب يخرج من التطبيق إلى خادم سيلا لحظة بلحظة: مساره،
            حالة رده، حجمه بالبايت، وزمنه. إذا ظهرت لك مشكلة في تحميل
            المنتجات، افتح هذه الشاشة واضغط «فحص شامل» — سترى بعينك هل
            يخرج طلب المنتجات أصلاً وماذا يحدث له على شبكتك، ثم أرسل
            لقطة شاشة للإدارة إن ظهر أي فشل.
          </Text>
          <View style={{gap: 4, marginTop: 2}}>
            <Text style={{fontSize: 11, color: palette.muted}}>
              النقطة الأساسية (مشفّرة HTTPS): {PRIMARY_SERVER_URL.replace('https://', '')}
            </Text>
            <Text style={{fontSize: 11, color: palette.muted}}>
              الاحتياطية: {FALLBACK_SERVER_URL.replace('http://', '').slice(0, 34)}…
            </Text>
          </View>
        </Card>

        {/* ─── الفحص الشامل ─── */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="الفحص الشامل" />
          <Button
            label={running ? 'جارٍ الفحص…' : 'فحص شامل الآن'}
            variant="solid"
            icon={running ? undefined : 'refresh'}
            onPress={running ? undefined : runProbe}
            disabled={running}
          />
          {running ? (
            <Card style={{paddingVertical: spacing.lg}}>
              <Loader label="نطلق طلبات الإعدادات والمتاجر والمنتجات…" />
            </Card>
          ) : null}

          {report != null ? (
            <Card style={{gap: spacing.md}}>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}>
                <View
                  style={[
                    diagStyles.pill,
                    {
                      backgroundColor:
                        okCount === report.steps.length
                          ? palette.successSoft
                          : okCount === 0
                            ? palette.dangerSoft
                            : palette.warningSoft ?? palette.brandSoft,
                    },
                  ]}>
                  <Icon
                    name={okCount === report.steps.length ? 'checkCircle' : 'warning'}
                    size={14}
                    color={
                      okCount === report.steps.length
                        ? palette.success
                        : palette.danger
                    }
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bold,
                      color:
                        okCount === report.steps.length
                          ? palette.success
                          : palette.danger,
                    }}>
                    {okCount}/{report.steps.length} خطوة نجحت · {fmtTime(report.at)}
                  </Text>
                </View>
              </View>

              {report.steps.map((s, i) => (
                <View
                  key={i}
                  style={[
                    diagStyles.stepRow,
                    {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
                  ]}>
                  <View style={{gap: 2, flex: 1, alignItems: 'flex-start'}}>
                    <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
                      <Icon
                        name={s.ok ? 'checkCircle' : 'warning'}
                        size={13}
                        color={s.ok ? palette.success : palette.danger}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: palette.ink,
                          fontFamily: fonts.bold,
                        }}>
                        {s.label}
                      </Text>
                    </View>
                    <Text style={{fontSize: 10.5, color: palette.muted}} numberOfLines={1}>
                      {shortPath(s.path)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: s.ok ? palette.inkSoft : palette.danger,
                        fontFamily: fonts.medium,
                      }}>
                      {s.ok
                        ? `حالة ${s.status} · ${s.bytes} بايت · ${s.ms}ms`
                        : s.detail}
                    </Text>
                  </View>
                </View>
              ))}

              {productStep != null && !productStep.ok ? (
                <Text style={{fontSize: 12, color: palette.danger, lineHeight: 20}}>
                  فشلت خطوة «منتجات المتجر» تحديداً — هذا هو مصدر اختفاء
                  المنتجات على شبكتك. الرجاء تصوير هذه الشاشة وإرسالها
                  للإدارة مع اسم شبكتك (جوّال/واي فاي).
                </Text>
              ) : null}
            </Card>
          ) : null}
        </View>

        {/* ─── السجل الحي ─── */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title={`سجل النداءات الحي (${log.length})`} />
          {log.length === 0 ? (
            <Card style={{paddingVertical: spacing.lg}}>
              <Text style={{fontSize: 12, color: palette.muted, textAlign: 'center'}}>
                لا نداءات بعد منذ فتح التطبيق — تصفح المول ثم عد هنا،
                أو اضغط «فحص شامل» أعلاه.
              </Text>
            </Card>
          ) : (
            <Card style={{gap: 0}}>
              {log
                .slice()
                .reverse()
                .slice(0, 60)
                .map((c, i) => (
                  <Pressable
                    key={`${c.at}-${i}`}
                    style={[
                      diagStyles.logRow,
                      {
                        borderBottomWidth: i < Math.min(log.length, 60) - 1 ? 1 : 0,
                        borderBottomColor: palette.line,
                      },
                    ]}>
                    <View style={{gap: 1.5, flex: 1, alignItems: 'flex-start'}}>
                      <View
                        style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 5,
                        }}>
                        <View
                          style={[
                            diagStyles.dot,
                            {
                              backgroundColor: c.ok
                                ? palette.success
                                : palette.danger,
                            },
                          ]}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: palette.muted,
                            fontFamily: fonts.medium,
                          }}>
                          {fmtTime(c.at)} · {c.method} · {c.status || '—'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: palette.brandDark,
                            fontFamily: fonts.bold,
                          }}>
                          {c.endpoint === 'primary' ? 'أساسية' : 'احتياطية'}
                        </Text>
                      </View>
                      <Text
                        style={{fontSize: 11, color: palette.ink}}
                        numberOfLines={1}>
                        {shortPath(c.path)}
                      </Text>
                      <Text style={{fontSize: 10, color: palette.muted}}>
                        {c.ok
                          ? `${c.bytes} بايت · ${c.ms}ms`
                          : `${c.code ?? 'خطأ'} · ${c.ms}ms`}
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </Card>
          )}
        </View>

        {/* ─── دلالات الأخطاء ─── */}
        <View style={{gap: spacing.md}}>
          <SectionTitle title="ماذا تعني الرموز؟" />
          <Card style={{gap: spacing.sm}}>
            {[
              {
                code: 'NETWORK',
                text: 'الطلب لم يصل للخادم أصلاً — انقطاع إنترنت أو شبكة تحجب الخادم. جرّب واي فاي بدل بيانات الجوال أو العكس.',
              },
              {
                code: 'TIMEOUT',
                text: 'الطلب وصل لكن الرد تأخر أكثر من 12 ثانية — شبكة بطيئة أو مزدحمة. الفحص الشامل يعيد المحاولة تلقائياً على النقطة الأخرى.',
              },
              {
                code: 'SERVER_ERROR',
                text: 'الخادم رد لكن بجسم غير مفهوم — يحدث عادة بسبب وسيط على الشبكة يفسد الردود. يظهر حجم الرد بجانبها للمقارنة.',
              },
              {
                code: 'RATE_LIMITED',
                text: 'طلبات كثيرة متتالية — انتظر قليلاً ثم أعد الفحص.',
              },
            ].map(e => (
              <View key={e.code} style={{gap: 2}}>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: palette.brandDark,
                    fontFamily: fonts.bold,
                  }}>
                  {e.code}
                </Text>
                <Text style={{fontSize: 11.5, color: palette.inkSoft, lineHeight: 19}}>
                  {e.text}
                </Text>
              </View>
            ))}
          </Card>
        </View>

        <Text style={{fontSize: 10.5, color: palette.muted, textAlign: 'center'}}>
          سيلا ماركت {APP_VERSION_LABEL} · تُسجَّل النداءات في الذاكرة فقط
          ولا تغادر جهازك
        </Text>
      </ScrollView>
    </Screen>
  );
}

const diagStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  logRow: {
    paddingVertical: 8,
  },
});
