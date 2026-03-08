'use client';

interface GameIconProps {
  name:
    | 'dashboard'
    | 'ranked'
    | 'story'
    | 'arsenal'
    | 'spirit'
    | 'friends'
    | 'leaderboard'
    | 'profile'
    | 'settings'
    | 'play'
    | 'logout'
    | 'seed'
    | 'clock'
    | 'trophy'
    | 'user'
    | 'check'
    | 'spark'
    | 'sound'
    | 'motion'
    | 'lock'
    | 'crosshair'
    | 'shield'
    | 'sword'
    | 'heart'
    | 'star'
    // Weapons
    | 'weaponSeedShot'
    | 'weaponPetalSpray'
    | 'weaponThornBurst'
    | 'weaponLotusBeam'
    | 'weaponPulseBlossom'
    | 'weaponTwinPetal'
    | 'weaponMistArc'
    | 'weaponRootCannon'
    | 'weaponMultiShoot'
    // Abilities
    | 'abilityPetalDash'
    | 'abilityBloomShield'
    | 'abilityBlossomPulse'
    | 'abilityThornVolley'
    | 'abilityNone'
    // Stats
    | 'statVitalRoots'
    | 'statForestMend'
    | 'statIronBark'
    | 'statPetalEdge'
    | 'statRapidBloom'
    | 'statDeepQuiver'
    | 'statSwiftLoad'
    | 'statWindStep'
    | 'statGustMaster'
    | 'statPetalGuard'
    // Misc
    | 'leaf'
    | 'lightning'
    | 'wind'
    | 'spiral'
    | 'flower'
    | 'circle'
    | 'refresh'
    | 'explosion'
    | 'wifiOff'
    | 'alert';
  className?: string;
}

