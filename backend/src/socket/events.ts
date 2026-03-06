// ══════════════════════════════════════════════════════════
// Socket.IO Event Catalogue
//
// This file defines EVERY event name and payload shape used
// by ZShooter's real-time layer. No event string is ever
// hardcoded outside this file.
//
// Convention:
//   ClientToServer — events the client emits to the server
//   ServerToClient — events the server emits to clients
//   InterServer    — events between server processes (future)
// ══════════════════════════════════════════════════════════

import type {
  LobbyPlayer,
  BotSlot,
  MatchResult,
  MatchEvent,
  RankTier,
} from '../types/index.js';

// ──────────────────────────────────────────────────────────
// Presence
// ──────────────────────────────────────────────────────────

export interface PresenceOnlinePayload {
  userId: string;
  username: string;
}

export interface PresenceInMatchPayload {
  userId: string;
  mode: 'ranked' | 'story';
}

export interface PresenceOfflinePayload {
  userId: string;
}

export interface PresenceUpdatePayload {
  userId: string;
  status: 'online' | 'in-match' | 'offline';
  mode?: 'ranked' | 'story';
}

// ──────────────────────────────────────────────────────────
// Matchmaking
// ──────────────────────────────────────────────────────────

export interface MatchmakingQueuePayload {
  userId: string;
  mmr: number;
  region: string;
  partyMembers: string[];  // userId[] of party members queuing together
}

export interface MatchmakingCancelPayload {
  userId: string;
}

export interface MatchmakingFoundPayload {
  lobbyId: string;
  players: LobbyPlayer[];
  bots: BotSlot[];
}

export interface MatchmakingWaitingPayload {
  position: number;
  estimatedWaitSeconds: number;
  expandedRange: boolean;  // true after 30s MMR range expansion
}

// ──────────────────────────────────────────────────────────
// Lobby
// ──────────────────────────────────────────────────────────

export interface LobbyReadyPayload {
  lobbyId: string;
  userId: string;
}

export interface LobbyChatPayload {
  lobbyId: string;
  userId: string;
  message: string;
}

export interface LobbyUpdatePayload {
  lobbyId: string;
  players: Array<LobbyPlayer | BotSlot>;
  countdownSeconds: number | null;  // null = countdown not started
}

export interface LobbyStartPayload {
  matchId: string;
  lobbyId: string;
}

// ──────────────────────────────────────────────────────────
// Match — in-game events
// ──────────────────────────────────────────────────────────

/** Sent every frame (or at fixed tick rate) from client */
export interface MatchInputPayload {
  matchId: string;
  userId: string;
  seq: number;   // monotonic sequence number for reconciliation
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    space: boolean;
    r: boolean;
  };
  mouseX: number;
  mouseY: number;
  firing: boolean;
}

/** Server authoritative state snapshot sent to all clients */
export interface MatchStatePayload {
  matchId: string;
  seq: number;
  tickMs: number;   // server timestamp for interpolation
  scores: Array<{
    userId: string;
    username: string;
    score: number;
    kills: number;
    isBot: boolean;
  }>;
  timerSeconds: number;
  wave: number;
}

export interface MatchRevivePayload {
  matchId: string;
  reviverId: string;
  targetId: string;
}

export interface MatchEndPayload {
  matchId: string;
  results: MatchResult[];
  durationSeconds: number;
}

export interface MatchEventPayload {
  matchId: string;
  event: MatchEvent;
}

// ──────────────────────────────────────────────────────────
// Friends
// ──────────────────────────────────────────────────────────

export interface FriendRequestPayload {
  fromUserId: string;
  toUsername: string;
}

export interface FriendAcceptPayload {
  userId: string;
  friendId: string;
}

export interface FriendDeclinePayload {
  userId: string;
  friendId: string;
}

export interface FriendRemovePayload {
  userId: string;
  friendId: string;
}

export interface FriendRequestReceivedPayload {
  fromUserId: string;
  fromUsername: string;
  fromAvatarId: string;
  fromRankTier: RankTier;
}

export interface FriendAcceptedPayload {
  userId: string;
  username: string;
  avatarId: string;
  rankTier: RankTier;
}

// ──────────────────────────────────────────────────────────
// Chat (DMs)
// ──────────────────────────────────────────────────────────

export interface ChatSendPayload {
  fromUserId: string;
  toUserId: string;
  message: string;   // max 200 chars, plain text only
}

export interface ChatMessagePayload {
  id: string;
  fromUserId: string;
  fromUsername: string;
  message: string;
  timestamp: number;  // epoch ms
}

