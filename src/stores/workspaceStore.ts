import { create } from 'zustand';

export interface QueryResults {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  affectedRows?: number;
}

export interface QueryTab {
  id: string;
  type: 'query';
  title: string;
  content: string;
  results: QueryResults | null;
  isExecuting: boolean;
  lastQuery?: string;
  lastExecutionTime?: number;
  lastAffectedRows?: number;
}

export interface TableTab {
  id: string;
  type: 'table';
  title: string;
  tableName: string;
}

export type WorkspaceTab = QueryTab | TableTab;

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  queryHistory: string[];

  addQueryTab: () => void;
  addOrActivateTableTab: (tableName: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateQueryTabContent: (id: string, content: string) => void;
  setQueryTabResults: (id: string, results: QueryResults | null) => void;
  setQueryTabExecuting: (id: string, isExecuting: boolean) => void;
  setQueryTabMeta: (
    id: string,
    meta: { lastQuery: string; lastExecutionTime: number; lastAffectedRows?: number }
  ) => void;
  addToHistory: (query: string) => void;
}

let tabCounter = 1;

const createQueryTab = (): QueryTab => {
  const num = tabCounter++;
  return {
    id: `query-${num}-${Date.now()}`,
    type: 'query',
    title: `Query ${num}`,
    content: '',
    results: null,
    isExecuting: false,
  };
};

const initialQueryTab = createQueryTab();

const createTableTab = (tableName: string): TableTab => ({
  id: `table-${tableName}-${Date.now()}`,
  type: 'table',
  title: tableName,
  tableName,
});

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [initialQueryTab],
  activeTabId: initialQueryTab.id,
  queryHistory: [],

  addQueryTab: () => {
    const newTab = createQueryTab();
    set({ tabs: [...get().tabs, newTab], activeTabId: newTab.id });
  },

  addOrActivateTableTab: (tableName) => {
    const existing = get().tabs.find((t) => t.type === 'table' && t.tableName === tableName);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const newTab = createTableTab(tableName);
    set({ tabs: [...get().tabs, newTab], activeTabId: newTab.id });
  },

  closeTab: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    if (tabs.length === 0) {
      const newTab = createQueryTab();
      set({ tabs: [newTab], activeTabId: newTab.id });
      return;
    }
    const activeTabId =
      get().activeTabId === id ? tabs[tabs.length - 1].id : get().activeTabId;
    set({ tabs, activeTabId });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  updateQueryTabContent: (id, content) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id && t.type === 'query' ? { ...t, content } : t)),
    });
  },

  setQueryTabResults: (id, results) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id && t.type === 'query' ? { ...t, results } : t)),
    });
  },

  setQueryTabExecuting: (id, isExecuting) => {
    set({
      tabs: get().tabs.map((t) =>
        t.id === id && t.type === 'query' ? { ...t, isExecuting } : t
      ),
    });
  },

  setQueryTabMeta: (id, meta) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id && t.type === 'query' ? { ...t, ...meta } : t)),
    });
  },

  addToHistory: (query) => {
    const history = get().queryHistory;
    if (history.length === 0 || history[history.length - 1] !== query) {
      set({ queryHistory: [...history.slice(-49), query] });
    }
  },
}));
