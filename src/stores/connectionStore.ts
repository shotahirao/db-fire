import { create } from 'zustand';
import { ConnectionConfig } from '../types/connection';
import { invoke } from '@tauri-apps/api/core';

interface ConnectionState {
  connections: ConnectionConfig[];
  isLoading: boolean;
  error: string | null;
  fetchConnections: () => Promise<void>;
  createConnection: (config: ConnectionConfig) => Promise<void>;
  updateConnection: (config: ConnectionConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  isLoading: false,
  error: null,

  fetchConnections: async () => {
    set({ isLoading: true, error: null });
    try {
      const connections = await invoke<ConnectionConfig[]>('list_connections');
      set({ connections, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createConnection: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('create_connection', { config });
      await get().fetchConnections();
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  updateConnection: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('update_connection', { config });
      await get().fetchConnections();
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  deleteConnection: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('delete_connection', { id });
      await get().fetchConnections();
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },
}));
