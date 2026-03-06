'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameProvider, useGame } from '@/context/GameContext';
import { startAudio } from '@/lib/game/audio';
import GameCanvas from '@/components/game/GameCanvas';
import ResultsScreen from '@/components/game/ResultsScreen';
import GameHub from '@/components/game/GameHub';
import { useGameScale } from '@/hooks/useGameScale';
import { useSocket } from '@/hooks/useSocket';
import type { UserProfile } from '@/lib/api';
import type { GameSave, WeaponId, StoryDifficulty } from '@/lib/game/types';
import { normalizeProfileToSave } from '@/lib/profile';

function buildSaveFromProfile(profile: UserProfile): GameSave {
  return normalizeProfileToSave(profile);
}

function NetworkLostOverlay() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    if (!navigator.onLine) setOffline(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="net-lost-overlay">
      <div className="net-lost-icon">⚡</div>
      <div className="net-lost-title">Connection Lost</div>
      <div className="net-lost-sub">
        Your internet connection dropped. The game will resume automatically when you reconnect.
      </div>
      <button className="net-lost-retry" onClick={() => window.location.reload()}>
        Retry now
      </button>
    </div>
  );
}

// Inner component — has access to GameContext.
function GameInner({ username, userId }: { username: string; userId: string }) {
  const {
    save, persistSave,
    gameState, setGameState,
    lastResult, lastRankedResult, setLastRankedResult,
    gameMode, setGameMode,
    storyChapter, setStoryChapter,
    storyDifficulty, setStoryDifficulty,
  } = useGame();
  const { isTouch } = useGameScale();
  const { socketState, matchmakingState, queueForMatch, cancelMatch, onLobbyStart } = useSocket(userId, username);

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
    setStoryChapter(null);
    setStoryDifficulty(null);
    setGameState('garden');
  }, [setGameState, setLastRankedResult, setGameMode, setStoryChapter, setStoryDifficulty]);

  const handleLogout = useCallback(async () => {
    await import('@/lib/api').then(({ apiLogout }) => apiLogout());
    window.location.href = '/';
  }, []);

  // ── Mode select handlers ──────────────────────────────────────────────────────

  const handlePlayStory = useCallback((chapterId: number, difficulty: StoryDifficulty) => {
    startAudio();
    setGameMode('story');
    setStoryChapter(chapterId);
    setStoryDifficulty(difficulty);
    setGameState('playing');
  }, [setGameMode, setStoryChapter, setStoryDifficulty, setGameState]);

  const isHighScore = (lastResult?.score ?? 0) >= save.highScore && (lastResult?.score ?? 0) > 0;
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
        onPlayStory={handlePlayStory}
        onLogout={handleLogout}
      />
      <ResultsScreen
        visible={gameState === 'results'}
        wave={lastResult?.wave ?? 1}
        score={lastResult?.score ?? 0}
        kills={lastResult?.kills ?? 0}
        seedsEarned={lastResult?.seedsEarned ?? 0}
        isHighScore={isHighScore}
        weapon={lastResult?.weapon ?? 'seedShot'}
        ability={lastResult?.ability ?? 'none'}
        gameMode={gameMode}
        rankedResult={lastRankedResult}
        onReturn={handleReturn}
      />
      <NetworkLostOverlay />
    </div>
  );
}

interface GamePageClientProps {
  profile: UserProfile;
}

export default function GamePageClient({ profile }: GamePageClientProps) {
  const initialSave = buildSaveFromProfile(profile);
  return (
    <GameProvider initialSave={initialSave} initialUsername={profile.username}>
      <GameInner username={profile.username} userId={profile.userId} />
    </GameProvider>
  );
}
