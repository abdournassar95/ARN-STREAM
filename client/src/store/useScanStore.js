import { create } from 'zustand';
import client from '../api/client';

export const useScanStore = create((set, get) => ({
  isScanning: false,
  progress: 0,
  current: 0,
  total: 0,
  currentFile: '',
  libraryName: '',
  phase: 'idle',
  newItems: [],
  isDetailsModalOpen: false,
  isToastVisible: false,
  lastScanTime: null,

  // Set real-time progress received from WebSocket / SSE
  updateProgress: (data) => {
    set({
      isScanning: true,
      progress: data.progress ?? 0,
      current: data.current ?? 0,
      total: data.total ?? 0,
      currentFile: data.currentFile || '',
      libraryName: data.libraryName || '',
      phase: data.phase || 'scanning',
      // If server sends new count
      newCount: data.newCount || 0
    });
  },

  // Set scan completion
  completeScan: (data) => {
    const items = data.newItems || [];
    set({
      isScanning: false,
      progress: 100,
      currentFile: '',
      phase: 'completed',
      newItems: items,
      isToastVisible: items.length > 0,
      lastScanTime: Date.now()
    });

    // Auto-hide progress after 2.5s
    setTimeout(() => {
      if (!get().isScanning) {
        set({ phase: 'idle', progress: 0 });
      }
    }, 2500);
  },

  // Start scan manually
  startScan: async () => {
    if (get().isScanning) return;
    set({
      isScanning: true,
      progress: 1,
      currentFile: 'بدء الاتصال بالخادم للفحص...',
      phase: 'starting',
      newItems: [],
      isToastVisible: false
    });

    try {
      await client.post('/scan?async=true');
    } catch (err) {
      console.error('[ScanStore] Failed to trigger scan:', err);
      set({ isScanning: false, phase: 'idle', progress: 0 });
    }
  },

  // Fetch initial scan state on mount
  fetchStatus: async () => {
    try {
      const res = await client.get('/scan/status');
      const data = res.data?.data;
      if (data && data.isScanning) {
        set({
          isScanning: true,
          progress: data.progress || 0,
          current: data.current || 0,
          total: data.total || 0,
          currentFile: data.currentFile || '',
          libraryName: data.libraryName || '',
          phase: data.phase || 'scanning'
        });
      }
    } catch (e) {
      // Ignore initial status fetch error
    }
  },

  openDetailsModal: () => set({ isDetailsModalOpen: true, isToastVisible: false }),
  closeDetailsModal: () => set({ isDetailsModalOpen: false }),
  dismissToast: () => set({ isToastVisible: false })
}));
