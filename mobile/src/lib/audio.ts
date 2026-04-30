import * as Haptics from 'expo-haptics';

let muted = false;
export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

/**
 * Audio in v1 = haptics. Real synth requires expo-audio + bundled wave assets,
 * which we'll add post-MVP. The API matches the web client so screens stay portable.
 */
export const sfx = {
  eat: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  gem: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  combo: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  closed: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  broke: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  end: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  click: () => !muted && Haptics.selectionAsync(),
};
