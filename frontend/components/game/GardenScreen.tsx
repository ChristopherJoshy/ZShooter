'use client';
import { useState, useEffect, useCallback } from 'react';
import { STAT_DEFS, WEAPON_DEFS, ABILITY_DEFS, getRankTier, GACHA_ITEMS, gachaDraw, type GachaItem } from '@/lib/game/constants';
import { apiGetLeaderboard, apiGetMyRank, apiGetFriends, apiFriendRequest, apiFriendAccept, apiFriendDecline, apiFriendRemove, type LeaderboardEntry, type FriendEntry, type FriendRequestEntry } from '@/lib/api';
import type { GameSave, OwnedCosmetic } from '@/lib/game/types';
import type { SocketState, MatchmakingState } from '@/hooks/useSocket';
import ProfileTab from '@/components/game/ProfileTab';
import { sfx } from '@/lib/game/audio';

// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = 'home' | 'arsenal' | 'soul' | 'spirit' | 'sanctuary' | 'garden' | 'shop' | 'profile' | 'friends' | 'matchmaking';

interface NavItem {
  id: TabId;
  icon: string;
  label: string;
  comingSoon?: boolean;
}

interface GardenScreenProps {
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
  onGachaPull: (n: number) => void;
  onBegin: () => void;
  onLogout: () => void;
  initialTab?: TabId;
}

// ── Nav rail items ─────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'arsenal', icon: '⚔', label: 'Arsenal' },
  { id: 'soul', icon: '✦', label: 'Soul' },
  { id: 'spirit', icon: '◈', label: 'Spirit' },
  { id: 'sanctuary', icon: '🏆', label: 'Sanctuary' },
  { id: 'matchmaking', icon: '⚡', label: 'Match' },
  { id: 'garden', icon: '🌱', label: 'Garden' },
  { id: 'shop', icon: '🌸', label: 'Shop' },
  { id: 'friends', icon: '◎', label: 'Friends' },
  { id: 'profile', icon: '◉', label: 'Profile' },
];

// ── Stat group config ──────────────────────────────────────────────────────────
const GROUP_META: Record<string, { label: string; borderColor: string }> = {
  Body: { label: 'Body', borderColor: '#c87060' },
  Flow: { label: 'Flow', borderColor: '#c89650' },
  Spirit: { label: 'Spirit', borderColor: '#8870b4' },
};

// ── Coming-soon placeholder ────────────────────────────────────────────────────
function ComingSoonPlaceholder({ label }: { label: string }) {
  return (
    <div className="cs-placeholder">
      <div className="cs-lock">🔒</div>
      <div className="cs-label">{label}</div>
      <div className="cs-sub">Coming Soon</div>
    </div>
  );
}

