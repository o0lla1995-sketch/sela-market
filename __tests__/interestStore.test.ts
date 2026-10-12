/**
 * interestStore.test.ts — منطق التوصيات الذكية (v2.0):
 * أوزان الإشارات (مشاهدة/مفضلة/طلب)، التلاشي الأسبوعي، أعلى
 * التصنيفات، والحدود (تجاهل الفارغ، دمج تكرار الطلب الواحد).
 */
import {useInterestStore} from '../src/stores/interestStore';

function fresh() {
  useInterestStore.setState({entries: {}});
  return useInterestStore.getState();
}

describe('interestStore — التوصيات الذكية', () => {
  test('المشاهدة ترفع الوزن 1 والمفضلة 3 والطلب 6', () => {
    const s = fresh();
    s.trackView('بقالة');
    expect(useInterestStore.getState().entries['بقالة'].score).toBe(1);
    s.trackWishlist('خضار');
    expect(useInterestStore.getState().entries['خضار'].score).toBe(3);
    s.trackOrder(['لحوم']);
    expect(useInterestStore.getState().entries['لحوم'].score).toBe(6);
  });

  test('الطلب الواحد يرفع كل تصنيفاته مرة واحدة مهما تكرر في السلة', () => {
    const s = fresh();
    s.trackOrder(['بقالة', 'بقالة', 'خضار', 'بقالة']);
    const entries = useInterestStore.getState().entries;
    expect(entries['بقالة'].score).toBe(6);
    expect(entries['خضار'].score).toBe(6);
  });

  test('topCategories ترتب بالوزن الأثقل وتتجاهل الضعيف', () => {
    const s = fresh();
    s.trackOrder(['لحوم']);       // 6
    s.trackWishlist('بقالة');     // 3
    s.trackView('خضار');          // 1
    const top = useInterestStore.getState().topCategories(3);
    expect(top).toEqual(['لحوم', 'بقالة', 'خضار']);
    // حد 2: أعلى اثنين فقط.
    expect(useInterestStore.getState().topCategories(2)).toEqual(['لحوم', 'بقالة']);
  });

  test('التصنيف الفارغ أو null يُتجاهل بصمت', () => {
    const s = fresh();
    s.trackView(null);
    s.trackView('   ');
    s.trackWishlist(undefined);
    s.trackOrder([null, '', 'بقالة']);
    const entries = useInterestStore.getState().entries;
    expect(Object.keys(entries)).toEqual(['بقالة']);
  });

  test('الإشارات المتكررة تتراكم على نفس التصنيف', () => {
    const s = fresh();
    s.trackView('بقالة');
    s.trackView('بقالة');
    s.trackWishlist('بقالة');
    s.trackOrder(['بقالة']);
    expect(useInterestStore.getState().entries['بقالة'].score).toBe(1 + 1 + 3 + 6);
  });

  test('clear يمسح كل شيء', () => {
    const s = fresh();
    s.trackOrder(['بقالة', 'خضار']);
    useInterestStore.getState().clear();
    expect(Object.keys(useInterestStore.getState().entries)).toEqual([]);
    expect(useInterestStore.getState().topCategories()).toEqual([]);
  });
});
