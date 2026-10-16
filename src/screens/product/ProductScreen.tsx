/**
 * ProductScreen.tsx — صفحة المنتج (v3.0 — إعادة بناء كاملة، الجولة 60):
 * ─────────────────────────────────────────────────────────────────
 * طلب التاجر بالنص: «اسجل دخول وافتح صفحة المنتج ولا أرى أي أزرار
 * لطلب المنتج وتحديد ما أريده» — أعيدت الهيكلية من الصفر بمعيار
 * المتاجر العالمية (أمازون/نون/سلة):
 *
 *  • شريط الشراء السفلي أصبح مُثبَّتاً تثبيتاً مطلقاً (BottomFixed
 *    الجديد: position:absolute + bottom:0) — يستحيل هندسياً أن
 *    يُدفَع خارج الشاشة كما كان يحدث مع عمود flex القديم. العدّاد
 *    وزر «أضف للسلة» مع الإجمالي الحي مرئيان دائماً من أول لحظة.
 *  • معرض صور بعرض كامل بنسبة 4:5 (نون) مع نقاط وعدّاد وعارض
 *    ملء الشاشة.
 *  • بطاقة سعر ملوّنة: خصم + توفير + الوحدة، وشريحة تصنيف بلون
 *    البلاطة المخصص (نظام الألوان الغني الجديد).
 *  • خيارات الشراء (مقاس/لون) برقائق ملونة + حالة «مطلوب».
 *  • قسم كمية صريح داخل المحتوى مع سقف المخزون + الإجمالي الحي.
 *  • منتجات مشابهة بمحرك التوصية (نفس التصنيف/السعر/الخصم) مع
 *    كاش 60 ثانية لكل متجر — لا نداء متكرر لكل منتج يُفتح.
 *  • القائمة كلها تمرر فوق الشريط بـ paddingBottom = ارتفاع الشريط
 *    + إخلاء النظام: لا محتوى يختفي خلفه أبداً.
 *  • v3.6 (الجولة 66 — ملاحظات المستخدم الثمانية):
 *   ① شريط الشراء لم يعد يضيف insets.bottom (كان يترك فراغاً
 *      ميتاً ضخماً فوق الهيدر السفلي ويكبر مع الشاشات الأكبر).
 *   ② المعرض مسقوف العرض 440px على الشاشات الكبيرة (تجاوب)
 *      + شريط مصغرات قابل للنقر أسفل الصورة (نمط أمازون/نون)
 *      يحلّ محل النقاط، والنقر على مصغرة يقفز لصورتها.
 *   ③ عارض ملء الشاشة بتكبير القرصة (إصبعان حتى 5×) + نقر
 *      مزدوج للتكبير 2.5× + سحب الصورة وهي مكبّرة مع قصّ حدودها
 *      وقفل تقليب الصفحات أثناء التكبير — بلا أي مكتبات جديدة.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  FlatList,
  I18nManager,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts, tileFor} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  BottomFixed,
  Button,
  Card,
  QtyStepper,
  Screen,
  SectionTitle,
} from '../../components/ui';
import {ProductCard} from '../../components/ProductCard';
import {StoreAvatar} from '../../components/StoreCard';
import {absoluteUrl} from '../../api/client';
import {getStoreSimilarProducts} from '../../api/endpoints';
import {formatMoney, formatQty} from '../../core/money';
import {effectiveMinor, hasDiscount} from '../../core/discount';
import {
  lineKeyOf,
  optionsComplete,
  variantTextOf,
  type Product,
  type ProductOptionGroup,
} from '../../core/types';
import {useCartStore} from '../../stores/cartStore';
import {useInterestStore} from '../../stores/interestStore';
import {useWishlistStore} from '../../stores/wishlistStore';
import {useToastStore} from '../../stores/toastStore';
import {hapticLight, hapticSuccess} from '../../core/haptics';
import {usePop} from '../../core/motion';
import {shareProduct} from '../../core/share';
import {getStoreDetail} from '../../api/endpoints';
import {useRequireAuth, type ShopStackParamList} from '../../navigation/RootNavigator';
import {minQty, qtyStep} from '../../core/money';
import {recommendSimilar, RECOMMEND_LIMIT} from '../../core/recommend';

type Props = NativeStackScreenProps<ShopStackParamList, 'Product'>;

export function ProductScreen({navigation, route}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const {width: screenWidth} = useWindowDimensions();
  const {product, storeRef} = route.params;

  /* هوكات مرتبة دائماً في القمة — بلا فروع شرطية (درس v2.6). */
  const addProduct = useCartStore(s => s.addProduct);
  const increment = useCartStore(s => s.increment);
  const decrement = useCartStore(s => s.decrement);
  const toast = useToastStore(s => s.show);
  const requireAuth = useRequireAuth();
  const wishlisted = useWishlistStore(s => s.items[String(product.id)] != null);
  const toggleWishlist = useWishlistStore(s => s.toggle);

  const soldByWeight = product.sold_by_weight === 1;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const optionGroups: ProductOptionGroup[] = product.options ?? [];
  const catTile = tileFor(product.category, palette.isDark);

  /* الكمية تُختار قبل الإضافة والإجمالي يتحدث لحظياً (منطق v2.8
   * المثبت) — والحد الأقصى هو المخزون المتاح نفسه: لا طلب أكبر
   * من المتوفر لا من العدّاد ولا من السلة. */
  const [qty, setQty] = useState(() => minQty(soldByWeight));
  const maxQty =
    Number.isFinite(product.stock) && product.stock > 0
      ? Math.max(minQty(soldByWeight), Math.floor(product.stock * 1000) / 1000)
      : 999;
  const stepQty = qtyStep(soldByWeight);
  const unitFinalPrice = effectiveMinor(product);
  const liveTotal = Math.round(unitFinalPrice * qty);

  /** اختيار المستخدم لكل مجموعة خيارات (اسم المجموعة → القيمة). */
  const [selection, setSelection] = useState<Record<string, string>>({});
  const variantText = variantTextOf(optionGroups, selection);
  const complete = optionsComplete(optionGroups, selection);
  const activeLineKey = lineKeyOf(product.id, variantText);

  const cartLine = useCartStore(
    s => s.carts[String(storeRef.id)]?.lines.find(l => l.key === activeLineKey),
  );
  const cartQty = cartLine?.quantity ?? 0;
  /** أسطر أخرى لنفس المنتج بخيارات مختلفة (معلومة إضافية). */
  const otherVariantCount = useCartStore(
    s =>
      (s.carts[String(storeRef.id)]?.lines ?? []).filter(
        l => l.productId === product.id && l.key !== activeLineKey,
      ).length,
  );

  const images = useMemo(
    () => (product.images ?? []).map(absoluteUrl).filter((u): u is string => u != null),
    [product.images],
  );
  const [slide, setSlide] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  /* v3.6: مؤشر المعرض + حالة التكبير (تقفل تقليب الصفحات أثناءها). */
  const galleryRef = useRef<ScrollView>(null);
  const [viewerZoomed, setViewerZoomed] = useState(false);

  /** v3.6: القفز لصورة عبر مصغّرتها — إزاحة RTL سالبة على أندرويد.
   * عرض الصفحة = عرض حاوية المعرض (الشاشة ناقص حشوة القائمة 12×2). */
  const jumpToImage = (i: number) => {
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    const pageW = screenWidth - spacing.md * 2;
    const x = I18nManager.isRTL ? -clamped * pageW : clamped * pageW;
    galleryRef.current?.scrollTo({x, animated: true});
    setSlide(clamped);
  };

  /* توصيات ذكية بمحرك core/recommend — عبر كاش المتجر (60 ث):
   * فتح عشرة منتجات من متجر واحد = نداء واحد لا عشرة. */
  const [similar, setSimilar] = useState<Product[]>([]);
  const [similarReason, setSimilarReason] = useState<string | null>(null);

  /* v4.0 (الجولة 68): معلومات المتجر الحية — أرخص منطقة توصيل
   * وعددها وتقييم المتجر (تغذي سطر «التوصيل يبدأ من…» وسطر المتجر
   * وسطر تقييمه). فشلها غير فادح — الصفحة تعمل كاملة بدونه. */
  const [storeDelivery, setStoreDelivery] = useState<{
    minFeeMinor: number | null;
    regionsCount: number;
    rating: number | null;
    ratingCount: number;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    getStoreDetail(storeRef.id)
      .then(d => {
        if (!alive) {
          return;
        }
        const fees = d.deliveryRegions
          .filter(r => r.enabled === 1)
          .map(r => r.fee_minor);
        setStoreDelivery({
          minFeeMinor: fees.length > 0 ? Math.min(...fees) : null,
          regionsCount: d.deliveryRegions.length,
          rating: d.store.rating ?? null,
          ratingCount: d.store.ratingCount ?? 0,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [storeRef.id]);

  /* v4.0: نبضة زر السلة — لحظة إضافة المنتج يقفز الزر قفزة صغيرة
   * فيحس المستخدم بالإضافة وهي تقع (موشن لطيفة بلا أي كلفة). */
  const addPulse = usePop();

  useEffect(() => {
    useInterestStore.getState().trackView(product.category);
  }, [product.id, product.category]);

  useEffect(() => {
    let alive = true;
    void getStoreSimilarProducts(storeRef.id, 40)
      .then(list => {
        if (!alive) {
          return;
        }
        const weights = useInterestStore.getState().categoryWeights();
        const picked = recommendSimilar(list, {current: product, categoryWeights: weights});
        setSimilar(picked.slice(0, RECOMMEND_LIMIT));
        const sameCat = picked.filter(p => p.category != null && p.category === product.category).length;
        const discounted = picked.filter(p => (p.discount_pct ?? 0) > 0).length;
        if (sameCat >= 3) {
          setSimilarReason(`من نفس التصنيف — ${product.category}`);
        } else if (discounted >= Math.ceil(picked.length / 2)) {
          setSimilarReason('عروض قد تعجبك من نفس المتجر');
        } else if (picked.length > 0) {
          setSimilarReason(`المزيد من ${storeRef.name}`);
        } else {
          setSimilarReason(null);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [product.id, product.category, storeRef.id, storeRef.name, product]);

  const onAdd = () => {
    if (outOfStock) {
      toast('نفدت الكمية من المتجر حالياً', 'danger');
      return;
    }
    if (!complete) {
      toast(`اختر ${optionGroups.find(g => selection[g.name] == null)!.name} أولاً`, 'danger');
      return;
    }
    /* الزائر لا يضيف للسلة — بوابة الدخول أولاً. */
    requireAuth(() => {
      addProduct(storeRef, product, variantText, qty);
      /* v3.2: تأكيد لمسي ملموس لحظة دخول المنتج للسلة. */
      hapticSuccess();
      /* v4.0: قفزة الزر — الإضافة تُرى ولا تُسمع فقط. */
      addPulse.pop();
      toast(`أُضيف «${product.name}» (${formatQty(qty, soldByWeight)}) إلى سلة ${storeRef.name}`, 'success');
    });
  };

  /* v4.0: مشاركة المنتج — طلب المستخدم الصريح: «يمكن للزبون مشاركة
   * منتج وهكذا» — زر مشاركة في التروسة وبجانب المفضلة. */
  const onShare = () => {
    void shareProduct(product, storeRef.name);
  };

  const onWishlist = () => {
    requireAuth(() => {
      /* v3.2: نبضة خفيفة عند تبديل المفضلة. */
      hapticLight();
      const added = toggleWishlist(product, storeRef.name);
      toast(added ? 'حُفظ في المفضلة' : 'أُزيل من المفضلة', 'info');
    });
  };

  /* v3.6: سقف عرض المعرض على الشاشات الكبيرة — الصورة لا تتمدد
   * بلا حدود مع الشاشة (شكوى «غير متجاوب مع حجم الشاشة»): عرض
   * الصفحة يساوي عرض حاوية المعرض (الشاشة ناقص حشوة القائمة)
   * ليصحّ التقليب المقضم، والصورة نفسها مسقوفة 440 وموسّطة داخل
   * صفحتها كالمتاجر العالمية على التابلت. */
  const galleryPageWidth = screenWidth - spacing.md * 2;
  const galleryImageWidth = Math.min(galleryPageWidth, 440);
  const galleryHeight = Math.round(galleryImageWidth * 1.25);
  /* إخلاء المحتوى فوق الشريط المثبت: ارتفاع الشريط بعد إصلاح v3.6
   * (حواشٍ 12×2 + صف الأزرار ‎≈52 + سطر التلميح ‎≈21 + حاشية 10)
   * + تنفّس — بلا insets.bottom (تستهلكه قائمة التبويبات نفسها). */
  const barClearance = 128;

  return (
    <Screen>
      <AppHeader
        title={product.name}
        subtitle={`من ${storeRef.name}`}
        onBack={() => navigation.goBack()}
        /* v4.0: زر مشاركة في التروسة — فعل المشاركة دائماً في المتناول
         * (طلب المستخدم: المشاركة من صفحة المنتج). */
        right={
          <Pressable
            onPress={onShare}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="مشاركة المنتج"
            style={[shareHeaderStyles.btn, {backgroundColor: palette.surface, borderColor: palette.line}]}>
            <Icon name="forward" size={18} color={palette.ink} />
          </Pressable>
        }
      />
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{padding: spacing.md, gap: spacing.md, paddingBottom: barClearance}}
        showsVerticalScrollIndicator={false}>
        {/* ─── معرض الصور ─── */}
        {images.length > 0 ? (
          <View>
            {/* إطار الصورة الحالية + عدّادها (المصغّرات تحته خارج الإطار
             * كي لا يتراكب معها العدّاد المطلق). */}
            <View style={{position: 'relative'}}>
              <ScrollView
                ref={galleryRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={32}
                /* v3.6: تتبّع مستمر — المصغّرة النشطة وعدّاد الصورة
                 * يتحركان مع السحب البطيء أيضاً لا بعد القذف فقط. */
                onScroll={e => {
                  // RTL: إزاحات سالبة على أندرويد — القيمة المطلقة تعطي
                  // الفهرس الصحيح دائماً (بمقياس عرض صفحة المعرض).
                  const i = Math.round(
                    Math.abs(e.nativeEvent.contentOffset.x) / galleryPageWidth,
                  );
                  setSlide(prev => (prev === i ? prev : i));
                }}
                style={{borderRadius: radius.xl, overflow: 'hidden'}}>
                {images.map((uri, i) => (
                  <Pressable
                    key={uri}
                    onPress={() => setViewerIndex(i)}
                    style={{width: galleryPageWidth, alignItems: 'center'}}>
                    <Image
                      source={{uri}}
                      style={{width: galleryImageWidth, height: galleryHeight}}
                      resizeMode="cover"
                      resizeMethod="resize"
                      progressiveRenderingEnabled
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <View style={[galleryStyles.countChip, {backgroundColor: palette.overlay}]}>
                <Icon name="photo" size={11} color="#FFFFFF" />
                <Text style={{fontSize: 10.5, color: '#FFFFFF', fontFamily: fonts.medium}}>
                  {slide + 1} / {images.length}
                </Text>
              </View>
            </View>

            {/* v3.6: شريط المصغّرات — نمط أمازون/نون: مصغّرة لكل صورة،
             * النشطة بإطار العلامة، والنقر يقفز لصورتها. حلّ محل
             * النقاط السابقة (معلومات الوضع نفسها بلا ازدواج). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={galleryStyles.thumbsRow}>
              {images.map((uri, i) => {
                const active = i === slide;
                return (
                  <Pressable
                    key={uri}
                    onPress={() => jumpToImage(i)}
                    hitSlop={4}
                    accessibilityRole="image"
                    accessibilityLabel={`صورة ${i + 1} من ${images.length}`}>
                    <View
                      style={[
                        galleryStyles.thumbWrap,
                        {borderColor: active ? palette.brand : palette.line},
                      ]}>
                      <Image
                        source={{uri}}
                        style={galleryStyles.thumb}
                        resizeMode="cover"
                        resizeMethod="resize"
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          /* بديل مرسوم عند غياب الصور — بلون بلاطة التصنيف */
          <View
            style={[
              galleryStyles.placeholder,
              {backgroundColor: catTile.soft, borderColor: catTile.solid + '55', height: galleryHeight * 0.62},
            ]}>
            <Icon name="photo" size={54} color={catTile.solid} />
            <Text style={[type.small, {color: catTile.ink, marginTop: spacing.md}]}>
              لا صور لهذا المنتج بعد — صوره تُرفع من نقطة بيع المتجر
            </Text>
          </View>
        )}

        {/* ─── بطاقة السعر الملوّنة ─── */}
        <Card style={{gap: spacing.sm}}>
          <View style={priceStyles.row}>
            <View style={{gap: 2, flex: 1, alignItems: 'flex-start'}}>
              <Text style={[type.h3, {color: palette.ink, fontFamily: fonts.bold}]}>
                {product.name}
              </Text>
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                {product.category ? (
                  <View style={[priceStyles.catChip, {backgroundColor: catTile.soft}]}>
                    <Text style={{fontSize: 10.5, color: catTile.ink, fontFamily: fonts.bold}}>
                      {product.category}
                    </Text>
                  </View>
                ) : null}
                <Text style={{fontSize: 10.5, color: palette.muted}}>
                  {soldByWeight ? 'بالكيلو — بأنصاف الكيلو' : product.unit_label ? `الوحدة: ${product.unit_label}` : 'يُباع بالقطعة'}
                </Text>
              </View>
            </View>
            <View style={{flexDirection: 'row-reverse', gap: spacing.sm}}>
              <Pressable
                onPress={onWishlist}
                hitSlop={10}
                style={[priceStyles.wishBtn, {backgroundColor: palette.surfaceAlt}]}>
                <Icon
                  name={wishlisted ? 'heartFilled' : 'heart'}
                  size={19}
                  color={wishlisted ? palette.danger : palette.muted}
                />
              </Pressable>
              {/* v4.0: مشاركة المنتج بجانب المفضلة — الفعلان الجانبيان
               * للمنتج في مكان واحد (طلب المستخدم: المشاركة). */}
              <Pressable
                onPress={onShare}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="مشاركة المنتج"
                style={[priceStyles.wishBtn, {backgroundColor: palette.surfaceAlt}]}>
                <Icon name="forward" size={18} color={palette.ink} />
              </Pressable>
            </View>
          </View>

          <View style={priceStyles.priceRow}>
            <Text style={[priceStyles.amount, {color: palette.brandDark}]}>
              {formatMoney(effectiveMinor(product))}
            </Text>
            {hasDiscount(product) ? (
              <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                <Text
                  style={[type.small, {color: palette.muted, textDecorationLine: 'line-through'}]}>
                  {formatMoney(product.price_minor)}
                </Text>
                <View style={[priceStyles.pctChip, {backgroundColor: palette.danger}]}>
                  <Text style={{fontSize: 10, color: '#FFFFFF', fontFamily: fonts.bold}}>
                    خصم {Math.round(product.discount_pct ?? 0)}%
                  </Text>
                </View>
                <Text style={{fontSize: 11, color: palette.success, fontFamily: fonts.medium}}>
                  توفّر {formatMoney(Math.max(0, product.price_minor - effectiveMinor(product)))}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={priceStyles.chipsRow}>
            <View
              style={[
                priceStyles.infoChip,
                {
                  backgroundColor: outOfStock ? palette.dangerSoft : lowStock ? palette.warningSoft : palette.successSoft,
                  borderColor: outOfStock ? palette.danger : lowStock ? palette.warning : palette.success,
                },
              ]}>
              <Icon
                name={outOfStock ? 'xCircle' : lowStock ? 'warning' : 'checkCircle'}
                size={12}
                color={outOfStock ? palette.danger : lowStock ? palette.warning : palette.success}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.medium,
                  color: outOfStock ? palette.danger : lowStock ? palette.warning : palette.success,
                }}>
                {outOfStock
                  ? 'نفدت الكمية'
                  : lowStock
                    ? `بقي القليل (${Math.floor(product.stock)}${soldByWeight ? ' كيلو' : ' قطعة'})`
                    : `متوفر (${Math.floor(product.stock)}${soldByWeight ? ' كيلو' : ' قطعة'})`}
              </Text>
            </View>
            {/* v4.0: معلومة التوصيل الحية — أرخص رسم توصيل لهذا المتجر
             * وعدد مناطقه (من نداء تفاصيل المتجر). */}
            {storeDelivery != null && storeDelivery.minFeeMinor != null ? (
              <View style={[priceStyles.infoChip, {
                backgroundColor: palette.successSoft,
                borderColor: palette.success,
              }]}>
                <Icon name="truck" size={12} color={palette.success} />
                <Text style={{fontSize: 11, fontFamily: fonts.medium, color: palette.success}}>
                  التوصيل يبدأ من {formatMoney(storeDelivery.minFeeMinor)}
                  {storeDelivery.regionsCount > 1
                    ? ` · ${storeDelivery.regionsCount} مناطق`
                    : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* ─── خيارات الشراء (مقاس/لون…) ─── */}
        {optionGroups.length > 0 ? (
          <Card style={{gap: spacing.sm}}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name="sliders" size={14} color={catTile.solid} />
              <Text style={[type.h3, {color: palette.ink}]}>اختياراتك</Text>
              {!complete ? (
                <View style={[optStyles.requiredChip, {backgroundColor: palette.dangerSoft, borderColor: palette.danger}]}>
                  <Text style={{fontSize: 9.5, color: palette.danger, fontFamily: fonts.bold}}>
                    مطلوب
                  </Text>
                </View>
              ) : null}
            </View>
            {optionGroups.map(group => (
              <View key={group.name} style={{gap: 5}}>
                <Text style={{fontSize: 11.5, color: palette.inkSoft, fontFamily: fonts.medium}}>
                  {group.name}
                </Text>
                <View style={optStyles.valuesWrap}>
                  {group.values.map(value => {
                    const active = selection[group.name] === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() =>
                          setSelection(prev => ({...prev, [group.name]: value}))
                        }
                        style={({pressed}) => [
                          optStyles.valueChip,
                          {
                            backgroundColor: active ? catTile.solid : palette.surface,
                            borderColor: active ? catTile.solid : palette.lineStrong,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <Text
                          style={{
                            fontSize: 12,
                            color: active ? '#FFFFFF' : palette.ink,
                            fontFamily: active ? fonts.bold : fonts.medium,
                          }}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {variantText != null ? (
              <Text style={{fontSize: 10.5, color: palette.muted}}>
                ستُضاف بالمواصفة: {variantText}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* ─── الكمية — قسم صريح داخل المحتوى كما أمازون ─── */}
        {!outOfStock ? (
          <Card style={{gap: spacing.sm}}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Icon name={soldByWeight ? 'scale' : 'box'} size={14} color={catTile.solid} />
              <Text style={[type.h3, {color: palette.ink}]}>
                {soldByWeight ? 'الوزن المطلوب' : 'الكمية المطلوبة'}
              </Text>
            </View>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between'}}>
              <QtyStepper
                qty={qty}
                soldByWeight={soldByWeight}
                max={maxQty}
                onIncrease={() =>
                  setQty(q => Math.min(maxQty, Math.round((q + stepQty) * 1000) / 1000))
                }
                onDecrease={() =>
                  setQty(q =>
                    q - stepQty < minQty(soldByWeight)
                      ? minQty(soldByWeight)
                      : Math.round((q - stepQty) * 1000) / 1000,
                  )
                }
              />
              <View style={{alignItems: 'flex-start', gap: 2}}>
                <Text style={{fontSize: 12.5, color: palette.brandDark, fontFamily: fonts.bold}}>
                  الإجمالي {formatMoney(liveTotal)}
                </Text>
                <Text style={{fontSize: 10.5, color: palette.muted}}>
                  {formatMoney(unitFinalPrice)} × {formatQty(qty, soldByWeight)}
                  {soldByWeight ? ' كيلو' : ' قطعة'}
                  {maxQty < 999
                    ? ` · المتاح ${formatQty(maxQty, soldByWeight)}${soldByWeight ? ' كيلو' : ' قطعة'} فقط`
                    : ''}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* الوصف */}
        {product.description ? (
          <Card style={{gap: 4, paddingVertical: 10}}>
            <Text style={{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}}>عن المنتج</Text>
            <Text style={{fontSize: 12, color: palette.inkSoft, lineHeight: 19}}>
              {product.description}
            </Text>
          </Card>
        ) : null}

        {/* المتجر — سطر مضغوط */}
        <Pressable onPress={() => navigation.navigate('Store', {storeId: storeRef.id, storeName: storeRef.name})}>
          <Card style={{paddingVertical: 10, gap: 4}}>
            <View style={priceStyles.row}>
              <StoreAvatar name={storeRef.name} logoUrl={storeRef.logoUrl} size={38} />
              <View style={{flex: 1, gap: 1, alignItems: 'flex-start'}}>
                <Text style={{fontSize: 13, color: palette.ink, fontFamily: fonts.bold}}>
                  {storeRef.name}
                </Text>
                {/* v4.0: تقييم المتجر الحي + مناطق التوصيل في سطر المتجر */}
                {storeDelivery?.rating != null && storeDelivery.rating > 0 ? (
                  <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4}}>
                    <Icon name="star" size={11} color={palette.warning} />
                    <Text style={{fontSize: 10.5, color: palette.muted}}>
                      {storeDelivery.rating} من 5 ({storeDelivery.ratingCount} تقييماً)
                    </Text>
                  </View>
                ) : (
                  <Text style={{fontSize: 10.5, color: palette.muted}}>
                    {storeRef.storeNumber ? `${storeRef.storeNumber} · ` : ''}زيارة المتجر وتصفح منتجاته ومناطق توصيله ›
                  </Text>
                )}
                {storeDelivery?.rating != null && storeDelivery.rating > 0 ? (
                  <Text style={{fontSize: 10.5, color: palette.brandDark, fontFamily: fonts.medium}}>
                    زيارة المتجر وتصفح منتجاته ومناطق توصيله ›
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        </Pressable>

        {/* منتجات مشابهة — توصية ذكية */}
        {similar.length > 0 ? (
          <View style={{gap: spacing.md}}>
            <SectionTitle
              title="منتجات مشابهة قد تعجبك"
              subtitle={similarReason ?? undefined}
              actionLabel={product.category ? 'كل التصنيف' : undefined}
              onAction={
                product.category
                  ? () => navigation.navigate('Category', {category: product.category!})
                  : undefined
              }
            />
            <FlatList
              horizontal
              data={similar}
              keyExtractor={p => String(p.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{gap: spacing.md, paddingVertical: 2}}
              style={{marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg}}
              renderItem={({item}) => (
                <View style={{width: 150}}>
                  <ProductCard
                    product={item}
                    storeName={storeRef.name}
                    storeRef={storeRef}
                    photoWidth={134}
                    onPress={() =>
                      navigation.push('Product', {product: item, storeRef})
                    }
                  />
                </View>
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* ─── شريط الشراء السفلي المثبّت — مرئي دائماً ───
       * v3.0: تثبيت مطلق (position:absolute bottom:0) — العدّاد وزر
       * الإضافة مع الإجمالي الحي لا يمكن أن يختفيا خلف المحتوى أياً
       * كان حجمه. هذا هو الزر الذي اشتكى التاجر من اختفائه. */}
      <BottomFixed>
        {/* v4.0: نبضة الزر لحظة الإضافة — الغلاف المتحرك حول صف الأزرار. */}
        <Animated.View style={addPulse.style}>
        <View style={bottomStyles.row}>
          <QtyStepper
            qty={cartQty > 0 ? cartQty : qty}
            soldByWeight={soldByWeight}
            max={maxQty}
            onIncrease={() =>
              cartQty > 0
                ? increment(storeRef.id, activeLineKey)
                : setQty(q => Math.min(maxQty, Math.round((q + stepQty) * 1000) / 1000))
            }
            onDecrease={() =>
              cartQty > 0
                ? decrement(storeRef.id, activeLineKey)
                : setQty(q =>
                    q - stepQty < minQty(soldByWeight)
                      ? minQty(soldByWeight)
                      : Math.round((q - stepQty) * 1000) / 1000,
                  )
            }
          />
          <Button
            label={
              outOfStock
                ? 'غير متوفر حالياً'
                : cartQty > 0
                  ? `في السلة — ${formatMoney(effectiveMinor(product) * cartQty)}`
                  : !complete
                    ? 'اختر المواصفات أولاً'
                    : `أضف للسلة — ${formatMoney(liveTotal)}`
            }
            icon={complete && !outOfStock ? 'cart' : 'sliders'}
            style={{flex: 1}}
            onPress={() => {
              if (cartQty > 0) {
                hapticLight();
                navigation.getParent()?.navigate('Cart');
                return;
              }
              onAdd();
            }}
            disabled={outOfStock}
          />
        </View>
        </Animated.View>
        <Text style={[bottomStyles.hint, {color: palette.muted}]}>
          {cartQty > 0
            ? `في سلة ${storeRef.name} — اضغط الزر لإتمام الطلب`
            : `${formatMoney(unitFinalPrice)} × ${formatQty(qty, soldByWeight)}${soldByWeight ? ' كيلو' : ' قطعة'} = ${formatMoney(liveTotal)}`
              + (otherVariantCount > 0 ? ` · لديك ${otherVariantCount} مواصفة أخرى في السلة` : '')}
        </Text>
      </BottomFixed>

      {/* ─── عارض ملء الشاشة ───
       * v3.6: معاينة احترافية كالمتاجر العالمية — تكبير بالقرصة
       * (إصبعان حتى ‎5×‎)، نقر مزدوج للتكبير ‎2.5×‎، وسحب الصورة وهي
       * مكبّرة مع قصّ حدودها، ويُقفل تقليب الصفحات أثناء التكبير. */}
      <Modal visible={viewerIndex != null} transparent animationType="fade"
        onRequestClose={() => {
          setViewerZoomed(false);
          setViewerIndex(null);
        }}>
        <View style={[viewerStyles.wrap, {backgroundColor: '#000000'}]}>
          <Pressable
            onPress={() => {
              setViewerZoomed(false);
              setViewerIndex(null);
            }}
            style={[viewerStyles.closeBtn, {top: insets.top + spacing.md}]}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
          {viewerIndex != null && images.length > 0 ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              /* قفل التمرير أثناء التكبير — الإصبع يحرّك الصورة لا الصفحات. */
              scrollEnabled={!viewerZoomed}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, i) => ({
                length: screenWidth,
                offset: screenWidth * i,
                index: i,
              })}
              keyExtractor={item => item}
              onMomentumScrollEnd={e => {
                // RTL: إزاحة سالبة — القيمة المطلقة تصحح الفهرس.
                setViewerIndex(
                  Math.round(Math.abs(e.nativeEvent.contentOffset.x) / screenWidth),
                );
              }}
              renderItem={({item}) => (
                <ZoomableImage
                  uri={item}
                  width={screenWidth}
                  onZoomChange={setViewerZoomed}
                />
              )}
            />
          ) : null}
          <View style={[viewerStyles.counter, {bottom: insets.bottom + spacing.xl}]}>
            <Text style={{color: '#FFFFFF', fontSize: 12, fontFamily: fonts.medium}}>
              {(viewerIndex ?? 0) + 1} / {images.length}
            </Text>
            <Text style={{color: 'rgba(255,255,255,0.66)', fontSize: 10, fontFamily: fonts.medium}}>
              قرّب بإصبعين أو انقر نقرتين
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/* ═══ v3.6: صورة قابلة للتكبير داخل العارض ═══
 * قرصة بإصبعين (‎1×‎ إلى ‎5×‎) + نقر مزدوج (تبديل ‎1×‎/‎2.5×‎) + سحب
 * وهي مكبّرة مع قصّ الإزاحة داخل حدودها. المنفّذ بـ PanResponder
 * وAnimated(transform بمحرك أصلي) حصراً — بلا أي مكتبة جديدة
 * وبلا مساس بمنظومة الانهيارات المحروسة (v3.4). تُترك لمسات
 * التمرير العادية للقائمة الأم حين تكون الصورة بحجمها الطبيعي. */
function ZoomableImage({
  uri,
  width,
  onZoomChange,
}: {
  uri: string;
  width: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  /* مرايا عددية للحظة القرار — قيم Animated لا تُقرأ مباشرة. */
  const scaleNow = useRef(1);
  const txNow = useRef(0);
  const tyNow = useRef(0);
  const boxW = useRef(width);
  const boxH = useRef(600);
  const pinchDist = useRef(0);
  const pinchBase = useRef(1);
  const panBase = useRef({x: 0, y: 0});
  const lastTap = useRef(0);

  useEffect(() => {
    const a = scale.addListener(v => (scaleNow.current = v.value));
    const b = translateX.addListener(v => (txNow.current = v.value));
    const c = translateY.addListener(v => (tyNow.current = v.value));
    return () => {
      scale.removeListener(a);
      translateX.removeListener(b);
      translateY.removeListener(c);
    };
  }, [scale, translateX, translateY]);

  /* عودة ناعمة للحجم الطبيعي مع تصفير الإزاحة. */
  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, useNativeDriver: true, friction: 7}),
      Animated.spring(translateX, {toValue: 0, useNativeDriver: true, friction: 7}),
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true, friction: 7}),
    ]).start(() => onZoomChange(false));
  };

  /* تكبير النقرة المزدوجة — توسيط بلا إزاحة. */
  const zoomIn = () => {
    Animated.parallel([
      Animated.spring(scale, {toValue: 2.5, useNativeDriver: true, friction: 7}),
      Animated.spring(translateX, {toValue: 0, useNativeDriver: true, friction: 7}),
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true, friction: 7}),
    ]).start(() => onZoomChange(true));
  };

  /* قصّ الإزاحة داخل حدود الصورة المكبّرة (لا سحب لما لا نهاية). */
  const clamped = (dx: number, dy: number) => {
    const maxX = (boxW.current * (scaleNow.current - 1)) / 2;
    const maxY = (boxH.current * (scaleNow.current - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, dx)),
      y: Math.max(-maxY, Math.min(maxY, dy)),
    };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (e, g) => {
          const touches = e.nativeEvent.touches;
          /* قرصة بإصبعين ⇒ تكبير. سحب بإصبع والصورة مكبّرة ⇒ تحريك.
           * غير ذلك نترك اللمسة للقائمة (تقليب الصفحات). */
          if (touches.length >= 2) {
            return true;
          }
          if (scaleNow.current > 1.05 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)) {
            return true;
          }
          return false;
        },
        onPanResponderGrant: e => {
          const t = e.nativeEvent.touches;
          if (t.length >= 2) {
            pinchDist.current = Math.hypot(
              t[0].pageX - t[1].pageX,
              t[0].pageY - t[1].pageY,
            );
            pinchBase.current = scaleNow.current;
          } else {
            panBase.current = {x: txNow.current, y: tyNow.current};
          }
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t.length >= 2 && pinchDist.current > 0) {
            const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            const next = Math.max(1, Math.min(5, pinchBase.current * (d / pinchDist.current)));
            scale.setValue(next);
            onZoomChange(next > 1.05);
          } else if (scaleNow.current > 1.05) {
            const target = clamped(panBase.current.x + g.dx, panBase.current.y + g.dy);
            translateX.setValue(target.x);
            translateY.setValue(target.y);
          }
        },
        onPanResponderRelease: () => {
          /* هبطت القرصة تحت الطبيعي؟ عودة ناعمة. وإلا فالإزاحة
           * مقصوصة أصلاً أثناء الحركة — ثبات هادئ. */
          if (scaleNow.current <= 1.05) {
            resetZoom();
          }
        },
        onPanResponderTerminate: () => {
          if (scaleNow.current <= 1.05) {
            resetZoom();
          }
        },
        /* لا نتخلى عن الإصبعين أثناء القرصة للقائمة الأم. */
        onPanResponderTerminationRequest: () => false,
      }),
    // مراجع فقط — المنشئ مرة واحدة آمن.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* النقرة المزدوجة — تُلتقط في onPress الودّي (لا تعارض مع القرصة). */
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (scaleNow.current > 1.05) {
        resetZoom();
      } else {
        zoomIn();
      }
    } else {
      lastTap.current = now;
    }
  };

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={e => {
        boxW.current = e.nativeEvent.layout.width || width;
        boxH.current = e.nativeEvent.layout.height || 600;
      }}
      style={{width, height: '100%'}}>
      <Pressable
        onPress={onTap}
        style={{width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
        <Animated.Image
          source={{uri}}
          style={{
            width,
            height: '100%',
            transform: [{translateX}, {translateY}, {scale}],
          }}
          resizeMode="contain"
          resizeMethod="resize"
        />
      </Pressable>
    </Animated.View>
  );
}

const galleryStyles = StyleSheet.create({
  /* v3.6: شريط المصغّرات — بديل النقاط (نمط أمازون/نون). */
  thumbsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  thumbWrap: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 2,
    padding: 2,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md - 2,
    backgroundColor: 'rgba(120,120,120,0.12)',
  },
  countChip: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  placeholder: {
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});

const priceStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm},
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  amount: {fontSize: 26, fontFamily: fonts.black},
  pctChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  catChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wishBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
});

const optStyles = StyleSheet.create({
  valuesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  valueChip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 46,
    alignItems: 'center',
  },
  requiredChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
});

/* v4.0 (الجولة 68): زر المشاركة في التروسة — نفس لغة زر الرجوع
 * (40×40 بحدود) كي يبقى الاتساق البصري للشريط العلوي. */
const shareHeaderStyles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const bottomStyles = StyleSheet.create({
  row: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md},
  hint: {
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 7,
  },
});

const viewerStyles = StyleSheet.create({
  wrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  closeBtn: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
