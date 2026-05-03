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
  /**
   * GET /auth/me
   * Devuelve el usuario autenticado.
   * Disponible ✅
   */
  getMe: () =>
    apiClient.get<ApiResponse<User>>('/auth/me'),

  /**
   * PATCH /auth/me
   * Actualiza nombre / avatar_url del usuario.
   * TODO: pendiente de implementar en el backend
   */
  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.patch<ApiResponse<User>>('/auth/me', data),

  /**
   * POST /auth/me/change-password
   * TODO: pendiente de implementar en el backend
   */
  changePassword: (data: ChangePasswordRequest) =>
    apiClient.post<ApiResponse<null>>('/auth/me/change-password', data),

  /**
   * POST /auth/me/push-token
   * TODO: pendiente de implementar en el backend
   */
  registerPushToken: (data: PushTokenRequest) =>
    apiClient.post<ApiResponse<null>>('/auth/me/push-token', data),

  /**
   * POST /auth/me/avatar — multipart/form-data
   * TODO: pendiente de implementar en el backend
   */
  uploadAvatar: (uri: string, fileName: string, mimeType: string) => {
    const form = new FormData();
    form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
    return apiClient.post<ApiResponse<UploadResponse>>('/auth/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * DELETE /auth/me
   * Elimina la cuenta y todos los datos del usuario.
   */
  deleteAccount: () =>
    apiClient.delete<ApiResponse<null>>('/auth/me'),
};
