import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

// Export redis availability flag for other modules
export let redisAvailable = false;

const CONNECT_TIMEOUT_MS = 5000; // Give up after 5s — keeps Fastify startup under avvio limit.

// Connects ioredis and decorates the Fastify instance.
// Also used as the store for @fastify/rate-limit.
async function redisPlugin(fastify: FastifyInstance) {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableReadyCheck: false, // Skip CLUSTER INFO / READY check — avoids extra round-trip that can hang.
    connectTimeout: CONNECT_TIMEOUT_MS,
    retryStrategy: () => null, // No auto-retry on initial connect — fail fast.
  });

  // Race the connect() call against a hard timeout so avvio never fires its
  // "plugin did not start in time" error when Redis is slow or unreachable.
  const connectResult = await Promise.race([
    redis.connect().then(() => 'ok' as const).catch((err: unknown) => err),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), CONNECT_TIMEOUT_MS)),
  ]);

  if (connectResult === 'ok') {
    fastify.log.info('Redis connected');
    redisAvailable = true;
  } else {
    fastify.log.warn(
      { connectResult },
      'Redis connection failed or timed out — rate limiting and caching disabled'
    );
    // Ensure ioredis is in a closed state so it doesn't keep retrying in background.
    redis.disconnect();
    redisAvailable = false;
  }

  fastify.decorate('redis', redisAvailable ? redis : null);

  fastify.addHook('onClose', async () => {
    try { await redis.quit(); } catch { /* already disconnected */ }
    fastify.log.info('Redis connection closed');
  });
}

export default fp(redisPlugin, { name: 'redis' });
