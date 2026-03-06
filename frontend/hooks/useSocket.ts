'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PresenceStatus = 'online' | 'in-match' | 'offline';

export interface FriendStatus {
  userId: string;
  status: PresenceStatus;
}

export interface SocketState {
  connected: boolean;
  /** Map from userId → current presence status — updated in real-time */
  presenceMap: Record<string, PresenceStatus>;
  /** Pending incoming friend request (cleared after reading) */
  incomingRequest: { fromUserId: string; fromUsername: string } | null;
  /** True when the socket is actively trying to reconnect after a drop */
  reconnecting: boolean;
  /** Latency in ms, tracked via socket.io ping/pong */
  ping: number;
}

// ── Matchmaking types ──────────────────────────────────────────────────────────

export interface LobbyPlayerSlim {
  userId: string;
  username: string;
  mmr: number;
}

export interface BotSlotSlim {
  botId: string;
  name: string;
  mmr: number;
}

export interface MatchmakingLobby {
  lobbyId: string;
  players: LobbyPlayerSlim[];
  bots: BotSlotSlim[];
  countdownSeconds: number | null;
}

export type MatchmakingStatus = 'idle' | 'queuing' | 'found';

export interface MatchmakingWaiting {
  position: number;
  estimatedWaitSeconds: number;
  expandedRange: boolean;
}

export interface MatchmakingState {
  status: MatchmakingStatus;
  waiting: MatchmakingWaiting | null;
  lobby:   MatchmakingLobby  | null;
}

const INITIAL_MM_STATE: MatchmakingState = {
  status:  'idle',
  waiting: null,
  lobby:   null,
};

const INITIAL_STATE: SocketState = {
  connected: false,
  presenceMap: {},
  incomingRequest: null,
  reconnecting: false,
  ping: 0,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useSocket — connects to the backend Socket.IO server once and manages
 * the connection lifecycle. Returns live connection state, matchmaking state,
 * queue/cancel actions, and a setter to clear the `incomingRequest` notification.
 *
 * Requires the backend's `GET /api/auth/token` endpoint to obtain a JWT
 * for the socket handshake (since the cookie is HttpOnly).
 */
export function useSocket(userId: string | null, username: string | null) {
  const [state, setState]     = useState<SocketState>(INITIAL_STATE);
  const [mmState, setMmState] = useState<MatchmakingState>(INITIAL_MM_STATE);
  const [lobbyStartTick, setLobbyStartTick] = useState(0);
  const socketRef             = useRef<Socket | null>(null);

  const clearIncomingRequest = useCallback(() => {
    setState((s) => ({ ...s, incomingRequest: null }));
  }, []);

  // ── Matchmaking actions ────────────────────────────────
  const queueForMatch = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !userId) return;
    setMmState({ status: 'queuing', waiting: null, lobby: null });
    socket.emit('matchmaking:queue', {
      userId,
      mmr:          1000,   // server ignores this and reads from DB
      region:       'global',
      partyMembers: [],
    });
  }, [userId]);

  const cancelMatch = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !userId) return;
    setMmState(INITIAL_MM_STATE);
    socket.emit('matchmaking:cancel', { userId });
  }, [userId]);

  useEffect(() => {
    if (!userId || !username) return;

    let cancelled = false;

    async function connect() {
      // Fetch token for socket handshake
      let token: string;
      try {
        const res = await fetch('/api/auth/token', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json() as { token: string };
        token = data.token;
      } catch {
        return; // Non-fatal — socket features simply won't be available
      }

      if (cancelled) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

      const socket = io(apiUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, connected: true, reconnecting: false }));
        // Announce presence
        socket.emit('presence:online', { userId: userId!, username: username! });
      });

      socket.on('disconnect', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, connected: false }));
        // Reset matchmaking on disconnect
        setMmState(INITIAL_MM_STATE);
      });

      socket.io.on('reconnect_attempt', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, reconnecting: true }));
      });

      socket.io.on('reconnect_failed', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, reconnecting: false, connected: false }));
      });

      let lastPingDate = Date.now();
      socket.io.on('ping', () => {
        lastPingDate = Date.now();
      });

      // socket.io-client TS types don't include 'pong' as a literal event name on Manager
      // We cast to any to attach the event listener for latency tracking
      (socket.io as any).on('pong', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, ping: Date.now() - lastPingDate }));
      });

      socket.on('presence:update', (payload: any) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          presenceMap: { ...s.presenceMap, [payload.userId]: payload.status },
        }));
      });

      socket.on('friend:request-received', (payload: any) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          incomingRequest: { fromUserId: payload.fromUserId, fromUsername: payload.fromUsername },
        }));
      });

      // ── Matchmaking events ─────────────────────────────
      socket.on('matchmaking:waiting', (payload: any) => {
        if (cancelled) return;
        setMmState((s) => ({
          ...s,
          status:  'queuing',
          waiting: {
            position:             payload.position,
            estimatedWaitSeconds: payload.estimatedWaitSeconds,
            expandedRange:        payload.expandedRange,
          },
        }));
      });

      socket.on('matchmaking:found', (payload: any) => {
        if (cancelled) return;
        setMmState({
          status: 'found',
          waiting: null,
          lobby: {
            lobbyId: payload.lobbyId,
            players: (payload.players as Array<{ userId: string; username: string; mmr: number }>).map((p) => ({
              userId:   p.userId,
              username: p.username,
              mmr:      p.mmr,
            })),
            bots: (payload.bots as Array<{ botId: string; name: string; mmr: number }>).map((b) => ({
              botId: b.botId,
              name:  b.name,
              mmr:   b.mmr,
            })),
            countdownSeconds: null,
          },
        });
      });

      socket.on('lobby:update', (payload: any) => {
        if (cancelled) return;
        setMmState((s) => {
          if (!s.lobby || s.lobby.lobbyId !== payload.lobbyId) return s;
          return {
            ...s,
            lobby: {
              ...s.lobby,
              countdownSeconds: payload.countdownSeconds,
            },
          };
        });
      });

      socket.on('lobby:start', () => {
        if (cancelled) return;
        // Reset matchmaking state once the match starts
        setMmState(INITIAL_MM_STATE);
        // Increment tick so consumers can react to lobby start as an effect dep
        setLobbyStartTick((t) => t + 1);
      });
    }

    connect().catch(() => null);

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        const uid = userId;
        if (uid) socket.emit('presence:offline', { userId: uid });
        socket.disconnect();
        socketRef.current = null;
      }
      setState(INITIAL_STATE);
      setMmState(INITIAL_MM_STATE);
    };
  }, [userId, username]);

  return {
    socketState: state,
    matchmakingState: mmState,
    clearIncomingRequest,
    queueForMatch,
    cancelMatch,
    /** Increments each time `lobby:start` fires — use as a useEffect dependency */
    onLobbyStart: lobbyStartTick,
  };
}
