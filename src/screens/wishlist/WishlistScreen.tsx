/**
 * WishlistScreen.tsx — المفضلة: المنتجات المحفوظة مع متاجرها، إضافة
 * مباشرة للسلة، وإزالة. تُحفظ محلياً وتظل بعد إغلاق التطبيق.
 */
import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, Button, Card, EmptyState, Screen} from '../../components/ui';
import {formatMoney} from '../../core/money';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useCartStore} from '../../stores/cartStore';
import {useToastStore} from '../../stores/toastStore';
import {StoreAvatar} from '../../components/StoreCard';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<ShopStackParamList, 'Wishlist'>;

export function WishlistScreen({navigation}: Props) {
  const {palette} = useTheme();
  const items = useWishlistStore(s => s.items);
  const remove = useWishlistStore(s => s.remove);
  const addProduct = useCartStore(s => s.addProduct);
  const toast = useToastStore(s => s.show);
  const list = Object.values(items).sort((a, b) => b.savedAt - a.savedAt);

  return (
    <Screen>
      <AppHeader
        title="المفضلة"
        subtitle={list.length > 0 ? `${list.length} منتجاً محفوظاً` : undefined}
        onBack={() => navigation.goBack()}
        big
      />
      {list.length === 0 ? (
        <EmptyState
          icon="heart"
          title="لا شيء في المفضلة بعد"
          body="اضغط القلب على أي منتج لحفظه هنا والعودة إليه لاحقاً — تُحفظ مفضلتك على جهازك"
          actionLabel="تصفح المنتجات"
          onAction={() => navigation.getParent()?.navigate('Shop')}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={entry => String(entry.product.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: useStackBottomClearance()}}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => {
            const p = item.product;
            const outOfStock = p.stock <= 0;
            return (
              <Card style={{gap: spacing.md}}>
                <View style={wishStyles.row}>
                  <StoreAvatar name={item.storeName || 'س'} size={42} />
                  <View style={{flex: 1, gap: 3, alignItems: 'flex-start'}}>
                    <Text style={[type.bodyMedium, {color: palette.ink}]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={[{fontSize: 11.5, color: palette.muted}]} numberOfLines={1}>
                      {item.storeName} · {formatMoney(p.price_minor)}
                    </Text>
                  </View>
                  <Pressable onPress={() => remove(p.id)} hitSlop={10}>
                    <Icon name="heartFilled" size={20} color={palette.danger} />
                  </Pressable>
                </View>
                <View style={{flexDirection: 'row-reverse', gap: spacing.md}}>
                  <Button
                    label={outOfStock ? 'نفدت الكمية' : 'إضافة للسلة'}
                    small
                    icon="cart"
                    style={{flex: 1}}
                    disabled={outOfStock}
                    onPress={() => {
                      if ((p.options ?? []).length > 0) {
                        // منتج بخيارات — يُختار المقاس/اللون في صفحته.
                        navigation.navigate('Product', {
                          product: p,
                          storeRef: {id: p.store_id, name: item.storeName},
                        });
                        toast('اختر المواصفة أولاً في صفحة المنتج', 'info');
                        return;
                      }
                      addProduct(
                        {id: p.store_id, name: item.storeName},
                        p,
                      );
                      toast(`أُضيف «${p.name}» إلى سلة ${item.storeName}`, 'success');
                    }}
                  />
                  <Button
                    label="المنتج"
                    variant="outline"
                    small
                    style={{flex: 1}}
                    onPress={() =>
                      navigation.navigate('Product', {
                        product: p,
                        storeRef: {id: p.store_id, name: item.storeName},
                      })
                    }
                  />
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const wishStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
});
