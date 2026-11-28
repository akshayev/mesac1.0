// Test helpers: a Cloudflare D1-compatible wrapper around Node's built-in node:sqlite, and an in-memory R2
// bucket. Both implement only what src/server/* uses. No dependencies.

import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// The admin server's compile-time flag (vite.config.ts defines it; production builds set it to false).
globalThis.__MESAC_DEV_ADMIN__ ??= false;

const MIGRATIONS = fileURLToPath(new URL("../../migrations/", import.meta.url));

class Statement {
  constructor(db, sql, values = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) {
    return new Statement(this.db, this.sql, values);
  }
  #stmt() {
    return this.db.sqlite.prepare(this.sql);
  }
  async first() {
    this.db.log.push(this.sql);
    return this.#stmt().get(...this.values) ?? null;
  }
  async all() {
    this.db.log.push(this.sql);
    return { results: this.#stmt().all(...this.values), success: true, meta: {} };
  }
  async run() {
    this.db.log.push(this.sql);
    const r = this.#stmt().run(...this.values);
    return {
      results: [],
      success: true,
      meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  }
}

export class D1Shim {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.log = [];
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.sqlite.exec("COMMIT");
      return out;
    } catch (err) {
      this.sqlite.exec("ROLLBACK");
      throw err;
    }
  }
  exec(sql) {
    this.sqlite.exec(sql);
  }
}

export function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(MIGRATIONS + f, "utf8") }));
}

/** A fresh in-memory database with every migration applied. */
export function migratedDb() {
  const db = new D1Shim();
  for (const m of migrationFiles()) db.exec(m.sql);
  return db;
}

export class R2Shim {
  constructor() {
    this.objects = new Map();
  }
  async put(key, value, options = {}) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    this.objects.set(key, {
      bytes: new Uint8Array(bytes),
      contentType: options.httpMetadata?.contentType,
      uploaded: options.uploaded ?? new Date(),
    });
  }
  async get(key) {
    const o = this.objects.get(key);
    if (!o) return null;
    return {
      body: new Response(o.bytes).body,
      httpMetadata: { contentType: o.contentType },
      arrayBuffer: async () => o.bytes.buffer.slice(0),
    };
  }
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
  /** Like R2: keys in order, `limit` per page, an opaque cursor. */
  async list({ cursor, limit = 1000 } = {}) {
    const keys = [...this.objects.keys()].sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + limit);
    const truncated = start + limit < keys.length;
    return {
      objects: page.map((key) => ({
        key,
        uploaded: this.objects.get(key).uploaded,
        size: this.objects.get(key).bytes.length,
      })),
      truncated,
      cursor: truncated ? String(start + limit) : undefined,
    };
  }
}
