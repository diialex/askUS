import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter, useSegments } from 'expo-router';
import { authApi } from '@api/auth';
import { profileApi } from '@api/profile';
import { clearAllCache } from '@store/cache';
import { STORAGE_KEYS } from '@utils/constants';
import { secureStorage } from '@utils/storage';
import type { User, LoginRequest, RegisterRequest, AuthTokens } from '@/types';

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
  /** Actualiza el usuario en memoria sin hacer una llamada a la API */
  updateUserLocally: (partial: Partial<User>) => void;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

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

  // ── Guardar tokens en SecureStore/localStorage ────────────────────────────

  const saveTokens = async (tokens: AuthTokens) => {
    await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    if (tokens.refresh_token) {
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    }
  };

  const clearTokens = async () => {
    await secureStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  };

  // ── Cargar sesión al arrancar ──────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (!token) {
          // Sin token: permite navegación en modo demo/offline
          setState({ user: null, isLoading: false, isAuthenticated: false });
          return;
        }

        // GET /auth/me → ApiResponse<UserResponse> → response.data = { success, data: User, message }
        const { data } = await profileApi.getMe();
        setState({ user: data.data, isLoading: false, isAuthenticated: true });
      } catch (error) {
        console.error('Auth initialization error:', error);
        await clearTokens();
        // En caso de error, permite navegar sin autenticación
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  // ── Redirección basada en autenticación ────────────────────────────────────

  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (state.isAuthenticated && inAuthGroup) {
      // Autenticado en pantalla de auth → va a los tabs
      router.replace('/(tabs)');
    } else if (!state.isAuthenticated && !inAuthGroup) {
      // No autenticado intentando acceder a tabs → va al login
      router.replace('/(auth)/login');
    }
  }, [state.isAuthenticated, state.isLoading, segments]);

  // ── Acciones ───────────────────────────────────────────────────────────────

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    const { user, tokens } = response.data.data;
    await saveTokens(tokens);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    const { user, tokens } = response.data.data;
    await saveTokens(tokens);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Si falla el logout remoto igual limpiamos localmente
    }
    await clearTokens();
    await clearAllCache();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await profileApi.getMe();
    setState((prev) => ({ ...prev, user: data.data }));
  }, []);

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
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
