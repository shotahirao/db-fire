import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoUpdateEnabled: true,
      setAutoUpdateEnabled: (enabled) => set({ autoUpdateEnabled: enabled }),
    }),
    {
      name: 'db-fire-settings',
    }
  )
);
