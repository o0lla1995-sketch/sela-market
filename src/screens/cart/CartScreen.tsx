/**
 * CartScreen.tsx — السلة المجمّعة: مجموعة لكل متجر (سلة مستقلة =
 * طلب مستقل) مع أسعارها الجزئية وأزرار «إتمام طلب هذا المتجر».
 * بوابة الدخول للزائر تُفتح من هنا عند إتمام الطلب.
 */
import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  BottomFixed,
  Button,
  EmptyState,
  QtyStepper,
  Screen,
} from '../../components/ui';
import {formatMoney, formatQty, lineTotal} from '../../core/money';
import {cartSavings, lineSavings} from '../../core/discount';
import {useCartStore} from '../../stores/cartStore';
import {useToastStore} from '../../stores/toastStore';
import {StoreAvatar} from '../../components/StoreCard';
import type {CartStoreEntry} from '../../core/types';
import type {CartStackParamList} from '../../navigation/RootNavigator';
import {useTabBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<CartStackParamList, 'Cart'>;

export function CartScreen({navigation}: Props) {
  const {palette} = useTheme();
  const carts = useCartStore(s => s.carts);
  const clearStore = useCartStore(s => s.clearStore);
  const clearAll = useCartStore(s => s.clearAll);
  const increment = useCartStore(s => s.increment);
  const decrement = useCartStore(s => s.decrement);
  const removeLine = useCartStore(s => s.removeLine);
  const toast = useToastStore(s => s.show);

  const entries = Object.values(carts).sort((a, b) => b.updatedAt - a.updatedAt);
  const grandCount = entries.reduce(
    (sum, e) => sum + e.lines.reduce((s, l) => s + l.quantity, 0),
    0,
  );

  return (
    <Screen>
      <AppHeader
        title="سلة التسوق"
        subtitle={
          entries.length === 0
            ? 'سلتك فارغة'
            : `${entries.length} متجراً · ${Math.floor(grandCount)} قطعة/كيلو`
        }
        big
      />

      {entries.length === 0 ? (
        <EmptyState
          icon="emptyBag"
          title="سلتك فارغة"
          body="ابدأ التسوق من الرئيسية أو المتاجر — كل ما تضيفه ينتظرك هنا مقسّماً حسب متجره"
          actionLabel="ابدأ التسوق"
          onAction={() => navigation.getParent()?.navigate('Shop')}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => String(e.storeId)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: useTabBottomClearance() + 40}}
          showsVerticalScrollIndicator={false}
          renderItem={({item: entry}) => (
            <StoreCart
              entry={entry}
              palette={palette}
              onOpenStore={() =>
                navigation.getParent()?.navigate('Stores', {
                  screen: 'Store',
                  params: {storeId: entry.storeId, storeName: entry.storeName},
                })
              }
              onCheckout={() => navigation.navigate('Checkout', {storeId: entry.storeId})}
              onClear={() => {
                clearStore(entry.storeId);
                toast(`أُفرغت سلة ${entry.storeName}`, 'info');
              }}
              onIncrease={(lineKey) => increment(entry.storeId, lineKey)}
              onDecrease={(lineKey) => decrement(entry.storeId, lineKey)}
              onRemove={(lineKey) => removeLine(entry.storeId, lineKey)}
            />
          )}
          ListFooterComponent={
            entries.length > 1 ? (
              <Pressable onPress={clearAll} hitSlop={8} style={{alignItems: 'center', padding: spacing.md}}>
                <Text style={[{fontSize: 12.5, color: palette.danger}]}>
                  إفراغ كل السلال ({entries.length})
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}

      {/* شريط إجمالي عام — ينقل لآخر متجر نشط */}
      {entries.length > 0 ? (
        <BottomFixed>
          <Button
            label={`إتمام طلب آخر متجر — ${entries[0].storeName}`}
            icon="cash"
            onPress={() => navigation.navigate('Checkout', {storeId: entries[0].storeId})}
          />
          <Text
            style={[
              {fontSize: 11, color: palette.muted, textAlign: 'center', marginTop: 8},
            ]}>
            لكل متجر طلب ورسم توصيل خاصان به — أكملها واحداً تلو الآخر
          </Text>
        </BottomFixed>
      ) : null}
    </Screen>
  );
}

function StoreCart({
  entry,
  palette,
  onOpenStore,
  onCheckout,
  onClear,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  entry: CartStoreEntry;
  palette: ReturnType<typeof useTheme>['palette'];
  onOpenStore: () => void;
  onCheckout: () => void;
  onClear: () => void;
  onIncrease: (lineKey: string) => void;
  onDecrease: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
}) {
  const subtotal = entry.lines.reduce((s, l) => s + lineTotal(l.priceMinor, l.quantity), 0);

  return (
    <View
      style={[
        cartStyles.group,
        {backgroundColor: palette.surface, borderColor: palette.line},
      ]}>
      {/* رأس المجموعة */}
      <View style={cartStyles.groupHead}>
        <Pressable onPress={onOpenStore} style={cartStyles.storeRow} hitSlop={6}>
          <StoreAvatar name={entry.storeName} logoUrl={entry.storeLogoUrl} size={40} />
          <View style={{gap: 1, alignItems: 'flex-start'}}>
            <Text style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]} numberOfLines={1}>
              {entry.storeName}
            </Text>
            <Text style={[{fontSize: 10.5, color: palette.muted}]}>
              {entry.lines.length} منتجاً · {entry.storeNumber}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={onClear} hitSlop={8}>
          <Icon name="trash" size={17} color={palette.danger} />
        </Pressable>
      </View>

      {/* الأسطر */}
      {entry.lines.map(line => (
        <View key={line.key} style={cartStyles.line}>
          <View style={{flex: 1, gap: 3, alignItems: 'flex-start'}}>
            <Text style={[type.smallMedium, {color: palette.ink}]} numberOfLines={2}>
              {line.name}
            </Text>
            {line.variant != null ? (
              <View style={[cartStyles.variantChip, {backgroundColor: palette.brandSoft}]}>
                <Icon name="sliders" size={10} color={palette.brandDark} />
                <Text
                  style={{fontSize: 10.5, color: palette.brandDark, fontFamily: fonts.medium}}
                  numberOfLines={1}>
                  {line.variant}
                </Text>
              </View>
            ) : null}
            <Text style={[{fontSize: 11.5, color: palette.muted}]}>
              {line.listPriceMinor != null && line.listPriceMinor > line.priceMinor ? (
                <Text style={{textDecorationLine: 'line-through'}}>
                  {formatMoney(line.listPriceMinor)}{' '}
                </Text>
              ) : null}
              {formatMoney(line.priceMinor)} × {formatQty(line.quantity, line.soldByWeight)}
              {line.soldByWeight ? ' كيلو' : line.unitLabel ? ` ${line.unitLabel}` : ''} ={' '}
              <Text style={{color: palette.brandDark, fontFamily: fonts.bold}}>
                {formatMoney(lineTotal(line.priceMinor, line.quantity))}
              </Text>
            </Text>
            {lineSavings(line) > 0 ? (
              <Text style={{fontSize: 10, color: palette.success, fontFamily: fonts.medium}}>
                وفّرت {formatMoney(lineSavings(line))} بخصم هذا المنتج
              </Text>
            ) : null}
          </View>
          <View style={{alignItems: 'center', gap: 6}}>
            <QtyStepper
              qty={line.quantity}
              soldByWeight={line.soldByWeight}
              compact
              onIncrease={() => onIncrease(line.key)}
              onDecrease={() => onDecrease(line.key)}
            />
            <Pressable onPress={() => onRemove(line.key)} hitSlop={6}>
              <Text style={[{fontSize: 10.5, color: palette.danger}]}>إزالة</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* تذييل المجموعة */}
      <View style={[cartStyles.groupFoot, {borderTopColor: palette.line}]}>
        <View style={{gap: 1, alignItems: 'flex-start'}}>
          {cartSavings(entry.lines) > 0 ? (
            <Text style={{fontSize: 10.5, color: palette.success, fontFamily: fonts.medium}}>
              وفّرت {formatMoney(cartSavings(entry.lines))} من خصومات هذا المتجر
            </Text>
          ) : null}
          <Text style={[{fontSize: 11, color: palette.muted}]}>إجمالي المنتجات</Text>
          <Text style={[{fontSize: 17, color: palette.brandDark, fontFamily: fonts.bold}]}>
            {formatMoney(subtotal)}
          </Text>
        </View>
        <Button label="إتمام طلب المتجر" small icon="cash" onPress={onCheckout} />
      </View>
    </View>
  );
}

const cartStyles = StyleSheet.create({
  group: {borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden'},
  groupHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  storeRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, flex: 1},
  line: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
  },
  variantChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  groupFoot: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    padding: spacing.md,
  },
});
