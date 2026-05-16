import * as Haptics from 'expo-haptics';

export const haptic = {
  // Light tap — button press, chip select
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  // Medium — toggle, check-in confirm
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  // Heavy — task completion, major action
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  // Error feedback
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  // Warning
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
