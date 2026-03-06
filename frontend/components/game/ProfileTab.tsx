'use client';
import { useRef, useEffect, useCallback } from 'react';
import GameIcon from '@/components/ui/GameIcon';
import {
  AVATAR_DEFS, FRAME_DEFS, BANNER_DEFS,
} from '@/lib/game/constants';
import type { GameSave, AvatarId, FrameId, BannerId } from '@/lib/game/types';

interface ProfileTabProps {
  save: GameSave;
  username: string;
  onSaveProfile: (profile: GameSave['profile']) => void;
}

// ── Avatar canvas renderer ────────────────────────────────────────────────────
// Draws the selected avatar shape onto a 96×96 canvas in the player's colors.
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  avatarId: AvatarId,
  color: string,
  accent: string,
  size: number,
) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  ctx.clearRect(0, 0, size, size);

  switch (avatarId) {
    case 'sprout': {
      // Triangle ship (default)
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r * 0.65, cy + r * 0.7);
      ctx.lineTo(cx + r * 0.65, cy + r * 0.7);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      // engine glow
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.55, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
    case 'bloom': {
      // Rounded diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.4, cx + r, cy);
      ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.4, cx, cy + r);
      ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.4, cx - r, cy);
      ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 0.4, cx, cy - r);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
    case 'thorn': {
      // 6-pointed star
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const ra = i % 2 === 0 ? r : r * 0.5;
        const x = cx + Math.cos(a) * ra;
        const y = cy + Math.sin(a) * ra;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }
    case 'lotus': {
      // Hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
    case 'mist': {
      // Circle with rings
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
    case 'root': {
      // Square with cut corners
      const sq = r * 0.82;
      const cut = sq * 0.28;
      ctx.beginPath();
      ctx.moveTo(cx - sq + cut, cy - sq);
      ctx.lineTo(cx + sq - cut, cy - sq);
      ctx.lineTo(cx + sq, cy - sq + cut);
      ctx.lineTo(cx + sq, cy + sq - cut);
      ctx.lineTo(cx + sq - cut, cy + sq);
      ctx.lineTo(cx - sq + cut, cy + sq);
      ctx.lineTo(cx - sq, cy + sq - cut);
      ctx.lineTo(cx - sq, cy - sq + cut);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }
    case 'petal': {
      // Twin-blade (two ellipses)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(-r * 0.28, 0, r * 0.22, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.28, 0, r * 0.22, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
    case 'blossom': {
      // 5-petal flower
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.52, r * 0.26, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
    case 'storm': {
      // Crescent / arc ship
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.arc(cx - r * 0.15, cy, r * 0.72, Math.PI * 0.75, -Math.PI * 0.75, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.1, cy, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
    }
  }
}

// ── Avatar preview canvas ─────────────────────────────────────────────────────
function AvatarCanvas({
  avatarId, color, accent, frameDef, size = 96,
}: {
  avatarId: AvatarId;
  color: string;
  accent: string;
  frameDef: typeof FRAME_DEFS[number];
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    // Draw frame glow
    if (frameDef.id !== 'none') {
      ctx.shadowColor = frameDef.glowColor;
      ctx.shadowBlur = 12;
    }
    // Draw circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.clip();
    drawAvatar(ctx, avatarId, color, accent, size);
    ctx.restore();

    // Frame border ring
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = frameDef.borderColor;
    ctx.lineWidth = frameDef.id === 'none' ? 1.5 : 3;
    ctx.stroke();
  }, [avatarId, color, accent, frameDef, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="profile-avatar-canvas" />;
}

// ── Swatch picker ─────────────────────────────────────────────────────────────
function SwatchRow<T extends string>({
  label, items, selected, isUnlocked, onSelect, renderSwatch,
}: {
  label: string;
  items: { id: T; name: string; unlockScore: number }[];
  selected: T;
  isUnlocked: (id: T) => boolean;
  onSelect: (id: T) => void;
  renderSwatch: (item: { id: T; name: string; unlockScore: number }, unlocked: boolean, sel: boolean) => React.ReactNode;
}) {
  return (
    <div className="profile-swatch-section">
      <div className="profile-swatch-label">{label}</div>
      <div className="profile-swatch-row">
        {items.map((item) => {
          const unlocked = isUnlocked(item.id);
          const sel = selected === item.id;
          return (
            <button
              key={item.id}
              className={'profile-swatch' + (sel ? ' sel' : '') + (!unlocked ? ' locked' : '')}
              onClick={() => unlocked && onSelect(item.id)}
              title={unlocked ? item.name : `${item.name} — unlock at ${item.unlockScore.toLocaleString()} score`}
            >
              {renderSwatch(item, unlocked, sel)}
              {!unlocked && <span className="swatch-lock"><GameIcon name="lock" className="swatch-lock-icon" /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ProfileTab ───────────────────────────────────────────────────────────
export default function ProfileTab({ save, username, onSaveProfile }: ProfileTabProps) {
  const { profile } = save;
  const rankLabel = `${save.ranked.tier.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}${save.ranked.division && save.ranked.division !== 'GM' ? ` ${save.ranked.division}` : ''}`;
  const progressPct = save.ranked.tier === 'garden-master' ? 100 : Math.min(100, Math.round((save.ranked.rp % 300) / 3));
  const nextRank = save.ranked.tier === 'garden-master'
    ? null
    : `${['seedling', 'sprout', 'blossom', 'willow', 'lotus', 'storm-petal', 'garden-master'][Math.min(['seedling', 'sprout', 'blossom', 'willow', 'lotus', 'storm-petal', 'garden-master'].indexOf(save.ranked.tier) + 1, 6)].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;

  const avatarDef = AVATAR_DEFS.find((a) => a.id === profile.avatar) ?? AVATAR_DEFS[0];
  const frameDef  = FRAME_DEFS.find((f) => f.id === profile.frame) ?? FRAME_DEFS[0];
  const bannerDef = BANNER_DEFS.find((b) => b.id === profile.banner) ?? BANNER_DEFS[0];

  const isAvatarUnlocked = useCallback(
    (id: AvatarId) => profile.unlockedAvatars.includes(id) ||
      (AVATAR_DEFS.find((a) => a.id === id)?.unlockScore ?? 0) === 0,
    [profile.unlockedAvatars],
  );
  const isFrameUnlocked = useCallback(
    (id: FrameId) => profile.unlockedFrames.includes(id) ||
      (FRAME_DEFS.find((f) => f.id === id)?.unlockScore ?? 0) === 0,
    [profile.unlockedFrames],
  );
  const isBannerUnlocked = useCallback(
    (id: BannerId) => profile.unlockedBanners.includes(id) ||
      (BANNER_DEFS.find((b) => b.id === id)?.unlockScore ?? 0) === 0,
    [profile.unlockedBanners],
  );

  function selectAvatar(id: AvatarId) {
    onSaveProfile({ ...profile, avatar: id });
  }
  function selectFrame(id: FrameId) {
    onSaveProfile({ ...profile, frame: id });
  }
  function selectBanner(id: BannerId) {
    onSaveProfile({ ...profile, banner: id });
  }

  return (
    <div className="tab-panel profile-tab">
      {/* Profile card */}
      <div className="profile-card" style={{ background: bannerDef.bg }}>
        <div className="profile-card-inner">
          <AvatarCanvas
            avatarId={profile.avatar}
            color={avatarDef.color}
            accent={avatarDef.accent}
            frameDef={frameDef}
            size={96}
          />
          <div className="profile-card-info">
            <div className="profile-card-username">{username}</div>
            <div className="profile-card-rank" style={{ color: bannerDef.accent }}>
              {rankLabel}
            </div>
            <div className="profile-card-score">
              Peak: <span>{save.ranked.peakRp} RP</span>
            </div>
          </div>
        </div>
        {/* Rank progress bar */}
        <div className="profile-rank-bar-wrap">
          <div className="profile-rank-bar-track">
            <div
              className="profile-rank-bar-fill"
              style={{ width: progressPct + '%', background: bannerDef.accent }}
            />
          </div>
          <div className="profile-rank-bar-labels">
            <span style={{ color: bannerDef.accent }}>{save.ranked.rp} RP</span>
            {nextRank && <span style={{ color: 'rgba(255,255,255,.45)' }}>{nextRank} next</span>}
            {!nextRank && <span style={{ color: bannerDef.accent }}>Max Rank</span>}
          </div>
        </div>
      </div>

      {/* Stat summary row */}
      <div className="profile-stats-row">
        <div className="profile-stat-chip">
          <span className="psc-val">{save.totalRuns ?? 0}</span>
          <span className="psc-lbl">Runs</span>
        </div>
        <div className="profile-stat-chip">
          <span className="psc-val">{save.seeds}</span>
          <span className="psc-lbl">Seeds</span>
        </div>
        <div className="profile-stat-chip">
          <span className="psc-val">{save.weapons.length}</span>
          <span className="psc-lbl">Weapons</span>
        </div>
        <div className="profile-stat-chip">
          <span className="psc-val">{save.abilities.length}</span>
          <span className="psc-lbl">Abilities</span>
        </div>
      </div>

      {/* Cosmetic pickers */}
      <SwatchRow
        label="Avatar"
        items={AVATAR_DEFS}
        selected={profile.avatar}
        isUnlocked={isAvatarUnlocked}
        onSelect={selectAvatar}
        renderSwatch={(item, unlocked, sel) => (
          <AvatarCanvas
            avatarId={item.id as AvatarId}
            color={unlocked ? (AVATAR_DEFS.find((a) => a.id === item.id)?.color ?? '#9a9a9a') : '#9a8a7a'}
            accent={unlocked ? (AVATAR_DEFS.find((a) => a.id === item.id)?.accent ?? '#7a7a7a') : '#7a6a5a'}
            frameDef={sel ? frameDef : FRAME_DEFS[0]}
            size={48}
          />
        )}
      />

      <SwatchRow
        label="Frame"
        items={FRAME_DEFS}
        selected={profile.frame}
        isUnlocked={isFrameUnlocked}
        onSelect={selectFrame}
        renderSwatch={(item, unlocked, _sel) => {
          const fd = FRAME_DEFS.find((f) => f.id === item.id) ?? FRAME_DEFS[0];
          return (
            <div
              className="frame-swatch-preview"
              style={{
                borderColor: unlocked ? fd.borderColor : 'rgba(154,138,122,.3)',
                boxShadow: unlocked && fd.id !== 'none' ? `0 0 6px ${fd.glowColor}` : 'none',
              }}
            />
          );
        }}
      />

      <SwatchRow
        label="Banner"
        items={BANNER_DEFS}
        selected={profile.banner}
        isUnlocked={isBannerUnlocked}
        onSelect={selectBanner}
        renderSwatch={(item, unlocked, _sel) => {
          const bd = BANNER_DEFS.find((b) => b.id === item.id) ?? BANNER_DEFS[0];
          return (
            <div
              className="banner-swatch-preview"
              style={{ background: unlocked ? bd.bg : 'rgba(154,138,122,.15)' }}
            />
          );
        }}
      />
    </div>
  );
}
