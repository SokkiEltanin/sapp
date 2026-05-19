import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_HAPTICS = 'setting_haptics_enabled';

// In-memory cache so haptic calls don't need to await AsyncStorage
let _hapticsEnabled = true;

export const appSettings = {
  async loadAll() {
    const raw = await AsyncStorage.getItem(KEY_HAPTICS);
    _hapticsEnabled = raw !== 'false';
  },

  isHapticsEnabled(): boolean {
    return _hapticsEnabled;
  },

  async setHapticsEnabled(v: boolean): Promise<void> {
    _hapticsEnabled = v;
    await AsyncStorage.setItem(KEY_HAPTICS, v ? 'true' : 'false');
  },
};
