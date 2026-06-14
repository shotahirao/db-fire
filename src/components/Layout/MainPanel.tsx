import React from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { QueryTabPanel } from '../Editor/QueryTabPanel';
import { TableTabPanel } from '../TableBrowser/TableTabPanel';
import { Plus, X, Terminal, Table2 } from 'lucide-react';

export const MainPanel: React.FC = () => {
  const { tabs, activeTabId, addQueryTab, closeTab, setActiveTab } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[tabs.length - 1];

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-main-bg)] overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-panel-bg)]">
        <div className="flex-1 flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-[var(--color-border)] min-w-fit ${
                activeTab?.id === tab.id
                  ? 'bg-[var(--color-main-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.type === 'query' ? (
                <Terminal size={12} className="shrink-0" />
              ) : (
                <Table2 size={12} className="shrink-0" />
              )}
              <span className="truncate max-w-[160px]">{tab.title}</span>
              <X
                size={12}
                className="shrink-0 hover:text-[var(--color-danger)]"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={addQueryTab}
          className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          title="New query"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeTab ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-3">
            <span className="text-sm">No tabs open</span>
            <button
              onClick={addQueryTab}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30"
            >
              <Plus size={12} />
              New Query
            </button>
          </div>
        ) : activeTab.type === 'query' ? (
          <QueryTabPanel tabId={activeTab.id} />
        ) : (
          <TableTabPanel tableName={activeTab.tableName} />
        )}
      </div>
    </div>
  );
};