export default function GameIcon({ name, className = '' }: GameIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const icons: Record<GameIconProps['name'], React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.4" />
        <rect x="14" y="3" width="7" height="5" rx="1.4" />
        <rect x="14" y="11" width="7" height="10" rx="1.4" />
        <rect x="3" y="13" width="7" height="8" rx="1.4" />
      </>
    ),
    ranked: (
      <>
        <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z" />
      </>
    ),
    story: (
      <>
        <path d="M5 4.5h6.5a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3z" />
        <path d="M19 4.5h-6.5a3 3 0 0 0-3 3v12H16a3 3 0 0 1 3 3z" />
      </>
    ),
    arsenal: (
      <>
        <path d="M4 20L20 4" />
        <path d="M8 4h12v12" />
        <path d="M3 15l6 6" />
      </>
    ),
    spirit: (
      <>
        <path d="M12 2c3.2 4 4.8 6.7 4.8 9.1A4.8 4.8 0 1 1 7.2 11C7.2 8.7 8.8 6 12 2z" />
        <path d="M9.5 13.5c1 .9 2 .9 3 0" />
      </>
    ),
    friends: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16.5" cy="9.5" r="2.5" />
        <path d="M3.5 20a5 5 0 0 1 9 0" />
        <path d="M13 20a4 4 0 0 1 7 0" />
      </>
    ),
    leaderboard: (
      <>
        <path d="M6 20V10" />
        <path d="M12 20V4" />
        <path d="M18 20v-7" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
      </>
    ),
    play: (
      <>
        <path d="M8 5l10 7-10 7V5z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
        <path d="M14 16l5-4-5-4" />
        <path d="M19 12H9" />
      </>
    ),
    seed: (
      <>
        <path d="M12 3c4 4 5.8 6.6 5.8 9.5A5.8 5.8 0 1 1 6.2 12.5C6.2 9.6 8 7 12 3z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" />
        <path d="M6 6H4a2 2 0 0 0 2 3" />
        <path d="M18 6h2a2 2 0 0 1-2 3" />
        <path d="M12 12v4" />
        <path d="M9 20h6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 20a6 6 0 0 1 12 0" />
      </>
    ),
    check: (
      <>
        <path d="M5 12.5l4.3 4.3L19 7" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      </>
    ),
    sound: (
      <>
        <path d="M5 14h3l4 4V6L8 10H5v4z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
        <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      </>
    ),
    motion: (
      <>
        <path d="M4 12c3-4 6-6 8-6s4 1 8 6c-4 5-6 6-8 6s-5-2-8-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    lock: (
      <>
        <rect x="6" y="11" width="12" height="9" rx="2" />
        <path d="M8.5 11V8.5A3.5 3.5 0 0 1 12 5a3.5 3.5 0 0 1 3.5 3.5V11" />
      </>
    ),
    crosshair: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="22" x2="12" y2="18" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="22" y1="12" x2="18" y2="12" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </>
    ),
    sword: (
      <>
        <path d="M14.5 4h5v5l-10 10-5-5 10-10z" />
        <line x1="4.5" y1="14.5" x2="9.5" y2="19.5" />
        <line x1="9.5" y1="14.5" x2="14.5" y2="19.5" />
      </>
    ),
    heart: (
      <>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </>
    ),
    star: (
      <>
        <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" />
      </>
    ),
    // ═══════════════════════════════════════════════════════════════
    // WEAPONS — High-fidelity icons for each weapon type
    // ═══════════════════════════════════════════════════════════════
    weaponSeedShot: (
      <>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 4v-2" />
        <path d="M12 20v-2" />
        <path d="M4 12h-2" />
        <path d="M20 12h-2" />
      </>
    ),
    weaponPetalSpray: (
      <>
        <path d="M12 4c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z" />
        <path d="M6 8c-1.5 2-2 4-2 5.5a2.5 2.5 0 0 0 5 0c0-1.5-.5-3.5-2-5.5z" />
        <path d="M18 8c1.5 2 2 4 2 5.5a2.5 2.5 0 0 1-5 0c0-1.5.5-3.5 2-5.5z" />
      </>
    ),
    weaponThornBurst: (
      <>
        <path d="M12 2l1 5h5l-4 3 2 5-4-2-4 2 2-5-4-3h5z" />
        <path d="M4 12l3 1v4l-2 2-1-4z" />
        <path d="M20 12l-3 1v4l2 2 1-4z" />
        <path d="M8 20l1 2h4l1-2" />
      </>
    ),
    weaponLotusBeam: (
      <>
        <path d="M12 2l2 8h8l-6 5 2 8-6-4-6 4 2-8-6-5h8z" />
        <path d="M12 11v8" />
      </>
    ),
    weaponPulseBlossom: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 4v3" />
        <path d="M12 17v3" />
        <path d="M4 12h3" />
        <path d="M17 12h3" />
        <path d="M6.3 6.3l2.1 2.1" />
        <path d="M15.6 15.6l2.1 2.1" />
        <path d="M6.3 17.7l2.1-2.1" />
        <path d="M15.6 8.4l2.1-2.1" />
      </>
    ),
    weaponTwinPetal: (
      <>
        <path d="M8 6c-2 3-3 5-3 7.5a3 3 0 0 0 6 0c0-2.5-1-4.5-3-7.5z" />
        <path d="M16 6c2 3 3 5 3 7.5a3 3 0 0 1-6 0c0-2.5 1-4.5 3-7.5z" />
      </>
    ),
    weaponMistArc: (
      <>
        <path d="M4 14c2-2 4-3 6-3s4 1 6 3" />
        <path d="M6 10c2-2 4-2.5 6-2.5s4 .5 6 2.5" />
        <path d="M8 6c2-1.5 4-2 6-2s4 .5 6 2" />
      </>
    ),
    weaponRootCannon: (
      <>
        <rect x="6" y="8" width="12" height="10" rx="2" />
        <path d="M9 8V5a3 3 0 0 1 6 0v3" />
        <path d="M8 18h8" />
        <path d="M10 18v-3" />
        <path d="M14 18v-3" />
      </>
    ),
    weaponMultiShoot: (
      <>
        {/* 5 short lines fanning out from a center point */}
        <path d="M12 14l-6-6" />
        <path d="M12 14l-3-7.5" />
        <path d="M12 14v-8" />
        <path d="M12 14l3-7.5" />
        <path d="M12 14l6-6" />
        <circle cx="12" cy="14" r="1.5" />
      </>
    ),
    // ═══════════════════════════════════════════════════════════════
    // ABILITIES — Icons for active abilities
    // ═══════════════════════════════════════════════════════════════
    abilityPetalDash: (
      <>
        <path d="M4 12c2-3 4-5 8-5s6 2 8 5" />
        <path d="M6 10l3-3" />
        <path d="M18 10l-3-3" />
        <circle cx="12" cy="15" r="2" />
      </>
    ),
    abilityBloomShield: (
      <>
        <path d="M12 3l9 5v6c0 5-4 9-9 12-5-3-9-7-9-12v-6l9-5z" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
    abilityBlossomPulse: (
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="6" opacity="0.6" />
        <circle cx="12" cy="12" r="9" opacity="0.3" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </>
    ),
    abilityThornVolley: (
      <>
        {/* 12-pointed radial burst — outer spikes and inner ring */}
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
        <path d="M5.6 5.6l2.1 2.1" />
        <path d="M16.3 16.3l2.1 2.1" />
        <path d="M5.6 18.4l2.1-2.1" />
        <path d="M16.3 7.7l2.1-2.1" />
        <path d="M12 6l.8-3" />
        <path d="M12 18l-.8 3" />
        <path d="M6 12l-3-.8" />
        <path d="M18 12l3 .8" />
      </>
    ),
    abilityNone: (
      <>
        <line x1="4" y1="4" x2="20" y2="20" />
        <line x1="20" y1="4" x2="4" y2="20" />
      </>
    ),
    // ═══════════════════════════════════════════════════════════════
    // STATS — Icons for upgradeable stats
    // ═══════════════════════════════════════════════════════════════
    statVitalRoots: (
      <>
        <path d="M12 21.5c-3-3-5-5.5-5-8a5 5 0 0 1 10 0c0 2.5-2 5-5 8z" />
        <path d="M12 10v4" />
      </>
    ),
    statForestMend: (
      <>
        <path d="M12 22V10" />
        <path d="M12 10c-3 2-6-1-6-5s3-4 6-1" />
        <path d="M12 10c3 2 6-1 6-5s-3-4-6-1" />
        <path d="M12 6v-4" />
      </>
    ),
    statIronBark: (
      <>
        <path d="M12 3l9 5v6c0 5-4 9-9 12-5-3-9-7-9-12v-6l9-5z" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </>
    ),
    statPetalEdge: (
      <>
        <path d="M12 3c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z" />
        <path d="M12 8l1 4" />
      </>
    ),
    statRapidBloom: (
      <>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </>
    ),
    statDeepQuiver: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
    statSwiftLoad: (
      <>
        <path d="M3 12a9 9 0 0 1 18 0" />
        <path d="M3 12h4" />
        <path d="M3 12a9 9 0 0 0 18 0" />
        <path d="M17 12h4" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    statWindStep: (
      <>
        <path d="M3 8c3-2 6-2 9 0" />
        <path d="M3 12c4-2 7-2 10 0" />
        <path d="M3 16c5-2 8-2 11 0" />
        <path d="M16 10c2 0 4-.5 6-2" />
      </>
    ),
    statGustMaster: (
      <>
        <path d="M12 3c4 2 6 4 6 7a6 6 0 0 1-12 0c0-3 2-5 6-7z" />
        <path d="M12 13c3 2 5 3.5 5 5.5a5.5 5.5 0 0 1-11 0c0-2 2-3.5 5-5.5z" />
      </>
    ),
    statPetalGuard: (
      <>
        <path d="M12 4c-2 3-3 5-3 7.5a3 3 0 0 0 6 0c0-2.5-1-4.5-3-7.5z" />
        <path d="M12 10c-2 2-3 4-3 6a3 3 0 0 0 6 0c0-2-1-4-3-6z" />
      </>
    ),
    // ═══════════════════════════════════════════════════════════════
    // MISC — Additional utility icons
    // ═══════════════════════════════════════════════════════════════
    leaf: (
      <>
        <path d="M12 22V10" />
        <path d="M12 10c-3 2-6-1-6-5s3-4 6-1" />
        <path d="M12 10c3 2 6-1 6-5s-3-4-6-1" />
      </>
    ),
    lightning: (
      <>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </>
    ),
    wind: (
      <>
        <path d="M3 8c3-2 6-2 9 0" />
        <path d="M3 12c4-2 7-2 10 0" />
        <path d="M3 16c5-2 8-2 11 0" />
      </>
    ),
    spiral: (
      <>
        <path d="M12 3c4 2 6 4 6 7a6 6 0 0 1-12 0c0-3 2-5 6-7z" />
        <path d="M12 13c3 2 5 3.5 5 5.5a5.5 5.5 0 0 1-11 0c0-2 2-3.5 5-5.5z" />
      </>
    ),
    flower: (
      <>
        <path d="M12 3c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9z" />
        <path d="M6 8c-1.5 2-2 4-2 5.5a2.5 2.5 0 0 0 5 0c0-1.5-.5-3.5-2-5.5z" />
        <path d="M18 8c1.5 2 2 4 2 5.5a2.5 2.5 0 0 1-5 0c0-1.5.5-3.5 2-5.5z" />
      </>
    ),
    circle: (
      <>
        <circle cx="12" cy="12" r="8" />
      </>
    ),
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 18 0" />
        <path d="M3 12h4" />
        <path d="M3 12a9 9 0 0 0 18 0" />
        <path d="M17 12h4" />
      </>
    ),
    explosion: (
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="6" opacity="0.6" />
        <circle cx="12" cy="12" r="9" opacity="0.3" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </>
    ),
    wifiOff: (
      <>
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
      {icons[name]}
    </svg>
  );
}
