import apiClient from './client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types';

/**
 * FastAPI con OAuth2PasswordBearer usa application/x-www-form-urlencoded
 * para el endpoint /auth/token. Si tu API acepta JSON directamente, usa JSON.
 * Aquí soportamos ambos: por defecto JSON, pero puedes cambiar a formData.
 */
export const authApi = {
  /** Iniciar sesión — devuelve { access_token, token_type, user, refresh_token? } */
  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  /** Crear cuenta */
  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/auth/register', data),

  /** Cerrar sesión — invalida el token en el servidor */
  logout: () =>
    apiClient.post<void>('/auth/logout'),

  /** Solicitar restablecimiento de contraseña (manda email) */
  forgotPassword: (email: string) =>
    apiClient.post<{ message: string }>('/auth/forgot-password', { email }),

  /** Refresca el access token usando el refresh token */
  refreshToken: (refresh_token: string) =>
    apiClient.post<AuthResponse>('/auth/refresh', { refresh_token }),
};
