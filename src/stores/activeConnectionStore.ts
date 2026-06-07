import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface TableInfo {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
}

interface ActiveConnectionState {
  activeConnectionId: string | null;
  activeDatabase: string | null;
  databases: string[];
  tables: TableInfo[];
  selectedTable: string | null;
  selectedTableSchema: TableInfo | null;
  tableData: {
    columns: string[];
    rows: (string | number | boolean | null)[][];
  } | null;
  tableFilter: string;
  tableOffset: number;
  tableLimit: number;
  tableTotalCount: number | null;
  tableDdl: string | null;
  isLoading: boolean;
  error: string | null;

  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  fetchDatabases: () => Promise<void>;
  selectDatabase: (database: string) => Promise<void>;
  selectTable: (table: string) => Promise<void>;
  fetchTableData: () => Promise<void>;
  setTableFilter: (filter: string) => void;
  setTableOffset: (offset: number) => void;
  setTableLimit: (limit: number) => void;
  fetchTableDdl: () => Promise<void>;
  executeUpdate: (sql: string) => Promise<number>;
}

export const useActiveConnectionStore = create<ActiveConnectionState>((set, get) => ({
  activeConnectionId: null,
  activeDatabase: null,
  databases: [],
  tables: [],
  selectedTable: null,
  selectedTableSchema: null,
  tableData: null,
  tableFilter: '',
  tableOffset: 0,
  tableLimit: 100,
  tableTotalCount: null,
  tableDdl: null,
  isLoading: false,
  error: null,

  connect: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('connect_db', { id });
      set({ activeConnectionId: id, isLoading: false });
      await get().fetchDatabases();
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  disconnect: async () => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return;
    try {
      await invoke('disconnect_db', { id: activeConnectionId });
      set({
        activeConnectionId: null,
        activeDatabase: null,
        databases: [],
        tables: [],
        selectedTable: null,
        selectedTableSchema: null,
        tableData: null,
        tableFilter: '',
        tableOffset: 0,
        tableLimit: 100,
        tableTotalCount: null,
        tableDdl: null,
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  fetchDatabases: async () => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return;
    set({ isLoading: true, error: null });
    try {
      const databases = await invoke<string[]>('list_databases', { id: activeConnectionId });
      set({ databases, isLoading: false });
      if (databases.length > 0) {
        await get().selectDatabase(databases[0]);
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  selectDatabase: async (database) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return;
    set({ activeDatabase: database, tables: [], selectedTable: null, selectedTableSchema: null, tableData: null, tableDdl: null, isLoading: true });
    try {
      const tables = await invoke<TableInfo[]>('list_tables', { id: activeConnectionId, database });
      set({ tables, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  selectTable: async (table) => {
    set({ selectedTable: table, tableData: null, tableOffset: 0, tableFilter: '', tableDdl: null, isLoading: true });
    try {
      const schema = await invoke<TableInfo>('get_table_schema', {
        id: get().activeConnectionId,
        database: get().activeDatabase,
        table,
      });
      set({ selectedTableSchema: schema, isLoading: false });
      await get().fetchTableData();
      await get().fetchTableDdl();
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  fetchTableData: async () => {
    const { activeConnectionId, activeDatabase, selectedTable, tableFilter, tableOffset, tableLimit } = get();
    if (!activeConnectionId || !activeDatabase || !selectedTable) return;

    set({ isLoading: true, error: null });
    try {
      let sql = `SELECT * FROM ${selectedTable}`;
      if (tableFilter.trim()) {
        sql += ` WHERE ${tableFilter}`;
      }
      sql += ` LIMIT ${tableLimit} OFFSET ${tableOffset}`;

      const result = await invoke<{ columns: string[]; rows: any[][] }>('execute_query', {
        id: activeConnectionId,
        sql,
      });

      set({
        tableData: {
          columns: result.columns,
          rows: result.rows.map((row) =>
            row.map((cell) => {
              if (cell === null || typeof cell === 'undefined') return null;
              if (typeof cell === 'object') return JSON.stringify(cell);
              return cell as string | number | boolean;
            })
          ),
        },
        isLoading: false,
      });

      // Get total count
      try {
        let countSql = `SELECT COUNT(*) AS cnt FROM ${selectedTable}`;
        if (tableFilter.trim()) {
          countSql += ` WHERE ${tableFilter}`;
        }
        const countResult = await invoke<{ columns: string[]; rows: any[][] }>('execute_query', {
          id: activeConnectionId,
          sql: countSql,
        });
        const total = countResult.rows[0]?.[0];
        set({ tableTotalCount: typeof total === 'number' ? total : parseInt(String(total), 10) || 0 });
      } catch {
        set({ tableTotalCount: null });
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setTableFilter: (filter) => {
    set({ tableFilter: filter, tableOffset: 0 });
    get().fetchTableData();
  },

  setTableOffset: (offset) => {
    set({ tableOffset: offset });
    get().fetchTableData();
  },

  setTableLimit: (limit) => {
    set({ tableLimit: limit, tableOffset: 0 });
    get().fetchTableData();
  },

  fetchTableDdl: async () => {
    const { activeConnectionId, activeDatabase, selectedTable } = get();
    if (!activeConnectionId || !activeDatabase || !selectedTable) return;
    try {
      const ddl = await invoke<string>('get_table_ddl', {
        id: activeConnectionId,
        database: activeDatabase,
        table: selectedTable,
      });
      set({ tableDdl: ddl });
    } catch (err) {
      set({ tableDdl: `Error fetching DDL: ${err}` });
    }
  },

  executeUpdate: async (sql) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) throw new Error('No active connection');
    const affected = await invoke<number>('execute_raw', { id: activeConnectionId, sql });
    await get().fetchTableData();
    return affected;
  },
}));
