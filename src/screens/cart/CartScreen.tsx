/**
 * CartScreen.tsx — السلة الموحّدة (v3، الجولة 59): الدفع داخل السلة.
 * ─────────────────────────────────────────────────────────────────
 * طلب التاجر بالنص: «لا أريد الطلب من خلال زر إضافة ثم إتمام الطلب
 * في السلة وبعدها إتمام الطلب في صفحة إتمام الطلب — هذا معقد وممل.
 * أريده أبسط: صفحة المنتج يحدد الكمية/الوزن/الاختيارات، ثم في السلة
 * يحدد عنوان التسليم ثم التوصيل وبشكل ذكي يتم احتساب كل شيء ثم
 * إتمام الطلب مباشرة دون أي مشاكل ونقله للمتجر».
 *
 * v2.8 — كما أنظمة التسوق العالمية (أمازون/نون/طلبات):
 *  • شاشة واحدة: الأصناف + العنوان + التوصيل + الملخص + زر واحد.
 *  • شاشة «إتمام الطلب» الوسيطة حُذفت من التدفق كلياً — طلب من
 *    السلة يذهب للمتجر مباشرة.
 *  • ذكاء: العنوان الافتراضي يُختار تلقائياً، ومنطقة التوصيل
 *    تتطابق مع منطقة العنوان إن كان المتجر يخدمها (وإلا منطقته
 *    المحفوظة/الأرخص) — العضو العائد يضغط زراً واحداً.
 *  • أزرار مدمجة (44px) بلا شريط سفلي ضخم — طلب التاجر: «الزر
 *    كبير جداً بأزرار تأخذ مساحة كبيرة».
 *  • سقف المخزون: العدّاد يتوقف عند المتاح ولا يُطلب أكثر منه،
 *    والخادم (5.4+) يحسم نهائياً عند الطلب.
 *  • إيديمبوتنسية لكل متجر + تحديث «طلباتي» فور النجاح + إخلاص
 *    كامل في الفشل (صف تحذير فوق الزر لا نجاح زائف).
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '../../theme/ThemeProvider';
import {radius, spacing, type, fonts} from '../../theme/tokens';
import {Icon} from '../../components/Icon';
import {
  AppHeader,
  Button,
  EmptyState,
  Field,
  QtyStepper,
  Screen,
} from '../../components/ui';
import {formatMoney, formatQty, lineTotal} from '../../core/money';
import {cartSavings, lineSavings} from '../../core/discount';
import {validateAddress} from '../../core/validation';
import {addressLine, type Address, type CartStoreEntry, type DeliveryRegion} from '../../core/types';
import {useCartStore} from '../../stores/cartStore';
import {useAuthStore} from '../../stores/authStore';
import {useInterestStore} from '../../stores/interestStore';
import {useLocationStore} from '../../stores/locationStore';
import {useSettingsStore} from '../../stores/settingsStore';
import {useToastStore} from '../../stores/toastStore';
import {hapticSuccess} from '../../core/haptics';
import {getStoreDetail, placeOrder, newOrderRequestId} from '../../api/endpoints';
import {syncOrdersOnce} from '../../services/ordersSync';
import {ApiError} from '../../api/client';
import {StoreAvatar} from '../../components/StoreCard';
import type {Order} from '../../core/types';
import type {CartStackParamList} from '../../navigation/RootNavigator';
import {useRequireAuth} from '../../navigation/RootNavigator';
import {useTabBottomClearance} from '../../core/layout';

type Props = NativeStackScreenProps<CartStackParamList, 'Cart'>;

export function CartScreen({navigation}: Props) {
  const {palette} = useTheme();
  /* هوك الإخلاء مرفوع لقمة المكون — استدعاؤه داخل فروع JSX شرطية
   * كان يغيّر عدد الـ hooks بين الرندرات ويحطم الشاشة (درس v2.6). */
  const tabClearance = useTabBottomClearance();
  const carts = useCartStore(s => s.carts);
  const clearAll = useCartStore(s => s.clearAll);
  const toast = useToastStore(s => s.show);
  const requireAuth = useRequireAuth();
  const serverAddresses = useLocationStore(s => s.addresses);
  const syncAddresses = useLocationStore(s => s.syncFromServer);

  /* العنوان مشترك بين كل متاجر السلة — رحلة شراء واحدة بعنوان
   * واحد (كما السلة العالمية)؛ كل متجر يطابق منطقته معه. */
  const [address, setAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  useEffect(() => {
    void syncAddresses();
  }, [syncAddresses]);

  /* ذكاء: العنوان الافتراضي يُعبّأ تلقائياً أول مرة تتوفر فيها
   * عناوين الحساب — العضو العائد لا يكتب شيئاً. */
  useEffect(() => {
    if (selectedAddressId != null || address.trim().length > 0) {
      return;
    }
    const def =
      serverAddresses.find(a => a.is_default === 1) ?? serverAddresses[0];
    if (def != null) {
      setSelectedAddressId(def.id);
      setAddress(addressLine(def));
    }
  }, [serverAddresses, selectedAddressId, address]);

  /** منطقة العنوان المختار — تُمرر لكل متجر ليطابق منطقته بها. */
  const addressRegionHint = useMemo(() => {
    if (selectedAddressId == null) {
      return null;
    }
    return serverAddresses.find(a => a.id === selectedAddressId)?.region ?? null;
  }, [selectedAddressId, serverAddresses]);

  const pickServerAddress = (a: Address) => {
    const same = selectedAddressId === a.id;
    setSelectedAddressId(same ? null : a.id);
    if (same) {
      setAddress('');
    } else {
      setAddress(addressLine(a));
    }
  };

  const entries = Object.values(carts).sort((a, b) => b.updatedAt - a.updatedAt);
  const grandCount = entries.reduce(
    (sum, e) => sum + e.lines.reduce((s, l) => s + l.quantity, 0),
    0,
  );

  const onOrderSuccess = (order: Order) => {
    navigation.replace('OrderSuccess', {order});
  };

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
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, paddingBottom: tabClearance + 48}}
          showsVerticalScrollIndicator={false}
          renderItem={({item: entry}) => (
            <StoreCheckout
              entry={entry}
              address={address}
              addressRegionHint={addressRegionHint}
              onPickServerAddress={pickServerAddress}
              serverAddresses={serverAddresses}
              selectedAddressId={selectedAddressId}
              onAddressText={(t => {
                setAddress(t);
                setSelectedAddressId(null);
              })}
              onOpenStore={() =>
                navigation.getParent()?.navigate('Stores', {
                  screen: 'Store',
                  params: {storeId: entry.storeId, storeName: entry.storeName},
                })
              }
              onClear={() => {
                useCartStore.getState().clearStore(entry.storeId);
                toast(`أُفرغت سلة ${entry.storeName}`, 'info');
              }}
              onOrder={onOrderSuccess}
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
    </Screen>
  );
}

