'use client';
import { useEffect, useRef } from 'react';
import GameIcon from '@/components/ui/GameIcon';
import { WEAPON_DEFS, ABILITY_DEFS } from '@/lib/game/constants';
import type { GameMode } from '@/context/GameContext';

interface RankedResult {
  rpDelta: number;
  newTier: string;
  newDivision: string | null;
  newRp: number;
}

interface ResultsScreenProps {
  visible: boolean;
  wave: number;
  score: number;
  kills: number;
  seedsEarned: number;
  isHighScore: boolean;
  weapon: string;
  ability: string;
  gameMode?: GameMode;
  rankedResult?: RankedResult | null;
  onReturn: () => void;
}

export default function ResultsScreen({
  visible, wave, score, kills, seedsEarned, isHighScore, weapon, ability, gameMode, rankedResult, onReturn,
}: ResultsScreenProps) {
  const weaponDef = WEAPON_DEFS.find((w) => w.id === weapon);
  const abilityDef = ABILITY_DEFS.find((a) => a.id === ability);
  const sparkleRef = useRef<HTMLDivElement>(null);
  const burstFiredRef = useRef(false);

  useEffect(() => {
    if (!visible || !isHighScore || burstFiredRef.current) return;
    if (!sparkleRef.current) return;
    burstFiredRef.current = true;
    const container = sparkleRef.current;
    const count = 22;
    const particles: HTMLDivElement[] = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'sparkle-particle';
      const angle = (i / count) * Math.PI * 2;
      const dist = 80 + Math.random() * 100;
      el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      el.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      el.style.animationDelay = `${Math.random() * 80}ms`;
      container.appendChild(el);
      particles.push(el);
    }
    const cleanup = setTimeout(() => {
      particles.forEach((p) => p.remove());
      burstFiredRef.current = false;
    }, 900);
    return () => {
      clearTimeout(cleanup);
      particles.forEach((p) => { if (p.parentNode) p.remove(); });
    };
  }, [visible, isHighScore]);

  const isRanked = gameMode === 'ranked';
  const isStory  = gameMode === 'story';
  const modeLabel = isRanked ? 'Ranked' : isStory ? 'Story' : null;

  return (
    <div id="resultsScreen" className={'fullscreen' + (visible ? '' : ' hidden')}>
      <div ref={sparkleRef} className="sparkle-origin" />
      <div className="rd">
        <GameIcon name={isHighScore ? 'trophy' : 'spark'} className="results-mark-icon" />
      </div>
      <div className="rt">{isHighScore ? 'New Best' : 'Run Complete'}</div>
      <div className="rs">{isHighScore ? 'New record' : ''}</div>
      {modeLabel && <div className="results-mode-badge">{modeLabel}</div>}
      <div className="divider" />
      <div className="rgrid">
        <div className="rstat">
          <div className="rv">{wave}</div>
          <div className="rl">Wave</div>
        </div>
        <div className="rstat">
          <div className="rv">{score}</div>
          <div className="rl">Harmony</div>
        </div>
        <div className="rstat">
          <div className="rv">{kills}</div>
          <div className="rl">Foes Stilled</div>
        </div>
      </div>
      <div className="se">+{seedsEarned} Seeds collected</div>
      {isRanked && rankedResult && (
        <div className="results-ranked-row">
          <span className={'results-rp-delta' + (rankedResult.rpDelta >= 0 ? ' results-rp-gain' : ' results-rp-loss')}>
            {rankedResult.rpDelta >= 0 ? '+' : ''}{rankedResult.rpDelta} RP
          </span>
          <span className="results-rp-tier">
            {rankedResult.newTier}{rankedResult.newDivision ? ` ${rankedResult.newDivision}` : ''} · {rankedResult.newRp} RP
          </span>
        </div>
      )}
      <div className="results-loadout">
        <span className="results-loadout-item">
          <GameIcon name="arsenal" className="rli-icon" />
          <span className="rli-name">{weaponDef?.name ?? weapon}</span>
        </span>
        <span className="rli-dot">·</span>
        <span className="results-loadout-item">
          <GameIcon name="spirit" className="rli-icon" />
          <span className="rli-name">{abilityDef?.name ?? ability}</span>
        </span>
      </div>
      <button className="zen-btn" onClick={onReturn}>Return to Hub</button>
    </div>
  );
}
