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
  /** True when the backend server is reachable (checked after reconnect failures) */
  serverAvailable: boolean;
  /** True once the socket has successfully connected at least once this session */
  hasEverConnected: boolean;
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
  serverAvailable: true,
  hasEverConnected: false,
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
  const retryIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectingRef      = useRef(false);

  const clearIncomingRequest = useCallback(() => {
    setState((s) => ({ ...s, incomingRequest: null }));
  }, []);

  // ── Server availability check ───────────────────────────────
  /** Check if the backend server is reachable */
  const checkServerAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/token', { 
        credentials: 'include',
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    }
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

  // ── Connect function ────────────────────────────────────────
  const connect = useCallback(() => {
    if (isConnectingRef.current || !userId || !username) return;
    
    isConnectingRef.current = true;
    
    let cancelled = false;

    async function doConnect() {
      // Fetch token for socket handshake
      let token: string;
      try {
        const res = await fetch('/api/auth/token', { credentials: 'include' });
        if (!res.ok) {
          isConnectingRef.current = false;
          return;
        }
        const data = await res.json() as { token: string };
        token = data.token;
      } catch {
        isConnectingRef.current = false;
        // Non-fatal — socket features simply won't be available
        return;
      }

      if (cancelled) {
        isConnectingRef.current = false;
        return;
      }

      const isDev = process.env.NODE_ENV === 'development';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? (isDev ? 'http://localhost:4000' : 'https://zshooter.onrender.com');

      const socket = io(apiUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (cancelled) return;
        isConnectingRef.current = false;
        setState((s) => ({ ...s, connected: true, reconnecting: false, serverAvailable: true, hasEverConnected: true }));
        // Announce presence
        socket.emit('presence:online', { userId: userId!, username: username! });
      });

      socket.on('disconnect', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, connected: false, reconnecting: true }));
        // Reset matchmaking on disconnect
        setMmState(INITIAL_MM_STATE);
      });

      socket.io.on('reconnect_attempt', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, reconnecting: true }));
      });

      socket.io.on('reconnect_failed', () => {
        if (cancelled) return;
        isConnectingRef.current = false;
        // Check if server is available after all reconnection attempts fail
        checkServerAvailable().then((available) => {
          setState((s) => ({ 
            ...s, 
            reconnecting: false, 
            connected: false,
            serverAvailable: available,
          }));
        });
      });

      let lastPingDate = Date.now();
      socket.io.on('ping', () => {
        lastPingDate = Date.now();
      });

      // socket.io-client TS types don't include 'pong' as a literal event name on Manager
      // We cast to any to attach the event listener for latency tracking
      (socket.io as unknown as { on: (event: string, cb: () => void) => void }).on('pong', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, ping: Date.now() - lastPingDate }));
      });

      socket.on('presence:update', (payload: unknown) => {
        if (cancelled) return;
        const p = payload as { userId: string; status: PresenceStatus };
        setState((s) => ({
          ...s,
          presenceMap: { ...s.presenceMap, [p.userId]: p.status },
        }));
      });

      socket.on('friend:request-received', (payload: unknown) => {
        if (cancelled) return;
        const p = payload as { fromUserId: string; fromUsername: string };
        setState((s) => ({
          ...s,
          incomingRequest: { fromUserId: p.fromUserId, fromUsername: p.fromUsername },
        }));
      });

      // ── Matchmaking events ─────────────────────────────
      socket.on('matchmaking:waiting', (payload: unknown) => {
        if (cancelled) return;
        const p = payload as { position: number; estimatedWaitSeconds: number; expandedRange: boolean };
        setMmState((s) => ({
          ...s,
          status:  'queuing',
          waiting: {
            position:             p.position,
            estimatedWaitSeconds: p.estimatedWaitSeconds,
            expandedRange:        p.expandedRange,
          },
        }));
      });

      socket.on('matchmaking:found', (payload: unknown) => {
        if (cancelled) return;
        const p = payload as { 
          lobbyId: string; 
          players: Array<{ userId: string; username: string; mmr: number }>;
          bots: Array<{ botId: string; name: string; mmr: number }>;
        };
        setMmState({
          status: 'found',
          waiting: null,
          lobby: {
            lobbyId: p.lobbyId,
            players: p.players.map((player) => ({
              userId:   player.userId,
              username: player.username,
              mmr:      player.mmr,
            })),
            bots: p.bots.map((bot) => ({
              botId: bot.botId,
              name:  bot.name,
              mmr:   bot.mmr,
            })),
            countdownSeconds: null,
          },
        });
      });

      socket.on('lobby:update', (payload: unknown) => {
        if (cancelled) return;
        const p = payload as { lobbyId: string; countdownSeconds: number | null };
        setMmState((s) => {
          if (!s.lobby || s.lobby.lobbyId !== p.lobbyId) return s;
          return {
            ...s,
            lobby: {
              ...s.lobby,
              countdownSeconds: p.countdownSeconds,
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

    doConnect().catch(() => {
      isConnectingRef.current = false;
    });
  }, [userId, username, checkServerAvailable]);

  // ── Retry connection (manual or periodic) ──────────────────
  const retryConnection = useCallback(async () => {
    // Check if server is available first
    const available = await checkServerAvailable();
    if (!available) {
      setState((s) => ({ ...s, serverAvailable: false }));
      return;
    }
    
    // Server is available, reset state and reconnect
    setState((s) => ({ ...s, serverAvailable: true }));
    
    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Trigger reconnection
    connect();
  }, [checkServerAvailable, connect]);

  // ── Periodic retry check (every 30s) ─────────────────────────────
  useEffect(() => {
    // Only start periodic checks if server is unavailable
    if (!state.serverAvailable) {
      retryIntervalRef.current = setInterval(() => {
        retryConnection();
      }, 30000); // 30 seconds
    }

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [state.serverAvailable, retryConnection]);

  // ── Initial connection on mount ───────────────────────────────
  useEffect(() => {
    if (!userId || !username) return;
    
    // Initial connection attempt
    connect();

    return () => {
      const socket = socketRef.current;
      if (socket) {
        const uid = userId;
        if (uid) socket.emit('presence:offline', { userId: uid });
        socket.disconnect();
        socketRef.current = null;
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [userId, username, connect]);

  return {
    socketState: state,
    matchmakingState: mmState,
    clearIncomingRequest,
    queueForMatch,
    cancelMatch,
    /** Retry connection manually (e.g., user clicked a retry button) */
    retryConnection,
    /** Increments each time `lobby:start` fires — use as a useEffect dependency */
    onLobbyStart: lobbyStartTick,
  };
}
