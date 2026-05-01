import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_TTL_MS } from '@utils/constants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Lee del caché. Devuelve null si no existe o si expiró. */
export async function getCached<T>(key: string, ttl = CACHE_TTL_MS): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/** Guarda un valor en el caché con timestamp actual. */
export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // fallo silencioso; el caché no es crítico
  }
}

/** Invalida una entrada específica del caché. */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // fallo silencioso
  }
}

/** Limpia todo el caché de la app. */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
  } catch {
    // fallo silencioso
  }
}
