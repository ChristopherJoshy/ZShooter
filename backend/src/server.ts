import 'dotenv/config';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import mongoose from 'mongoose';

import mongodbPlugin from './plugins/mongodb.js';
import redisPlugin, { redisAvailable } from './plugins/redis.js';
import authPlugin from './plugins/auth.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import leaderboardRoutes from './routes/leaderboard.js';
import friendsRoutes from './routes/friends.js';
import matchRoutes from './routes/match.js';

import { initSocket } from './socket/index.js';

const PORT = Number(process.env.PORT ?? 3001);
// FRONTEND_URL may be a comma-separated list of allowed origins (e.g. prod URL
// + local LAN IP for mobile dev testing).  Split into an array so @fastify/cors
// accepts each entry individually rather than treating the whole string as one
// origin (which would never match and silently break credentials).
const FRONTEND_URLS = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

async function bootstrap() {
  // Infrastructure plugins — order matters: redis before rate-limit.
  await fastify.register(mongodbPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);

  // HTTP plugins.
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'change-me-in-production',
    parseOptions: {},
  });

  await fastify.register(cors, {
    // Only allow the configured frontend origins — never reflect arbitrary origins.
    // Set FRONTEND_URL=https://z-shooter.vercel.app on Render in production.
    // Multiple origins (comma-separated in env) are supported for LAN dev testing.
    origin: FRONTEND_URLS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  });

  // Rate limiting — backed by Redis when available.
  await fastify.register(rateLimit, {
    global: false, // applied per-route, not globally
    redis: fastify.redis ?? undefined, // Pass undefined if Redis unavailable
  });

  // Apply per-route rate limit on auth endpoints.
  // Must be registered BEFORE the auth routes so the hook fires when those routes register.
  fastify.addHook('onRoute', (routeOptions) => {
    if (
      routeOptions.url === '/api/auth/register' ||
      routeOptions.url === '/api/auth/login'
    ) {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: { max: 10, timeWindow: '1 minute' },
      };
    }
  });

  // Auth routes — rate-limited aggressively.
  await fastify.register(authRoutes, {
    prefix: '/api',
    logLevel: 'info',
  });

  await fastify.register(userRoutes, { prefix: '/api' });
  await fastify.register(leaderboardRoutes, { prefix: '/api' });
  await fastify.register(friendsRoutes, { prefix: '/api' });
  await fastify.register(matchRoutes, { prefix: '/api' });

  // Health check with Redis and MongoDB status.
  fastify.get('/health', async () => ({
    status: 'ok',
    redis: redisAvailable,
    mongo: mongoose.connection.readyState === 1,
  }));

  // Start HTTP server and attach Socket.IO to the same port.
  // Must call fastify.listen() first to get the underlying http.Server.
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${PORT}`);

    // Attach Socket.IO to the underlying http.Server after it is bound.
    const httpServer = fastify.server;
    initSocket(httpServer, fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
