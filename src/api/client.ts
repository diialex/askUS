import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, API_TIMEOUT, STORAGE_KEYS } from '@utils/constants';
import type { ApiError } from '@/types';

// ─── Instancia principal ──────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request: inyecta el Bearer token ────────────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response: refresca token en 401 y normaliza errores ─────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        processQueue(error, null);
        isRefreshing = false;
        return Promise.reject(normalizeError(error));
      }

      try {
        // FastAPI: POST /auth/refresh con { refresh_token }
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newToken: string = data.access_token;
        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, newToken);
        if (data.refresh_token) {
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        }

        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        original.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return apiClient(original);
      } catch (refreshErr) {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        processQueue(refreshErr, null);
        return Promise.reject(normalizeError(error));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

// ─── Helper: extrae el mensaje de error de FastAPI ────────────────────────────
// FastAPI devuelve { detail: "..." } o { detail: [{ msg: "..." }] }

function normalizeError(error: AxiosError): ApiError {
  const responseData = error.response?.data as Record<string, unknown> | undefined;
  const detail = responseData?.detail;

  let message = 'Error desconocido';
  if (typeof detail === 'string') {
    message = detail;
  } else if (Array.isArray(detail) && detail[0]?.msg) {
    message = detail.map((d: { msg: string }) => d.msg).join(', ');
  } else if (typeof responseData?.message === 'string') {
    message = responseData.message;
  } else if (error.message) {
    message = error.message;
  }

  return {
    detail: typeof detail === 'string' ? detail : undefined,
    message,
    status: error.response?.status,
  };
}

export default apiClient;
