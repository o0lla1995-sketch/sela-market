/**
 * ProductCard.tsx — بطاقة منتج لشبكة المنتجات (عابر للمتاجر أو داخل
 * متجر): الاسم والسعر والوحدة ومتجره، قلب للمفضلة، وزر إضافة فوري
 * للسلة مع عدّاد كمية مصغّر إن كان المنتج في السلة.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../theme/tokens';
import {Icon} from './Icon';
import {QtyStepper} from './ui';
import {formatMoney, formatQty} from '../core/money';
import type {CrossProduct, Product, StoreRef} from '../core/types';
import {useCartStore} from '../stores/cartStore';
import {useWishlistStore} from '../stores/wishlistStore';
import {useToastStore} from '../stores/toastStore';

export function ProductCard({
  product,
  storeName,
  storeRef,
  onPress,
}: {
  product: CrossProduct | Product;
  storeName?: string;
  storeRef: StoreRef;
  onPress: () => void;
}) {
  const {palette} = useTheme();
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
  const displayName = storeName ?? (product as CrossProduct).store_name ?? '';

  const onAdd = () => {
    if (outOfStock) {
      toast('نفدت الكمية من المتجر حالياً', 'danger');
      return;
    }
    addProduct(storeRef, product);
    toast(`أُضيف «${product.name}» إلى سلة ${storeRef.name}`, 'success');
  };

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      {/* رأس البطاقة: الوحدة/الوزن + المفضلة */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.unitChip,
            {backgroundColor: palette.surfaceAlt, borderColor: palette.line},
          ]}>
          <Icon
            name={soldByWeight ? 'scale' : 'box'}
            size={13}
            color={palette.muted}
          />
          <Text style={[{fontSize: 10.5, color: palette.muted, fontFamily: fonts.medium}]}>
            {soldByWeight ? 'بالوزن' : (product.unit_label ?? 'قطعة')}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            const added = toggleWishlist(product, displayName);
            toast(added ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'info');
          }}
          hitSlop={10}>
          <Icon
            name={wishlisted ? 'heartFilled' : 'heart'}
            size={20}
            color={wishlisted ? palette.danger : palette.muted}
          />
        </Pressable>
      </View>

      {/* اسم المنتج + المتجر */}
      <Text style={[type.bodyMedium, {color: palette.ink}]} numberOfLines={2}>
        {product.name}
      </Text>
      {displayName ? (
        <Text style={[{fontSize: 11.5, color: palette.muted, fontFamily: fonts.medium}]} numberOfLines={1}>
          من {displayName}
        </Text>
      ) : null}

      {/* السعر + الإضافة/الكمية */}
      <View style={styles.bottomRow}>
        <View style={styles.priceCol}>
          <Text style={[styles.price, {color: palette.brandDark}]}>
            {formatMoney(product.price_minor)}
          </Text>
          {outOfStock ? (
            <Text style={[{fontSize: 11, color: palette.danger, fontFamily: fonts.medium}]}>
              نفدت الكمية
            </Text>
          ) : product.stock <= 5 ? (
            <Text style={[{fontSize: 11, color: palette.warning, fontFamily: fonts.medium}]}>
              بقي القليل
            </Text>
          ) : null}
        </View>
        {cartQty > 0 ? (
          <QtyStepper
            qty={cartQty}
            soldByWeight={soldByWeight}
            compact
            onIncrease={() => increment(storeRef.id, product.id)}
            onDecrease={() => decrement(storeRef.id, product.id)}
          />
        ) : (
          <Pressable
            onPress={onAdd}
            disabled={outOfStock}
            style={[
              styles.addBtn,
              {backgroundColor: outOfStock ? palette.line : palette.brand},
            ]}>
            <Icon name="plus" size={17} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
    minHeight: 150,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  priceCol: {gap: 1, alignItems: 'flex-start'},
  price: {fontSize: 16.5, fontFamily: fonts.bold},
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
