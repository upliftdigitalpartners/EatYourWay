import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  onPress: () => void;
  enabled?: boolean;
}

export function EatButton({ onPress, enabled = true }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        pressed && styles.pressed,
        !enabled && styles.disabled,
      ]}
      onPress={() => {
        if (!enabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      hitSlop={12}
    >
      <Text style={styles.label}>EAT</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    bottom: 48,
    right: 24,
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3d8b',
    shadowColor: '#ff3d8b',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  pressed: { transform: [{ scale: 0.92 }] },
  disabled: { opacity: 0.35 },
  label: { color: 'white', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});
