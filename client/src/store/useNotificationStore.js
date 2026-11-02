import { create } from 'zustand';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotificationApi,
  clearAllNotificationsApi
} from '../api/client';

let globalAudioCtx = null;

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!globalAudioCtx) {
      globalAudioCtx = new AudioContext();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }

    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();

    const now = globalAudioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, now); // G5 note
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12); // C6 note

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(globalAudioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch {}
}

const getStoredSoundPreference = () => {
  try {
    const stored = localStorage.getItem('arn_notification_sound');
    return stored !== null ? stored === 'true' : true;
  } catch {
    return true;
  }
};

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isDrawerOpen: false,
  toasts: [],
  soundEnabled: getStoredSoundPreference(),
  isInitialized: false,

  initListeners: () => {
    if (get().isInitialized || typeof window === 'undefined') return;

    // 1. الاستماع للإشعارات الواردة عبر WebSocket
    window.addEventListener('arn-notification', (e) => {
      if (e.detail) {
        get().addNotification(e.detail);
      }
    });

    window.addEventListener('arn-notification-all-read', () => {
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0
      }));
    });

    window.addEventListener('arn-notification-cleared', () => {
      set({ notifications: [], unreadCount: 0 });
    });

    window.addEventListener('arn-notification-deleted', (e) => {
      if (e.detail?.id) {
        set((state) => {
          const target = state.notifications.find((n) => n.id === e.detail.id);
          const wasUnread = target && !target.read;
          return {
            notifications: state.notifications.filter((n) => n.id !== e.detail.id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
          };
        });
      }
    });

    set({ isInitialized: true });
    get().fetchNotificationsList();
  },

  fetchNotificationsList: async () => {
    try {
      const data = await fetchNotifications({ limit: 50 });
      if (data) {
        set({
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0
        });
      }
    } catch {}
  },

  addNotification: (notif) => {
    const formatted = {
      ...notif,
      read: Boolean(notif.read),
      created_at: notif.created_at || new Date().toISOString()
    };

    set((state) => {
      // تفادي التكرار إذا كان المعرف موجوداً مسبقاً
      const exists = state.notifications.some((n) => n.id === formatted.id);
      if (exists) return state;

      const updatedList = [formatted, ...state.notifications].slice(0, 80);
      const newUnread = state.unreadCount + (formatted.read ? 0 : 1);

      // إضافة Toast جديد (بحد أقصى 4 Toasts ظاهرة)
      const newToast = {
        id: formatted.id || `toast-${Date.now()}`,
        title: formatted.title,
        message: formatted.message,
        type: formatted.type || 'info',
        category: formatted.category || 'general',
        link: formatted.link
      };
      const updatedToasts = [newToast, ...state.toasts].slice(0, 4);

      return {
        notifications: updatedList,
        unreadCount: newUnread,
        toasts: updatedToasts
      };
    });

    // تشغيل نغمة صوتية ناعمة إذا كانت مفعلة
    if (get().soundEnabled) {
      playNotificationChime();
    }

    // إخفاء الـ Toast تلقائياً بعد 4.5 ثوانٍ
    const toastId = formatted.id;
    setTimeout(() => {
      get().removeToast(toastId);
    }, 4500);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  toggleSound: () => {
    set((state) => {
      const next = !state.soundEnabled;
      try {
        localStorage.setItem('arn_notification_sound', String(next));
      } catch {}
      return { soundEnabled: next };
    });
  },

  markAsRead: async (id) => {
    try {
      await markNotificationRead(id);
    } catch {}
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      const wasUnread = target && !target.read;
      return {
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  },

  markAllAsRead: async () => {
    try {
      await markAllNotificationsRead();
    } catch {}
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0
    }));
  },

  deleteNotification: async (id) => {
    try {
      await deleteNotificationApi(id);
    } catch {}
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      const wasUnread = target && !target.read;
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  },

  clearAll: async () => {
    try {
      await clearAllNotificationsApi();
    } catch {}
    set({
      notifications: [],
      unreadCount: 0
    });
  }
}));
