// Session identity cache — stores only username + userId in localStorage.
// Game save data is never cached here; MongoDB is always authoritative for that.
// Cache is valid for 7 days (matching JWT lifetime). Cleared on logout.

const CACHE_KEY = 'zs_session';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export interface SessionCache {
  username: string;
  userId: string;
  cachedAt: number;
}

export function writeSessionCache(username: string, userId: string): void {
  try {
    const entry: SessionCache = { username, userId, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable (private browsing, storage quota) — non-fatal
  }
}

export function readSessionCache(): SessionCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionCache;
    if (!data.username || !data.userId || typeof data.cachedAt !== 'number') return null;
    if (Date.now() - data.cachedAt > CACHE_TTL) {
      clearSessionCache();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearSessionCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // non-fatal
  }
}
