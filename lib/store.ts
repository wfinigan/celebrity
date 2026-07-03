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

// There is exactly one game at a time.
export interface Store {
  // Replaces any existing game and clears its submissions.
  resetGame(meta: GameMeta): Promise<void>;
  getGame(): Promise<GameMeta | null>;
  setGame(meta: GameMeta): Promise<void>;
  addSubmission(name: string): Promise<void>;
  getSubmissions(): Promise<string[]>;
}

const GAME_TTL_SECONDS = 6 * 60 * 60; // the game expires after 6 hours

const META_KEY = "game:current";
const SUBS_KEY = "game:current:subs";

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async resetGame(meta: GameMeta) {
    await this.redis.del(SUBS_KEY);
    await this.redis.set(META_KEY, meta, { ex: GAME_TTL_SECONDS });
  }

  async getGame() {
    return await this.redis.get<GameMeta>(META_KEY);
  }

  async setGame(meta: GameMeta) {
    await this.redis.set(META_KEY, meta, { ex: GAME_TTL_SECONDS });
  }

  async addSubmission(name: string) {
    await this.redis.rpush(SUBS_KEY, name);
    await this.redis.expire(SUBS_KEY, GAME_TTL_SECONDS);
  }

  async getSubmissions() {
    return await this.redis.lrange(SUBS_KEY, 0, -1);
  }
}

// In-memory store for local development only. State lives in a single
// process, so it can never work on Vercel; getStore() refuses to use it
// there.
type MemoryGame = { meta: GameMeta; subs: string[] };

class MemoryStore implements Store {
  private box: { game: MemoryGame | null };

  constructor() {
    const g = globalThis as { __celebrityGame?: { game: MemoryGame | null } };
    g.__celebrityGame ??= { game: null };
    this.box = g.__celebrityGame;
  }

  private live(): MemoryGame | null {
    const game = this.box.game;
    if (!game) return null;
    if (game.meta.createdAt < Date.now() - GAME_TTL_SECONDS * 1000) {
      this.box.game = null;
      return null;
    }
    return game;
  }

  async resetGame(meta: GameMeta) {
    this.box.game = { meta, subs: [] };
  }

  async getGame() {
    return this.live()?.meta ?? null;
  }

  async setGame(meta: GameMeta) {
    const game = this.live();
    if (game) game.meta = meta;
  }

  async addSubmission(name: string) {
    this.live()?.subs.push(name);
  }

  async getSubmissions() {
    return this.live()?.subs.slice() ?? [];
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
