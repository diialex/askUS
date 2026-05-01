import apiClient from './client';
import type {
  User,
  UpdateProfileRequest,
  ChangePasswordRequest,
  PushTokenRequest,
  UploadResponse,
} from '@/types';

export const profileApi = {
  /** GET /users/me — FastAPI devuelve el objeto User directamente */
  getMe: () =>
    apiClient.get<User>('/users/me'),

  /** PATCH /users/me */
  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.patch<User>('/users/me', data),

  /** POST /users/me/change-password */
  changePassword: (data: ChangePasswordRequest) =>
    apiClient.post<{ message: string }>('/users/me/change-password', data),

  /** POST /users/me/push-token */
  registerPushToken: (data: PushTokenRequest) =>
    apiClient.post<{ message: string }>('/users/me/push-token', data),

  /** POST /users/me/avatar — multipart/form-data */
  uploadAvatar: (uri: string, fileName: string, mimeType: string) => {
    const form = new FormData();
    form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
    return apiClient.post<UploadResponse>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
