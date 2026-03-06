// ══════════════════════════════════════════════════════════
// Socket.IO bootstrap
// Attaches a Socket.IO Server to Fastify's underlying
// http.Server and registers all event namespaces.
// ══════════════════════════════════════════════════════════

import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { FastifyInstance } from 'fastify';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './events.js';
import { registerPresenceHandlers } from './presence.js';
import { registerMatchmakingHandlers } from './matchmaking.js';
import type { Redis } from 'ioredis';

// Re-export the typed IO type for use in other modules
export type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ──────────────────────────────────────────────────────────
// JWT verification helper (reuses the Fastify auth plugin logic)
// ──────────────────────────────────────────────────────────

async function verifySocketToken(
  fastify: FastifyInstance,
  token: string
): Promise<{ userId: string; username: string } | null> {
  try {
    const payload = await fastify.verifyJwt(token);
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// Main init function — called once from server.ts
// ──────────────────────────────────────────────────────────

export function initSocket(httpServer: HttpServer, fastify: FastifyInstance): IO {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: frontendUrl,
        credentials: true,
      },
      // Prefer WebSocket, fall back to polling
      transports: ['websocket', 'polling'],
      // Ping/pong for connection health
      pingInterval: 25000,
      pingTimeout: 60000,
    }
  );

  // ── Authentication middleware ────────────────────────
  // Clients must send the JWT in the auth handshake.
  // The cookie is HttpOnly so we forward it via socket auth object.
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as Record<string, string>)?.token;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    const identity = await verifySocketToken(fastify, token);
    if (!identity) {
      next(new Error('Invalid or expired token'));
      return;
    }

    socket.data.userId = identity.userId;
    socket.data.username = identity.username;
    next();
  });

  // ── Connection handler ───────────────────────────────
  io.on('connection', (socket) => {
    const redis = fastify.redis as Redis;

    fastify.log.info(`[socket] connected: ${socket.data.username} (${socket.id})`);

    // Register feature handlers
    registerPresenceHandlers(io, socket, redis);
    registerMatchmakingHandlers(io, socket, redis);

    // Log disconnects
    socket.on('disconnect', (reason) => {
      fastify.log.info(
        `[socket] disconnected: ${socket.data.username ?? 'unknown'} — ${reason}`
      );
    });
  });

  fastify.log.info('[socket] Socket.IO server attached');
  return io;
}
