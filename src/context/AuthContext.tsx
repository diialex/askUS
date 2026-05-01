import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { authApi } from '@api/auth';
import { profileApi } from '@api/profile';
import { clearAllCache } from '@store/cache';
import { STORAGE_KEYS } from '@utils/constants';
import type { User, LoginRequest, RegisterRequest } from '@/types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserLocally: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();
  const segments = useSegments();

  // ── Guardar / borrar tokens ────────────────────────────────────────────────

  const saveTokens = async (accessToken: string, refreshToken?: string) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  };

  const clearTokens = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  };

  // ── Cargar sesión guardada al arrancar ────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
        if (!token) {
          setState({ user: null, isLoading: false, isAuthenticated: false });
          return;
        }
        // Verifica el token pidiendo el perfil
        const { data } = await profileApi.getMe();
        setState({ user: data, isLoading: false, isAuthenticated: true });
      } catch {
        await clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  // ── Redirección automática ────────────────────────────────────────────────

  useEffect(() => {
    if (state.isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!state.isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (state.isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [state.isAuthenticated, state.isLoading, segments]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    const { user, access_token, refresh_token } = res.data;
    await saveTokens(access_token, refresh_token);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    const { user, access_token, refresh_token } = res.data;
    await saveTokens(access_token, refresh_token);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* falla silencioso */ }
    await clearTokens();
    await clearAllCache();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await profileApi.getMe();
    setState((prev) => ({ ...prev, user: data }));
  }, []);

  /** Actualiza el usuario local sin llamar a la API (después de un PUT profile) */
  const updateUserLocally = useCallback((partial: Partial<User>) => {
    setState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...partial } : prev.user,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshUser, updateUserLocally }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
