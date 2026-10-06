import { useSyncExternalStore } from 'react';

// Окно заявки: открывается с любой кнопки страницы, кнопка тарифа подставляет свой тариф.
interface LeadDialogState { open: boolean; plan: string | null }

let state: LeadDialogState = { open: false, plan: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openLead(plan: string | null = null): void {
  state = { open: true, plan };
  emit();
}

export function closeLead(): void {
  state = { ...state, open: false };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useLeadDialog = (): LeadDialogState => useSyncExternalStore(subscribe, () => state);