/* ═════════════ بطاقة متجر: أصناف + عنوان + توصيل + ملخص + زر ═══ */

function StoreCheckout({
  entry,
  address,
  addressRegionHint,
  serverAddresses,
  selectedAddressId,
  onPickServerAddress,
  onAddressText,
  onOpenStore,
  onClear,
  onOrder,
}: {
  entry: CartStoreEntry;
  address: string;
  addressRegionHint: string | null;
  serverAddresses: Address[];
  selectedAddressId: number | null;
  onPickServerAddress: (a: Address) => void;
  onAddressText: (t: string) => void;
  onOpenStore: () => void;
  onClear: () => void;
  onOrder: (order: Order) => void;
}) {
  const {palette} = useTheme();
  const toast = useToastStore(s => s.show);
  const requireAuth = useRequireAuth();
  const savedAddresses = useSettingsStore(s => s.savedAddresses);
  const rememberedRegion = useSettingsStore(
    s => s.lastRegionByStore[String(entry.storeId)],
  );
  const myRegion = useLocationStore(s => s.myRegion);
  const addAddress = useSettingsStore(s => s.addAddress);
  const rememberRegion = useSettingsStore(s => s.rememberRegion);
  const trackOrder = useInterestStore(s => s.trackOrder);

  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [lastSendError, setLastSendError] = useState<string | null>(null);
  /* إيديمبوتنسية: مفتاح لكل متجر يبقى نفسه حتى نجاح الطلب — إعادة
   * الضغط بعد فشل شبكة لا تنشئ طلباً مكرراً لدى التاجر. */
  const orderRequestIdRef = useRef<string>(newOrderRequestId());

  const loadRegions = async () => {
    setRegionsError(null);
    setRegionsLoading(true);
    try {
      const detail = await getStoreDetail(entry.storeId);
      setRegions(detail.deliveryRegions.filter(r => r.enabled === 1));
    } catch {
      setRegionsError('تعذر جلب مناطق التوصيل — تحقق من الشبكة');
    } finally {
      setRegionsLoading(false);
    }
  };

  useEffect(() => {
    void loadRegions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.storeId]);

  /* ذكاء التوصيل: أول تحميل للمناطق يختار منطقة العنوان إن كان
   * المتجر يخدمها، وإلا منطقته المحفوظة من طلب سابق، وإلا منطقة
   * المستخدم، وإلا الأرخص. */
  useEffect(() => {
    if (regions.length === 0 || regionName != null) {
      return;
    }
    const pick =
      regions.find(r => r.name === addressRegionHint) ??
      regions.find(r => r.name === rememberedRegion) ??
      regions.find(r => r.name === myRegion) ??
      [...regions].sort((a, b) => a.fee_minor - b.fee_minor)[0];
    setRegionName(pick?.name ?? null);
    // منطقة العنوان أولوية متجددة — لا نعيد فتح ما اختاره المستخدم.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  /* تغيّر عنوان المستخدم لمنطقة يخدمها المتجر → تتبدّل منطقة
   * التوصيل تلقائياً (طلب التاجر: «بشكل ذكي يتم احتساب كل شيء»). */
  useEffect(() => {
    if (addressRegionHint == null || regions.length === 0) {
      return;
    }
    const match = regions.find(r => r.name === addressRegionHint);
    if (match != null) {
      setRegionName(match.name);
    }
  }, [addressRegionHint, regions]);

  const selectedRegion = useMemo(
    () => regions.find(r => r.name === regionName) ?? null,
    [regions, regionName],
  );

  const itemsSubtotal = useMemo(
    () => entry.lines.reduce((s, l) => s + lineTotal(l.priceMinor, l.quantity), 0),
    [entry.lines],
  );
  const deliveryFee = selectedRegion?.fee_minor ?? 0;
  const total = itemsSubtotal + deliveryFee;
  const addressValid = validateAddress(address) == null;
  const ready = regions.length > 0 && regionName != null && addressValid;

  const submit = async () => {
    /* الزائر: بوابة الدخول ثم العودة — العنوان والسلة لا يضيعان. */
    requireAuth(async () => {
      if (regionName == null) {
        toast('اختر منطقة التوصيل أولاً', 'danger');
        return;
      }
      if (!addressValid) {
        toast(validateAddress(address) ?? 'أدخل عنوان التسليم', 'danger');
        return;
      }
      setPlacing(true);
      setLastSendError(null);
      try {
        const order = await placeOrder(useAuthStore.getState().token!, {
          storeId: entry.storeId,
          items: entry.lines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            variant: l.variant ?? undefined,
          })),
          regionName,
          address: address.trim(),
          note: note.trim() || undefined,
          clientRequestId: orderRequestIdRef.current,
        });
        // نجح — مفتاح جديد لأي طلب تالٍ لهذا المتجر.
        orderRequestIdRef.current = newOrderRequestId();
        useCartStore.getState().clearStore(entry.storeId);
        addAddress(address.trim());
        rememberRegion(entry.storeId, regionName);
        trackOrder(entry.lines.map(l => l.category ?? null));
        /* v3.2: تأكيد لمسي لحظة نجاح الطلب — إحساس إنجاز ملموس
         * كما تطبيقات الدفع العالمية (طلب التاجر: تفاعلات لمسية). */
        hapticSuccess();
        /* «طلباتي» وشارة التبويب تتحدثان فوراً — لا دورة ٤٥ ثانية
         * تُوهم المستخدم أن طلبه «لم يُرسل». */
        void syncOrdersOnce(true);
        onOrder(order);
      } catch (e) {
        if (e instanceof ApiError) {
          /* v2.8 (خادم 5.4): حدود المخزون تتكلم بوضوح — لا طلب
           * أكبر من المتاح يمر بصمت. */
          if (e.code === 'INSUFFICIENT_STOCK') {
            const name = typeof e.extra?.productName === 'string' ? e.extra.productName : 'أحد المنتجات';
            const avail = Number(e.extra?.available);
            const availText = Number.isFinite(avail) && avail > 0
              ? ` — المتاح الآن ${formatQty(avail, false)} فقط`
              : '';
            setLastSendError(`الكمية المتاحة من «${name}» لا تكفي${availText}. عدّل الكمية وأعد الإرسال`);
            toast('الكمية المطلوبة أكبر من المتاح — عدّلها وأعد الإرسال', 'danger');
          } else if (e.code === 'PRODUCT_UNAVAILABLE') {
            setLastSendError('أحد منتجات السلة لم يعد متاحاً في المتجر — أزله ثم أعد الإرسال');
            toast('منتج من سلتك لم يعد متاحاً — أزله وأعد المحاولة', 'danger');
          } else {
            if (e.code === 'BAD_REGION') {
              await loadRegions();
              setRegionName(null);
            }
            setLastSendError(e.message);
            toast(e.message, 'danger');
          }
        } else {
          setLastSendError('تعذر إرسال الطلب — تحقق من الإنترنت وحاول مجدداً');
          toast('تعذر إرسال الطلب — تحقق من الإنترنت وحاول مجدداً', 'danger');
        }
      } finally {
        setPlacing(false);
      }
    });
  };

  return (
    <View style={[cardStyles.group, {backgroundColor: palette.surface, borderColor: palette.line}]}>
      {/* v3.3: رأس المتجر — شريط هوية ملون ناعم (brandSoft) يفصل
       * كل متجر بصرياً كبطاقة متجر حقيقية، لا مجرد عنوان نصي. */}
      <View style={[cardStyles.groupHead, {backgroundColor: palette.brandSoft}]}>
        <Pressable onPress={onOpenStore} style={cardStyles.storeRow} hitSlop={6}>
          <StoreAvatar name={entry.storeName} logoUrl={entry.storeLogoUrl} size={40} />
          <View style={{gap: 1, alignItems: 'flex-start', flex: 1}}>
            <Text style={[type.bodyMedium, {color: palette.ink, fontFamily: fonts.bold}]} numberOfLines={1}>
              {entry.storeName}
            </Text>
            <Text style={[{fontSize: 10.5, color: palette.brandDark}]}>
              سلة مستقلة · {entry.lines.length} منتجاً
            </Text>
          </View>
          <Icon name="chevronLeft" size={16} color={palette.brandDark} />
        </Pressable>
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`إفراغ سلة ${entry.storeName}`}
          style={[cardStyles.clearChip, {backgroundColor: palette.surface, borderColor: palette.line}]}>
          <Icon name="trash" size={14} color={palette.danger} />
        </Pressable>
      </View>

      {/* الأصناف — العدّاد محدود بالمخزون المتاح (v3.3: كل صنف
       * بطاقة مضمنة بحدودها وصورة حرفية للهوية، كبطاقات السلة
       * العالمية — لا فوارق باهتة بين سطور متلاصقة). */}
      <View style={cardStyles.linesWrap}>
      {entry.lines.map(line => {
        const cap = line.stock > 0 ? line.stock : undefined;
        const overStock = line.stock > 0 && line.quantity > line.stock + 0.0001;
        const initial = line.name.trim().charAt(0) || '؟';
        return (
          <View
            key={line.key}
            style={[cardStyles.line, {backgroundColor: palette.surfaceAlt, borderColor: palette.line}]}>
            {/* بلاطة حرفية — هوية بصرية للصنف رغم غياب الصورة في السلة */}
            <View style={[cardStyles.lineTile, {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder}]}>
              <Text style={{fontSize: 17, fontFamily: fonts.black, color: palette.brandDark}}>
                {initial}
              </Text>
            </View>
            <View style={{flex: 1, gap: 3, alignItems: 'flex-start'}}>
              <Text style={[type.smallMedium, {color: palette.ink, fontFamily: fonts.bold}]} numberOfLines={2}>
                {line.name}
              </Text>
              {line.variant != null ? (
                <View style={[cardStyles.variantChip, {backgroundColor: palette.brandSoft}]}>
                  <Icon name="sliders" size={10} color={palette.brandDark} />
                  <Text style={{fontSize: 10.5, color: palette.brandDark, fontFamily: fonts.medium}} numberOfLines={1}>
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
              {overStock ? (
                <Text style={{fontSize: 10, color: palette.warning, fontFamily: fonts.medium}}>
                  المتاح حالياً {formatQty(line.stock, line.soldByWeight)} — قلّل الكمية
                </Text>
              ) : null}
            </View>
            <View style={{alignItems: 'center', gap: 6}}>
              <QtyStepper
                qty={line.quantity}
                soldByWeight={line.soldByWeight}
                compact
                max={cap}
                onIncrease={() => useCartStore.getState().increment(entry.storeId, line.key)}
                onDecrease={() => useCartStore.getState().decrement(entry.storeId, line.key)}
              />
              <Pressable onPress={() => useCartStore.getState().removeLine(entry.storeId, line.key)} hitSlop={6}>
                <Text style={[{fontSize: 10.5, color: palette.danger}]}>إزالة</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      </View>

      {/* العنوان — مشترك، ذكي: الافتراضي معبأ مسبقاً */}
      <View style={[cardStyles.section, {borderTopColor: palette.line}]}>
        <View style={cardStyles.sectionHead}>
          <View style={[cardStyles.sectionIcon, {backgroundColor: palette.brandSoft}]}>
            <Icon name="pin" size={13} color={palette.brandDark} />
          </View>
          <Text style={[type.small, {color: palette.ink, fontFamily: fonts.bold, flex: 1}]}>
            عنوان التسليم
          </Text>
          {addressValid ? (
            <Icon name="checkCircle" size={14} color={palette.success} />
          ) : null}
        </View>
        {/* عناوين الحساب المحفوظة — لمسة تُعبّئ العنوان ومنطقته
         * (المنطقة تطابق منطقة التوصيل تلقائياً — «احتساب ذكي»). */}
        {serverAddresses.length > 0 ? (
          <View style={{gap: 5}}>
            {serverAddresses.slice(0, 4).map(a => {
              const active = selectedAddressId === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => onPickServerAddress(a)}
                  style={[
                    cardStyles.addrChip,
                    {
                      backgroundColor: active ? palette.brandSoft : palette.surfaceAlt,
                      borderColor: active ? palette.brand : palette.line,
                    },
                  ]}>
                  <Icon
                    name={active ? 'checkCircle' : 'pin'}
                    size={13}
                    color={active ? palette.brandDark : palette.muted}
                  />
                  <View style={{flex: 1, gap: 1, alignItems: 'flex-start'}}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: palette.ink,
                        fontFamily: active ? fonts.bold : fonts.medium,
                      }}
                      numberOfLines={1}>
                      {a.label}
                      {a.is_default === 1 ? '  · الافتراضي' : ''}
                    </Text>
                    <Text style={{fontSize: 10, color: palette.muted}} numberOfLines={1}>
                      {addressLine(a)}
                    </Text>
                  </View>
                  {a.region ? (
                    <View style={[cardStyles.regionTag, {backgroundColor: palette.surface}]}>
                      <Text style={{fontSize: 9.5, color: palette.brandDark, fontFamily: fonts.medium}}>
                        {a.region}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Field
          label=""
          value={address}
          onChangeText={onAddressText}
          placeholder="الحي، الشارع، رقم البناية…"
          icon="pin"
          maxLength={200}
        />
        {selectedAddressId == null && savedAddresses.length > 0 ? (
          <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 2}}>
            {savedAddresses.slice(0, 3).map(a => (
              <Pressable
                key={a}
                onPress={() => onAddressText(a)}
                style={[cardStyles.savedChip, {backgroundColor: palette.surfaceAlt, borderColor: palette.line}]}>
                <Icon name="clock" size={12} color={palette.muted} />
                <Text style={[{fontSize: 11, color: palette.inkSoft}]} numberOfLines={1}>
                  {a.length > 26 ? `${a.slice(0, 26)}…` : a}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* التوصيل — منطقة تلقائية بذكاء + رسمها */}
      <View style={cardStyles.section}>
        <View style={cardStyles.sectionHead}>
          <View style={[cardStyles.sectionIcon, {backgroundColor: palette.brandSoft}]}>
            <Icon name="truck" size={13} color={palette.brandDark} />
          </View>
          <Text style={[type.small, {color: palette.ink, fontFamily: fonts.bold, flex: 1}]}>
            التوصيل
          </Text>
          {selectedRegion != null ? (
            <Text style={{fontSize: 11, color: palette.muted}}>
              {formatMoney(deliveryFee)}
            </Text>
          ) : null}
        </View>
        {regionsLoading ? (
          <Text style={[{fontSize: 11.5, color: palette.muted}]}>جارٍ جلب مناطق التوصيل…</Text>
        ) : regionsError != null ? (
          <Pressable onPress={() => void loadRegions()} style={{alignSelf: 'flex-start'}}>
            <Text style={{fontSize: 11.5, color: palette.brandDark, fontFamily: fonts.bold}}>
              {regionsError} · إعادة المحاولة
            </Text>
          </Pressable>
        ) : regions.length === 0 ? (
          <Text style={[{fontSize: 11.5, color: palette.danger}]}>
            المتجر لم يضبط مناطق توصيل بعد — لا يمكن إتمام الطلب
          </Text>
        ) : (
          <View style={cardStyles.regionWrap}>
            {regions.map(r => {
              const active = r.name === regionName;
              return (
                <Pressable
                  key={r.name}
                  onPress={() => setRegionName(r.name)}
                  style={[
                    cardStyles.regionChip,
                    {
                      backgroundColor: active ? palette.brand : palette.surface,
                      borderColor: active ? palette.brand : palette.lineStrong,
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: active ? '#FFFFFF' : palette.ink,
                      fontFamily: active ? fonts.bold : fonts.medium,
                    }}>
                    {r.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: active ? 'rgba(255,255,255,0.85)' : palette.muted,
                      fontFamily: fonts.medium,
                    }}>
                    {formatMoney(r.fee_minor)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* ملاحظة اختيارية — صغيرة ومنطوية افتراضياً */}
      {!noteOpen ? (
        <Pressable
          onPress={() => setNoteOpen(true)}
          style={{alignSelf: 'flex-start', paddingVertical: 2}}
          hitSlop={6}>
          <Text style={{fontSize: 11.5, color: palette.brandDark, fontFamily: fonts.bold}}>
            + ملاحظة للمتجر (اختياري)
          </Text>
        </Pressable>
      ) : (
        <Field
          label="ملاحظة للمتجر"
          value={note}
          onChangeText={setNote}
          placeholder="مثال: الاتصال قبل الوصول بنصف ساعة"
          maxLength={300}
          multiline
          icon="note"
        />
      )}

      {/* v3.3: الملخص — الإجمالي داخل لوحة بارزة (brandSoft) بجانب
       * رقاقة الدفع نقداً؛ الفصل البصري يلفت العين لمبلغ الطلب. */}
      <View style={cardStyles.foot}>
        <View style={{gap: 4, alignItems: 'flex-start', flex: 1}}>
          <View style={cardStyles.sumRow}>
            <Text style={{fontSize: 11, color: palette.muted}}>المنتجات</Text>
            <Text style={{fontSize: 12, color: palette.ink, fontFamily: fonts.medium}}>
              {formatMoney(itemsSubtotal)}
            </Text>
          </View>
          {cartSavings(entry.lines) > 0 ? (
            <View style={cardStyles.sumRow}>
              <Text style={{fontSize: 11, color: palette.success, fontFamily: fonts.medium}}>
                وفّرت من الخصومات
              </Text>
              <Text style={{fontSize: 12, color: palette.success, fontFamily: fonts.bold}}>
                −{formatMoney(cartSavings(entry.lines))}
              </Text>
            </View>
          ) : null}
          <View style={cardStyles.sumRow}>
            <Text style={{fontSize: 11, color: palette.muted}}>
              التوصيل {selectedRegion != null ? `(${selectedRegion.name})` : ''}
            </Text>
            <Text style={{fontSize: 12, color: palette.ink, fontFamily: fonts.medium}}>
              {formatMoney(deliveryFee)}
            </Text>
          </View>
        </View>
        <View
          style={[
            cardStyles.totalPanel,
            {backgroundColor: palette.brandSoft, borderColor: palette.brandBorder},
          ]}>
          <View style={{gap: 4, alignItems: 'flex-start', flex: 1}}>
            <Text style={{fontSize: 12.5, color: palette.ink, fontFamily: fonts.bold}}>
              الإجمالي
            </Text>
            <View style={[cardStyles.cashChip, {backgroundColor: palette.surface, borderColor: palette.brandBorder}]}>
              <Icon name="cash" size={11} color={palette.brandDark} />
              <Text style={{fontSize: 10, color: palette.brandDark, fontFamily: fonts.medium}}>
                الدفع نقداً عند الاستلام
              </Text>
            </View>
          </View>
          <Text style={{fontSize: 20, color: palette.brandDark, fontFamily: fonts.black}}>
            {formatMoney(total)}
          </Text>
        </View>
      </View>

      {lastSendError != null ? (
        <View style={[cardStyles.errorRow, {borderColor: palette.warning}]}>
          <Icon name="warning" size={14} color={palette.warning} />
          <Text style={{flex: 1, fontSize: 11, color: palette.warning, fontFamily: fonts.medium, lineHeight: 16}}>
            {lastSendError} — طلبك لم يُرسل بعد؛ أعد الضغط. إعادة الضغط لا تنشئ طلباً مكرراً.
          </Text>
        </View>
      ) : null}

      {/* v3.3: زر الفعل الأساسي بحجم 44 القياسي العالمي — طلب
       * التاجر نفسه (40–44px للفعل الأساسي)؛ الصغير 36 كان للثانوي. */}
      <View style={{paddingHorizontal: spacing.md, paddingBottom: spacing.md}}>
        <Button
          label={placing ? 'جارٍ إرسال الطلب…' : `إتمام الطلب — ${formatMoney(total)}`}
          icon="cash"
          onPress={() => void submit()}
          loading={placing}
          disabled={!ready}
          haptic="success"
        />
      </View>
      {!ready ? (
        <Text style={[{fontSize: 10.5, color: palette.warning, textAlign: 'center', marginTop: 2, marginBottom: spacing.sm, marginHorizontal: spacing.md}]}>
          {regions.length === 0
            ? 'المتجر بلا مناطق توصيل حالياً'
            : regionName == null
              ? 'اختر منطقة التوصيل'
              : 'أكمل عنوان التسليم لتفعيل الزر'}
        </Text>
      ) : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  group: {borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden'},
  /* v3.3: رأس المتجر — شريط هوية ملون. */
  groupHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  storeRow: {flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, flex: 1},
  /* v3.3: زر إفراغ السلة — رقاقة حدودية بدل أيقونة عارية. */
  clearChip: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* v3.3: حاوية الأصناف — مساحة تنفس حول بطاقات الأصناف. */
  linesWrap: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  /* v3.3: صنف السلة — بطاقة مضمنة بحدودها وخلفية surfaceAlt. */
  line: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
  },
  /* v3.3: بلاطة حرفية 44×44 — هوية الصنف كبطاقات السلة العالمية. */
  lineTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  section: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    gap: 8,
  },
  sectionHead: {flexDirection: 'row-reverse', alignItems: 'center', gap: 8},
  /* v3.3: رقاقة أيقونة القسم — مربع ناعم 26×26 بلون brandSoft. */
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 190,
  },
  /* v2.8: رقاقة عنوان حساب محفوظ — سطر مضغوط بلمسة واحدة. */
  addrChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  regionTag: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  regionWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  regionChip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    gap: 1,
    alignItems: 'center',
  },
  foot: {
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sumRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    width: '100%',
  },
  /* v3.3: لوحة الإجمالي البارزة — خلفية brandSoft وحد brandBorder
   * ورقم كبير 20px؛ تجذب العين لمبلغ الطلب فوراً. */
  totalPanel: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  /* v3.3: رقاقة طريقة الدفع داخل لوحة الإجمالي. */
  cashChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  errorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
});
