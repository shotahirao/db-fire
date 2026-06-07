import { create } from 'zustand';

interface EditorTab {
  id: string;
  title: string;
  content: string;
  results: {
    columns: string[];
    rows: (string | number | boolean | null)[][];
    affectedRows?: number;
  } | null;
  isExecuting: boolean;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  queryHistory: string[];

  addTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  setTabResults: (id: string, results: EditorTab['results']) => void;
  setTabExecuting: (id: string, isExecuting: boolean) => void;
  addToHistory: (query: string) => void;
}

let tabCounter = 1;

const createNewTab = (): EditorTab => ({
  id: `query-${tabCounter++}-${Date.now()}`,
  title: `Query ${tabCounter - 1}`,
  content: '',
  results: null,
  isExecuting: false,
});

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [createNewTab()],
  activeTabId: null,
  queryHistory: [],

  addTab: () => {
    const newTab = createNewTab();
    set({ tabs: [...get().tabs, newTab], activeTabId: newTab.id });
  },

  closeTab: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    if (tabs.length === 0) {
      const newTab = createNewTab();
      set({ tabs: [newTab], activeTabId: newTab.id });
    } else {
      const activeTabId = get().activeTabId === id ? tabs[tabs.length - 1].id : get().activeTabId;
      set({ tabs, activeTabId });
    }
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  updateTabContent: (id, content) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, content } : t)),
    });
  },

  setTabResults: (id, results) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, results } : t)),
    });
  },

  setTabExecuting: (id, isExecuting) => {
    set({
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, isExecuting } : t)),
    });
  },

  addToHistory: (query) => {
    const history = get().queryHistory;
    if (history.length === 0 || history[history.length - 1] !== query) {
      set({ queryHistory: [...history.slice(-49), query] });
    }
  },
}));
