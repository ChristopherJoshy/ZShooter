'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameProvider, useGame } from '@/context/GameContext';
import { startAudio } from '@/lib/game/audio';
import GameCanvas from '@/components/game/GameCanvas';
import ResultsScreen from '@/components/game/ResultsScreen';
import NetworkLostScreen from '@/components/game/NetworkLostScreen';
import GameHub from '@/components/game/GameHub';
import { useGameScale } from '@/hooks/useGameScale';
import { useSocket } from '@/hooks/useSocket';
import type { UserProfile } from '@/lib/api';
import type { GameSave, WeaponId } from '@/lib/game/types';
import { normalizeProfileToSave } from '@/lib/profile';
import { readSessionCache, writeSessionCache } from '@/lib/sessionCache';
import { apiGetMe } from '@/lib/api';

// Inner component — has access to GameContext.
function GameInner({ username, userId }: { username: string; userId: string }) {
  const {
    save, persistSave,
    gameState, setGameState,
    lastResult, lastRankedResult, setLastRankedResult,
    gameMode, setGameMode,
  } = useGame();
  const { isTouch } = useGameScale();
  const { socketState, matchmakingState, queueForMatch, cancelMatch, onLobbyStart, retryConnection } = useSocket(userId, username);

  // When lobby:start fires, transition into ranked playing mode
  useEffect(() => {
    if (!onLobbyStart) return;
    setGameMode('ranked');
    startAudio();
    setGameState('playing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLobbyStart]);

  // ── Garden shop actions ──────────────────────────────────────────────────────

  const handleBuyStat = useCallback((id: string) => {
    import('@/lib/game/constants').then(({ STAT_DEFS }) => {
      const def = STAT_DEFS.find((s) => s.id === id);
      if (!def) return;
      const lvl = save.up[id as keyof typeof save.up] as number;
      if (lvl >= def.max) return;
      const cost = (def.costs as readonly number[])[lvl];
      if (save.seeds < cost) return;
      const newSave: GameSave = {
        ...save,
        seeds: save.seeds - cost,
        up: { ...save.up, [id]: lvl + 1 },
      };
      persistSave(newSave);
    });
  }, [save, persistSave]);

  const handleSelectWeapon = useCallback((id: string) => {
    const wid = id as WeaponId;
    if (!save.weapons.includes(wid)) return;
    persistSave({ ...save, activeWeapon: wid });
  }, [save, persistSave]);

  const handleBuyWeapon = useCallback((id: string) => {
    import('@/lib/game/constants').then(({ WEAPON_DEFS }) => {
      const wid = id as WeaponId;
      const def = WEAPON_DEFS.find((w) => w.id === id);
      if (!def || save.weapons.includes(wid) || save.seeds < def.cost) return;
      persistSave({ ...save, seeds: save.seeds - def.cost, weapons: [...save.weapons, wid], activeWeapon: wid });
    });
  }, [save, persistSave]);

  const handleSelectAbility = useCallback((id: string) => {
    if (id !== 'none' && !save.abilities.includes(id)) return;
    persistSave({ ...save, activeAbility: id });
  }, [save, persistSave]);

  const handleBuyAbility = useCallback((id: string) => {
    import('@/lib/game/constants').then(({ ABILITY_DEFS }) => {
      const def = ABILITY_DEFS.find((a) => a.id === id);
      if (!def || def.id === 'none' || save.abilities.includes(id) || save.seeds < def.cost) return;
      persistSave({ ...save, seeds: save.seeds - def.cost, abilities: [...save.abilities, id], activeAbility: id });
    });
  }, [save, persistSave]);

  const handleSaveProfile = useCallback((profile: GameSave['profile']) => {
    persistSave({ ...save, profile });
  }, [save, persistSave]);

  const handleGachaPull = useCallback((n: number) => {
    import('@/lib/game/constants').then(({ gachaDraw: draw }) => {
      const COSTS: Record<number, number> = { 1: 50, 5: 220, 10: 400 };
      const cost = COSTS[n] ?? 50;
      if (save.seeds < cost) return;
      const { items, newPityCount } = draw(n, save.pityCount ?? 0);
      const newInventory = [...(save.inventory ?? []), ...items.map((item) => ({
        id: item.id,
        type: item.type,
        rarity: item.rarity,
      }))];
      persistSave({
        ...save,
        seeds: save.seeds - cost,
        pityCount: newPityCount,
        inventory: newInventory,
      });
    });
  }, [save, persistSave]);

  const handlePlayArcade = useCallback(() => {
    startAudio();
    setGameMode('arcade');
    setGameState('playing');
  }, [setGameMode, setGameState]);

  const handleReturn = useCallback(() => {
    setLastRankedResult(null);
    setGameMode('arcade');
    setGameState('garden');
  }, [setGameState, setLastRankedResult, setGameMode]);

  const handleLogout = useCallback(async () => {
    await import('@/lib/api').then(({ apiLogout }) => apiLogout());
    window.location.href = '/';
  }, []);

  const isHighScore = (lastResult?.score ?? 0) >= save.highScore && (lastResult?.score ?? 0) > 0;
  const isNewWaveRecord = (lastResult?.wave ?? 0) > (save.highestWave ?? 0);
  const opponentNames = useMemo(() => [
    ...(matchmakingState.lobby?.players ?? []).filter((player) => player.userId !== userId).map((player) => player.username),
    ...(matchmakingState.lobby?.bots ?? []).map((bot) => bot.name),
  ], [matchmakingState.lobby, userId]);

  return (
    <div id="app-wrap">
      <div id="app">
        <GameCanvas isTouch={isTouch} onReturn={handleReturn} opponentNames={opponentNames} />
      </div>
      <GameHub
        visible={gameState === 'garden'}
        save={save}
        username={username}
        userId={userId}
        socketState={socketState}
        matchmakingState={matchmakingState}
        onMatchmakingQueue={queueForMatch}
        onMatchmakingCancel={cancelMatch}
        onBuyStat={handleBuyStat}
        onSelectWeapon={handleSelectWeapon}
        onBuyWeapon={handleBuyWeapon}
        onSelectAbility={handleSelectAbility}
        onBuyAbility={handleBuyAbility}
        onSaveProfile={handleSaveProfile}
        onPlayArcade={handlePlayArcade}
        onLogout={handleLogout}
      />
      <ResultsScreen
        visible={gameState === 'results'}
        wave={lastResult?.wave ?? 1}
        score={lastResult?.score ?? 0}
        kills={lastResult?.kills ?? 0}
        seedsEarned={lastResult?.seedsEarned ?? 0}
        isHighScore={isHighScore}
        isNewWaveRecord={isNewWaveRecord}
        weapon={lastResult?.weapon ?? 'seedShot'}
        ability={lastResult?.ability ?? 'none'}
        died={lastResult?.died ?? false}
        gameMode={gameMode}
        rankedResult={lastRankedResult}
        onReturn={handleReturn}
      />
      <NetworkLostScreen
        isReconnecting={socketState.hasEverConnected && (socketState.reconnecting || !socketState.connected)}
        serverAvailable={socketState.serverAvailable}
        onReturnToGarden={handleReturn}
        onRetry={retryConnection}
      />
    </div>
  );
}

interface GamePageClientProps {
  profile: UserProfile | null;
}

export default function GamePageClient({ profile }: GamePageClientProps) {
  const [resolvedProfile, setResolvedProfile] = useState<UserProfile | null>(profile);
  const [networkLost, setNetworkLost] = useState(false);

  // If the server could not fetch the profile (Render cold start / network
  // blip), attempt to recover client-side using the localStorage session cache
  // written at last login. The cache holds only identity (username + userId);
  // the full save is fetched fresh from the backend in the background.
  useEffect(() => {
    if (resolvedProfile !== null) {
      // Server gave us a fresh profile — update the cache and we're done.
      writeSessionCache(resolvedProfile.username, resolvedProfile.userId);
      return;
    }

    // Server returned null. Try background fetch with the cookie the browser
    // already holds. Also read the cache so we have identity for the socket.
    const cache = readSessionCache();

    apiGetMe()
      .then((fresh) => {
        writeSessionCache(fresh.username, fresh.userId);
        setResolvedProfile(fresh);
        setNetworkLost(false);
      })
      .catch(() => {
        if (cache) {
          // Cache hit — we know who the user is but save data is unavailable.
          // Show NetworkLostScreen so the user knows the backend is unreachable.
          setNetworkLost(true);
        } else {
          // No cache and no backend response — redirect to login.
          window.location.href = '/';
        }
      });
  // Run once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (resolvedProfile === null && !networkLost) {
    // Still waiting for background fetch — render nothing (brief flash).
    return null;
  }

  if (networkLost || resolvedProfile === null) {
    return (
      <div id="app-wrap">
        <div id="app">
          <NetworkLostScreen
            isReconnecting={true}
            serverAvailable={false}
            onReturnToGarden={() => { window.location.href = '/'; }}
            onRetry={() => { window.location.reload(); }}
          />
        </div>
      </div>
    );
  }

  const initialSave = normalizeProfileToSave(resolvedProfile);
  return (
    <GameProvider initialSave={initialSave} initialUsername={resolvedProfile.username}>
      <GameInner username={resolvedProfile.username} userId={resolvedProfile.userId} />
    </GameProvider>
  );
}
