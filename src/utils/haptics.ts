import * as Haptics from 'expo-haptics';
import { appSettings } from './appSettings';

const ok = () => appSettings.isHapticsEnabled();

export const haptic = {
  tap:     () => ok() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium:  () => ok() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error:   () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warn:    () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
