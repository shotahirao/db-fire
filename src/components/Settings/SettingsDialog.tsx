import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
  const { autoUpdateEnabled, setAutoUpdateEnabled } = useSettingsStore();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[var(--color-panel-bg)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-text-muted)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="autoUpdate" className="text-sm font-medium">
                  Automatic Updates
                </label>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Check for updates on app startup
                </p>
              </div>
              <button
                id="autoUpdate"
                role="switch"
                aria-checked={autoUpdateEnabled}
                onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  autoUpdateEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    autoUpdateEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 rounded text-sm bg-[var(--color-accent)] text-[var(--color-main-bg)] font-medium hover:bg-[var(--color-accent-hover)]"
              >
                Done
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
