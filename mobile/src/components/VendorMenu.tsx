import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MenuItem, Vendor } from '../core/types';
import { type GameState, isVendorOpen, timeOfDay } from '../core/game';

interface Props {
  state: GameState;
  vendor: Vendor | null;
  onEat: (item: MenuItem) => void;
  onClose: () => void;
}

export function VendorMenu({ state, vendor, onEat, onClose }: Props) {
  if (!vendor) return null;
  const time = timeOfDay(state);
  const open = isVendorOpen(vendor, time);

  return (
    <Modal transparent animationType="fade" visible={!!vendor} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => { /* swallow */ }}>
          <Text style={styles.title}>
            {vendor.emoji}  {vendor.hidden ? `✨ ${vendor.name}` : vendor.name}
          </Text>
          <Text style={styles.sub}>{vendor.blurb}</Text>

          {!open ? (
            <View style={styles.closedBox}>
              <Text style={styles.closedText}>
                Closed right now · open: {vendor.openAt.join(', ')}
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {vendor.items.map(it => {
                const cant = it.price > state.cash;
                return (
                  <Pressable
                    key={it.name}
                    disabled={cant}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onEat(it);
                    }}
                    style={({ pressed }) => [
                      styles.item,
                      it.gem && styles.gem,
                      cant && styles.cant,
                      pressed && !cant && styles.pressed,
                    ]}
                  >
                    <Text style={styles.itemEmoji}>{it.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{it.name}{it.gem ? ' ✨' : ''}</Text>
                      <Text style={styles.itemMeta}>+{it.flavor} flavor · +{it.coma} coma · +{it.hunger} fill</Text>
                    </View>
                    <Text style={styles.itemPrice}>${it.price}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.hint}>Tap outside to walk away</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 5, 24, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#1a0b2e',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ff3d8b',
  },
  sub: {
    fontSize: 11,
    opacity: 0.7,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  closedBox: {
    padding: 14,
    backgroundColor: 'rgba(255,90,90,0.1)',
    borderColor: 'rgba(255,90,90,0.3)',
    borderWidth: 1,
    borderRadius: 10,
  },
  closedText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gem: {
    borderColor: '#2bd4d9',
    shadowColor: '#2bd4d9',
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cant: { opacity: 0.4 },
  pressed: { backgroundColor: 'rgba(255, 61, 139, 0.12)' },
  itemEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  itemName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  itemMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  itemPrice: { color: '#ffd23f', fontWeight: '800', fontSize: 14 },
  hint: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 12, letterSpacing: 1 },
});
