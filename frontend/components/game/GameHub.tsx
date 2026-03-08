'use client';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import GameIcon from '@/components/ui/GameIcon';
import { useGame } from '@/context/GameContext';
import MatchmakingAnimation from '@/components/game/MatchmakingAnimation';
import {
  apiFriendAccept,
  apiFriendDecline,
  apiFriendRemove,
  apiFriendRequest,
  apiGetFriends,
  apiGetLeaderboard,
  apiGetMyRank,
  type FriendEntry,
  type FriendRequestEntry,
  type LeaderboardEntry,
} from '@/lib/api';
import { ABILITY_DEFS, STAT_DEFS, WEAPON_DEFS } from '@/lib/game/constants';
import { sfx } from '@/lib/game/audio';
import type { GameSave, PlayerSettings } from '@/lib/game/types';
import type { MatchmakingState, SocketState } from '@/hooks/useSocket';

type ViewId = 'dashboard' | 'loadout' | 'ranked' | 'leaderboard' | 'friends' | 'settings';

interface GameHubProps {
  visible: boolean;
  save: GameSave;
  username: string;
  userId: string;
  socketState: SocketState;
  matchmakingState: MatchmakingState;
  onMatchmakingQueue: () => void;
  onMatchmakingCancel: () => void;
  onBuyStat: (id: string) => void;
  onSelectWeapon: (id: string) => void;
  onBuyWeapon: (id: string) => void;
  onSelectAbility: (id: string) => void;
  onBuyAbility: (id: string) => void;
  onSaveProfile: (profile: GameSave['profile']) => void;
  onPlayArcade: () => void;
  onLogout: () => void;
}

const VIEWS: Array<{ id: ViewId; label: string; icon: React.ComponentProps<typeof GameIcon>['name'] }> = [
  { id: 'dashboard', label: 'Play',        icon: 'play'        },
  { id: 'loadout',   label: 'Loadout',     icon: 'arsenal'     },
  { id: 'ranked',    label: 'Ranked',      icon: 'ranked'      },
  { id: 'leaderboard', label: 'Scores',   icon: 'leaderboard' },
  { id: 'friends',   label: 'Friends',     icon: 'friends'     },
  { id: 'settings',  label: 'Settings',    icon: 'settings'    },
];

const RANK_ORDER = ['seedling', 'sprout', 'blossom', 'willow', 'lotus', 'storm-petal', 'garden-master'];
const RANK_REWARDS: Record<string, string[]> = {
  seedling:       ['Scout banner', 'Starter title'],
  sprout:         ['Verdant frame', '500 seeds'],
  blossom:        ['Blossom banner', 'Profile accent'],
  willow:         ['Willow title', '900 seeds'],
  lotus:          ['Lotus frame', 'Victory card'],
  'storm-petal':  ['Storm Petal banner', 'Elite badge'],
  'garden-master':['Garden Master title', 'Signature aura'],
};

function prettifyRank(rank: string, division: string | null | undefined): string {
  return `${rank.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}${division && division !== 'GM' ? ` ${division}` : ''}`;
}

function updateToggle<K extends keyof PlayerSettings>(
  settings: PlayerSettings,
  setSettings: (settings: PlayerSettings) => void,
  key: K,
) {
  setSettings({ ...settings, [key]: !settings[key] });
}

function tryLockLandscape() {
  try {
    const orientation = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
    if (orientation?.lock) {
      orientation.lock('landscape').catch(() => null);
    }
  } catch { /* not supported */ }
}

