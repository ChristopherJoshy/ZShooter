import { ABIL_CD, COMBO_DUR } from './constants';
import type { GameRunState } from './types';

export function updateHudDOM(state: GameRunState): void {
  const hud = document.getElementById('hud');
  if (!hud) return;

  // Top — wave progress
  if (!state.waveTrans) {
    const waveProgFill = hud.querySelector('.wave-prog-fill') as HTMLElement;
    if (waveProgFill) {
      const waveProgPct = state.waveTotal > 0 ? Math.min(100, ((state.waveTotal - state.waveLeft) / state.waveTotal) * 100) : 0;
      waveProgFill.style.width = waveProgPct + '%';
    }
  }

  // Health
  const healthFill = document.getElementById('healthFill');
  if (healthFill) {
    const healthPct = Math.max(0, (state.player.hp / state.player.maxHp) * 100);
    healthFill.style.width = healthPct + '%';
  }

  // Ammo
  const ammoBar = document.getElementById('ammoBar');
  if (ammoBar) {
    const pips = ammoBar.children;
    for (let i = 0; i < pips.length; i++) {
      if (i < state.player.ammo) {
        pips[i].classList.remove('em');
      } else {
        pips[i].classList.add('em');
      }
    }
  }

  // Ability
  if (state.stats.ability && state.stats.ability !== 'none') {
    const abilFill = document.getElementById('abilFill');
    const abilStatus = document.getElementById('abilStatus');
    const baseAbilCD = ABIL_CD[state.stats.ability] ?? 1;
    const maxCD = Math.round(baseAbilCD * (state.stats.abilityCDMult ?? 1));
    const abilPct = state.abilityCooldown <= 0 ? 100 : Math.max(0, (1 - state.abilityCooldown / (maxCD || 1)) * 100);
    
    if (abilFill) abilFill.style.width = abilPct + '%';
    if (abilStatus) {
      const abilReady = state.abilityCooldown <= 0;
      if (abilReady) {
        if (!abilStatus.classList.contains('abil-ready')) {
          abilStatus.classList.add('abil-ready');
          abilStatus.textContent = 'SPACE ▸ Ready';
        }
      } else {
        abilStatus.classList.remove('abil-ready');
        abilStatus.textContent = (state.abilityCooldown / 60).toFixed(1) + 's';
      }
    }
  }

  // Centre — wave & combo
  const waveLabel = document.getElementById('waveLabel');
  if (waveLabel) {
    waveLabel.textContent = `Wave ${state.wave}${state.wave % 5 === 0 ? ' (Boss)' : ''}`;
  }

  const comboWrap = document.getElementById('comboWrap');
  if (comboWrap) {
    const showCombo = state.combo > 1 && state.comboTimer > 0;
    if (showCombo) {
      comboWrap.classList.add('show');
      const comboVal = document.getElementById('comboVal');
      if (comboVal) comboVal.textContent = 'x' + state.combo;
      const comboFill = document.getElementById('comboFill');
      if (comboFill) {
        const comboPct = Math.max(0, (state.comboTimer / COMBO_DUR) * 100);
        comboFill.style.width = comboPct + '%';
      }
    } else {
      comboWrap.classList.remove('show');
    }
  }

  // Right — score & seeds
  const scoreVal = document.getElementById('scoreVal');
  if (scoreVal) scoreVal.textContent = String(state.score).padStart(6, '0');
  
  const hudSeeds = document.getElementById('hudSeeds');
  if (hudSeeds) hudSeeds.textContent = '◆ ' + state.runSeeds;

  // Bottom — reload & wave status
  const hudBot2 = document.getElementById('hudBot2');
  if (hudBot2) {
    if (state.player.reloading) {
      const rp = 1 - (state.player.reloadTimer ?? 0) / state.stats.reloadTime;
      hudBot2.textContent = `Reloading ${Math.round(rp * 100)}%`;
    } else {
      hudBot2.textContent = state.waveTrans ? 'Wave complete!' : `Enemies: ${state.waveLeft} remaining`;
    }
  }
}
