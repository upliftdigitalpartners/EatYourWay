import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

/** Capture a view as a PNG and open the native share sheet with it. */
export async function captureAndShare(
  viewRef: RefObject<View | null>,
  message: string,
): Promise<'shared' | 'cancelled' | 'error'> {
  if (!viewRef.current) return 'error';
  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 0.95,
      result: 'tmpfile',
    });
    const result = await Share.share({
      title: 'Eat Your Way',
      message,
      url: uri,
    });
    if (result.action === Share.dismissedAction) return 'cancelled';
    return 'shared';
  } catch {
    return 'error';
  }
}
