import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { User } from '../models/User.js';
import { z } from 'zod';

const usernameSchema = z.object({
  username: z.string().min(2).max(24),
});

const userIdSchema = z.object({
  friendId: z.string().min(1),
});

export default async function friendsRoutes(fastify: FastifyInstance) {
  // GET /friends — list accepted friends with their presence status (online / offline)
  fastify.get('/friends', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.userId).select('friends').lean();
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const redis = fastify.redis;
    const accepted = user.friends?.accepted ?? [];
    const requestsIn = user.friends?.requestsIn ?? [];
    const requestsOut = user.friends?.requestsOut ?? [];

    // Fetch presence for each accepted friend in parallel
    const friendsWithStatus = await Promise.all(
      accepted.map(async (f) => {
        const raw = await redis.get(`presence:${f.userId}`).catch(() => null);
        const status: 'online' | 'in-match' | 'offline' =
          raw === 'online' ? 'online' : raw === 'in-match' ? 'in-match' : 'offline';
        return {
          userId: f.userId,
          username: f.username,
          addedAt: f.addedAt,
          status,
        };
      })
    );

    return reply.send({
      friends: friendsWithStatus,
      requestsIn: requestsIn.map((r) => ({ userId: r.userId, username: r.username, sentAt: r.sentAt })),
      requestsOut: requestsOut.map((r) => ({ userId: r.userId, username: r.username, sentAt: r.sentAt })),
    });
  });

  // POST /friends/request — send a friend request by username
  fastify.post('/friends/request', { preHandler: authenticate }, async (request, reply) => {
    const parsed = usernameSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });

    const normalized = parsed.data.username.toLowerCase().trim();

    const [me, target] = await Promise.all([
      User.findById(request.userId).select('username friends').lean(),
      User.findOne({ usernameNormalized: normalized }).select('_id username friends').lean(),
    ]);

    if (!me) return reply.status(404).send({ error: 'User not found' });
    if (!target) return reply.status(404).send({ error: 'Player not found' });
    if (String(target._id) === request.userId) return reply.status(400).send({ error: 'Cannot add yourself' });

    const alreadyFriend = me.friends?.accepted?.some((f) => f.userId === String(target._id));
    if (alreadyFriend) return reply.status(409).send({ error: 'Already friends' });

    const alreadySent = me.friends?.requestsOut?.some((r) => r.userId === String(target._id));
    if (alreadySent) return reply.status(409).send({ error: 'Request already sent' });

    // Check if target already sent us a request → auto-accept
    const theyRequested = me.friends?.requestsIn?.some((r) => r.userId === String(target._id));
    if (theyRequested) {
      // Auto-accept: add to both accepted lists, remove from requestsIn/Out
      await User.findByIdAndUpdate(request.userId, {
        $push: { 'friends.accepted': { userId: String(target._id), username: target.username } },
        $pull: { 'friends.requestsIn': { userId: String(target._id) } },
      });
      await User.findByIdAndUpdate(String(target._id), {
        $push: { 'friends.accepted': { userId: request.userId, username: me.username } },
        $pull: { 'friends.requestsOut': { userId: request.userId } },
      });
      return reply.send({ ok: true, autoAccepted: true });
    }

    // Normal request
    await User.findByIdAndUpdate(request.userId, {
      $push: { 'friends.requestsOut': { userId: String(target._id), username: target.username } },
    });
    await User.findByIdAndUpdate(String(target._id), {
      $push: { 'friends.requestsIn': { userId: request.userId, username: me.username } },
    });

    return reply.send({ ok: true, autoAccepted: false });
  });

  // POST /friends/accept — accept an incoming request
  fastify.post('/friends/accept', { preHandler: authenticate }, async (request, reply) => {
    const parsed = userIdSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });

    const { friendId } = parsed.data;

    const [me, them] = await Promise.all([
      User.findById(request.userId).select('username friends').lean(),
      User.findById(friendId).select('username').lean(),
    ]);

    if (!me) return reply.status(404).send({ error: 'User not found' });
    if (!them) return reply.status(404).send({ error: 'Friend not found' });

    const hasRequest = me.friends?.requestsIn?.some((r) => r.userId === friendId);
    if (!hasRequest) return reply.status(404).send({ error: 'No incoming request from that user' });

    await User.findByIdAndUpdate(request.userId, {
      $push: { 'friends.accepted': { userId: friendId, username: them.username } },
      $pull: { 'friends.requestsIn': { userId: friendId } },
    });
    await User.findByIdAndUpdate(friendId, {
      $push: { 'friends.accepted': { userId: request.userId, username: me.username } },
      $pull: { 'friends.requestsOut': { userId: request.userId } },
    });

    return reply.send({ ok: true });
  });

  // POST /friends/decline — decline an incoming request
  fastify.post('/friends/decline', { preHandler: authenticate }, async (request, reply) => {
    const parsed = userIdSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });

    const { friendId } = parsed.data;

    const me = await User.findById(request.userId).select('friends').lean();
    if (!me) return reply.status(404).send({ error: 'User not found' });

    await User.findByIdAndUpdate(request.userId, {
      $pull: { 'friends.requestsIn': { userId: friendId } },
    });
    await User.findByIdAndUpdate(friendId, {
      $pull: { 'friends.requestsOut': { userId: request.userId } },
    });

    return reply.send({ ok: true });
  });

  // POST /friends/remove — remove an accepted friend
  fastify.post('/friends/remove', { preHandler: authenticate }, async (request, reply) => {
    const parsed = userIdSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0].message });

    const { friendId } = parsed.data;

    await Promise.all([
      User.findByIdAndUpdate(request.userId, {
        $pull: { 'friends.accepted': { userId: friendId } },
      }),
      User.findByIdAndUpdate(friendId, {
        $pull: { 'friends.accepted': { userId: request.userId } },
      }),
    ]);

    return reply.send({ ok: true });
  });
}
