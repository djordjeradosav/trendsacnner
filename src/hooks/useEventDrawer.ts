import { create } from "zustand";
import type { EconomicEvent } from "@/hooks/useEconomicCalendar";

interface EventDrawerState {
  isOpen: boolean;
  event: EconomicEvent | null;
  initialTab: string;
  open: (event: EconomicEvent, tab?: string) => void;
  close: () => void;
  setTab: (tab: string) => void;
}

export const useEventDrawer = create<EventDrawerState>((set) => ({
  isOpen: false,
  event: null,
  initialTab: "overview",
  open: (event, tab = "overview") => set({ isOpen: true, event, initialTab: tab }),
  close: () => set({ isOpen: false, event: null, initialTab: "overview" }),
  setTab: (tab) => set({ initialTab: tab }),
}));
