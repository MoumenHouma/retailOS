import { create } from "zustand";

export interface AiNotification {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  receivedAt: number;
}

interface AiNotificationsState {
  notifications: AiNotification[];
  unreadCount: number;
  connected: boolean;
  setConnected: (connected: boolean) => void;
  push: (event: string, payload: Record<string, unknown>) => void;
  markAllRead: () => void;
}

export const useAiNotificationsStore = create<AiNotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  connected: false,
  setConnected: (connected) => set({ connected }),
  push: (event, payload) =>
    set((state) => ({
      notifications: [
        { id: crypto.randomUUID(), event, payload, receivedAt: Date.now() },
        ...state.notifications,
      ].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),
  markAllRead: () => set({ unreadCount: 0 }),
}));
