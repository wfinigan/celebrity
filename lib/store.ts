import { Redis } from "@upstash/redis";

export type GameMeta = {
  hostToken: string;
  revealed: boolean;
  // Shuffled reading order, fixed at reveal time so re-reads match.
  order: string[];
  // How many names have been dealt to the reader, across all passes.
  // The reader may go through the list at most MAX_PASSES times.
  served: number;
  // Set when the reader confirms past the last name; after this, no name
  // ever comes back — not even the one on screen.
  locked: boolean;
  createdAt: number;
};

export const MAX_PASSES = 2;

export interface Store {
  createGame(code: string, meta: GameMeta): Promise<void>;
  getGame(code: string): Promise<GameMeta | null>;
  setGame(code: string, meta: GameMeta): Promise<void>;
  // Who's playing: playerId → the player's own (display) name.
  setPlayer(code: string, playerId: string, name: string): Promise<void>;
  getPlayers(code: string): Promise<Record<string, string>>;
  // One submission per player: submitting again replaces that player's name.
  setSubmission(code: string, playerId: string, name: string): Promise<void>;
  // playerId → submitted celebrity name.
  getSubmissions(code: string): Promise<Record<string, string>>;
}

const GAME_TTL_SECONDS = 6 * 60 * 60; // games expire after 6 hours

function metaKey(code: string) {
  return `game:${code}`;
}
function subsKey(code: string) {
  return `game:${code}:subs`;
}
function playersKey(code: string) {
  return `game:${code}:players`;
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

  async setPlayer(code: string, playerId: string, name: string) {
    await this.redis.hset(playersKey(code), { [playerId]: name });
    await this.redis.expire(playersKey(code), GAME_TTL_SECONDS);
  }

  async getPlayers(code: string) {
    return ((await this.redis.hgetall(playersKey(code))) ??
      {}) as Record<string, string>;
  }

  async setSubmission(code: string, playerId: string, name: string) {
    await this.redis.hset(subsKey(code), { [playerId]: name });
    await this.redis.expire(subsKey(code), GAME_TTL_SECONDS);
  }

  async getSubmissions(code: string) {
    return ((await this.redis.hgetall(subsKey(code))) ?? {}) as Record<
      string,
      string
    >;
  }
}

// In-memory store for local development only. State lives in a single
// process, so it can never work on Vercel; getStore() refuses to use it
// there.
type MemoryGame = {
  meta: GameMeta;
  players: Map<string, string>;
  subs: Map<string, string>;
};

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
    this.games.set(code, { meta, players: new Map(), subs: new Map() });
  }

  async getGame(code: string) {
    return this.games.get(code)?.meta ?? null;
  }

  async setGame(code: string, meta: GameMeta) {
    const game = this.games.get(code);
    if (game) game.meta = meta;
  }

  async setPlayer(code: string, playerId: string, name: string) {
    this.games.get(code)?.players.set(playerId, name);
  }

  async getPlayers(code: string) {
    return Object.fromEntries(this.games.get(code)?.players ?? []);
  }

  async setSubmission(code: string, playerId: string, name: string) {
    this.games.get(code)?.subs.set(playerId, name);
  }

  async getSubmissions(code: string) {
    return Object.fromEntries(this.games.get(code)?.subs ?? []);
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