// ── Coming-soon modal ──────────────────────────────────────────────────────────
function ComingSoonModal({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="cs-modal-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cs-modal-lock">🔒</div>
        <div className="cs-modal-title">{label}</div>
        <div className="cs-modal-sub">This feature is coming soon.</div>
        <button className="zen-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ── Tab: Arsenal (weapons) ─────────────────────────────────────────────────────
function TabArsenal({
  save, onSelectWeapon, onBuyWeapon,
}: {
  save: GameSave;
  onSelectWeapon: (id: string) => void;
  onBuyWeapon: (id: string) => void;
}) {
  return (
    <div className="tab-panel">
      <div className="tab-section-title">Armory — Weapons</div>
      <div className="icard-grid">
        {WEAPON_DEFS.map((def) => {
          const owned = save.weapons.includes(def.id);
          const selected = save.activeWeapon === def.id;
          const canAfford = save.seeds >= def.cost;
          return (
            <div
              key={def.id}
              className={'icard' + (selected ? ' sel' : '') + (!owned && !canAfford ? ' lk' : '')}
              onClick={() => {
                if (owned) onSelectWeapon(def.id);
                else if (canAfford) onBuyWeapon(def.id);
              }}
            >
              <div className="ic-hdr">
                <div className="ic-ico">{def.icon}</div>
                <div className="ic-name">{def.name}</div>
                {selected && <span className="ic-badge b-eq">Equipped</span>}
                {!owned && <span className="ic-badge b-lk">&#9670;{def.cost}</span>}
                {owned && !selected && <span className="ic-badge b-owned">Owned</span>}
              </div>
              <div className="ic-desc">{def.desc}</div>
              <div className="ic-stats">{def.stats}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Soul (passive upgrades) ───────────────────────────────────────────────
function TabSoul({
  save, onBuyStat,
}: {
  save: GameSave;
  onBuyStat: (id: string) => void;
}) {
  const groups = ['Body', 'Flow', 'Spirit'] as const;
  return (
    <div className="tab-panel">
      <div className="tab-section-title">Soul — Passive Growth</div>
      {groups.map((group) => {
        const defs = STAT_DEFS.filter((d) => d.group === group);
        const meta = GROUP_META[group];
        return (
          <div key={group} className="soul-group">
            <div className="soul-group-header" style={{ borderLeftColor: meta.borderColor }}>
              {meta.label}
            </div>
            {defs.map((def) => {
              const lvl = save.up[def.id as keyof typeof save.up] as number;
              const maxed = lvl >= def.max;
              const cost = !maxed ? (def.costs as readonly number[])[lvl] : 0;
              const canAfford = save.seeds >= cost;
              return (
                <div key={def.id} className="stat-row">
                  <div className="s-icon">{def.icon}</div>
                  <div className="s-info">
                    <div className="s-name">{def.name}</div>
                    <div className="s-val">{def.val(lvl)} {def.unit}</div>
                    <div className="s-dots">
                      {Array.from({ length: def.max }, (_, i) => (
                        <div key={i} className={'dot' + (i < lvl ? ' on' : '')} />
                      ))}
                    </div>
                  </div>
                  <button
                    className={'s-btn' + (maxed ? ' mx' : '')}
                    disabled={maxed || !canAfford}
                    onClick={() => onBuyStat(def.id)}
                  >
                    {maxed ? 'Max' : `◆${cost}`}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Spirit (abilities) ────────────────────────────────────────────────────
function TabSpirit({
  save, onSelectAbility, onBuyAbility,
}: {
  save: GameSave;
  onSelectAbility: (id: string) => void;
  onBuyAbility: (id: string) => void;
}) {
  return (
    <div className="tab-panel">
      <div className="tab-section-title">Spirit — Abilities</div>
      <div className="spirit-list">
        {ABILITY_DEFS.map((def) => {
          const owned = def.id === 'none' || save.abilities.includes(def.id);
          const selected = save.activeAbility === def.id;
          const canAfford = save.seeds >= def.cost;
          return (
            <div
              key={def.id}
              className={'icard' + (selected ? ' sel' : '') + (!owned && !canAfford ? ' lk' : '')}
              onClick={() => {
                if (owned) onSelectAbility(def.id);
                else if (canAfford) onBuyAbility(def.id);
              }}
            >
              <div className="ic-hdr">
                <div className="ic-ico">{def.icon}</div>
                <div className="ic-name">{def.name}</div>
                {selected && <span className="ic-badge b-eq">Equipped</span>}
                {!owned && <span className="ic-badge b-lk">&#9670;{def.cost}</span>}
                {owned && !selected && <span className="ic-badge b-owned">Owned</span>}
              </div>
              <div className="ic-desc">{def.desc}</div>
              {def.stats && <div className="ic-stats">{def.stats}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Sanctuary (leaderboard) ───────────────────────────────────────────────
const LB_PAGE_SIZE = 20;

function TabSanctuary({
  userId, username,
}: {
  userId: string;
  username: string;
}) {
  const [subTab, setSubTab] = useState<'global' | 'season'>('global');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [csSeasonOpen, setCsSeason] = useState(false);

  const medals = ['🥇', '🥈', '🥉'];

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await apiGetLeaderboard({ limit: LB_PAGE_SIZE, offset: p * LB_PAGE_SIZE });
      setEntries(data);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  const fetchMyRank = useCallback(async () => {
    try {
      const data = await apiGetMyRank();
      setMyRank(data);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchPage(0);
    fetchMyRank();
  }, [fetchPage, fetchMyRank]);

  function handlePrev() {
    if (page <= 0) return;
    const next = page - 1;
    setPage(next);
    fetchPage(next);
  }

  function handleNext() {
    if (entries.length < LB_PAGE_SIZE) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }

  function handleRefresh() {
    fetchPage(page);
    fetchMyRank();
  }

  const myRankOnPage = entries.some((e) => e.userId === userId);

  return (
    <div className="tab-panel">
      <div className="snc-subtab-row">
        <button
          className={'snc-subtab' + (subTab === 'global' ? ' active' : '')}
          onClick={() => setSubTab('global')}
        >🏆 All-Time</button>
        <button
          className={'snc-subtab' + (subTab === 'season' ? ' active' : '')}
          onClick={() => { setSubTab('season'); setCsSeason(true); }}
        >🌸 Season 1</button>
      </div>

      {subTab === 'global' && (
        <>
          <div className="tab-section-header">
            <div className="tab-section-title">Sanctuary — Leaderboard</div>
            <button className="refresh-btn" onClick={handleRefresh} title="Refresh">&#8635;</button>
          </div>

          {myRank && !myRankOnPage && (
            <div className="lb-my-rank">
              <span className="lb-my-rank-label">Your rank</span>
              <span className="lb-col-rank lb-my-rank-val">
                {myRank.rank <= 3
                  ? medals[myRank.rank - 1]
                  : <span className="lb-rank-num">#{myRank.rank}</span>}
              </span>
              <span className="lb-col-user">{username}</span>
              <span className="lb-col-score">{String(myRank.highScore).padStart(6, '0')}</span>
              <span className="lb-col-runs">{myRank.totalRuns}</span>
            </div>
          )}

          {loading ? (
            <div className="lb-empty">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="lb-empty">No records yet</div>
          ) : (
            <div className="lb-table">
              <div className="lb-thead">
                <span className="lb-col-rank">Rank</span>
                <span className="lb-col-user">Player</span>
                <span className="lb-col-score">High Score</span>
                <span className="lb-col-runs">Runs</span>
              </div>
              {entries.map((entry) => (
                <div
                  key={entry.rank}
                  className={'lb-row' + (entry.userId === userId ? ' lb-row-me' : '')}
                >
                  <span className="lb-col-rank">
                    {entry.rank <= 3
                      ? medals[entry.rank - 1]
                      : <span className="lb-rank-num">#{entry.rank}</span>}
                  </span>
                  <span className="lb-col-user">{entry.username}</span>
                  <span className="lb-col-score">{String(entry.highScore).padStart(6, '0')}</span>
                  <span className="lb-col-runs">{entry.totalRuns}</span>
                </div>
              ))}
            </div>
          )}

          <div className="lb-pagination">
            <button className="lb-page-btn" onClick={handlePrev} disabled={page === 0}>&#8592; Prev</button>
            <span className="lb-page-label">Page {page + 1}</span>
            <button className="lb-page-btn" onClick={handleNext} disabled={entries.length < LB_PAGE_SIZE}>Next &#8594;</button>
          </div>
        </>
      )}

      {subTab === 'season' && (
        <div className="snc-season-wrap">
          <div className="tab-section-title">Season 1 — Leaderboard</div>
          <ComingSoonPlaceholder label="Season 1" />
        </div>
      )}

      {csSeasonOpen && (
        <ComingSoonModal label="Season 1 Leaderboard" onClose={() => setCsSeason(false)} />
      )}
    </div>
  );
}

// ── Tab: Garden (Run History) ──────────────────────────────────────────────────
function TabGarden({ save }: { save: GameSave }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const history = save.runHistory ?? [];

  const avgScore = history.length > 0
    ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
    : 0;
  const bestWave = history.length > 0 ? Math.max(...history.map((r) => r.wave)) : 0;
  const totalKills = history.reduce((s, r) => s + r.kills, 0);
  const totalSeeds = history.reduce((s, r) => s + r.seeds, 0);

  function fmt(ms: number) {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="tab-panel">
      <div className="tab-section-title">Garden — Run History</div>

      <div className="gh-summary">
        <div className="gh-stat"><div className="ghs-val">{avgScore}</div><div className="ghs-lbl">Avg Score</div></div>
        <div className="gh-stat"><div className="ghs-val">{bestWave}</div><div className="ghs-lbl">Best Wave</div></div>
        <div className="gh-stat"><div className="ghs-val">{totalKills}</div><div className="ghs-lbl">Total Kills</div></div>
        <div className="gh-stat"><div className="ghs-val">{totalSeeds}</div><div className="ghs-lbl">Seeds Earned</div></div>
      </div>

      {history.length === 0 ? (
        <div className="lb-empty">No runs recorded yet — go play!</div>
      ) : (
        <div className="gh-table">
          <div className="gh-thead">
            <span className="ghc-date">Date</span>
            <span className="ghc-wave">Wave</span>
            <span className="ghc-score">Score</span>
            <span className="ghc-kills">Kills</span>
            <span className="ghc-seeds">Seeds</span>
          </div>
          {history.map((run, i) => {
            const wDef = WEAPON_DEFS.find((w) => w.id === run.weapon);
            const aDef = ABILITY_DEFS.find((a) => a.id === run.ability);
            return (
              <div key={i}>
                <div
                  className={'gh-row' + (expanded === i ? ' gh-row-open' : '')}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <span className="ghc-date">{fmt(run.date)}</span>
                  <span className="ghc-wave">{run.wave}</span>
                  <span className="ghc-score">{run.score}</span>
                  <span className="ghc-kills">{run.kills}</span>
                  <span className="ghc-seeds">+{run.seeds}</span>
                  <span className="gh-chevron">{expanded === i ? '▲' : '▼'}</span>
                </div>
                {expanded === i && (
                  <div className="gh-detail">
                    <div className="gh-detail-row">
                      <span className="ghd-lbl">Weapon</span>
                      <span className="ghd-val">{wDef?.icon ?? '◉'} {wDef?.name ?? run.weapon}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="ghd-lbl">Ability</span>
                      <span className="ghd-val">{aDef?.icon ?? '—'} {aDef?.name ?? run.ability}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="ghd-lbl">Score</span>
                      <span className="ghd-val">{String(run.score).padStart(6, '0')}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="ghd-lbl">Wave</span>
                      <span className="ghd-val">{run.wave}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="ghd-lbl">Kills</span>
                      <span className="ghd-val">{run.kills}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="ghd-lbl">Seeds</span>
                      <span className="ghd-val">+{run.seeds}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Shop (Bloom Pull Gacha + Inventory) ───────────────────────────────────
const RARITY_COLOR: Record<string, string> = {
  common: '#9a8a7a',
  rare: '#5a8ac4',
  epic: '#a060c4',
};
const RARITY_GLOW: Record<string, string> = {
  common: 'rgba(154,138,122,.18)',
  rare: 'rgba(90,138,196,.25)',
  epic: 'rgba(160,96,196,.35)',
};

function PullCard({ item, idx, revealed }: { item: GachaItem; idx: number; revealed: boolean }) {
  return (
    <div
      className={'pull-card' + (revealed ? ' revealed' : '') + (' rarity-' + item.rarity)}
      style={{
        animationDelay: revealed ? `${idx * 120}ms` : '0ms',
        borderColor: revealed ? RARITY_COLOR[item.rarity] : undefined,
        boxShadow: revealed ? `0 0 18px ${RARITY_GLOW[item.rarity]}` : undefined,
      }}
    >
      <div className="pull-card-back">🌸</div>
      <div className="pull-card-front">
        <div className="pull-rarity" style={{ color: RARITY_COLOR[item.rarity] }}>
          {item.rarity.toUpperCase()}
        </div>
        <div className="pull-type">{item.type}</div>
        <div className="pull-name">{item.name}</div>
      </div>
    </div>
  );
}

function TabShop({
  save, onGachaPull,
}: {
  save: GameSave;
  onGachaPull: (n: number) => void;
}) {
  const [subTab, setSubTab] = useState<'pull' | 'inventory'>('pull');
  const [pullResult, setPullResult] = useState<GachaItem[] | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);

  const COSTS = { 1: 50, 5: 220, 10: 400 };

  function handlePull(n: 1 | 5 | 10) {
    const cost = COSTS[n];
    if (save.seeds < cost) return;
    onGachaPull(n);
    const { items } = gachaDraw(n, save.pityCount ?? 0);
    setPullResult(items);
    setRevealed(Array(n).fill(false));
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        setRevealed((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 120 + 80);
    }
  }

  function handleClosePull() {
    setPullResult(null);
    setRevealed([]);
  }

  const inventory = save.inventory ?? [];

  return (
    <div className="tab-panel">
      <div className="tab-section-title">Shop — Bloom Pull</div>

      <div className="shop-subtab-row">
        <button
          className={'shop-subtab' + (subTab === 'pull' ? ' active' : '')}
          onClick={() => setSubTab('pull')}
        >🌸 Bloom Pull</button>
        <button
          className={'shop-subtab' + (subTab === 'inventory' ? ' active' : '')}
          onClick={() => setSubTab('inventory')}
        >◉ Inventory</button>
      </div>

      {subTab === 'pull' && !pullResult && (
        <div className="pull-screen">
          <div className="pull-intro">
            <div className="pull-intro-title">Bloom Pull</div>
            <div className="pull-intro-sub">
              Discover rare cosmetics — avatars, frames, and banners.
              Pity: guaranteed Rare at 10 pulls, Epic at 50.
            </div>
            <div className="pull-pity-info">
              Current pity: <strong>{save.pityCount ?? 0}</strong> / 50 pulls since last Epic
            </div>
          </div>
          <div className="pull-btns">
            <div className="pull-btn-card" onClick={() => save.seeds >= COSTS[1] && handlePull(1)}>
              <div className="pbc-count">1 Pull</div>
              <div className="pbc-cost"><span className="pbc-icon">◆</span>{COSTS[1]} Seeds</div>
              <div className={'pbc-status' + (save.seeds < COSTS[1] ? ' pbc-locked' : '')}>
                {save.seeds >= COSTS[1] ? 'Pull Now' : 'Not enough seeds'}
              </div>
            </div>
            <div className="pull-btn-card" onClick={() => save.seeds >= COSTS[5] && handlePull(5)}>
              <div className="pbc-count">5 Pulls</div>
              <div className="pbc-cost"><span className="pbc-icon">◆</span>{COSTS[5]} Seeds</div>
              <div className={'pbc-status' + (save.seeds < COSTS[5] ? ' pbc-locked' : '')}>
                {save.seeds >= COSTS[5] ? 'Best Value' : 'Not enough seeds'}
              </div>
            </div>
            <div className="pull-btn-card pull-btn-featured" onClick={() => save.seeds >= COSTS[10] && handlePull(10)}>
              <div className="pbc-count">10 Pulls</div>
              <div className="pbc-cost"><span className="pbc-icon">◆</span>{COSTS[10]} Seeds</div>
              <div className={'pbc-status' + (save.seeds < COSTS[10] ? ' pbc-locked' : '')}>
                {save.seeds >= COSTS[10] ? '★ Rare Guaranteed' : 'Not enough seeds'}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'pull' && pullResult && (
        <div className="pull-reveal">
          <div className="pull-reveal-grid" style={{ gridTemplateColumns: `repeat(${Math.min(pullResult.length, 5)}, 1fr)` }}>
            {pullResult.map((item, i) => (
              <PullCard key={i} item={item} idx={i} revealed={revealed[i] ?? false} />
            ))}
          </div>
          <button className="zen-btn pull-close-btn" onClick={handleClosePull}>
            Collect
          </button>
        </div>
      )}

      {subTab === 'inventory' && (
        <div className="inv-section">
          {inventory.length === 0 ? (
            <div className="lb-empty">No items yet — try a Bloom Pull!</div>
          ) : (
            <div className="inv-grid">
              {inventory.map((item, i) => (
                <div
                  key={i}
                  className={'inv-item rarity-' + item.rarity}
                  style={{ borderColor: RARITY_COLOR[item.rarity] }}
                >
                  <div className="inv-item-type">{item.type}</div>
                  <div className="inv-item-name">{item.id}</div>
                  <div className="inv-item-rarity" style={{ color: RARITY_COLOR[item.rarity] }}>
                    {item.rarity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Matchmaking ──────────────────────────────────────────────────────────
function TabMatchmaking({
  matchmakingState, onQueue, onCancel,
}: {
  matchmakingState: MatchmakingState;
  onQueue: () => void;
  onCancel: () => void;
}) {
  const { status, waiting, lobby } = matchmakingState;

  return (
    <div className="tab-panel">
      <div className="tab-section-title">Match — Find Game</div>

      {status === 'idle' && (
        <div className="mm-idle">
          <div className="mm-idle-icon">⚡</div>
          <div className="mm-idle-title">Ranked Match</div>
          <div className="mm-idle-sub">
            Get matched with players of similar skill.<br />
            Bots fill empty slots after 60 seconds.
          </div>
          <button className="zen-btn mm-find-btn" onClick={onQueue}>Find Match</button>
        </div>
      )}

      {status === 'queuing' && waiting && (
        <div className="mm-queuing">
          <div className="mm-spinner" />
          <div className="mm-q-title">Searching for opponents…</div>
          <div className="mm-q-stats">
            <span className="mm-q-stat">
              <span className="mm-q-lbl">Position</span>
              <span className="mm-q-val">#{waiting.position}</span>
            </span>
            <span className="mm-q-dot">·</span>
            <span className="mm-q-stat">
              <span className="mm-q-lbl">Est. wait</span>
              <span className="mm-q-val">{waiting.estimatedWaitSeconds}s</span>
            </span>
            {waiting.expandedRange && (
              <span className="mm-q-expanded">Range expanded</span>
            )}
          </div>
          <button className="zen-btn mm-cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      )}

      {status === 'found' && lobby && (
        <div className="mm-found">
          <div className="mm-found-title">Match Found!</div>
          {lobby.countdownSeconds !== null && (
            <div className="mm-countdown">{lobby.countdownSeconds}</div>
          )}
          <div className="mm-lobby-slots">
            {lobby.players.map((p) => (
              <div key={p.userId} className="mm-slot mm-slot-player">
                <span className="mm-slot-icon">◉</span>
                <span className="mm-slot-name">{p.username}</span>
                <span className="mm-slot-mmr">{p.mmr} MMR</span>
              </div>
            ))}
            {lobby.bots.map((b) => (
              <div key={b.botId} className="mm-slot mm-slot-bot">
                <span className="mm-slot-icon">◈</span>
                <span className="mm-slot-name">{b.name}</span>
                <span className="mm-slot-mmr">{b.mmr} MMR</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Home ──────────────────────────────────────────────────────────────────
function TabHome({
  save, username, onBegin,
  onGoArsenal, onGoSpirit,
}: {
  save: GameSave;
  username: string;
  onBegin: () => void;
  onGoArsenal: () => void;
  onGoSpirit: () => void;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const activeWeapon = WEAPON_DEFS.find((w) => w.id === save.activeWeapon);
  const activeAbility = ABILITY_DEFS.find((a) => a.id === save.activeAbility);
  const ls = save.stats ?? { totalKills: 0, totalSeeds: 0, totalWaves: 0, highestCombo: 0, totalPlayTime: 0 };
  const lastRun = (save.runHistory ?? [])[0] ?? null;

  return (
    <div className="tab-panel">
      <div className="home-welcome">
        <div className="home-greeting">Garden, <em>{username}</em></div>
        <div className="home-sub">Best score: {String(save.highScore).padStart(6, '0')}</div>
      </div>

      <div className="home-stats-grid">
        <div className="home-stat-card">
          <div className="hsc-val">{String(save.highScore).padStart(6, '0')}</div>
          <div className="hsc-lbl">Best Score</div>
        </div>
        <div className="home-stat-card">
          <div className="hsc-val">{save.totalRuns ?? 0}</div>
          <div className="hsc-lbl">Total Runs</div>
        </div>
        <div className="home-stat-card">
          <div className="hsc-val">{save.seeds}</div>
          <div className="hsc-lbl">Seeds Banked</div>
        </div>
      </div>

      {lastRun && (() => {
        const wDef = WEAPON_DEFS.find((w) => w.id === lastRun.weapon);
        const aDef = ABILITY_DEFS.find((a) => a.id === lastRun.ability);
        return (
          <div className="home-last-run">
            <div className="hlr-label">Last Run</div>
            <div className="hlr-body">
              <div className="hlr-stat"><span className="hlr-v">{lastRun.wave}</span><span className="hlr-l">Wave</span></div>
              <div className="hlr-stat"><span className="hlr-v">{lastRun.score}</span><span className="hlr-l">Score</span></div>
              <div className="hlr-stat"><span className="hlr-v">{lastRun.kills}</span><span className="hlr-l">Kills</span></div>
              <div className="hlr-loadout">
                <span>{wDef?.icon ?? '◉'} {wDef?.name ?? lastRun.weapon}</span>
                <span className="hlr-dot">·</span>
                <span>{aDef?.icon ?? '—'} {aDef?.name ?? lastRun.ability}</span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="home-equip-row">
        <div className="home-equip-label">Current Loadout</div>
        <div className="home-equip-cards">
          <button className="home-equip-card" onClick={onGoArsenal} onMouseEnter={() => sfx('menuHover')}>
            <span className="hec-icon">{activeWeapon?.icon ?? '◉'}</span>
            <span className="hec-name">{activeWeapon?.name ?? 'Seed Shot'}</span>
            <span className="hec-tag">Weapon</span>
          </button>
          <button className="home-equip-card" onClick={onGoSpirit} onMouseEnter={() => sfx('menuHover')}>
            <span className="hec-icon">{activeAbility?.icon ?? '—'}</span>
            <span className="hec-name">{activeAbility?.name ?? 'None'}</span>
            <span className="hec-tag">Ability</span>
          </button>
        </div>
      </div>

      <div className="home-ls-section">
        <button className="home-ls-toggle" onClick={() => setStatsOpen((v) => !v)}>
          <span className="home-ls-title">Lifetime Stats</span>
          <span className="home-ls-chevron">{statsOpen ? '▲' : '▼'}</span>
        </button>
        {statsOpen && (
          <div className="home-ls-grid">
            <div className="home-ls-item"><div className="hlsi-v">{ls.totalKills}</div><div className="hlsi-l">Total Kills</div></div>
            <div className="home-ls-item"><div className="hlsi-v">{ls.totalSeeds}</div><div className="hlsi-l">Seeds Earned</div></div>
            <div className="home-ls-item"><div className="hlsi-v">{ls.totalWaves}</div><div className="hlsi-l">Waves Cleared</div></div>
            <div className="home-ls-item"><div className="hlsi-v">{ls.highestCombo}x</div><div className="hlsi-l">Best Combo</div></div>
          </div>
        )}
      </div>

      <div className="season-pass-section">
        <div className="sp-header">Season Pass — Season 1</div>
        <div className="sp-track-wrap">
          <div className="sp-track">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="sp-node">
                <div className="sp-node-circle">
                  <span className="sp-node-num">{i + 1}</span>
                </div>
                {i < 19 && <div className="sp-connector" />}
              </div>
            ))}
          </div>
          <div className="sp-locked-overlay">
            <span className="sp-lock-icon">🔒</span>
            <span className="sp-lock-text">Coming Soon</span>
          </div>
        </div>
      </div>

      <div className="home-cta">
        <button className="zen-btn home-begin-btn" onClick={onBegin}>
          Begin Journey &#8594;
        </button>
      </div>
    </div>
  );
}

// ── Tab: Friends ───────────────────────────────────────────────────────────────
function TabFriends({ socketState }: { socketState: SocketState }) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requestsIn, setRequestsIn] = useState<FriendRequestEntry[]>([]);
  const [requestsOut, setRequestsOut] = useState<FriendRequestEntry[]>([]);
  const [addInput, setAddInput] = useState('');
  const [addMsg, setAddMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    try {
      const data = await apiGetFriends();
      setFriends(data.friends);
      setRequestsIn(data.requestsIn);
      setRequestsOut(data.requestsOut);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  const friendsWithLive = friends.map((f) => ({
    ...f,
    status: (socketState.presenceMap[f.userId] ?? f.status) as 'online' | 'in-match' | 'offline',
  }));
  const online = friendsWithLive.filter((f) => f.status !== 'offline');
  const offline = friendsWithLive.filter((f) => f.status === 'offline');

  async function handleAdd() {
    const name = addInput.trim();
    if (!name) return;
    setLoading(true);
    setAddMsg(null);
    try {
      const res = await apiFriendRequest(name);
      setAddMsg({ text: res.autoAccepted ? 'Now friends!' : 'Request sent!', error: false });
      setAddInput('');
      await fetchFriends();
    } catch (err) {
      setAddMsg({ text: (err as Error).message, error: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(friendId: string) {
    try { await apiFriendAccept(friendId); await fetchFriends(); } catch { }
  }
  async function handleDecline(friendId: string) {
    try { await apiFriendDecline(friendId); await fetchFriends(); } catch { }
  }
  async function handleRemove(friendId: string) {
    try { await apiFriendRemove(friendId); await fetchFriends(); } catch { }
  }

  const statusDot = (s: 'online' | 'in-match' | 'offline') => {
    if (s === 'online') return <span className="fr-dot fr-dot-on" />;
    if (s === 'in-match') return <span className="fr-dot fr-dot-match" />;
    return <span className="fr-dot fr-dot-off" />;
  };

  return (
    <div className="tab-section">
      <div className="tab-header">Friends</div>

      <div className="fr-add-row">
        <input
          className="fr-add-input"
          placeholder="Enter username…"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={24}
        />
        <button className="zen-btn fr-add-btn" onClick={handleAdd} disabled={loading || !addInput.trim()}>
          {loading ? '…' : 'Add'}
        </button>
      </div>
      {addMsg && (
        <div className={'fr-add-msg' + (addMsg.error ? ' err' : '')}>{addMsg.text}</div>
      )}

      {requestsIn.length > 0 && (
        <div className="fr-section">
          <div className="fr-section-label">Pending — {requestsIn.length}</div>
          {requestsIn.map((r) => (
            <div key={r.userId} className="fr-row fr-row-req">
              <span className="fr-dot fr-dot-off" />
              <span className="fr-name">{r.username}</span>
              <span className="fr-req-label">wants to be friends</span>
              <button className="fr-action-btn fr-accept" onClick={() => handleAccept(r.userId)}>✓</button>
              <button className="fr-action-btn fr-decline" onClick={() => handleDecline(r.userId)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {requestsOut.length > 0 && (
        <div className="fr-section">
          <div className="fr-section-label">Sent</div>
          {requestsOut.map((r) => (
            <div key={r.userId} className="fr-row">
              <span className="fr-dot fr-dot-off" />
              <span className="fr-name">{r.username}</span>
              <span className="fr-req-label">request pending</span>
            </div>
          ))}
        </div>
      )}

      {online.length > 0 && (
        <div className="fr-section">
          <div className="fr-section-label">Online — {online.length}</div>
          {online.map((f) => (
            <div key={f.userId} className="fr-row">
              {statusDot(f.status)}
              <span className="fr-name">{f.username}</span>
              {f.status === 'in-match' && <span className="fr-in-match">In Match</span>}
              <button className="fr-action-btn fr-remove" onClick={() => handleRemove(f.userId)} title="Remove friend">–</button>
            </div>
          ))}
        </div>
      )}

      {offline.length > 0 && (
        <div className="fr-section">
          <div className="fr-section-label">Offline — {offline.length}</div>
          {offline.map((f) => (
            <div key={f.userId} className="fr-row fr-row-off">
              {statusDot(f.status)}
              <span className="fr-name">{f.username}</span>
              <button className="fr-action-btn fr-remove" onClick={() => handleRemove(f.userId)} title="Remove friend">–</button>
            </div>
          ))}
        </div>
      )}

      {friends.length === 0 && requestsIn.length === 0 && (
        <div className="fr-empty">
          <div className="fr-empty-icon">◎</div>
          <div className="fr-empty-text">No friends yet</div>
          <div className="fr-empty-sub">Add a friend by username above</div>
        </div>
      )}
    </div>
  );
}

// ── INJECTED STYLES ────────────────────────────────────────────────────────────
const GARDEN_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Sora:wght@300;400;500&display=swap');

  /* ─── Variables ──────────────────────────────────────── */
  :root {
    --ink0:   #080806;
    --ink1:   #0e0d0a;
    --ink2:   #141210;
    --ink3:   #1c1916;
    --ink4:   #252118;
    --hair:   rgba(215,185,130,0.07);
    --hair2:  rgba(215,185,130,0.14);
    --hair3:  rgba(215,185,130,0.28);
    --parch:  #ddd4c0;
    --parch2: #a89880;
    --parch3: #5a5040;
    --amber:  #c8903c;
    --amber2: rgba(200,144,60,0.08);
    --amber3: rgba(200,144,60,0.18);
    --sage:   #6a9e7a;
    --sage2:  rgba(106,158,122,0.10);
    --rose:   #b86a6a;
    --F:      'Sora', sans-serif;
    --FM:     'DM Mono', monospace;
    --FS:     'Cormorant Garamond', serif;
  }

  /* ─── Root layout ────────────────────────────────────── */
  #gardenScreen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: row;
    background: var(--ink0);
    font-family: var(--F);
    color: var(--parch);
    overflow: hidden;
  }
  #gardenScreen.hidden { display: none; }
  .fullscreen { width: 100%; height: 100%; }

  /* ─── Noise grain overlay ────────────────────────────── */
  #gardenScreen::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    opacity: 0.022;
    pointer-events: none;
    z-index: 1000;
  }

  /* ─── Nav Rail ───────────────────────────────────────── */
  .g-nav-rail {
    width: 52px;
    min-width: 52px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 18px 0 14px;
    gap: 2px;
    background: var(--ink1);
    border-right: 1px solid var(--hair);
    z-index: 10;
    flex-shrink: 0;
  }
  .g-nav-item-wrap {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .g-nav-item-wrap[data-tooltip]:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    left: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    background: var(--ink3);
    border: 1px solid var(--hair2);
    color: var(--parch);
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.06em;
    padding: 5px 10px;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 200;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .g-nav-item {
    position: relative;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
    font-size: 15px;
    opacity: 0.32;
    color: var(--parch);
  }
  .g-nav-item:hover { opacity: 0.65; background: var(--ink3); }
  .g-nav-item.active {
    opacity: 1;
    background: var(--amber2);
  }
  /* Left amber line on active */
  .g-nav-item.active::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--amber);
    border-radius: 0 2px 2px 0;
    box-shadow: 0 0 8px var(--amber);
  }
  .g-nav-item.cs { opacity: 0.18; cursor: not-allowed; }
  .g-nav-icon { line-height: 1; pointer-events: none; }
  .g-nav-spacer { flex: 1; }
  .g-nav-logout { font-size: 12px; }
  .g-nav-logout:hover { background: rgba(184,106,106,0.1) !important; }

  /* ─── Content area ───────────────────────────────────── */
  .g-content {
    flex: 1;
    min-width: 0;
    height: calc(100% - 44px);
    overflow-y: auto;
    padding: 36px 40px 28px;
    scrollbar-width: thin;
    scrollbar-color: var(--ink4) transparent;
  }
  .g-content::-webkit-scrollbar { width: 3px; }
  .g-content::-webkit-scrollbar-thumb { background: var(--ink4); border-radius: 2px; }

  /* ─── Tab transitions ────────────────────────────────── */
  .tab-fade-in {
    animation: tabIn 0.16s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes tabIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ─── Tab panel base ─────────────────────────────────── */
  .tab-panel { max-width: 760px; }
  .tab-section { max-width: 760px; }

  .tab-section-title {
    font-family: var(--FS);
    font-size: 24px;
    font-weight: 300;
    font-style: italic;
    color: var(--parch);
    letter-spacing: 0.02em;
    margin-bottom: 22px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--hair);
  }
  .tab-header {
    font-family: var(--FS);
    font-size: 24px;
    font-style: italic;
    font-weight: 300;
    margin-bottom: 22px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--hair);
  }
  .tab-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 0;
  }

  /* ─── Status bar ─────────────────────────────────────── */
  .g-status-bar {
    position: fixed;
    bottom: 0;
    left: 52px;
    right: 0;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: var(--ink1);
    border-top: 1px solid var(--hair);
    z-index: 20;
    gap: 16px;
  }
  .gsb-seeds {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .gsb-seed-icon {
    color: var(--amber);
    font-size: 10px;
    opacity: 0.8;
  }
  .gsb-seed-val {
    font-family: var(--FM);
    font-size: 13px;
    font-weight: 500;
    color: var(--amber);
    letter-spacing: 0.04em;
  }
  .gsb-seed-lbl {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .gsb-centre {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--FM);
    font-size: 11px;
    font-weight: 300;
    color: var(--parch2);
    letter-spacing: 0.03em;
  }
  .gsb-dot { color: var(--ink4); }
  .gsb-loadout-item { color: var(--parch2); }
  .gsb-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .gsb-username {
    font-family: var(--FM);
    font-size: 11px;
    font-weight: 300;
    color: var(--parch3);
    letter-spacing: 0.04em;
  }
  .gsb-rank-badge {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    padding: 3px 8px;
    border: 1px solid;
    border-radius: 2px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .gsb-settings {
    background: none;
    border: none;
    color: var(--parch3);
    font-size: 13px;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 0.14s;
    padding: 4px;
    line-height: 1;
  }
  .gsb-settings:hover { opacity: 0.9; }

  /* ─── Item cards (weapons / abilities) ───────────────── */
  .icard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }
  .spirit-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .icard {
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 7px;
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s, transform 0.12s;
    user-select: none;
  }
  .icard:hover:not(.lk) {
    border-color: var(--hair2);
    background: var(--ink3);
    transform: translateY(-1px);
  }
  .icard.sel {
    border-color: rgba(106,158,122,0.35);
    background: var(--sage2);
  }
  .icard.lk { opacity: 0.38; cursor: default; }
  .ic-hdr {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .ic-ico { font-size: 16px; flex-shrink: 0; }
  .ic-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--parch);
    letter-spacing: 0.02em;
    flex: 1;
  }
  .ic-badge {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 2px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .b-eq  { background: var(--sage2); color: var(--sage); border: 1px solid rgba(106,158,122,0.2); }
  .b-lk  { background: var(--amber2); color: var(--amber); border: 1px solid rgba(200,144,60,0.18); }
  .b-owned { background: var(--ink4); color: var(--parch3); border: 1px solid var(--hair); }
  .ic-desc {
    font-size: 11px;
    font-weight: 300;
    color: var(--parch3);
    line-height: 1.55;
    margin-bottom: 7px;
  }
  .ic-stats {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
    opacity: 0.65;
    letter-spacing: 0.03em;
  }

  /* ─── Soul upgrades ──────────────────────────────────── */
  .soul-group { margin-bottom: 24px; }
  .soul-group-header {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding-left: 10px;
    border-left: 2px solid;
    margin-bottom: 8px;
  }
  .stat-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    margin-bottom: 5px;
    transition: border-color 0.14s, background 0.14s;
  }
  .stat-row:hover { border-color: var(--hair2); background: var(--ink3); }
  .s-icon { font-size: 15px; flex-shrink: 0; width: 22px; text-align: center; opacity: 0.75; }
  .s-info { flex: 1; min-width: 0; }
  .s-name {
    font-size: 12px;
    font-weight: 400;
    color: var(--parch);
    margin-bottom: 2px;
    letter-spacing: 0.01em;
  }
  .s-val {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--amber);
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    opacity: 0.85;
  }
  .s-dots { display: flex; gap: 3px; flex-wrap: wrap; }
  .dot {
    width: 10px;
    height: 2px;
    border-radius: 1px;
    background: var(--ink4);
    transition: background 0.18s;
  }
  .dot.on { background: var(--amber); }
  .s-btn {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--amber);
    background: transparent;
    border: 1px solid var(--hair2);
    border-radius: 3px;
    padding: 5px 11px;
    cursor: pointer;
    white-space: nowrap;
    letter-spacing: 0.05em;
    transition: background 0.14s, border-color 0.14s;
    flex-shrink: 0;
  }
  .s-btn:hover:not(:disabled) { background: var(--amber2); border-color: var(--hair3); }
  .s-btn:disabled { opacity: 0.28; cursor: not-allowed; }
  .s-btn.mx { color: var(--parch3); border-color: var(--hair); cursor: default; }

  /* ─── Sub-tabs (leaderboard, shop) ───────────────────── */
  .snc-subtab-row,
  .shop-subtab-row {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }
  .snc-subtab,
  .shop-subtab {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--hair);
    border-radius: 2px;
    color: var(--parch3);
    cursor: pointer;
    transition: all 0.14s;
  }
  .snc-subtab:hover,
  .shop-subtab:hover { border-color: var(--hair2); color: var(--parch2); }
  .snc-subtab.active,
  .shop-subtab.active {
    background: var(--amber2);
    border-color: var(--hair3);
    color: var(--amber);
  }
  .refresh-btn {
    background: none;
    border: 1px solid var(--hair);
    border-radius: 3px;
    color: var(--parch3);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    transition: all 0.14s;
    margin-top: 2px;
  }
  .refresh-btn:hover { border-color: var(--hair2); color: var(--parch2); }

  /* ─── Leaderboard ────────────────────────────────────── */
  .lb-empty {
    font-family: var(--FM);
    font-size: 11px;
    font-weight: 300;
    color: var(--parch3);
    text-align: center;
    padding: 44px 0;
    letter-spacing: 0.04em;
  }
  .lb-my-rank {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    margin-bottom: 10px;
    background: var(--amber2);
    border: 1px solid var(--hair3);
    border-radius: 5px;
    font-size: 12px;
    font-weight: 300;
  }
  .lb-my-rank-label {
    font-family: var(--FM);
    font-size: 9px;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .lb-table {
    border: 1px solid var(--hair);
    border-radius: 6px;
    overflow: hidden;
  }
  .lb-thead {
    display: flex;
    padding: 8px 14px;
    background: var(--ink3);
    border-bottom: 1px solid var(--hair);
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .lb-row {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--hair);
    font-size: 12px;
    font-weight: 300;
    transition: background 0.1s;
  }
  .lb-row:last-child { border-bottom: none; }
  .lb-row:hover { background: var(--ink3); }
  .lb-row-me { background: var(--amber2); }
  .lb-col-rank  { width: 52px; flex-shrink: 0; font-size: 14px; }
  .lb-col-user  { flex: 1; min-width: 0; font-weight: 400; color: var(--parch); }
  .lb-col-score {
    width: 110px;
    font-family: var(--FM);
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.06em;
    color: var(--amber);
  }
  .lb-col-runs {
    width: 56px;
    font-family: var(--FM);
    font-size: 11px;
    font-weight: 300;
    color: var(--parch3);
    text-align: right;
  }
  .lb-rank-num {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
  }
  .lb-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    margin-top: 14px;
  }
  .lb-page-btn {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
    background: transparent;
    border: 1px solid var(--hair);
    border-radius: 3px;
    padding: 5px 14px;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: all 0.14s;
  }
  .lb-page-btn:hover:not(:disabled) { border-color: var(--hair2); color: var(--parch2); }
  .lb-page-btn:disabled { opacity: 0.22; cursor: default; }
  .lb-page-label {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
  }

  /* ─── Run history ────────────────────────────────────── */
  .gh-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 18px;
  }
  .gh-stat {
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 14px;
    text-align: center;
  }
  .ghs-val {
    font-family: var(--FS);
    font-size: 26px;
    font-weight: 300;
    font-style: italic;
    color: var(--parch);
    margin-bottom: 4px;
  }
  .ghs-lbl {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .gh-table {
    border: 1px solid var(--hair);
    border-radius: 6px;
    overflow: hidden;
  }
  .gh-thead {
    display: flex;
    padding: 8px 14px;
    background: var(--ink3);
    border-bottom: 1px solid var(--hair);
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .gh-row {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--hair);
    font-size: 12px;
    font-weight: 300;
    cursor: pointer;
    transition: background 0.1s;
  }
  .gh-row:last-child { border-bottom: none; }
  .gh-row:hover,
  .gh-row-open { background: var(--ink3); }
  .ghc-date  { flex: 1; font-family: var(--FM); font-size: 10px; font-weight: 300; color: var(--parch3); }
  .ghc-wave  { width: 46px; font-family: var(--FM); font-size: 11px; text-align: center; color: var(--parch2); }
  .ghc-score { width: 80px; font-family: var(--FM); font-size: 11px; color: var(--amber); }
  .ghc-kills { width: 46px; font-family: var(--FM); font-size: 11px; text-align: center; color: var(--parch2); }
  .ghc-seeds { width: 56px; font-family: var(--FM); font-size: 11px; color: var(--sage); }
  .gh-chevron { width: 22px; text-align: right; font-size: 9px; color: var(--parch3); opacity: 0.5; }
  .gh-detail {
    padding: 12px 14px 14px 48px;
    background: var(--ink1);
    border-bottom: 1px solid var(--hair);
  }
  .gh-detail-row {
    display: flex;
    gap: 18px;
    padding: 4px 0;
    border-bottom: 1px solid var(--hair);
  }
  .gh-detail-row:last-child { border-bottom: none; }
  .ghd-lbl {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    width: 58px;
    flex-shrink: 0;
  }
  .ghd-val { font-size: 12px; font-weight: 300; color: var(--parch2); }

  /* ─── Shop / Gacha ───────────────────────────────────── */
  .pull-screen { padding: 4px 0; }
  .pull-intro { margin-bottom: 28px; }
  .pull-intro-title {
    font-family: var(--FS);
    font-size: 30px;
    font-style: italic;
    font-weight: 300;
    color: var(--parch);
    margin-bottom: 8px;
  }
  .pull-intro-sub {
    font-size: 12px;
    font-weight: 300;
    color: var(--parch3);
    line-height: 1.7;
    margin-bottom: 12px;
  }
  .pull-pity-info {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
    padding: 8px 12px;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 3px;
    display: inline-block;
    letter-spacing: 0.02em;
  }
  .pull-pity-info strong { color: var(--amber); font-weight: 500; }
  .pull-btns { display: flex; gap: 10px; flex-wrap: wrap; }
  .pull-btn-card {
    flex: 1;
    min-width: 130px;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 7px;
    padding: 20px 16px;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s, transform 0.12s;
    text-align: center;
  }
  .pull-btn-card:hover {
    border-color: var(--hair2);
    background: var(--ink3);
    transform: translateY(-2px);
  }
  .pull-btn-featured {
    border-color: var(--hair3);
  }
  .pull-btn-featured:hover { border-color: rgba(200,144,60,0.45); }
  .pbc-count {
    font-family: var(--FS);
    font-size: 22px;
    font-style: italic;
    font-weight: 300;
    color: var(--parch);
    margin-bottom: 6px;
  }
  .pbc-cost {
    font-family: var(--FM);
    font-size: 12px;
    font-weight: 400;
    color: var(--amber);
    margin-bottom: 8px;
    letter-spacing: 0.04em;
  }
  .pbc-icon { margin-right: 3px; }
  .pbc-status {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
    letter-spacing: 0.04em;
  }
  .pbc-locked { color: var(--rose) !important; opacity: 0.65; }
  .pull-reveal { text-align: center; padding: 8px 0; }
  .pull-reveal-grid {
    display: grid;
    gap: 8px;
    justify-content: center;
    margin-bottom: 24px;
  }
  .pull-card {
    width: 116px;
    height: 154px;
    border: 1px solid var(--hair);
    border-radius: 8px;
    background: var(--ink2);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .pull-card-back { font-size: 26px; opacity: 0.2; }
  .pull-card-front { display: none; text-align: center; padding: 12px; }
  .pull-card.revealed .pull-card-back { display: none; }
  .pull-card.revealed .pull-card-front {
    display: block;
    animation: cardReveal 0.26s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes cardReveal {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  .pull-rarity {
    font-family: var(--FM);
    font-size: 8px;
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .pull-type {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .pull-name {
    font-family: var(--FS);
    font-size: 14px;
    font-style: italic;
    color: var(--parch);
  }
  .pull-close-btn { margin: 0 auto; }
  .inv-section { padding: 4px 0; }
  .inv-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
    gap: 7px;
  }
  .inv-item {
    background: var(--ink2);
    border: 1px solid;
    border-radius: 6px;
    padding: 12px;
    transition: background 0.12s;
  }
  .inv-item:hover { background: var(--ink3); }
  .inv-item-type {
    font-family: var(--FM);
    font-size: 8px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    margin-bottom: 5px;
  }
  .inv-item-name { font-size: 12px; font-weight: 400; color: var(--parch); margin-bottom: 5px; }
  .inv-item-rarity {
    font-family: var(--FM);
    font-size: 8px;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ─── Matchmaking ────────────────────────────────────── */
  .mm-idle { text-align: center; padding: 52px 0 36px; }
  .mm-idle-icon { font-size: 30px; opacity: 0.4; margin-bottom: 16px; }
  .mm-idle-title {
    font-family: var(--FS);
    font-size: 30px;
    font-style: italic;
    font-weight: 300;
    margin-bottom: 10px;
  }
  .mm-idle-sub {
    font-size: 12px;
    font-weight: 300;
    color: var(--parch3);
    line-height: 1.75;
    margin-bottom: 30px;
  }
  .mm-find-btn { margin: 0 auto; }
  .mm-queuing { text-align: center; padding: 52px 0 36px; }
  .mm-spinner {
    width: 32px;
    height: 32px;
    border: 1px solid var(--hair2);
    border-top-color: var(--amber);
    border-radius: 50%;
    margin: 0 auto 20px;
    animation: spin 0.85s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .mm-q-title {
    font-family: var(--FS);
    font-size: 22px;
    font-style: italic;
    font-weight: 300;
    color: var(--parch);
    margin-bottom: 14px;
  }
  .mm-q-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 26px;
    font-family: var(--FM);
    font-size: 11px;
    color: var(--parch3);
  }
  .mm-q-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .mm-q-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.6; }
  .mm-q-val { font-size: 16px; font-weight: 400; color: var(--parch); }
  .mm-q-dot { opacity: 0.2; }
  .mm-q-expanded {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--amber);
    background: var(--amber2);
    border: 1px solid var(--hair3);
    border-radius: 2px;
    padding: 2px 7px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .mm-cancel-btn { margin: 0 auto; }
  .mm-found { text-align: center; padding: 36px 0; }
  .mm-found-title {
    font-family: var(--FS);
    font-size: 30px;
    font-style: italic;
    font-weight: 300;
    color: var(--amber);
    margin-bottom: 8px;
  }
  .mm-countdown {
    font-family: var(--FM);
    font-size: 56px;
    font-weight: 300;
    color: var(--parch);
    margin-bottom: 22px;
    letter-spacing: -0.02em;
    opacity: 0.9;
  }
  .mm-lobby-slots {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-width: 300px;
    margin: 0 auto;
  }
  .mm-slot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 300;
    border: 1px solid var(--hair);
    background: var(--ink2);
  }
  .mm-slot-player { border-color: rgba(106,158,122,0.25); background: var(--sage2); }
  .mm-slot-icon { font-size: 13px; opacity: 0.6; }
  .mm-slot-name { flex: 1; font-weight: 400; color: var(--parch); }
  .mm-slot-mmr {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
  }

  /* ─── Home tab ───────────────────────────────────────── */
  .home-welcome { margin-bottom: 26px; }
  .home-greeting {
    font-family: var(--FS);
    font-size: 34px;
    font-weight: 300;
    color: var(--parch);
    margin-bottom: 4px;
    line-height: 1.1;
  }
  .home-greeting em { font-style: italic; color: var(--amber); }
  .home-sub {
    font-family: var(--FM);
    font-size: 11px;
    font-weight: 300;
    color: var(--parch3);
    letter-spacing: 0.04em;
  }
  .home-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .home-stat-card {
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 16px;
    text-align: center;
    transition: border-color 0.14s;
  }
  .home-stat-card:hover { border-color: var(--hair2); }
  .hsc-val {
    font-family: var(--FS);
    font-size: 28px;
    font-weight: 300;
    font-style: italic;
    color: var(--parch);
    margin-bottom: 4px;
    letter-spacing: 0.02em;
  }
  .hsc-lbl {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
  }
  .home-last-run {
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 14px 16px;
    margin-bottom: 12px;
  }
  .hlr-label {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--parch3);
    margin-bottom: 10px;
  }
  .hlr-body {
    display: flex;
    align-items: center;
    gap: 22px;
    flex-wrap: wrap;
  }
  .hlr-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .hlr-v {
    font-family: var(--FS);
    font-size: 22px;
    font-style: italic;
    font-weight: 300;
    color: var(--parch);
  }
  .hlr-l {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .hlr-loadout {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 300;
    color: var(--parch3);
    margin-left: auto;
    font-family: var(--FM);
  }
  .hlr-dot { color: var(--ink4); }
  .home-equip-row { margin-bottom: 12px; }
  .home-equip-label {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--parch3);
    margin-bottom: 8px;
  }
  .home-equip-cards { display: flex; gap: 8px; }
  .home-equip-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s;
    text-align: left;
  }
  .home-equip-card:hover { border-color: var(--hair2); background: var(--ink3); }
  .hec-icon { font-size: 17px; flex-shrink: 0; }
  .hec-name { flex: 1; font-size: 12px; font-weight: 400; color: var(--parch); }
  .hec-tag {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
  }
  .home-ls-section { margin-bottom: 12px; }
  .home-ls-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s;
  }
  .home-ls-toggle:hover { border-color: var(--hair2); background: var(--ink3); }
  .home-ls-title { font-size: 12px; font-weight: 400; color: var(--parch); letter-spacing: 0.01em; }
  .home-ls-chevron { font-size: 9px; color: var(--parch3); opacity: 0.5; }
  .home-ls-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin-top: 7px;
  }
  .home-ls-item {
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 5px;
    padding: 12px;
    text-align: center;
  }
  .hlsi-v {
    font-family: var(--FS);
    font-size: 22px;
    font-style: italic;
    font-weight: 300;
    color: var(--parch);
    margin-bottom: 3px;
  }
  .hlsi-l {
    font-family: var(--FM);
    font-size: 8px;
    font-weight: 300;
    color: var(--parch3);
    text-transform: uppercase;
    letter-spacing: 0.10em;
  }
  .season-pass-section { margin-bottom: 20px; }
  .sp-header {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--parch3);
    margin-bottom: 9px;
  }
  .sp-track-wrap {
    position: relative;
    overflow: hidden;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 6px;
    padding: 16px;
  }
  .sp-track { display: flex; align-items: center; overflow: hidden; }
  .sp-node { display: flex; align-items: center; }
  .sp-node-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--hair2);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink3);
    flex-shrink: 0;
  }
  .sp-node-num {
    font-family: var(--FM);
    font-size: 8px;
    font-weight: 300;
    color: var(--parch3);
  }
  .sp-connector { flex: 1; height: 1px; background: var(--hair); min-width: 4px; }
  .sp-locked-overlay {
    position: absolute;
    inset: 0;
    border-radius: 6px;
    background: rgba(8,8,6,0.78);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .sp-lock-icon { font-size: 13px; opacity: 0.4; }
  .sp-lock-text {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    color: var(--parch3);
    letter-spacing: 0.08em;
  }
  .home-cta { padding: 8px 0 4px; }
  .home-begin-btn { min-width: 180px; }

  /* ─── Friends ────────────────────────────────────────── */
  .fr-add-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .fr-add-input {
    flex: 1;
    background: var(--ink2);
    border: 1px solid var(--hair);
    border-radius: 4px;
    padding: 9px 12px;
    color: var(--parch);
    font-family: var(--FM);
    font-size: 12px;
    font-weight: 300;
    outline: none;
    transition: border-color 0.14s;
    letter-spacing: 0.02em;
  }
  .fr-add-input:focus { border-color: var(--hair3); }
  .fr-add-input::placeholder { color: var(--parch3); opacity: 0.5; }
  .fr-add-btn { flex-shrink: 0; }
  .fr-add-msg {
    font-family: var(--FM);
    font-size: 10px;
    font-weight: 300;
    margin-bottom: 12px;
    padding: 7px 12px;
    border-radius: 3px;
    border: 1px solid var(--hair);
    background: var(--ink2);
    color: var(--sage);
    letter-spacing: 0.03em;
  }
  .fr-add-msg.err { color: var(--rose); }
  .fr-section { margin-bottom: 16px; }
  .fr-section-label {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--parch3);
    margin-bottom: 6px;
  }
  .fr-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 5px;
    background: var(--ink2);
    border: 1px solid var(--hair);
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 300;
    transition: border-color 0.12s;
  }
  .fr-row:hover { border-color: var(--hair2); }
  .fr-row-off { opacity: 0.45; }
  .fr-row-req { border-color: var(--hair3); background: var(--amber2); }
  .fr-name { flex: 1; font-weight: 400; color: var(--parch); }
  .fr-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .fr-dot-on    { background: var(--sage); box-shadow: 0 0 5px var(--sage); }
  .fr-dot-match { background: var(--amber); box-shadow: 0 0 5px var(--amber); }
  .fr-dot-off   { background: var(--ink4); }
  .fr-in-match {
    font-family: var(--FM);
    font-size: 9px;
    font-weight: 300;
    color: var(--amber);
    background: var(--amber2);
    border: 1px solid var(--hair3);
    border-radius: 2px;
    padding: 2px 6px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .fr-req-label { font-size: 11px; font-weight: 300; color: var(--parch3); }
  .fr-action-btn {
    width: 26px;
    height: 26px;
    border-radius: 4px;
    border: 1px solid var(--hair);
    background: var(--ink3);
    color: var(--parch3);
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.14s;
    flex-shrink: 0;
  }
  .fr-accept:hover { border-color: rgba(106,158,122,0.35); color: var(--sage); background: var(--sage2); }
  .fr-decline:hover,
  .fr-remove:hover { border-color: rgba(184,106,106,0.3); color: var(--rose); background: rgba(184,106,106,0.07); }
  .fr-empty { text-align: center; padding: 52px 0; }
  .fr-empty-icon { font-size: 26px; opacity: 0.2; margin-bottom: 12px; }
  .fr-empty-text { font-size: 14px; font-weight: 300; color: var(--parch3); margin-bottom: 4px; }
  .fr-empty-sub  { font-size: 11px; font-weight: 300; color: var(--parch3); opacity: 0.5; }

  /* ─── Zen button ─────────────────────────────────────── */
  .zen-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 28px;
    background: var(--amber);
    color: #080806;
    border: none;
    border-radius: 4px;
    font-family: var(--FM);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.16s, box-shadow 0.16s, transform 0.12s;
    box-shadow: 0 2px 14px rgba(200,144,60,0.18);
  }
  .zen-btn:hover {
    background: #d8a04c;
    box-shadow: 0 4px 20px rgba(200,144,60,0.3);
    transform: translateY(-1px);
  }
  .zen-btn:active { transform: translateY(0); }
  .zen-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }

  /* ─── Coming soon ────────────────────────────────────── */
  .cs-placeholder {
    text-align: center;
    padding: 60px 0 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .cs-lock    { font-size: 22px; opacity: 0.25; }
  .cs-label   { font-family: var(--FS); font-size: 22px; font-style: italic; color: var(--parch3); }
  .cs-sub     { font-family: var(--FM); font-size: 10px; color: var(--parch3); opacity: 0.5; letter-spacing: 0.08em; }
  .cs-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(6px);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cs-modal {
    background: var(--ink2);
    border: 1px solid var(--hair2);
    border-radius: 10px;
    padding: 40px 48px;
    text-align: center;
    min-width: 280px;
    box-shadow: 0 28px 80px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .cs-modal-lock  { font-size: 22px; opacity: 0.3; }
  .cs-modal-title { font-family: var(--FS); font-size: 24px; font-style: italic; color: var(--parch); }
  .cs-modal-sub   { font-size: 12px; font-weight: 300; color: var(--parch3); margin-bottom: 8px; }

  /* ─── Season wrap ────────────────────────────────────── */
  .snc-season-wrap { padding: 4px 0; }
`;

// ── Main component ─────────────────────────────────────────────────────────────
export default function GardenScreen({
  visible, save, username, userId, socketState, matchmakingState,
  onMatchmakingQueue, onMatchmakingCancel,
  onBuyStat, onSelectWeapon, onBuyWeapon, onSelectAbility, onBuyAbility,
  onSaveProfile, onGachaPull, onBegin, onLogout, initialTab,
}: GardenScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [prevTab, setPrevTab] = useState<TabId>('home');
  const [animKey, setAnimKey] = useState(0);
  const [csModal, setCsModal] = useState<string | null>(null);

  useEffect(() => {
    if (visible && initialTab && initialTab !== activeTab) {
      setPrevTab(activeTab);
      setActiveTab(initialTab);
      setAnimKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialTab]);

  function handleNavClick(item: NavItem) {
    if (item.comingSoon) { setCsModal(item.label); return; }
    if (item.id === activeTab) return;
    sfx('menuClick');
    setPrevTab(activeTab);
    setActiveTab(item.id);
    setAnimKey((k) => k + 1);
  }

  const activeWeapon = WEAPON_DEFS.find((w) => w.id === save.activeWeapon);
  const activeAbility = ABILITY_DEFS.find((a) => a.id === save.activeAbility);
  const rank = getRankTier(save.highScore);

  return (
    <div id="gardenScreen" className={'fullscreen' + (visible ? '' : ' hidden')}>
      {/* ─── Injected styles ───────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: GARDEN_STYLES }} />

      {/* ─── Left nav rail ─────────────────────────────────── */}
      <nav className="g-nav-rail">
        {NAV_ITEMS.map((item) => (
          <div key={item.id} className="g-nav-item-wrap" data-tooltip={item.label}>
            <button
              className={
                'g-nav-item' +
                (activeTab === item.id ? ' active' : '') +
                (item.comingSoon ? ' cs' : '')
              }
              onClick={() => handleNavClick(item)}
              aria-label={item.label}
            >
              <span className="g-nav-icon">{item.icon}</span>
            </button>
          </div>
        ))}
        <div className="g-nav-spacer" />
        <div className="g-nav-item-wrap" data-tooltip="Sign Out">
          <button
            className="g-nav-item g-nav-logout"
            onClick={() => { sfx('menuClick'); onLogout(); }}
            onMouseEnter={() => sfx('menuHover')}
            aria-label="Sign Out"
          >
            <span className="g-nav-icon">&#x2715;</span>
          </button>
        </div>
      </nav>

      {/* ─── Content area ──────────────────────────────────── */}
      <div className="g-content">
        <div key={animKey} className="tab-fade-in">
          {activeTab === 'home' && (
            <TabHome
              save={save} username={username}
              onBegin={() => { sfx('menuClick'); onBegin(); }}
              onGoArsenal={() => { sfx('menuClick'); setActiveTab('arsenal'); setAnimKey((k) => k + 1); }}
              onGoSpirit={() => { sfx('menuClick'); setActiveTab('spirit'); setAnimKey((k) => k + 1); }}
            />
          )}
          {activeTab === 'arsenal' && <TabArsenal save={save} onSelectWeapon={onSelectWeapon} onBuyWeapon={onBuyWeapon} />}
          {activeTab === 'soul' && <TabSoul save={save} onBuyStat={onBuyStat} />}
          {activeTab === 'spirit' && <TabSpirit save={save} onSelectAbility={onSelectAbility} onBuyAbility={onBuyAbility} />}
          {activeTab === 'sanctuary' && <TabSanctuary userId={userId} username={username} />}
          {activeTab === 'matchmaking' && <TabMatchmaking matchmakingState={matchmakingState} onQueue={onMatchmakingQueue} onCancel={onMatchmakingCancel} />}
          {activeTab === 'garden' && <TabGarden save={save} />}
          {activeTab === 'shop' && <TabShop save={save} onGachaPull={onGachaPull} />}
          {activeTab === 'friends' && <TabFriends socketState={socketState} />}
          {activeTab === 'profile' && <ProfileTab save={save} username={username} onSaveProfile={onSaveProfile} />}
        </div>
      </div>

      {/* ─── Bottom status bar ─────────────────────────────── */}
      <div className="g-status-bar">
        <div className="gsb-seeds">
          <span className="gsb-seed-icon">&#9670;</span>
          <span className="gsb-seed-val">{save.seeds}</span>
          <span className="gsb-seed-lbl">Seeds</span>
        </div>
        <div className="gsb-centre">
          <span className="gsb-loadout-item">
            {activeWeapon?.icon ?? '◉'}&nbsp;{activeWeapon?.name ?? 'Seed Shot'}
          </span>
          <span className="gsb-dot">·</span>
          <span className="gsb-loadout-item">
            {activeAbility?.icon ?? '—'}&nbsp;{activeAbility?.name ?? 'None'}
          </span>
        </div>
        <div className="gsb-right">
          <span className="gsb-username">{username}</span>
          <span className="gsb-rank-badge" style={{ color: rank.color, borderColor: rank.color + '44' }}>
            {rank.label}
          </span>
          <button className="gsb-settings" aria-label="Settings" onClick={() => setCsModal('Settings')}>
            &#9881;
          </button>
        </div>
      </div>

      {/* ─── Coming-soon modal ─────────────────────────────── */}
      {csModal && <ComingSoonModal label={csModal} onClose={() => setCsModal(null)} />}

      {prevTab === prevTab && null}
    </div>
  );
}