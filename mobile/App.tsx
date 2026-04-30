import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TitleScreen } from './src/screens/TitleScreen';
import { GameScreen } from './src/screens/GameScreen';
import { EndScreen } from './src/screens/EndScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import type { MapDef, RunResult } from './src/core/types';

type Screen =
  | { name: 'title' }
  | { name: 'game'; map: MapDef }
  | { name: 'end'; result: RunResult; map: MapDef; isNewBest: boolean; previousBest: number }
  | { name: 'leaderboard' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {screen.name === 'title' && (
          <TitleScreen
            onPickMap={(map) => setScreen({ name: 'game', map })}
            onOpenLeaderboard={() => setScreen({ name: 'leaderboard' })}
          />
        )}
        {screen.name === 'game' && (
          <GameScreen
            map={screen.map}
            onEnded={(result, isNewBest, previousBest) =>
              setScreen({ name: 'end', result, map: screen.map, isNewBest, previousBest })
            }
            onQuit={() => setScreen({ name: 'title' })}
          />
        )}
        {screen.name === 'end' && (
          <EndScreen
            result={screen.result}
            map={screen.map}
            isNewBest={screen.isNewBest}
            previousBest={screen.previousBest}
            onPlayAgain={() => setScreen({ name: 'game', map: screen.map })}
            onChangeMap={() => setScreen({ name: 'title' })}
          />
        )}
        {screen.name === 'leaderboard' && (
          <LeaderboardScreen onClose={() => setScreen({ name: 'title' })} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
