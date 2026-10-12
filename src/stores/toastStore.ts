/**
 * toastStore.ts — إشعارات سريعة عابرة أعلى الشاشة (نجاح/خطأ/معلومة).
 */
import {create} from 'zustand';

export interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'danger' | 'info';
}

interface ToastState {
  toasts: Toast[];
  show: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (text, tone = 'info') => {
    const id = nextId++;
    set({toasts: [...get().toasts, {id, text, tone}]});
    // إخفاء تلقائي بعد 2.6 ثانية.
    setTimeout(() => get().dismiss(id), 2600);
  },

  dismiss: (id) => {
    set({toasts: get().toasts.filter(t => t.id !== id)});
  },
}));

/** مساعد مباشر خارج المكونات. */
export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  useToastStore.getState().show(text, tone);
}
