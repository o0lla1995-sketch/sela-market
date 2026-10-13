/**
 * OrderSuccessScreen.tsx — تأكيد نجاح الطلب: رقم الطلب بارز، الحالة
 * الأولى، ملخص سريع، وأزرار متابعة التتبع أو مواصلة التسوق.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {Button, Card, Screen} from '../../components/ui';
import {formatMoney} from '../../core/money';
import type {CartStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<CartStackParamList, 'OrderSuccess'>;

export function OrderSuccessScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const {order} = route.params;

  return (
    <Screen style={{paddingBottom: insets.bottom}}>
      <View style={styles.wrap}>
        <View style={[styles.heroIcon, {backgroundColor: palette.successSoft, borderColor: palette.success}]}>
          <Icon name="checkCircle" size={54} color={palette.success} />
        </View>
        <Text style={[type.h1, {color: palette.ink, textAlign: 'center'}]}>
          وصل طلبك إلى المتجر
        </Text>
        <Text
          style={[type.body, {color: palette.muted, textAlign: 'center', lineHeight: 24}]}>
          سيتولى {order.store?.name ?? 'المتجر'} مراجعة طلبك خلال دقائق عادة،
          وسنُعلمك عند قبوله وإرساله. الدفع نقداً عند الاستلام.
        </Text>

        <Card style={{gap: spacing.md, width: '100%'}}>
          <View style={styles.numRow}>
            <Text style={[type.small, {color: palette.muted}]}>رقم الطلب</Text>
            <Text style={[{fontSize: 15, color: palette.ink, fontFamily: fonts.bold}]}>
              {order.order_number}
            </Text>
          </View>
          <View style={styles.numRow}>
            <Text style={[type.small, {color: palette.muted}]}>الإجمالي مع التوصيل</Text>
            <Text style={[{fontSize: 15, color: palette.brandDark, fontFamily: fonts.bold}]}>
              {formatMoney(order.total_minor)}
            </Text>
          </View>
          <View style={styles.numRow}>
            <Text style={[type.small, {color: palette.muted}]}>منطقة التوصيل</Text>
            <Text style={[{fontSize: 13.5, color: palette.ink}]}>
              {order.region_name ?? '—'}
            </Text>
          </View>
        </Card>

        <View style={{gap: spacing.md, width: '100%'}}>
          <Button
            label="تتبّع الطلب"
            icon="receipt"
            onPress={() => {
              /* v3.1 (الجولة 61): السلة كانت تُستبدل بهذه الشاشة، فتبقى
               * «نجاح عالق» أعلى تبويب السلة كلما عاد إليه المستخدم.
               * الآن: يُعاد مكدس السلة إلى السلة نفسها ثم ننتقل للتتبع. */
              const parent = navigation.getParent();
              navigation.reset({index: 0, routes: [{name: 'Cart'}]});
              parent?.navigate('Orders', {
                screen: 'OrderDetail',
                params: {orderId: order.id, order},
              });
            }}
          />
          <Button
            label="مواصلة التسوق"
            variant="outline"
            icon="store"
            onPress={() => {
              const parent = navigation.getParent();
              navigation.reset({index: 0, routes: [{name: 'Cart'}]});
              parent?.navigate('Shop');
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  heroIcon: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  numRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
