import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL, API_TIMEOUT, STORAGE_KEYS } from '@utils/constants';
import { secureStorage } from '@utils/storage';
import type { ApiError } from '@/types';

// ─── Instancia principal ──────────────────────────────────────────────────────

const baseURL = 'http://192.168.1.47:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Interceptor de request: inyecta el token ─────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Interceptor de response: refresca token y maneja errores ─────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        processQueue(error, null);
        isRefreshing = false;
        // El AuthContext escuchará el 401 para cerrar sesión
        return Promise.reject(buildApiError(error));
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newToken: string = data.tokens?.access_token ?? data.access_token;
        await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);

        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await secureStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        return Promise.reject(buildApiError(error));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(buildApiError(error));
  },
);

// ─── Helper: normaliza errores de la API ──────────────────────────────────────

function buildApiError(error: AxiosError): ApiError {
  const responseData = error.response?.data as Record<string, unknown> | undefined;
  return {
    message:
      (responseData?.message as string) ??
      error.message ??
      'Error desconocido',
    errors: responseData?.errors as Record<string, string[]> | undefined,
    status: error.response?.status,
  };
}

export default apiClient;
