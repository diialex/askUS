import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL, API_TIMEOUT, STORAGE_KEYS } from '@utils/constants';
import { secureStorage } from '@utils/storage';
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

        // Backend responde: { success, data: { user, tokens: { access_token, refresh_token } } }
        const newToken: string = data.data?.tokens?.access_token;
        const newRefresh: string | undefined = data.data?.tokens?.refresh_token;

        await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);
        if (newRefresh) {
          await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefresh);
        }

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

// ─── Helper: normaliza errores de FastAPI ─────────────────────────────────────
//
// FastAPI devuelve:
//   { detail: "mensaje" }                         ← HTTPException estándar
//   { detail: [{ loc, msg, type }] }              ← validación Pydantic
//   { success: false, message: "..." }            ← errores custom del proyecto

function buildApiError(error: AxiosError): ApiError {
  const body = error.response?.data as Record<string, unknown> | undefined;

  let message = 'Error desconocido';

  if (typeof body?.detail === 'string') {
    message = body.detail;
  } else if (Array.isArray(body?.detail)) {
    const first = (body.detail as Array<{ msg?: string }>)[0];
    message = first?.msg ?? message;
  } else if (typeof body?.message === 'string') {
    message = body.message;
  } else if (error.message === 'Network Error') {
    message = 'No se pudo conectar con el servidor. Comprueba tu conexión.';
  } else if (error.message) {
    message = error.message;
  }

  return { message, status: error.response?.status };
}

export default apiClient;
