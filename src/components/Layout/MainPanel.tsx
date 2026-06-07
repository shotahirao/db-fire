import React, { useState } from 'react';
import { SQLEditorPanel } from '../Editor/SQLEditorPanel';
import { TableBrowser } from '../TableBrowser/TableBrowser';
import { useEditorStore } from '../../stores/editorStore';

type ViewMode = 'editor' | 'browser';

export const MainPanel: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('browser');
  const { addTab } = useEditorStore();

  const openEditor = () => {
    addTab();
    setViewMode('editor');
  };

  const closeEditor = () => {
    setViewMode('browser');
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-main-bg)] overflow-hidden">
      {/* Content */}
      {viewMode === 'editor' ? (
        <SQLEditorPanel onClose={closeEditor} />
      ) : (
        <TableBrowser onNewQuery={openEditor} />
      )}
    </div>
  );
};
