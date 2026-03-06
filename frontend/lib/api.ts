// HTTP client for all backend API calls.
// All requests go through Next.js rewrites (/api/* → backend).
import type { GameSave } from './game/types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  });

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Backend unreachable or returned non-JSON (e.g. proxy error)
    throw new Error(res.ok ? 'Unexpected server response' : `Server error (${res.status})`);
  }

  if (!res.ok) throw new Error((body.error as string) ?? 'Request failed');
  return body as T;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export function apiRegister(username: string, password: string): Promise<{ username: string }> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function apiLogin(username: string, password: string): Promise<{ username: string }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function apiLogout(): Promise<{ ok: boolean }> {
  return request('/auth/logout', { method: 'POST' });
}

// ── User ───────────────────────────────────────────────────────────────────────

export type UserProfile = Omit<GameSave, 'profile' | 'ranked' | 'story' | 'inventory' | 'pityCount'> & {
  userId: string;
  username: string;
  createdAt?: string;
  ranked?: {
    tier: string;
    division: string;
    rp: number;
    mmr: number;
  };
  stats?: {
    combat?: {
      totalKills: number;
      highestCombo: number;
    };
    survival?: {
      totalWaves: number;
      totalRunTimeSeconds: number;
    };
    ranked?: {
      peakRP: number;
      winRate: number;
      matchesThisSeason: number;
      matchesAllTime: number;
      podiumFinishes: number;
      firstPlaceCount: number;
      placementMatchesPlayed: number;
    };
    economy?: {
      seedsEarnedAllTime: number;
    };
  };
  profile?: {
    avatarId?: string;
    frameId?: string;
    bannerId?: string;
    title?: string;
    badgeId?: string;
  };
  inventory?: Array<{
    id: string;
    category: 'ship-skin' | 'bullet-skin' | 'kill-effect' | 'banner' | 'frame' | 'avatar' | 'weapon-skin';
    rarity: 'common' | 'refined' | 'rare' | 'legendary' | 'signature' | 'gm';
    source: string;
    obtainedAt: string;
    equipped: boolean;
  }>;
  pity?: {
    pullsSinceLastLegendary: number;
  };
  story?: {
    completedChapters: Array<{
      chapterId: number;
      difficulty: 'calm' | 'balanced' | 'tempest';
      completedAt: string;
    }>;
    fullClearDate: string | null;
  };
  runHistory?: Array<{
    wave: number;
    score: number;
    kills: number;
    seeds: number;
    date: number;
    weapon: string;
    ability: string;
  }>;
};

export function apiGetMe(): Promise<UserProfile> {
  return request('/user/me');
}

export function apiSaveSave(save: GameSave): Promise<{ ok: boolean }> {
  return request('/user/save', { method: 'PATCH', body: JSON.stringify(save) });
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  highScore: number;
  totalRuns: number;
  rp?: number;
  mmr?: number;
  tier?: string;
  division?: string | null;
}

export interface LeaderboardParams {
  limit?: number;
  offset?: number;
  scope?: 'ranked' | 'score';
}

export function apiGetLeaderboard(params?: LeaderboardParams): Promise<LeaderboardEntry[]> {
  const qs = new URLSearchParams();
  if (params?.limit  != null) qs.set('limit',  String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.scope) qs.set('scope', params.scope);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/leaderboard${query}`);
}

export function apiGetMyRank(scope: 'ranked' | 'score' = 'ranked'): Promise<LeaderboardEntry> {
  return request(`/leaderboard/me?scope=${scope}`);
}

export function apiSubmitScore(payload: {
  score: number;
  wavesReached: number;
  kills: number;
  durationMs: number;
}): Promise<{ ok: boolean; isNewHigh: boolean; highScore: number }> {
  return request('/leaderboard/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Friends ────────────────────────────────────────────────────────────────────

export type FriendPresenceStatus = 'online' | 'in-match' | 'offline';

export interface FriendEntry {
  userId: string;
  username: string;
  addedAt: string;
  status: FriendPresenceStatus;
}

export interface FriendRequestEntry {
  userId: string;
  username: string;
  sentAt: string;
}

export interface FriendsResponse {
  friends: FriendEntry[];
  requestsIn: FriendRequestEntry[];
  requestsOut: FriendRequestEntry[];
}

export function apiGetFriends(): Promise<FriendsResponse> {
  return request('/friends');
}

export function apiFriendRequest(username: string): Promise<{ ok: boolean; autoAccepted: boolean }> {
  return request('/friends/request', { method: 'POST', body: JSON.stringify({ username }) });
}

export function apiFriendAccept(friendId: string): Promise<{ ok: boolean }> {
  return request('/friends/accept', { method: 'POST', body: JSON.stringify({ friendId }) });
}

export function apiFriendDecline(friendId: string): Promise<{ ok: boolean }> {
  return request('/friends/decline', { method: 'POST', body: JSON.stringify({ friendId }) });
}

export function apiFriendRemove(friendId: string): Promise<{ ok: boolean }> {
  return request('/friends/remove', { method: 'POST', body: JSON.stringify({ friendId }) });
}

// ── Story ──────────────────────────────────────────────────────────────────────

export function apiCompleteChapter(payload: {
  chapterId: number;
  difficulty: 'calm' | 'balanced' | 'tempest';
}): Promise<{ ok: boolean; fullClear: boolean }> {
  return request('/story/complete', { method: 'POST', body: JSON.stringify(payload) });
}

// ── Match result ───────────────────────────────────────────────────────────────

export interface MatchResultResponse {
  ok: boolean;
  rpDelta: number;
  mmrDelta: number;
  newRp: number;
  newMmr: number;
  newTier: string;
  newDivision: string | null;
  rankedUp: boolean;
  isPlacement: boolean;
}

export function apiSubmitMatchResult(payload: {
  placement: number;
  score: number;
  kills: number;
  wavesReached: number;
  durationMs: number;
}): Promise<MatchResultResponse> {
  return request('/match/result', { method: 'POST', body: JSON.stringify(payload) });
}
