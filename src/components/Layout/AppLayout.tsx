import React from 'react';
import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';
import { StatusBar } from './StatusBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-[var(--color-main-bg)] text-[var(--color-text)]">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainPanel />
      </div>
      <StatusBar />
    </div>
  );
};
