import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { User } from '../models/User.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { COOKIE_NAME } from '../plugins/auth.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
};

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }
    const { username, password } = parsed.data;
    const normalized = username.toLowerCase().trim();

    const existing = await User.findOne({ usernameNormalized: normalized });
    if (existing) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await User.create({
      username: username.trim(),
      usernameNormalized: normalized,
      passwordHash,
    });

    const token = await fastify.signJwt({ userId: String(user._id), username: user.username });
    return reply
      .setCookie(COOKIE_NAME, token, COOKIE_OPTS)
      .status(201)
      .send({ username: user.username });
  });

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }
    const { username, password } = parsed.data;
    const normalized = username.toLowerCase().trim();

    const user = await User.findOne({ usernameNormalized: normalized });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    const token = await fastify.signJwt({ userId: String(user._id), username: user.username });
    return reply
      .setCookie(COOKIE_NAME, token, COOKIE_OPTS)
      .send({ username: user.username });
  });

  // POST /auth/logout
  fastify.post('/auth/logout', async (_request, reply) => {
    return reply
      .clearCookie(COOKIE_NAME, COOKIE_OPTS)
      .send({ ok: true });
  });

  // GET /auth/token — returns the raw JWT for Socket.IO handshake.
  // The cookie is HttpOnly so the browser JS cannot read it directly.
  // This endpoint reads it server-side and echoes the string back.
  fastify.get('/auth/token', async (request, reply) => {
    const token = request.cookies?.[COOKIE_NAME];
    if (!token) return reply.status(401).send({ error: 'Not authenticated' });
    try {
      await fastify.verifyJwt(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
    return reply.send({ token });
  });
}
