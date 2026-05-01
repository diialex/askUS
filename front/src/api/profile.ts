import apiClient from './client';
import type {
  User,
  UpdateProfileRequest,
  ChangePasswordRequest,
  PushTokenRequest,
  UploadResponse,
  ApiResponse,
} from '@/types';

export const profileApi = {
  /** Obtener perfil del usuario autenticado */
  getMe: () =>
    apiClient.get<ApiResponse<User>>('/auth/me'),

  /** Actualizar datos del perfil */
  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.put<ApiResponse<User>>('/auth/me', data),

  /** Cambiar contraseña */
  changePassword: (data: ChangePasswordRequest) =>
    apiClient.post<ApiResponse<null>>('/profile/change-password', data),

  /** Registrar push token para notificaciones */
  registerPushToken: (data: PushTokenRequest) =>
    apiClient.post<ApiResponse<null>>('/profile/push-token', data),

  /** Subir avatar — envía multipart/form-data */
  uploadAvatar: (uri: string, fileName: string, mimeType: string) => {
    const form = new FormData();
    form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
    return apiClient.post<ApiResponse<UploadResponse>>('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
