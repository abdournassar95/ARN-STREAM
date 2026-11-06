import { create } from 'zustand';
import { fetchAuthStatus, loginApi, setupAdminApi, logoutApi } from '../api/client';

/**
 * Auth store — cookie based.
 * The session JWT lives in an httpOnly cookie set by the server, so it is never
 * readable from JavaScript and cannot be exfiltrated through XSS.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: true,
  hasLibraries: true, // Default true to prevent flashing onboarding
  isLoading: true,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const data = await fetchAuthStatus();

      set({
        isInitialized: data.initialized,
        isAuthenticated: Boolean(data.authenticated),
        hasLibraries: data.hasLibraries ?? true,
        user: data.user || null,
        isLoading: false
      });
      return data;
    } catch (err) {
      console.error('[Auth Store] Check auth failed', err);
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
      return { initialized: true, authenticated: false, user: null };
    }
  },

  login: async (username, password) => {
    const res = await loginApi({ username, password });
    if (res?.user) {
      set({
        user: res.user,
        isAuthenticated: true,
        isInitialized: true,
        hasLibraries: res.hasLibraries ?? true
      });
    }
    return res;
  },

  setupAdmin: async ({ username, password, display_name }) => {
    const res = await setupAdminApi({ username, password, display_name });
    if (res?.user) {
      set({
        user: res.user,
        isAuthenticated: true,
        isInitialized: true,
        hasLibraries: false // By definition, after setup they have no libraries
      });
    }
    return res;
  },

  logout: async () => {
    try {
      await logoutApi();
    } catch (err) {
      // Ignore network errors: local state is cleared regardless.
    }
    set({
      user: null,
      isAuthenticated: false
    });
  },

  setUser: (user) => set({ user }),

  isAdmin: () => {
    const { user } = get();
    return user?.role === 'admin';
  },

  canDownload: () => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.can_download !== false && user.can_download !== 0;
  },

  canCast: () => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.can_cast !== false && user.can_cast !== 0;
  }
}));
