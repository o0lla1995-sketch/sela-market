/**
 * WishlistScreen.tsx — المفضلة: المنتجات المحفوظة مع متاجرها، إضافة
 * مباشرة للسلة، وإزالة. تُحفظ محلياً وتظل بعد إغلاق التطبيق.
 * ─────────────────────────────────────────────────────────────────
 * v2.7: تنظيف المنتجات التي لم تعد موجودة — شكوى التاجر بالنص:
 * «اذا اضاف المستخدم منتج الي المفضلة وقد تم إزالة المنتج ولم
 * يعد موجود يبقي ظاهر بقائمة المفضلة».
 *  • عند الفتح: العناصر التي تجاوز تحقيقها ٢٤ ساعة تُفحص مقابل
 *    كتالوج متجرها الحي (نداء واحد لكل متجر مختلف — لا لكل منتج).
 *  • المنتج الغائب عن الكتالوج يُحذف فوراً + إشعار لطيف.
 *  • فشل جلب متجر (شبكة) لا يحذف شيئاً — انقطاع ≠ حذف.
 */
import React, {useEffect, useRef, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, Button, Card, EmptyState, Screen} from '../../components/ui';
import {formatMoney} from '../../core/money';
import {getStoreProducts} from '../../api/endpoints';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useCartStore} from '../../stores/cartStore';
import {useToastStore} from '../../stores/toastStore';
import {StoreAvatar} from '../../components/StoreCard';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';
import type {Product} from '../../core/types';

type Props = NativeStackScreenProps<ShopStackParamList, 'Wishlist'>;

/** سقف الصفحات عند جلب كتالوج للتحقق (40×5 = 200 منتج كحد أمان). */
const VERIFY_PAGE_CAP = 5;
const VERIFY_PAGE_PER = 40;

/**
 * يجلب معرفات منتجات متجر متاحة حالياً (صفحات كاملة) — يعيد null
 * عند فشل الجلب (شبكة/متجر مخفي) كي لا يُحذف شيء ظلماً.
 */
async function fetchAvailableIds(storeId: number): Promise<Set<number> | null> {
  const ids = new Set<number>();
  try {
    for (let page = 1; page <= VERIFY_PAGE_CAP; page += 1) {
      const list = await getStoreProducts(storeId, {per: VERIFY_PAGE_PER, page});
      for (const p of list) {
        ids.add(p.id);
      }
      if (list.length < VERIFY_PAGE_PER) {
        break;
      }
    }
    return ids;
  } catch {
    return null;
  }
}

export function WishlistScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* v2.6: هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل
   * فروع JSX شرطية كان يغيّر عدد الـ hooks بين الرندرات ويحطم
   * الشاشة (Rendered more hooks). */
  const stackClearance = useStackBottomClearance();
  const items = useWishlistStore(s => s.items);
  const remove = useWishlistStore(s => s.remove);
  const prune = useWishlistStore(s => s.prune);
  const markVerified = useWishlistStore(s => s.markVerified);
  const staleIds = useWishlistStore(s => s.staleIds);
  const addProduct = useCartStore(s => s.addProduct);
  const toast = useToastStore(s => s.show);
  const [verifying, setVerifying] = useState(false);
  const verifyRan = useRef(false);

  const list = Object.values(items).sort((a, b) => b.savedAt - a.savedAt);

  /* v2.7: تحقيق العناصر المنتهية (24س) مقابل الكتالوج الحي — مرة
   * واحدة لكل فتح، بلا منافسة مع التنقل السريع (ref guard). */
  useEffect(() => {
    if (verifyRan.current) {
      return;
    }
    verifyRan.current = true;
    const stale = staleIds();
    if (stale.length === 0) {
      return;
    }
    setVerifying(true);
    void (async () => {
      try {
        // تجميع المعرفات المنتهية حسب متجرها — نداء واحد لكل متجر.
        const byStore = new Map<number, number[]>();
        for (const id of stale) {
          const entry = items[String(id)];
          if (entry == null) {
            continue;
          }
          const storeId = entry.product.store_id;
          const bucket = byStore.get(storeId) ?? [];
          bucket.push(id);
          byStore.set(storeId, bucket);
        }
        let removedCount = 0;
        for (const [storeId, ids] of byStore) {
          const available = await fetchAvailableIds(storeId);
          if (available == null) {
            continue; // فشل جلب — لا نحذف (انقطاع ≠ حذف).
          }
          const gone: number[] = [];
          const kept: number[] = [];
          for (const id of ids) {
            if (available.has(id)) {
              kept.push(id);
            } else {
              gone.push(id);
            }
          }
          if (gone.length > 0) {
            removedCount += prune(gone);
          }
          if (kept.length > 0) {
            markVerified(kept);
          }
        }
        if (removedCount > 0) {
          toast(
            `نُظّفت مفضلتك: أُزيل ${removedCount} ${removedCount === 1 ? 'منتج' : 'منتجات'} لم ${
              removedCount === 1 ? 'يعد متوفراً' : 'تعد متوفرة'
            } لدى متاجرها`,
            'info',
          );
        }
      } finally {
        setVerifying(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <AppHeader
        title="المفضلة"
        subtitle={
          verifying
            ? 'جارٍ التحقق من توفر منتجاتك…'
            : list.length > 0
              ? `${list.length} منتجاً محفوظاً`
              : undefined
        }
        onBack={() => navigation.goBack()}
        big
      />
      {list.length === 0 ? (
        <EmptyState
          icon="heart"
          title="لا شيء في المفضلة بعد"
          body="اضغط القلب على أي منتج لحفظه هنا والعودة إليه لاحقاً — تُحفظ مفضلتك على جهازك، ويتحقق التطبيق دورياً من استمرار توفر منتجاتها"
          actionLabel="تصفح المنتجات"
          onAction={() => navigation.getParent()?.navigate('Shop')}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={entry => String(entry.product.id)}
          contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: stackClearance}}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => {
            const p = item.product;
            const outOfStock = p.stock <= 0;
            const image = (p.images ?? [])[0];
            return (
              <Card style={{gap: spacing.md}}>
                <View style={wishStyles.row}>
                  <StoreAvatar name={item.storeName || 'س'} size={42} logoUrl={image ?? null} />
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
