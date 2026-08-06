import "server-only";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL, SCHEMA_VERSION } from "@/lib/db/schema";

// Overridable so tests can point at a throwaway directory.
const DATA_DIR =
  process.env.AD_STUDIO_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ad-studio.db");

// Cached on globalThis so dev-server hot reloads reuse one connection.
const globalForDb = globalThis as unknown as {
  __adStudioDb?: Database.Database;
  __adStudioDbVersion?: number;
};

/** Columns added after the initial schema; patches DBs created before them. */
function migrate(db: Database.Database): void {
  const cols = (
    db.prepare(`select name from pragma_table_info('trends')`).all() as Array<{
      name: string;
    }>
  ).map((c) => c.name);
  if (!cols.includes("image_url")) {
    db.exec(`alter table trends add column image_url text`);
  }
  if (!cols.includes("topic")) {
    db.exec(`alter table trends add column topic text`);
  }
  if (!cols.includes("category")) {
    db.exec(`alter table trends add column category text not null default 'news'`);
    db.exec(`update trends set category = 'search' where source = 'google_trends'`);
  }

  const brandCols = (
    db
      .prepare(`select name from pragma_table_info('brand_profile')`)
      .all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (brandCols.length > 0 && !brandCols.includes("platforms")) {
    db.exec(
      `alter table brand_profile add column platforms text not null default 'instagram, facebook, tiktok'`,
    );
  }

  // Widen the posts.platform check constraint (added tiktok/facebook/youtube)
  // — SQLite can't alter a check, so rebuild the table once.
  const postsSql = (
    db
      .prepare(`select sql from sqlite_master where name = 'posts' and type = 'table'`)
      .get() as { sql: string } | undefined
  )?.sql;
  if (postsSql && !postsSql.includes("tiktok")) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      create table posts_new (
        id integer primary key autoincrement,
        idea_id integer references ideas (id) on delete set null,
        platform text not null check (platform in ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x')),
        caption text not null,
        hashtags text not null default '',
        status text not null default 'pending'
          check (status in ('pending', 'approved', 'rejected')),
        created_on text not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      );
      insert into posts_new select * from posts;
      drop table posts;
      alter table posts_new rename to posts;
      create index if not exists posts_created_on_idx on posts (created_on);
      create index if not exists posts_status_idx on posts (status);
    `);
    db.pragma("foreign_keys = ON");
  }

  const jobCols = (
    db
      .prepare(`select name from pragma_table_info('jobs')`)
      .all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (jobCols.length > 0 && !jobCols.includes("idea_id")) {
    db.exec(
      `alter table jobs add column idea_id integer references ideas (id) on delete set null`,
    );
  }

  const studioCols = (
    db
      .prepare(`select name from pragma_table_info('studio_images')`)
      .all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (studioCols.length > 0 && !studioCols.includes("model")) {
    db.exec(
      `alter table studio_images add column model text not null default ''`,
    );
  }

  const postCols = (
    db
      .prepare(`select name from pragma_table_info('posts')`)
      .all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (postCols.length > 0 && !postCols.includes("kind")) {
    db.exec(
      `alter table posts add column kind text not null default 'organic' check (kind in ('organic', 'ad'))`,
    );
  }
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  // A hot-reloaded schema change must reopen the cached dev connection,
  // since the schema and migrations only run on open.
  if (globalForDb.__adStudioDbVersion !== SCHEMA_VERSION) {
    globalForDb.__adStudioDb?.close();
    globalForDb.__adStudioDb = undefined;
  }
  globalForDb.__adStudioDb ??= open();
  globalForDb.__adStudioDbVersion = SCHEMA_VERSION;
  return globalForDb.__adStudioDb;
}

/** Local calendar date as YYYY-MM-DD — the "today" key for briefs. */
export function localDate(now = new Date()): string {
  return now.toLocaleDateString("en-CA");
}
