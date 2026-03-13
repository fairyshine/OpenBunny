import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IPlatformStorage } from '@openbunny/shared/platform';

/**
 * React Native storage implementation using AsyncStorage
 */
export const nativeStorage: IPlatformStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('[Storage] getItem failed:', key, error);
      return null;
    }
  },

  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('[Storage] setItem failed:', key, error);
    }
  },

  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[Storage] removeItem failed:', key, error);
    }
  },
};