export default function GameHub({
  visible,
  save,
  username,
  userId,
  socketState,
  matchmakingState,
  onMatchmakingQueue,
  onMatchmakingCancel,
  onBuyStat,
  onSelectWeapon,
  onBuyWeapon,
  onSelectAbility,
  onBuyAbility,
  onSaveProfile,
  onPlayArcade,
  onLogout,
}: GameHubProps) {
  const { settings, setSettings } = useGame();
  const [view, setView] = useState<ViewId>('dashboard');
  const [showModePicker, setShowModePicker] = useState(false);
  const [leaderboardScope, setLeaderboardScope] = useState<'ranked' | 'score' | 'wave'>('ranked');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardOffset, setLeaderboardOffset] = useState(0);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requestsIn, setRequestsIn] = useState<FriendRequestEntry[]>([]);
  const [requestsOut, setRequestsOut] = useState<FriendRequestEntry[]>([]);
  const [friendName, setFriendName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const LEADERBOARD_LIMIT = 8;

  const myRankInView = myRank && myRank.rank >= leaderboardOffset + 1 && myRank.rank <= leaderboardOffset + LEADERBOARD_LIMIT;

  useEffect(() => {
    if (!visible) return;
    setLeaderboardOffset(0);
    setLeaderboardEntries([]);
    setMyRank(null);
    setLeaderboardLoading(true);
    Promise.all([
      apiGetLeaderboard({ scope: leaderboardScope, limit: LEADERBOARD_LIMIT, offset: 0 }),
      apiGetMyRank(leaderboardScope),
    ]).then(([entries, rank]) => {
      setLeaderboardEntries(entries);
      setMyRank(rank);
    }).catch(() => null).finally(() => setLeaderboardLoading(false));
  }, [leaderboardScope, visible]);

  useEffect(() => {
    if (!visible) return;
    setLeaderboardLoading(true);
    apiGetLeaderboard({ scope: leaderboardScope, limit: LEADERBOARD_LIMIT, offset: leaderboardOffset })
      .then(setLeaderboardEntries)
      .catch(() => null)
      .finally(() => setLeaderboardLoading(false));
  }, [leaderboardScope, visible, leaderboardOffset]);

  const rankName = prettifyRank(save.ranked.tier, save.ranked.division);
  const progress = save.ranked.tier === 'garden-master' ? 100 : Math.round((save.ranked.rp % 300) / 3);
  const nextTier = RANK_ORDER[Math.min(RANK_ORDER.indexOf(save.ranked.tier) + 1, RANK_ORDER.length - 1)];
  const lastRun = save.runHistory[0] ?? null;
  const activeWeapon = useMemo(() => WEAPON_DEFS.find((item) => item.id === save.activeWeapon) ?? WEAPON_DEFS[0], [save.activeWeapon]);
  const activeAbility = useMemo(() => ABILITY_DEFS.find((item) => item.id === save.activeAbility) ?? ABILITY_DEFS[0], [save.activeAbility]);
  const onlineFriends = friends.filter((friend) => (socketState.presenceMap[friend.userId] ?? friend.status) !== 'offline');

  useEffect(() => {
    if (!visible) return;
    apiGetFriends().then((data) => {
      setFriends(data.friends);
      setRequestsIn(data.requestsIn);
      setRequestsOut(data.requestsOut);
    }).catch(() => null);
  }, [visible]);

  async function refreshFriends() {
    const data = await apiGetFriends();
    setFriends(data.friends);
    setRequestsIn(data.requestsIn);
    setRequestsOut(data.requestsOut);
  }

  async function addFriend() {
    if (!friendName.trim()) return;
    try {
      const result = await apiFriendRequest(friendName.trim());
      setFeedback(result.autoAccepted ? 'Friend added.' : 'Request sent.');
      setFriendName('');
      await refreshFriends();
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleFriendAction(action: 'accept' | 'decline' | 'remove', targetUserId: string) {
    const fn = action === 'accept' ? apiFriendAccept : action === 'decline' ? apiFriendDecline : apiFriendRemove;
    await fn(targetUserId).catch(() => null);
    refreshFriends().catch(() => null);
  }

  return (
    <div className={'hub-shell' + (visible ? '' : ' hidden') + ' rail-collapsed'}>

      {/* ── Sidebar rail ─────────────────────────────────────────────── */}
      <aside className={"hub-rail collapsed" + (railOpen ? " open" : "")}>
        <div className="hub-brand">
          <img src="/zshooter-logo.png" alt="ZShooter" className="hub-brand-mark-img" />
          <span className="hub-brand-title">ZShooter</span>
        </div>

        <nav className="hub-nav">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              className={'hub-nav-btn' + (item.id === view ? ' active' : '')}
              title={item.label}
              onClick={() => {
                sfx('menuClick');
                setView(item.id);
                setRailOpen(false);
              }}
              onMouseEnter={() => sfx('menuHover')}
            >
              <GameIcon name={item.icon} className="hub-nav-icon" />
              <span className="hub-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="hub-rail-spacer" />

        <div className="hub-rail-foot">
          <div className="hub-foot-stat">
            <GameIcon name="seed" className="hub-foot-icon" />
            <span className="hub-foot-seeds">{save.seeds}</span>
            <span className="hub-foot-lbl">seeds</span>
          </div>
          <div className="hub-foot-rank">{rankName}</div>
          
          <div className="hub-foot-conn">
            {socketState.connected ? (
              <>
                <div className="conn-dot conn-online" />
                <span className="conn-text">{socketState.ping}ms</span>
              </>
            ) : socketState.reconnecting ? (
              <>
                <div className="conn-dot conn-reconn" />
                <span className="conn-text">Reconnecting...</span>
              </>
            ) : (
              <>
                <div className="conn-dot conn-offline" />
                <span className="conn-text">Offline</span>
              </>
            )}
          </div>
        </div>

        <button className="hub-logout" onClick={() => { setRailOpen(false); onLogout(); }}>
          <GameIcon name="logout" className="hub-nav-icon" />
          <span className="hub-nav-label">Log out</span>
        </button>

      </aside>

      {/* ── Mobile rail scrim ────────────────────────────────────────── */}
      {railOpen && (
        <div className="hub-rail-scrim" onClick={() => setRailOpen(false)} />
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="hub-main">

        {/* ── Mobile hamburger ─────────────────────────────────────────── */}
        <button
          className="hub-hamburger"
          aria-label="Open navigation"
          onClick={() => setRailOpen(true)}
        >
          <span /><span /><span />
        </button>

        {/* ── Dashboard / Play ──────────────────────────────────────── */}
        {view === 'dashboard' && (
          <section className="hub-view">
            <div className="hub-view-header">
              <div className="hub-view-title">Welcome back, {username}</div>
            </div>

            {/* Hero play CTA */}
            <div className="hub-play-row">
              <button className="hub-play-primary hub-play-hero" onClick={() => setShowModePicker(true)}>
                <GameIcon name="play" className="hub-play-icon" />
                <div className="hub-play-text">
                  <span>Play</span>
                  <small>Choose your mode</small>
                </div>
              </button>
            </div>

            {/* Stats grid */}
            <div className="hub-dash-grid">
              <article className="hub-card hub-rank-card">
                <div className="hub-card-label">Rank</div>
                <div className="hub-rank-name">{rankName}</div>
                <div className="hub-rank-meta">
                  <span>{save.ranked.rp} RP</span>
                  <span>{save.ranked.mmr} MMR</span>
                  <span>{Math.round(save.ranked.winRate * 100)}% win rate</span>
                </div>
                <div className="hub-progress-bar">
                  <div className="hub-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="hub-progress-labels">
                  <span>{progress}% to {prettifyRank(nextTier, nextTier === 'garden-master' ? 'GM' : 'III')}</span>
                </div>
              </article>

              <article className="hub-card">
                <div className="hub-card-label">Loadout</div>
                <div className="hub-loadout-summary">
                  <div className="hub-loadout-item">
                    <GameIcon name="arsenal" className="hub-loadout-icon" />
                    <div>
                      <div className="hub-loadout-name">{activeWeapon.name}</div>
                      <div className="hub-loadout-stat">{activeWeapon.stats}</div>
                    </div>
                  </div>
                  <div className="hub-loadout-item">
                    <GameIcon name="spirit" className="hub-loadout-icon" />
                    <div>
                      <div className="hub-loadout-name">{activeAbility.name}</div>
                      <div className="hub-loadout-stat">{activeAbility.desc}</div>
                    </div>
                  </div>
                </div>
                <button className="hub-text-link" onClick={() => setView('loadout')}>Change loadout</button>
              </article>

              <article className="hub-card">
                <div className="hub-card-label">Last run</div>
                {lastRun ? (
                  <div className="hub-last-run">
                    <div className="hub-last-stat"><span className="hub-last-val">{lastRun.wave}</span><span className="hub-last-lbl">Wave</span></div>
                    <div className="hub-last-stat"><span className="hub-last-val">{lastRun.score}</span><span className="hub-last-lbl">Score</span></div>
                    <div className="hub-last-stat"><span className="hub-last-val">{lastRun.kills}</span><span className="hub-last-lbl">Kills</span></div>
                  </div>
                ) : (
                  <div className="hub-empty-copy">No runs yet.</div>
                )}
              </article>

              <article className="hub-card">
                <div className="hub-card-label">Top scores</div>
                {leaderboardEntries.slice(0, 3).map((entry) => (
                  <div key={entry.userId} className="hub-spotlight-row">
                    <span className="hub-rank-badge">#{entry.rank}</span>
                    <span>{entry.username}</span>
                    <strong>{leaderboardScope === 'ranked' ? `${entry.rp ?? 0} RP` : leaderboardScope === 'wave' ? `Wave ${entry.highestWave ?? 0}` : entry.highScore}</strong>
                  </div>
                ))}
                <button className="hub-text-link" onClick={() => setView('leaderboard')}>View leaderboard</button>
              </article>

              <article className="hub-card">
                <div className="hub-card-label">Friends online</div>
                {onlineFriends.slice(0, 4).map((friend) => (
                  <div key={friend.userId} className="hub-spotlight-row">
                    <span className={'hub-presence ' + (socketState.presenceMap[friend.userId] ?? friend.status)} />
                    <span>{friend.username}</span>
                    <strong>{socketState.presenceMap[friend.userId] ?? friend.status}</strong>
                  </div>
                ))}
                {onlineFriends.length === 0 && <div className="hub-empty-copy">No friends online.</div>}
                <button className="hub-text-link" onClick={() => setView('friends')}>Manage friends</button>
              </article>

              <article className="hub-card">
                <div className="hub-card-label">Profile</div>
                <div className="hub-profile-inline">
                  <div className="hub-profile-identity">
                    <div className="hub-profile-avatar">{save.profile.avatar.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="hub-profile-name">{username}</div>
                      <div className="hub-profile-rank">{rankName}</div>
                    </div>
                  </div>
                  <div className="hub-profile-cosmetics">
                    <div className="hub-profile-swatch-group">
                      <span className="hub-profile-swatch-lbl">Avatar</span>
                      <div className="hub-profile-swatch-row">
                        {(save.profile.unlockedAvatars ?? ['sprout']).map((avatarId) => (
                          <button
                            key={avatarId}
                            className={'hub-profile-swatch' + (save.profile.avatar === avatarId ? ' sel' : '')}
                            onClick={() => onSaveProfile({ ...save.profile, avatar: avatarId })}
                            title={avatarId}
                          >
                            {avatarId.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hub-profile-swatch-group">
                      <span className="hub-profile-swatch-lbl">Frame</span>
                      <div className="hub-profile-swatch-row">
                        {(save.profile.unlockedFrames ?? ['none']).map((frameId) => (
                          <button
                            key={frameId}
                            className={'hub-profile-swatch' + (save.profile.frame === frameId ? ' sel' : '')}
                            onClick={() => onSaveProfile({ ...save.profile, frame: frameId })}
                            title={frameId}
                          >
                            {frameId === 'none' ? '—' : frameId.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hub-profile-swatch-group">
                      <span className="hub-profile-swatch-lbl">Banner</span>
                      <div className="hub-profile-swatch-row">
                        {(save.profile.unlockedBanners ?? ['forest']).map((bannerId) => (
                          <button
                            key={bannerId}
                            className={'hub-profile-swatch' + (save.profile.banner === bannerId ? ' sel' : '')}
                            onClick={() => onSaveProfile({ ...save.profile, banner: bannerId })}
                            title={bannerId}
                          >
                            {bannerId.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}

        {/* ── Loadout ───────────────────────────────────────────────── */}
        {view === 'loadout' && (
          <section className="hub-view">
            <div className="hub-view-header">
              <div className="hub-view-title">Loadout</div>
              <div className="hub-view-seeds">
                <GameIcon name="seed" className="hub-view-seeds-icon" />
                <span className="hub-view-seeds-count">{save.seeds}</span>
                <span className="hub-view-seeds-lbl">seeds</span>
              </div>
            </div>
            <div className="hub-loadout-columns">
              <div className="hub-card">
                <div className="hub-card-label">Weapons</div>
                <div className="hub-item-grid">
                  {WEAPON_DEFS.map((weapon) => {
                    const owned = save.weapons.includes(weapon.id);
                    return (
                      <button
                        key={weapon.id}
                        className={'hub-item-card' + (save.activeWeapon === weapon.id ? ' active' : '')}
                        onClick={() => owned ? onSelectWeapon(weapon.id) : onBuyWeapon(weapon.id)}
                      >
                        <GameIcon name={weapon.icon as any} className="hub-item-icon" />
                        <div className="hub-item-info">
                          <strong>{weapon.name}</strong>
                          <span>{weapon.stats}</span>
                          <small>{owned ? (save.activeWeapon === weapon.id ? 'Equipped' : 'Owned') : `${weapon.cost} seeds`}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hub-card">
                <div className="hub-card-label">Abilities</div>
                <div className="hub-item-grid">
                  {ABILITY_DEFS.map((ability) => {
                    const owned = ability.id === 'none' || save.abilities.includes(ability.id);
                    return (
                      <button
                        key={ability.id}
                        className={'hub-item-card' + (save.activeAbility === ability.id ? ' active' : '')}
                        onClick={() => owned ? onSelectAbility(ability.id) : onBuyAbility(ability.id)}
                      >
                        <GameIcon name={ability.icon as any} className="hub-item-icon" />
                        <div className="hub-item-info">
                          <strong>{ability.name}</strong>
                          <span>{ability.desc}</span>
                          <small>{owned ? (save.activeAbility === ability.id ? 'Equipped' : 'Owned') : `${ability.cost} seeds`}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="hub-card">
              <div className="hub-card-label">Permanent upgrades</div>
              <div className="hub-stat-list">
                {STAT_DEFS.map((stat) => {
                  const level = save.up[stat.id as keyof typeof save.up] as number;
                  const cost = level >= stat.max ? 0 : stat.costs[level];
                  return (
                    <div key={stat.id} className="hub-stat-row">
                      <GameIcon name={stat.icon as any} className="hub-stat-icon" />
                      <div className="hub-stat-info"><strong>{stat.name}</strong><span>{stat.val(level)} {stat.unit}</span></div>
                      <button
                        className="hub-inline-btn"
                        disabled={level >= stat.max || save.seeds < cost}
                        onClick={() => onBuyStat(stat.id)}
                      >
                        {level >= stat.max ? 'Maxed' : `${cost} seeds`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Ranked ────────────────────────────────────────────────── */}
        {view === 'ranked' && (
          <section className="hub-view">
            <div className="hub-view-header">
              <div className="hub-view-title">Ranked</div>
            </div>
            <div className="hub-grid hub-grid-main">
              <article className="hub-card hub-rank-card">
                <div className="hub-card-label">Standing</div>
                <div className="hub-rank-name small">{rankName}</div>
                <div className="hub-rank-meta">
                  <span>{save.ranked.rp} RP</span>
                  <span>{save.ranked.mmr} MMR</span>
                  <span>{save.ranked.placementMatchesPlayed}/8 placements</span>
                </div>
                <div className="hub-progress-bar">
                  <div className="hub-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="hub-reward-strip">
                  {(RANK_REWARDS[save.ranked.tier] ?? []).map((reward) => (
                    <span key={reward} className="hub-reward-pill">{reward}</span>
                  ))}
                </div>
              </article>
              <article className="hub-card">
                <div className="hub-card-label">Queue</div>
                {matchmakingState.status === 'idle' && (
                  <button className="hub-play-primary compact" onClick={onMatchmakingQueue}>
                    <GameIcon name="ranked" className="hub-play-icon" />
                    <div className="hub-play-text">
                      <span>Find match</span>
                      <small>Ranked placement</small>
                    </div>
                  </button>
                )}
                {(matchmakingState.status === 'queuing' || matchmakingState.status === 'found') && (
                  <MatchmakingAnimation
                    status={matchmakingState.status}
                    waiting={matchmakingState.waiting}
                    lobby={matchmakingState.lobby}
                    onCancel={onMatchmakingCancel}
                  />
                )}
              </article>
            </div>
          </section>
        )}

        {/* ── Leaderboard ───────────────────────────────────────────── */}
        {view === 'leaderboard' && (
          <section className="hub-view">
            <div className="hub-view-header">
              <div className="hub-view-title">Leaderboard</div>
            </div>
            <div className="hub-switch-row">
              {(['ranked', 'score', 'wave'] as const).map((scope) => (
                <button
                  key={scope}
                  className={'hub-switch-btn' + (leaderboardScope === scope ? ' active' : '')}
                  onClick={() => { sfx('menuClick'); setLeaderboardScope(scope); }}
                >
                  {scope === 'ranked' ? 'Ranked' : scope === 'score' ? 'All-time score' : 'Highest wave'}
                </button>
              ))}
            </div>
            <div className="hub-card">
              {leaderboardLoading && (
                <div className="hub-leaderboard-loading">Loading...</div>
              )}
              {!leaderboardLoading && myRank && !myRankInView && (
                <div className="hub-leaderboard-self">
                  <span>#{myRank.rank}</span>
                  <span>{username} (You)</span>
                  <span>{leaderboardScope === 'ranked' ? prettifyRank(myRank.tier ?? 'seedling', myRank.division) : leaderboardScope === 'wave' ? `Wave ${myRank.highestWave ?? 0}` : myRank.highScore}</span>
                  <span>{leaderboardScope === 'ranked' ? `${myRank.rp ?? 0} RP` : `${myRank.totalRuns} runs`}</span>
                </div>
              )}
              {!leaderboardLoading && leaderboardEntries.length === 0 && (
                <div className="hub-empty-copy">No entries yet.</div>
              )}
              {!leaderboardLoading && leaderboardEntries.map((entry) => (
                <div key={entry.userId} className={'hub-leaderboard-row' + (entry.userId === userId ? ' self' : '')}>
                  <span>#{entry.rank}</span>
                  <span>{entry.username}</span>
                  <span>{leaderboardScope === 'ranked' ? prettifyRank(entry.tier ?? 'seedling', entry.division) : leaderboardScope === 'wave' ? `Wave ${entry.highestWave ?? 0}` : entry.highScore}</span>
                  <span>{leaderboardScope === 'ranked' ? `${entry.rp ?? 0} RP` : `${entry.totalRuns} runs`}</span>
                </div>
              ))}
              {!leaderboardLoading && leaderboardEntries.length > 0 && (
                <div className="hub-leaderboard-pagination">
                  <button
                    className="hub-inline-btn"
                    disabled={leaderboardOffset === 0}
                    onClick={() => { sfx('menuClick'); setLeaderboardOffset((o) => Math.max(0, o - LEADERBOARD_LIMIT)); }}
                  >
                    Previous
                  </button>
                  <span className="hub-leaderboard-page-info">
                    {leaderboardOffset + 1}-{leaderboardOffset + leaderboardEntries.length}
                  </span>
                  <button
                    className="hub-inline-btn"
                    disabled={leaderboardEntries.length < LEADERBOARD_LIMIT}
                    onClick={() => { sfx('menuClick'); setLeaderboardOffset((o) => o + LEADERBOARD_LIMIT); }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Friends ───────────────────────────────────────────────── */}
        {view === 'friends' && (
          <section className="hub-view">
            <div className="hub-view-header">
              <div className="hub-view-title">Friends</div>
            </div>
            <div className="hub-grid hub-grid-main">
              <article className="hub-card">
                <div className="hub-card-label">Add player</div>
                <div className="hub-form-row">
                  <input
                    className="hub-input"
                    value={friendName}
                    onChange={(event) => setFriendName(event.target.value)}
                    placeholder="Username"
                    onKeyDown={(e) => e.key === 'Enter' && addFriend()}
                  />
                  <button className="hub-inline-btn" onClick={addFriend}>Send</button>
                </div>
                {feedback && <div className="hub-empty-copy">{feedback}</div>}
              </article>
              <article className="hub-card">
                <div className="hub-card-label">Roster</div>
                {friends.map((friend) => {
                  const status = socketState.presenceMap[friend.userId] ?? friend.status;
                  return (
                    <div key={friend.userId} className="hub-friend-row">
                      <span className={'hub-presence ' + status} />
                      <div><strong>{friend.username}</strong><span>{status}</span></div>
                      <button className="hub-inline-btn" onClick={() => handleFriendAction('remove', friend.userId)}>Remove</button>
                    </div>
                  );
                })}
                {friends.length === 0 && <div className="hub-empty-copy">No friends yet.</div>}
              </article>
            </div>
            <div className="hub-grid hub-grid-secondary">
              <article className="hub-card">
                <div className="hub-card-label">Incoming requests</div>
                {requestsIn.map((request) => (
                  <div key={request.userId} className="hub-friend-row">
                    <div><strong>{request.username}</strong></div>
                    <div className="hub-inline-actions">
                      <button className="hub-inline-btn" onClick={() => handleFriendAction('accept', request.userId)}>Accept</button>
                      <button className="hub-inline-btn muted" onClick={() => handleFriendAction('decline', request.userId)}>Decline</button>
                    </div>
                  </div>
                ))}
                {requestsIn.length === 0 && <div className="hub-empty-copy">None.</div>}
              </article>
              <article className="hub-card">
                <div className="hub-card-label">Sent requests</div>
                {requestsOut.map((request) => (
                  <div key={request.userId} className="hub-friend-row">
                    <div><strong>{request.username}</strong><span>Pending</span></div>
                  </div>
                ))}
                {requestsOut.length === 0 && <div className="hub-empty-copy">None.</div>}
              </article>
            </div>
          </section>
        )}

        {/* ── Settings ──────────────────────────────────────────────── */}
        {view === 'settings' && (
          <section className="hub-view">
            <div className="hub-view-header">
              <div className="hub-view-title">Settings</div>
            </div>
            <div className="hub-settings-grid">
              <article className="hub-card">
                <div className="hub-card-label">Audio</div>
                <label className="hub-slider-field">
                  <span>Master volume</span>
                  <input
                    type="range" min="0" max="100"
                    value={settings.audioLevel}
                    onChange={(event) => setSettings({ ...settings, audioLevel: Number(event.target.value) })}
                  />
                </label>
                <button
                  className={'hub-toggle-card compact' + (settings.sfxEnabled ? ' active' : '')}
                  onClick={() => updateToggle(settings, setSettings, 'sfxEnabled')}
                >
                  <div className="hub-toggle-title">Sound effects</div>
                  <div className="hub-toggle-copy">Toggle procedural audio.</div>
                </button>
              </article>
              <article className="hub-card">
                <div className="hub-card-label">Gameplay</div>
                <button
                  className={'hub-toggle-card compact' + (settings.screenShake ? ' active' : '')}
                  onClick={() => updateToggle(settings, setSettings, 'screenShake')}
                >
                  <div className="hub-toggle-title">Screen shake</div>
                  <div className="hub-toggle-copy">Camera impact feedback.</div>
                </button>
                <button
                  className={'hub-toggle-card compact' + (settings.touchControls ? ' active' : '')}
                  onClick={() => updateToggle(settings, setSettings, 'touchControls')}
                >
                  <div className="hub-toggle-title">Touch controls</div>
                  <div className="hub-toggle-copy">On-screen joystick and button.</div>
                </button>
              </article>
              <article className="hub-card">
                <div className="hub-card-label">HUD</div>
                <button
                  className={'hub-toggle-card compact' + (settings.showHudLabels ? ' active' : '')}
                  onClick={() => updateToggle(settings, setSettings, 'showHudLabels')}
                >
                  <div className="hub-toggle-title">HUD labels</div>
                  <div className="hub-toggle-copy">Show text above bars.</div>
                </button>
                <button
                  className={'hub-toggle-card compact' + (settings.showOpponentNames ? ' active' : '')}
                  onClick={() => updateToggle(settings, setSettings, 'showOpponentNames')}
                >
                  <div className="hub-toggle-title">Opponent names</div>
                  <div className="hub-toggle-copy">Labels above named enemies.</div>
                </button>
              </article>
              <article className="hub-card">
                <div className="hub-card-label">Accessibility</div>
                <button
                  className={'hub-toggle-card compact' + (settings.reducedMotion ? ' active' : '')}
                  onClick={() => updateToggle(settings, setSettings, 'reducedMotion')}
                >
                  <div className="hub-toggle-title">Reduced motion</div>
                  <div className="hub-toggle-copy">Cuts heavy transitions.</div>
                </button>
              </article>
            </div>
          </section>
        )}

      </main>

      {/* ── Mode picker modal ─────────────────────────────────────────── */}
      {showModePicker && (
        <div className="hub-mode-backdrop" onClick={() => setShowModePicker(false)}>
          <div className="hub-mode-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hub-mode-header">
              <div className="hub-mode-title">Choose Your Path</div>
              <div className="hub-mode-subtitle">Select a game mode to begin</div>
            </div>
            <div className="hub-mode-cards">

              {/* Arcade Mode */}
              <button
                className="hub-mode-card mode-arcade"
                onClick={() => { setShowModePicker(false); tryLockLandscape(); onPlayArcade(); }}
              >
                <div className="hub-mode-card-art arcade">
                  <GameIcon name="play" className="hub-mode-card-art-icon" />
                </div>
                <div className="hub-mode-card-body">
                  <div className="hub-mode-card-title">Arcade</div>
                  <div className="hub-mode-card-desc">Pure action. No stakes. Just you against endless waves.</div>
                  <div className="hub-mode-card-meta">
                    <span>Score attack</span>
                    <span>Quick play</span>
                  </div>
                </div>
              </button>

              {/* Ranked Mode */}
              <button
                className="hub-mode-card mode-ranked"
                onClick={() => {
                  setShowModePicker(false);
                  tryLockLandscape();
                  onMatchmakingQueue();
                  setView('ranked');
                }}
              >
                <div className="hub-mode-card-art ranked">
                  <GameIcon name="ranked" className="hub-mode-card-art-icon" />
                </div>
                <div className="hub-mode-card-body">
                  <div className="hub-mode-card-title">Ranked</div>
                  <div className="hub-mode-card-desc">Compete for rank. Climb the ladder. Prove your skill.</div>
                  <div className="hub-mode-card-meta">
                    <span>RP rewards</span>
                    <span>PvP</span>
                  </div>
                </div>
              </button>

            </div>
            <button className="hub-mode-close" onClick={() => setShowModePicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
