import fp from 'fastify-plugin';
import { SignJWT, jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '../types/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    signJwt: (payload: JwtPayload) => Promise<string>;
    verifyJwt: (token: string) => Promise<JwtPayload>;
  }
}

const JWT_EXPIRY = '7d';
const COOKIE_NAME = 'zf_token';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env variable is not set');
  return new TextEncoder().encode(secret);
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('signJwt', async (payload: JwtPayload): Promise<string> => {
    const secret = getSecret();
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(secret);
  });

  fastify.decorate('verifyJwt', async (token: string): Promise<JwtPayload> => {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  });
}

export { COOKIE_NAME };
export default fp(authPlugin, { name: 'auth' });
