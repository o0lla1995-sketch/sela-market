/**
 * ProductScreen.tsx — صفحة المنتج: بطاقة سعر كبيرة، الوحدة/الوزن،
 * المخزون، المتجر وانتقال إليه، عدّاد كمية مريح، إضافة للسلة
 * والمفضلة. المنتجات بالوزن تزيد بنصف كيلو.
 */
import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts, toneColors} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, BottomFixed, Button, Card, QtyStepper, Screen} from '../../components/ui';
import {formatMoney} from '../../core/money';
import {useCartStore} from '../../stores/cartStore';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useToastStore} from '../../stores/toastStore';
import {StoreAvatar} from '../../components/StoreCard';
import type {ShopStackParamList} from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<ShopStackParamList, 'Product'>;

export function ProductScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const {product, storeRef} = route.params;

  const addProduct = useCartStore(s => s.addProduct);
  const increment = useCartStore(s => s.increment);
  const decrement = useCartStore(s => s.decrement);
  const cartQty = useCartStore(
    s => s.carts[String(storeRef.id)]?.lines.find(l => l.productId === product.id)?.quantity ?? 0,
  );
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);
  const toast = useToastStore(s => s.show);

  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;

  const onAdd = () => {
    if (outOfStock) {
      toast('نفدت الكمية من المتجر حالياً', 'danger');
      return;
    }
    addProduct(storeRef, product);
    toast(`أُضيف «${product.name}» إلى سلة ${storeRef.name}`, 'success');
  };

  return (
    <Screen>
      <AppHeader
        title={product.name}
        subtitle={`من ${storeRef.name}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} showsVerticalScrollIndicator={false}>
        {/* بطاقة السعر */}
        <Card style={{gap: spacing.md}}>
          <View style={priceStyles.row}>
            <View style={{gap: 2, flex: 1, alignItems: 'flex-start'}}>
              <Text style={[type.small, {color: palette.muted}]}>السعر</Text>
              <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
                {formatMoney(product.price_minor)}
              </Text>
              <Text style={[{fontSize: 12, color: palette.muted}]}>
                {soldByWeight
                  ? `لكل ${product.unit_label ?? 'كيلو'} (يُطلب بأنصاف الكيلو)`
                  : product.unit_label
                    ? `لكل ${product.unit_label}`
                    : 'للقطعة'}
              </Text>
            </View>
            <View
              style={[
                priceStyles.bigIcon,
                {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder},
              ]}>
              <Icon
                name={soldByWeight ? 'scale' : 'box'}
                size={34}
                color={palette.brandDark}
              />
            </View>
          </View>

          {/* حالة المخزون */}
          <View
            style={[
              priceStyles.stockRow,
              outOfStock
                ? {backgroundColor: palette.dangerSoft, borderColor: palette.danger}
                : lowStock
                  ? {backgroundColor: palette.warningSoft, borderColor: palette.warning}
                  : {backgroundColor: palette.successSoft, borderColor: palette.success},
            ]}>
            <Icon
              name={outOfStock ? 'xCircle' : lowStock ? 'warning' : 'checkCircle'}
              size={16}
              color={outOfStock ? palette.danger : lowStock ? palette.warning : palette.success}
            />
            <Text
              style={[
                {fontSize: 12.5, fontFamily: fonts.medium},
                {color: outOfStock ? palette.danger : lowStock ? palette.warning : palette.success},
              ]}>
              {outOfStock
                ? 'نفدت الكمية حالياً — جرّب متجراً آخر أو عد لاحقاً'
                : lowStock
                  ? `بقي القليل (${product.stock}${soldByWeight ? ' كيلو' : ' قطعة'} تقريباً)`
                  : `متوفر (${Math.floor(product.stock)}${soldByWeight ? ' كيلو' : ' قطعة'} تقريباً)`}
            </Text>
          </View>

          {/* التصنيف */}
          {product.category ? (
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name="tag" size={14} color={palette.muted} />
              <Text style={[{fontSize: 12.5, color: palette.muted}]}>{product.category}</Text>
            </View>
          ) : null}
        </Card>

        {/* الوصف */}
        {product.description ? (
          <Card style={{gap: spacing.sm}}>
            <Text style={[type.h3, {color: palette.ink}]}>عن المنتج</Text>
            <Text style={[type.small, {color: palette.inkSoft, lineHeight: 22}]}>
              {product.description}
            </Text>
          </Card>
        ) : null}

        {/* المتجر */}
        <Pressable onPress={() => navigation.navigate('Store', {storeId: storeRef.id, storeName: storeRef.name})}>
          <Card style={{gap: spacing.md}}>
            <View style={priceStyles.row}>
              <StoreAvatar name={storeRef.name} size={52} />
              <View style={{flex: 1, gap: 2, alignItems: 'flex-start'}}>
                <Text style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]}>
                  {storeRef.name}
                </Text>
                {storeRef.storeNumber ? (
                  <Text style={[{fontSize: 11.5, color: palette.muted}]}>{storeRef.storeNumber}</Text>
                ) : null}
              </View>
              <Icon name="forward" size={18} color={palette.muted} />
            </View>
            <Text style={[{fontSize: 12, color: palette.muted}]}>
              اضغط لزيارة المتجر وتصفح كل منتجاته ومناطق توصيله
            </Text>
          </Card>
        </Pressable>

        {/* المفضلة */}
        <Button
          label={wishlisted ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
          variant={wishlisted ? 'soft' : 'outline'}
          icon={wishlisted ? 'heartFilled' : 'heart'}
          onPress={() => {
            const added = toggleWishlist(product, storeRef.name);
            toast(added ? 'حُفظ في المفضلة' : 'أُزيل من المفضلة', 'info');
          }}
        />
      </ScrollView>

      {/* شريط الإضافة السفلي */}
      <BottomFixed>
        {cartQty > 0 ? (
          <View style={bottomStyles.row}>
            <QtyStepper
              qty={cartQty}
              soldByWeight={soldByWeight}
              onIncrease={() => increment(storeRef.id, product.id)}
              onDecrease={() => decrement(storeRef.id, product.id)}
            />
            <Button
              label={`في السلة — ${formatMoney(product.price_minor * cartQty)}`}
              variant="soft"
              style={{flex: 1}}
              onPress={() => navigation.getParent()?.navigate('Cart')}
            />
          </View>
        ) : (
          <Button
            label={outOfStock ? 'غير متوفر حالياً' : 'إضافة إلى السلة'}
            icon="cart"
            onPress={onAdd}
            disabled={outOfStock}
          />
        )}
      </BottomFixed>
    </Screen>
  );
}

const priceStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
  amount: {fontSize: 30, fontFamily: fonts.black},
  bigIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
});

const bottomStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
});
