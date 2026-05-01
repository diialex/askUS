import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage abstraction that uses:
 * - expo-secure-store on native platforms
 * - localStorage on web
 */

const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error('localStorage.setItem failed:', e);
      }
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (e) {
        console.error('SecureStore.setItemAsync failed:', e);
      }
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.error('localStorage.getItem failed:', e);
        return null;
      }
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (e) {
        console.error('SecureStore.getItemAsync failed:', e);
        return null;
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('localStorage.removeItem failed:', e);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        console.error('SecureStore.deleteItemAsync failed:', e);
      }
    }
  },
};
