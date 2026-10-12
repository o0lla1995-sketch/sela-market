/**
 * RatingSheet.tsx — تقييم المتجر عند استلام الطلب (v2.0 — خادم 4.4).
 * ─────────────────────────────────────────────────────────────────
 * نافذة سفلية أنيقة: عنوان المتجر + نجوم قابلة للمس (1–5 بحركة
 * تكبير) + تعليق اختياري + إرسال. بعد الإرسال: شكر بحركة + متوسط
 * المتجر الجديد — إغلاق تلقائي. تُفتح من «طلباتي» وصفحة الطلب
 * للطلبات المسلّمة غير المقيّمة.
 */
import React, {useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../theme/tokens';
import {Icon} from './Icon';
import {Button} from './ui';
import {rateOrder} from '../api/endpoints';
import {ApiError} from '../api/client';
import {useAuthStore} from '../stores/authStore';
import {useToastStore} from '../stores/toastStore';

/* ─── عرض النجوم (للعرض فقط داخل البطاقات) ─── */

export function Stars({
  rating,
  count,
  size = 13,
  compact = false,
}: {
  rating: number | null | undefined;
  count?: number;
  size?: number;
  /** compact = نجمة + رقم فقط (بطاقات المتاجر). */
  compact?: boolean;
}) {
  const {palette} = useTheme();
  if (rating == null || rating <= 0) {
    return null;
  }
  const rounded = Math.round(rating * 2) / 2;
  return (
    <View style={starsStyles.wrap}>
      <Icon name="star" size={size} color={palette.warning} />
      <Text style={[{fontSize: size - 1.5, color: palette.ink, fontFamily: fonts.bold}]}>
        {rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}
      </Text>
      {!compact && count != null && count > 0 ? (
        <Text style={{fontSize: size - 2.5, color: palette.muted}}>({count})</Text>
      ) : null}
    </View>
  );
}

const starsStyles = StyleSheet.create({
  wrap: {flexDirection: 'row-reverse', alignItems: 'center', gap: 3},
});

/* ─── منتقي النجوم التفاعلي ─── */

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const {palette} = useTheme();
  return (
    <View style={pickerStyles.row}>
      {[1, 2, 3, 4, 5].map(n => {
        const active = n <= value;
        const big = n === value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            hitSlop={6}
            style={({pressed}) => [
              pickerStyles.cell,
              {
                transform: [{scale: pressed ? 1.25 : big ? 1.12 : 1}],
              },
            ]}>
            <Icon
              name="star"
              size={big ? 40 : 36}
              color={active ? palette.warning : palette.lineStrong}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', justifyContent: 'center', gap: spacing.sm},
  cell: {padding: 4},
});

const RATING_LABELS: Record<number, string> = {
  0: 'اضغط على النجوم للتقييم',
  1: 'سيئ جداً',
  2: 'سيئ',
  3: 'جيد',
  4: 'جيد جداً',
  5: 'ممتاز!',
};

/* ─── النافذة الكاملة ─── */

export function RatingSheet({
  visible,
  onClose,
  orderId,
  storeName,
  onRated,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  storeName: string;
  /** تُستدعى بعد نجاح التقييم مع النجوم المُرسلة. */
  onRated?: (stars: number) => void;
}) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuthStore(s => s.token);
  const toast = useToastStore(s => s.show);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{stars: number; avg: number | null} | null>(null);

  const close = () => {
    if (sending) {
      return;
    }
    onClose();
    // تصفير بعد إغلاق النافذة (بلا وميض).
    setTimeout(() => {
      setStars(0);
      setComment('');
      setDone(null);
    }, 250);
  };

  const submit = async () => {
    if (stars < 1 || token == null || sending) {
      return;
    }
    setSending(true);
    try {
      const res = await rateOrder(token, orderId, {
        stars,
        comment: comment.trim() || undefined,
      });
      setDone({stars, avg: res.storeRating.rating});
      onRated?.(stars);
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : 'تعذر إرسال التقييم — حاول مجدداً',
        'danger',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent>
      <Pressable style={sheetStyles.backdrop} onPress={close}>
        <Pressable
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: palette.surface,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
          onPress={() => undefined}>
          <View style={[sheetStyles.grab, {backgroundColor: palette.lineStrong}]} />

          {done != null ? (
            <View style={sheetStyles.doneWrap}>
              <View style={[sheetStyles.doneCircle, {backgroundColor: palette.successSoft}]}>
                <Icon name="checkCircle" size={44} color={palette.success} />
              </View>
              <Text style={[type.h2, {color: palette.ink, textAlign: 'center'}]}>
                شكراً لتقييمك!
              </Text>
              <View style={starsStyles.wrap}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Icon
                    key={n}
                    name="star"
                    size={22}
                    color={n <= done.stars ? palette.warning : palette.lineStrong}
                  />
                ))}
              </View>
              {done.avg != null ? (
                <Text style={[type.small, {color: palette.muted, textAlign: 'center'}]}>
                  تقييم «{storeName}» الآن {done.avg} من 5
                </Text>
              ) : null}
              <Button label="إغلاق" variant="soft" onPress={close} />
            </View>
          ) : (
            <View style={sheetStyles.body}>
              <Text style={[type.h2, {color: palette.ink, textAlign: 'center'}]}>
                كيف كانت تجربتك؟
              </Text>
              <Text
                style={[type.small, {color: palette.muted, textAlign: 'center'}]}
                numberOfLines={1}>
                طلبك من «{storeName}» — رأيك يساعد بقية المتسوقين
              </Text>

              <StarPicker value={stars} onChange={setStars} />
              <Text
                style={[
                  {fontSize: 13.5, fontFamily: fonts.bold, color: stars > 0 ? palette.brandDark : palette.muted},
                  {textAlign: 'center'},
                ]}>
                {RATING_LABELS[stars] ?? RATING_LABELS[0]}
              </Text>

              <View
                style={[
                  sheetStyles.commentBox,
                  {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
                ]}>
                <Text style={{fontSize: 11, color: palette.muted, textAlign: 'right'}}>
                  تعليق اختياري (يظهر في مراجعات المتجر باسمك الأول فقط)
                </Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="مثال: طلبي وصل سريعاً وبحالة ممتازة…"
                  placeholderTextColor={palette.muted}
                  maxLength={300}
                  multiline
                  textAlign="right"
                  style={[
                    type.small,
                    {
                      color: palette.ink,
                      textAlign: 'right',
                      paddingTop: spacing.xs,
                      minHeight: 56,
                    },
                  ]}
                />
              </View>

              <Button
                label={sending ? 'جارٍ الإرسال…' : 'إرسال التقييم'}
                icon="star"
                onPress={submit}
                loading={sending}
                disabled={stars < 1}
              />
              <Button label="لاحقاً" variant="ghost" onPress={close} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopRightRadius: radius.xl,
    borderTopLeftRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    marginTop: spacing.xs,
  },
  body: {gap: spacing.md, paddingTop: spacing.sm},
  doneWrap: {gap: spacing.lg, alignItems: 'center', paddingVertical: spacing.xl},
  doneCircle: {
    width: 84,
    height: 84,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 96,
  },
});
