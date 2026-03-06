'use client';
import { ABIL_CD, ABILITY_DEFS } from '@/lib/game/constants';
import { useGame } from '@/context/GameContext';
import type { GameRunState } from '@/lib/game/types';

interface HUDProps {
  state: GameRunState;
}

export default function HUD({ state }: HUDProps) {
  const { settings } = useGame();
  const { player, stats, score, wave, combo, comboTimer, waveTrans, waveLeft,
    abilityCooldown, abilityActive } = state;
  if (!player) return null;

  const healthPct = Math.max(0, (player.hp / player.maxHp) * 100);
  const baseAbilCD = ABIL_CD[stats.ability] ?? 1;
  const maxCD = Math.round(baseAbilCD * (stats.abilityCDMult ?? 1));
  const abilPct = abilityCooldown <= 0 ? 100 : Math.max(0, (1 - abilityCooldown / (maxCD || 1)) * 100);
  const showAbility = stats.ability && stats.ability !== 'none';
  const abilDef = ABILITY_DEFS.find((a) => a.id === stats.ability);
  const abilReady = abilityCooldown <= 0 && showAbility;
  const showCombo = combo > 1 && comboTimer > 0;
  const comboPct = Math.max(0, (comboTimer / 140) * 100);

  let botText = '';
  if (player.reloading) {
    const rp = 1 - (player.reloadTimer ?? 0) / stats.reloadTime;
    botText = `Reloading ${Math.round(rp * 100)}%`;
  } else {
    botText = waveTrans ? 'Wave complete!' : `Enemies: ${waveLeft} remaining`;
  }

  const waveProgPct = state.waveTotal > 0
    ? Math.min(100, ((state.waveTotal - state.waveLeft) / state.waveTotal) * 100)
    : 0;

  return (
    <div id="hud" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Top — wave progress bar */}
      {!waveTrans && (
        <div className="wave-prog-bar">
          <div className="wave-prog-fill" style={{ width: waveProgPct + '%' }} />
        </div>
      )}
      {/* Left — vitality, energy, ability */}
      <div id="hudL" style={{ position: 'absolute', top: 16, left: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {settings.showHudLabels && <div className="hl">Vitality</div>}
        <div id="healthBar">
          <div id="healthFill" style={{ width: healthPct + '%' }} />
        </div>
        {settings.showHudLabels && <div className="hl hmt">Energy</div>}
        <div id="ammoBar">
          {Array.from({ length: stats.maxAmmo }, (_, i) => (
            <div key={i} className={'ap' + (i < player.ammo ? '' : ' em')} />
          ))}
        </div>
        {showAbility && (
          <div id="abilHud" className="hmt">
            {settings.showHudLabels && <div className="hl" id="abilLabel">{abilDef?.name}</div>}
            <div id="abilBar">
              <div id="abilFill" style={{ width: abilPct + '%' }} />
            </div>
            <div id="abilStatus" className={abilReady ? 'abil-ready' : ''}>{abilReady ? 'SPACE ▸ Ready' : (abilityCooldown / 60).toFixed(1) + 's'}</div>
          </div>
        )}
      </div>

      {/* Centre — wave, combo */}
      <div id="hudC" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
        <div id="waveLabel">{`Wave ${wave}${wave % 5 === 0 ? ' (Boss)' : ''}`}</div>
        <div className={'cw' + (showCombo ? ' show' : '')} id="comboWrap">
          <div id="comboVal">x{combo}</div>
          <div id="comboBar"><div id="comboFill" style={{ width: comboPct + '%' }} /></div>
        </div>
      </div>

      {/* Right — score, seeds */}
      <div id="hudR" style={{ position: 'absolute', top: 16, right: 20, textAlign: 'right' }}>
        {settings.showHudLabels && <div className="sc-lbl">Harmony</div>}
        <div id="scoreVal">{String(score).padStart(6, '0')}</div>
        <div id="hudSeeds">◆ {state.runSeeds}</div>
      </div>

      {/* Bottom centre — reload / wave status */}
      <div id="hudBot" style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>
        <span id="hudBot2">{botText}</span>
      </div>
    </div>
  );
}
