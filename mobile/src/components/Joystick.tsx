import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';

interface Props {
  /** Called every frame the joystick is active. (x,y) in [-1, 1]. */
  onMove: (x: number, y: number) => void;
}

const RADIUS = 50;

export function Joystick({ onMove }: Props) {
  const knobX = useRef(new Animated.Value(0)).current;
  const knobY = useRef(new Animated.Value(0)).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const len = Math.hypot(g.dx, g.dy);
        const cap = Math.min(1, len / RADIUS);
        const nx = len > 0 ? (g.dx / len) * cap : 0;
        const ny = len > 0 ? (g.dy / len) * cap : 0;
        knobX.setValue(nx * RADIUS);
        knobY.setValue(ny * RADIUS);
        onMove(nx, ny);
      },
      onPanResponderRelease: () => {
        knobX.setValue(0);
        knobY.setValue(0);
        onMove(0, 0);
      },
      onPanResponderTerminate: () => {
        knobX.setValue(0);
        knobY.setValue(0);
        onMove(0, 0);
      },
    }),
  ).current;

  return (
    <View style={styles.base} {...responder.panHandlers}>
      <Animated.View
        style={[
          styles.knob,
          { transform: [{ translateX: knobX }, { translateY: knobY }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(10, 5, 24, 0.5)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 61, 139, 0.7)',
    shadowColor: '#ff3d8b',
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
});
