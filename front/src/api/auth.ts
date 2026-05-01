import apiClient from './client';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ApiResponse,
} from '@/types';

export const authApi = {
  /** Iniciar sesión */
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data),

  /** Crear cuenta */
  register: (data: RegisterRequest) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data),

  /** Cerrar sesión (invalida el token en el servidor) */
  logout: () =>
    apiClient.post<ApiResponse<null>>('/auth/logout'),

  /** Solicitar restablecimiento de contraseña */
  forgotPassword: (email: string) =>
    apiClient.post<ApiResponse<null>>('/auth/forgot-password', { email }),

  /** Refrescar access token */
  refreshToken: (refresh_token: string) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/refresh', { refresh_token }),
};