// ──────────────────────────────────────────────────────────
// Party
// ──────────────────────────────────────────────────────────

export interface PartyInvitePayload {
  fromUserId: string;
  toUserId: string;
}

export interface PartyAcceptPayload {
  userId: string;
  partyId: string;
}

export interface PartyLeavePayload {
  userId: string;
  partyId: string;
}

export interface PartyChatPayload {
  partyId: string;
  userId: string;
  message: string;
}

export interface PartyInvitedPayload {
  partyId: string;
  fromUserId: string;
  fromUsername: string;
}

export interface PartyJoinedPayload {
  partyId: string;
  members: Array<{
    userId: string;
    username: string;
    avatarId: string;
    rankTier: RankTier;
    isLeader: boolean;
    isReady: boolean;
  }>;
}

export interface PartyLeftPayload {
  partyId: string;
  userId: string;
}

// ──────────────────────────────────────────────────────────
// Activity feed
// ──────────────────────────────────────────────────────────

export interface ActivityFeedEventPayload {
  id: string;
  type:
    | 'rank-reached'
    | 'wave-milestone'
    | 'first-place'
    | 'story-complete'
    | 'friend-joined';
  message: string;
  actorUsername: string;
  actorRankTier: RankTier;
  timestamp: number;
}

// ──────────────────────────────────────────────────────────
// Generic error
// ──────────────────────────────────────────────────────────

export interface SocketErrorPayload {
  code: string;
  message: string;
}

// ══════════════════════════════════════════════════════════
// Socket.IO typed interface maps
// These are passed to the Server<> and Socket<> generics.
// ══════════════════════════════════════════════════════════

export interface ClientToServerEvents {
  // Presence
  'presence:online':    (payload: PresenceOnlinePayload)    => void;
  'presence:in-match':  (payload: PresenceInMatchPayload)   => void;
  'presence:offline':   (payload: PresenceOfflinePayload)   => void;

  // Matchmaking
  'matchmaking:queue':  (payload: MatchmakingQueuePayload)  => void;
  'matchmaking:cancel': (payload: MatchmakingCancelPayload) => void;

  // Lobby
  'lobby:ready':        (payload: LobbyReadyPayload)        => void;
  'lobby:chat':         (payload: LobbyChatPayload)         => void;

  // Match
  'match:input':        (payload: MatchInputPayload)        => void;
  'match:revive':       (payload: MatchRevivePayload)       => void;

  // Friends
  'friend:request':     (payload: FriendRequestPayload)     => void;
  'friend:accept':      (payload: FriendAcceptPayload)      => void;
  'friend:decline':     (payload: FriendDeclinePayload)     => void;
  'friend:remove':      (payload: FriendRemovePayload)      => void;

  // Chat
  'chat:send':          (payload: ChatSendPayload)          => void;

  // Party
  'party:invite':       (payload: PartyInvitePayload)       => void;
  'party:accept':       (payload: PartyAcceptPayload)       => void;
  'party:leave':        (payload: PartyLeavePayload)        => void;
  'party:chat':         (payload: PartyChatPayload)         => void;
}

export interface ServerToClientEvents {
  // Presence
  'presence:update':             (payload: PresenceUpdatePayload)          => void;

  // Matchmaking
  'matchmaking:found':           (payload: MatchmakingFoundPayload)        => void;
  'matchmaking:waiting':         (payload: MatchmakingWaitingPayload)      => void;

  // Lobby
  'lobby:update':                (payload: LobbyUpdatePayload)             => void;
  'lobby:start':                 (payload: LobbyStartPayload)              => void;

  // Match
  'match:state':                 (payload: MatchStatePayload)              => void;
  'match:event':                 (payload: MatchEventPayload)              => void;
  'match:end':                   (payload: MatchEndPayload)                => void;

  // Friends
  'friend:request-received':     (payload: FriendRequestReceivedPayload)  => void;
  'friend:accepted':             (payload: FriendAcceptedPayload)          => void;

  // Chat
  'chat:message':                (payload: ChatMessagePayload)             => void;

  // Party
  'party:invited':               (payload: PartyInvitedPayload)            => void;
  'party:joined':                (payload: PartyJoinedPayload)             => void;
  'party:left':                  (payload: PartyLeftPayload)               => void;

  // Activity feed
  'feed:event':                  (payload: ActivityFeedEventPayload)       => void;

  // Error
  'error:generic':               (payload: SocketErrorPayload)             => void;
}

export interface InterServerEvents {
  // Placeholder for future horizontal scaling (Redis adapter pub/sub)
  ping: () => void;
}

export interface SocketData {
  userId: string;
  username: string;
}
