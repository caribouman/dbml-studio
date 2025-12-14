import { create } from 'zustand';
import { authAPI } from '../utils/api';

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' &&
         window.electronAPI &&
         window.electronAPI.isElectron === true;
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isElectron: isElectron(),

  // Initialize auth state
  initialize: async () => {
    try {
      // Auto-login for Electron
      if (isElectron()) {
        console.log('Running in Electron - auto-login enabled');
        const data = await authAPI.electronAutoLogin();
        set({ user: data.user, isAuthenticated: true, isLoading: false });
        return;
      }

      // Regular web login check
      const data = await authAPI.getCurrentUser();
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  // Register new user
  register: async (email, username, password) => {
    const data = await authAPI.register(email, username, password);
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  // Login
  login: async (email, password) => {
    const data = await authAPI.login(email, password);
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  // Logout
  logout: async () => {
    await authAPI.logout();
    set({ user: null, isAuthenticated: false });
  },

  // Login with Google
  loginWithGoogle: () => {
    authAPI.loginWithGoogle();
  },

  // Login with GitHub
  loginWithGitHub: () => {
    authAPI.loginWithGitHub();
  },
}));
