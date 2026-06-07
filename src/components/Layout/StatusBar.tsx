import React from 'react';

export const StatusBar: React.FC = () => {
  return (
    <div className="h-7 px-3 flex items-center border-t border-[var(--color-border)] bg-[var(--color-panel-bg)] text-xs text-[var(--color-text-muted)]">
      <span>db-fire v0.1.0</span>
    </div>
  );
};
