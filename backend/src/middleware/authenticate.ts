import type { FastifyRequest, FastifyReply } from 'fastify';
import { COOKIE_NAME } from '../plugins/auth.js';

// Fastify preHandler hook — verifies the JWT cookie and attaches userId/username to request.
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies?.[COOKIE_NAME];

  if (!token) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  try {
    const payload = await request.server.verifyJwt(token);
    request.userId = payload.userId;
    request.username = payload.username;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired session' });
  }
}
