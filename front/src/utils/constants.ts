export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
export const API_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT ?? 10000);

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  QUESTIONS_CACHE: 'questions_cache',
  GROUPS_CACHE: 'groups_cache',
} as const;

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
