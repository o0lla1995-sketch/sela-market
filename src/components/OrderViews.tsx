/**
 * OrderViews.tsx — مكونات الطلب: شارة الحالة، خط الزمن، بطاقة الطلب
 * في القائمة، وبطاقة تفاصيل الطلب.
 * v4.0 (الجولة 68): خط الزمن يدخل بإيقاع متدرج — كل خطوة تظهر
 * بتأخير صغير عن سابقتها (cascade) فيقرأ المستخدم «التتبع» كقصة
 * متحركة لا قائمة ساكنة (طلب: موشن لطيفة في كل الصفحات).
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {radius, spacing, type, fonts, toneColors} from '../theme/tokens';
import {Icon} from './Icon';
import {Card} from './ui';
import {formatDateTime, relativeTime} from '../core/time';
import {formatMoney, formatQty} from '../core/money';
import {absoluteUrl} from '../api/client';
import {
  STATUS_META,
  TIMELINE_STEPS,
  statusTimestamp,
  timelineIndex,
} from '../core/orderStatus';
import type {Order} from '../core/types';

/* ─── شارة الحالة ─── */

export function OrderStatusBadge({status}: {status: Order['status']}) {
  const {palette} = useTheme();
  const meta = STATUS_META[status];
  const c = toneColors(palette, meta.tone);
  return (
    <View
      style={[
        badgeStyles.box,
        {backgroundColor: c.bg, borderColor: c.border},
      ]}>
      <Icon
        name={
          status === 'delivered' ? 'checkCircle' :
          status === 'rejected' || status === 'cancelled' ? 'xCircle' :
          status === 'sent' ? 'truck' :
          status === 'accepted' ? 'clock' :
          status === 'returned' ? 'refresh' : 'bag'
        }
        size={13}
        color={c.fg}
      />
      <Text style={[{fontSize: 11.5, color: c.fg, fontFamily: fonts.bold}]}>
        {meta.label}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  box: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

/* ─── خط الزمن ─── */

export function OrderTimeline({order}: {order: Order}) {
  const {palette} = useTheme();
  const current = timelineIndex(order.status);

  // الحالات الطرفية خارج المسار الطبيعي تُعرض كملخص خاص بها.
  if (current < 0) {
    const meta = STATUS_META[order.status];
    const c = toneColors(palette, meta.tone);
    return (
      <View
        style={[
          timelineStyles.fallback,
          {backgroundColor: c.bg, borderColor: c.border, borderRightColor: c.fg},
        ]}>
        <Icon name="info" size={17} color={c.fg} />
        <View style={{flex: 1, gap: 2}}>
          <Text style={[type.smallMedium, {color: c.fg, fontFamily: fonts.bold}]}>
            {meta.label}
          </Text>
          <Text style={[{fontSize: 11.5, color: palette.inkSoft}]}>
            {meta.description}
            {order.reject_reason ? ` — ${order.reject_reason}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{gap: 0}}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === TIMELINE_STEPS.length - 1;
        const ts =
          step.status === 'new' ? order.created_at :
          step.status === 'accepted' ? order.accepted_at :
          step.status === 'sent' ? order.sent_at :
          order.delivered_at;
        return (
          <AnimatedTimelineRow
            key={step.status}
            index={i}
            done={done}
            active={active}
            isLast={isLast}
            label={step.label}
            timestamp={active ? step.hint : ts != null ? formatDateTime(ts) : step.hint}
          />
        );
      })}
    </View>
  );
}

/* v4.0: صف خط زمن متدرج الدخول — يظهر بتأخير ‎90ms عن سابقه
 * (ظهور + انزلاق صغير من الأعلى) بمحرك JS: مرة واحدة عند التركيب. */
function AnimatedTimelineRow({
  index,
  done,
  active,
  isLast,
  label,
  timestamp,
}: {
  index: number;
  done: boolean;
  active: boolean;
  isLast: boolean;
  label: string;
  timestamp: string;
}) {
  const {palette} = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(v, {
        toValue: 1,
        duration: 320,
        useNativeDriver: false,
      }).start();
    }, index * 90);
    return () => clearTimeout(t);
  }, [v, index]);
  return (
    <Animated.View
      style={[
        timelineStyles.row,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            },
          ],
        },
      ]}>
      {/* العمود الدائري */}
      <View style={timelineStyles.rail}>
        <View
          style={[
            timelineStyles.dot,
            {
              backgroundColor: done || active ? palette.brand : palette.surface,
              borderColor: done || active ? palette.brand : palette.lineStrong,
            },
          ]}>
          {done ? (
            <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} />
          ) : active ? (
            <View style={[timelineStyles.innerDot, {backgroundColor: '#FFFFFF'}]} />
          ) : null}
        </View>
        {!isLast ? (
          <View
            style={[
              timelineStyles.line,
              {backgroundColor: done ? palette.brand : palette.line},
            ]}
          />
        ) : null}
      </View>
      {/* النص */}
      <View style={[timelineStyles.texts, {marginBottom: isLast ? 0 : spacing.md}]}>
        <Text
          style={[
            type.smallMedium,
            {
              color: done || active ? palette.ink : palette.muted,
              fontFamily: active || done ? fonts.bold : fonts.medium,
              opacity: done ? 0.75 : 1,
            },
          ]}>
          {label}
        </Text>
        <Text style={[{fontSize: 11, color: palette.muted}]}>{timestamp}</Text>
      </View>
    </Animated.View>
  );
}

const timelineStyles = StyleSheet.create({
  fallback: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderRightWidth: 4,
    padding: spacing.md,
  },
  row: {flexDirection: 'row-reverse'},
  rail: {alignItems: 'center', width: 26},
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {width: 8, height: 8, borderRadius: 4},
  line: {width: 2.5, flex: 1, minHeight: 18},
  texts: {flex: 1, paddingBottom: 2, gap: 1, alignItems: 'flex-start'},
});

/* ─── بطاقة الطلب في القائمة ─── */

/** بطاقة الطلب في القائمة — v2.0: زر تقييم للطلبات المسلّمة غير
 *  المقيّمة ونجوم للتقييم المرسل + دائرة المتجر. */
export function OrderListCard({
  order,
  onPress,
  onRate,
}: {
  order: Order;
  onPress: () => void;
  /** يُستدعى عند طلب تقييم طلب مسلّم غير مقيّم. */
  onRate?: (order: Order) => void;
}) {
  const {palette} = useTheme();
  const items = order.items ?? [];
  const canRate = order.status === 'delivered' && order.rating == null && onRate != null;
  /* v3.3: لمسة لونية بحالة الطلب على الحافة الأمامية للبطاقة —
   * المسح البصري يميّز النشط من المكتمل قبل قراءة أي نص. */
  const tone = toneColors(palette, STATUS_META[order.status].tone);
  return (
    <Card
      onPress={onPress}
      style={[{gap: spacing.sm, borderRightWidth: 4, borderRightColor: tone.fg}]}>
      <View style={listStyles.topRow}>
        {absoluteUrl(order.store?.logo_url ?? null) != null ? (
          <Image
            source={{uri: absoluteUrl(order.store?.logo_url ?? null) ?? ''}}
            style={[listStyles.avatar, {backgroundColor: '#FFFFFF'}]}
            resizeMode="cover"
          />
        ) : (
          <View style={[listStyles.avatar, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
            <Text style={{fontSize: 16, color: palette.brandDark, fontFamily: fonts.black}}>
              {(order.store?.name ?? 'م').trim().charAt(0)}
            </Text>
          </View>
        )}
        <View style={{flex: 1, gap: 2, alignItems: 'flex-start'}}>
          <Text style={[type.smallMedium, {color: palette.muted, fontFamily: fonts.medium}]}>
            {order.order_number}
          </Text>
          <Text style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]} numberOfLines={1}>
            {order.store?.name ?? 'متجر'}
          </Text>
        </View>
        <OrderStatusBadge status={order.status} />
        <Icon name="chevronLeft" size={16} color={palette.muted} />
      </View>

      <View style={listStyles.itemsRow}>
        {items.slice(0, 3).map(it => (
          <View key={it.id} style={[listStyles.itemChip, {backgroundColor: palette.surfaceAlt}]}>
            <Text style={[{fontSize: 11, color: palette.inkSoft}]} numberOfLines={1}>
              {it.product_name}
              {it.variant != null ? ` (${it.variant})` : ''} × {formatQty(it.quantity, false)}
            </Text>
          </View>
        ))}
        {items.length > 3 ? (
          <View style={[listStyles.itemChip, {backgroundColor: palette.surfaceAlt}]}>
            <Text style={[{fontSize: 11, color: palette.muted}]}>
              +{items.length - 3}
            </Text>
          </View>
        ) : null}
      </View>

      {order.rating != null ? (
        <View style={[listStyles.ratedRow, {backgroundColor: palette.successSoft}]}>
          <Icon name="star" size={13} color={palette.warning} />
          <Text style={{fontSize: 11.5, color: palette.inkSoft, flex: 1}}>
            قيّمت هذا الطلب بـ {order.rating.stars} من 5
          </Text>
          <Icon name="checkCircle" size={13} color={palette.success} />
        </View>
      ) : canRate ? (
        <Pressable
          onPress={() => onRate?.(order)}
          style={({pressed}) => [
            listStyles.rateRow,
            {backgroundColor: palette.warningSoft, opacity: pressed ? 0.75 : 1},
          ]}>
          <Icon name="star" size={14} color={palette.warning} />
          <Text style={{fontSize: 12, color: palette.warning, fontFamily: fonts.bold, flex: 1}}>
            وصل طلبك؟ قيّم المتجر وساعد غيرك
          </Text>
          <Icon name="forward" size={13} color={palette.warning} />
        </Pressable>
      ) : null}

      <View style={listStyles.bottomRow}>
        <Text style={[{fontSize: 12, color: palette.muted}]}>
          {relativeTime(statusTimestamp(order))}
        </Text>
        <Text style={[{fontSize: 15, color: palette.brandDark, fontFamily: fonts.bold}]}>
          {formatMoney(order.total_minor)}
        </Text>
      </View>
    </Card>
  );
}

const listStyles = StyleSheet.create({
  topRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsRow: {flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6},
  itemChip: {borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 170},
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  ratedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
});

/* ─── ملخص مبالغ ─── */

export function OrderTotals({order}: {order: Order}) {
  const {palette} = useTheme();
  const rows: {label: string; value: string; strong?: boolean; tone?: 'success'}[] = [
    {label: 'إجمالي المنتجات', value: formatMoney(order.items_total_minor)},
    {label: `التوصيل (${order.region_name ?? '—'})`, value: formatMoney(order.delivery_fee_minor)},
    {label: 'الإجمالي مع التوصيل', value: formatMoney(order.total_minor), strong: true},
  ];
  // v2.1: وفورات خصومات المتجر على هذا الطلب (خادم 4.5)
  if ((order.items_discount_minor ?? 0) > 0) {
    rows.push({label: 'وفّرت من خصومات المتجر', value: `− ${formatMoney(order.items_discount_minor ?? 0)}`, tone: 'success'});
  }
  if (order.returned_minor > 0) {
    rows.push({label: 'المُرجَع', value: `− ${formatMoney(order.returned_minor)}`});
  }
  return (
    <View style={{gap: spacing.sm}}>
      {rows.map(r => (
        <View key={r.label} style={listStyles.bottomRow}>
          <Text
            style={[
              type.small,
              {color: r.tone === 'success' ? palette.success : r.strong ? palette.ink : palette.muted},
              r.strong ? {fontFamily: fonts.bold} : null,
            ]}>
            {r.label}
          </Text>
          <Text
            style={[
              {fontSize: 14, fontFamily: r.strong ? fonts.bold : fonts.medium},
              {color: r.tone === 'success' ? palette.success : r.strong ? palette.brandDark : palette.inkSoft},
            ]}>
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
