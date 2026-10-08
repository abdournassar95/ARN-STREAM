import { create } from 'zustand';
import { fetchAuthStatus, loginApi, setupAdminApi } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('arn_auth_token') || null,
  isAuthenticated: false,
  isInitialized: true,
  hasLibraries: true, // Default true to prevent flashing onboarding
  isLoading: true,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const data = await fetchAuthStatus();
      const token = localStorage.getItem('arn_auth_token');

      set({
        isInitialized: data.initialized,
        isAuthenticated: data.authenticated && !!token,
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
    if (res.token) {
      localStorage.setItem('arn_auth_token', res.token);
      set({
        token: res.token,
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
    if (res.token) {
      localStorage.setItem('arn_auth_token', res.token);
      set({
        token: res.token,
        user: res.user,
        isAuthenticated: true,
        isInitialized: true,
        hasLibraries: false // By definition, after setup they have no libraries
      });
    }
    return res;
  },

  logout: () => {
    localStorage.removeItem('arn_auth_token');
    set({
      token: null,
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
