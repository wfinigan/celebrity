import { Redis } from "@upstash/redis";

export type GameMeta = {
  hostToken: string;
  revealed: boolean;
  // Shuffled reading order, fixed at reveal time so re-reads match.
  order: string[];
  // How many names have been dealt to the reader, across all passes.
  // The reader may go through the list at most MAX_PASSES times.
  served: number;
  createdAt: number;
};

export const MAX_PASSES = 2;

export interface Store {
  createGame(code: string, meta: GameMeta): Promise<void>;
  getGame(code: string): Promise<GameMeta | null>;
  setGame(code: string, meta: GameMeta): Promise<void>;
  addSubmission(code: string, name: string): Promise<void>;
  getSubmissions(code: string): Promise<string[]>;
}

const GAME_TTL_SECONDS = 6 * 60 * 60; // games expire after 6 hours

function metaKey(code: string) {
  return `game:${code}`;
}
function subsKey(code: string) {
  return `game:${code}:subs`;
}

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async createGame(code: string, meta: GameMeta) {
    await this.redis.set(metaKey(code), meta, { ex: GAME_TTL_SECONDS });
  }

  async getGame(code: string) {
    return await this.redis.get<GameMeta>(metaKey(code));
  }

  async setGame(code: string, meta: GameMeta) {
    await this.redis.set(metaKey(code), meta, { ex: GAME_TTL_SECONDS });
  }

  async addSubmission(code: string, name: string) {
    await this.redis.rpush(subsKey(code), name);
    await this.redis.expire(subsKey(code), GAME_TTL_SECONDS);
  }

  async getSubmissions(code: string) {
    return await this.redis.lrange(subsKey(code), 0, -1);
  }
}

// In-memory store for local development only. State lives in a single
// process, so it can never work on Vercel; getStore() refuses to use it
// there.
type MemoryGame = { meta: GameMeta; subs: string[] };

class MemoryStore implements Store {
  private games: Map<string, MemoryGame>;

  constructor() {
    const g = globalThis as { __celebrityGames?: Map<string, MemoryGame> };
    g.__celebrityGames ??= new Map();
    this.games = g.__celebrityGames;
  }

  private prune() {
    const cutoff = Date.now() - GAME_TTL_SECONDS * 1000;
    for (const [code, game] of this.games) {
      if (game.meta.createdAt < cutoff) this.games.delete(code);
    }
  }

  async createGame(code: string, meta: GameMeta) {
    this.prune();
    this.games.set(code, { meta, subs: [] });
  }

  async getGame(code: string) {
    return this.games.get(code)?.meta ?? null;
  }

  async setGame(code: string, meta: GameMeta) {
    const game = this.games.get(code);
    if (game) game.meta = meta;
  }

  async addSubmission(code: string, name: string) {
    this.games.get(code)?.subs.push(name);
  }

  async getSubmissions(code: string) {
    return this.games.get(code)?.subs.slice() ?? [];
  }
}

export function getStore(): Store {
  // Set by Vercel's Upstash for Redis integration.
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return new RedisStore(new Redis({ url, token }));
  }
  if (process.env.VERCEL) {
    throw new Error(
      "KV_REST_API_URL / KV_REST_API_TOKEN are not set. Connect the Upstash " +
        "for Redis integration to this Vercel project and redeploy."
    );
  }
  return new MemoryStore();
}
