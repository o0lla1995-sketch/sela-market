/**
 * react-native-mmkv shim for Jest — a plain Map with the exact accessor
 * semantics the app relies on (getString/getNumber/getBoolean return
 * undefined when missing; set stores the typed value).
 *
 * v2.6: instances sharing the same id now share one backing Map —
 * exactly like the real MMKV (same id → same file on disk). This lets
 * persistence tests simulate an app restart: write via one module
 * instance, jest.resetModules(), require fresh — the data survives.
 *
 * v2.6.1: السجل مثبّت على globalThis لا على نطاق الوحدة —
 * jest.resetModules() يعيد تقييم الوحدة فيولّد سجلاً فارغاً جديداً
 * فتموت البيانات بين «التشغيلين» ويفشل اختبار الإقلاع رغم سلامة
 * منطق التطبيق نفسه. الجهاز الحقيقي يقرأ من ملف على القرص عبر
 * نسخ الوحدة كافة — محاكاة ذلك تستلزم سجلاً يعيش أطول من تقييم
 * الوحدة نفسه.
 */
'use strict';

function __registry() {
  var g = globalThis;
  if (!g.__SELA_MMKV_REGISTRY) {
    g.__SELA_MMKV_REGISTRY = new Map();
  }
  return g.__SELA_MMKV_REGISTRY;
}

class MMKV {
  constructor({id} = {}) {
    this.__id = String(id != null ? id : 'default');
  }

  /** The live backing map for this instance's id (shared globally). */
  __backing() {
    const registry = __registry();
    if (!registry.has(this.__id)) {
      registry.set(this.__id, new Map());
    }
    return registry.get(this.__id);
  }

  set(key, value) {
    this.__backing().set(key, value);
  }

  getString(key) {
    const value = this.__backing().get(key);
    return typeof value === 'string' ? value : undefined;
  }

  getNumber(key) {
    const value = this.__backing().get(key);
    return typeof value === 'number' ? value : undefined;
  }

  getBoolean(key) {
    const value = this.__backing().get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  delete(key) {
    this.__backing().delete(key);
  }

  contains(key) {
    return this.__backing().has(key);
  }

  clearAll() {
    this.__backing().clear();
  }

  getAllKeys() {
    return Array.from(this.__backing().keys());
  }
}

/* لاختبارات العزل الكامل (بدء تطبيق جديد نظيف). */
MMKV.__resetAll = function resetAll() {
  __registry().clear();
};

module.exports = {MMKV};
