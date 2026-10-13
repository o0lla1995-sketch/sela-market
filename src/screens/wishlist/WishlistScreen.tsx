/**
 * WishlistScreen.tsx — المفضلة: المنتجات المحفوظة مع متاجرها والقفز
 * لصفحة المنتج للطلب. تُحفظ محلياً وتظل بعد إغلاق التطبيق.
 * ─────────────────────────────────────────────────────────────────
 * v3.1 (الجولة 61): تنظيف فوري بنداء واحد — طلب التاجر بالنص:
 * «كما يختفي المنتج عند إلغاء تفعيله وظهوره في المتجر أن يختفي
 * من قائمة المفضلة ولا يبقى محفوظاً».
 *  • عند الفتح: نداء واحد (/products/availability) بكل المعرفات
 *    (≤60) يُعيد المتاح — المحذوف/المعطّل يُحذف فوراً بإشعار.
 *  • الجولة السابقة كانت تنتظر ٢٤ ساعة ثم تجلب كتالوج كل متجر
 *    صفحات كاملة (حتى 200 منتج لكل متجر) — بطيء ومكلف.
 *  • فشل النداء (شبكة) لا يحذف شيئاً — انقطاع ≠ منتج مسحوب.
 *  • throttle داخلي 60 ثانية: فتح المفضلة مرات متتالية لا يكرر
 *    النداء.
 */
import React, {useEffect, useRef, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {AppHeader, Button, Card, EmptyState, Screen} from '../../components/ui';
import {formatMoney} from '../../core/money';
import {absoluteUrl} from '../../api/client';
import {checkProductsAvailability} from '../../api/endpoints';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useToastStore} from '../../stores/toastStore';
import type {ShopStackParamList} from '../../navigation/RootNavigator';
import {useStackBottomClearance} from '../../core/layout';
import type {Product} from '../../core/types';

type Props = NativeStackScreenProps<ShopStackParamList, 'Wishlist'>;

/** أقل فاصل بين فحصين (ملي ثانية) — فتح متتالي لا يكرر النداء. */
const VERIFY_THROTTLE_MS = 60 * 1000;

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
  const toast = useToastStore(s => s.show);
  const [verifying, setVerifying] = useState(false);
  const verifyRan = useRef(false);
  const lastVerifyAt = useRef(0);

  const list = Object.values(items).sort((a, b) => b.savedAt - a.savedAt);

  /* v3.1: فحص فوري بنداء واحد — كل المعرفات دفعة واحدة، والمغيب
   * عن الرد يُشطب من المفضلة في الحال (سُحب أو عُطّل من التاجر). */
  useEffect(() => {
    if (verifyRan.current) {
      return;
    }
    verifyRan.current = true;
    const ids = Object.keys(items).map(Number);
    if (ids.length === 0) {
      return;
    }
    if (Date.now() - lastVerifyAt.current < VERIFY_THROTTLE_MS) {
      return;
    }
    lastVerifyAt.current = Date.now();
    setVerifying(true);
    void (async () => {
      try {
        const available = await checkProductsAvailability(ids);
        const availableSet = new Set(available);
        const gone = ids.filter(id => !availableSet.has(id));
        const kept = ids.filter(id => availableSet.has(id));
        if (gone.length > 0) {
          const removedCount = prune(gone);
          if (removedCount > 0) {
            toast(
              `أُزيل ${removedCount} ${removedCount === 1 ? 'منتج لم يعد متوفراً' : 'منتجات لم تعد متوفرة'} من مفضلتك`,
              'info',
            );
          }
        }
        if (kept.length > 0) {
          markVerified(kept);
        }
      } catch {
        /* شبكة — لا نحذف شيئاً (انقطاع ≠ منتج مسحوب) */
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
          body="اضغط القلب على أي منتج لحفظه هنا — ويتحقق التطبيق من استمرار توفرها تلقائياً"
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
            const image = absoluteUrl((p.images ?? [])[0]);
            return (
              <Card style={{gap: spacing.md}}>
                <View style={wishStyles.row}>
                  {/* v3.1: صورة المنتج نفسه (كانت تُمرر لشعار المتجر
                   * خطأً فتظهر صورة المنتج داخل دائرة «س» مقطوعة). */}
                  {image != null ? (
                    <Image
                      source={{uri: image}}
                      style={wishStyles.thumb}
                      resizeMode="cover"
                      resizeMethod="resize"
                    />
                  ) : (
                    <View style={[wishStyles.thumb, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
                      <Text style={{fontSize: 17, fontFamily: fonts.black, color: palette.brandDark, opacity: 0.5}}>
                        {p.name.trim().charAt(0) || '؟'}
                      </Text>
                    </View>
                  )}
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
                <Button
                  /* v2.8 (الجولة 59): لا إضافة عمياء من القوائم —
                   * الكمية/الوزن/المواصفة تُختار في صفحة المنتج ثم
                   * تُضاف (طلب التاجر: الطلب من صفحة المنتج فقط). */
                  label={outOfStock ? 'نفدت الكمية — عرض المنتج' : 'اطلب من صفحة المنتج'}
                  small
                  icon={outOfStock ? 'search' : 'cart'}
                  disabled={false}
                  onPress={() => {
                    if (!outOfStock && (p.options ?? []).length === 0) {
                      toast('حدّد الكمية في صفحة المنتج ثم أضفها', 'info');
                    }
                    navigation.navigate('Product', {
                      product: p,
                      storeRef: {id: p.store_id, name: item.storeName},
                    });
                  }}
                />
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
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
