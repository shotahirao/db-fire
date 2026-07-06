import React, { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { Settings } from 'lucide-react';
import { SettingsDialog } from '../Settings/SettingsDialog';

export const StatusBar: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(''));
  }, []);

  return (
    <>
      <div className="h-7 px-3 flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-panel-bg)] text-xs text-[var(--color-text-muted)]">
        <span>db-fire{version ? ` v${version}` : ''}</span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1 rounded hover:bg-[var(--color-main-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
