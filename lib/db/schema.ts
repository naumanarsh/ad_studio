/**
 * SQLite schema (local, single-workspace phase). The table shapes mirror the
 * eventual Postgres schema in docs/02-database.md so the later swap to
 * Supabase stays mechanical: repositories change, callers do not.
 */
/**
 * Bump when SCHEMA_SQL or migrate() changes so a dev server's cached
 * connection (which only runs the schema on open) gets reopened.
 */
export const SCHEMA_VERSION = 10;

export const SCHEMA_SQL = `
create table if not exists trends (
  id integer primary key autoincrement,
  source text not null check (source in ('google_trends', 'rss', 'sample')),
  source_name text not null,
  title text not null,
  url text,
  summary text,
  image_url text,
  topic text,
  category text not null default 'news'
    check (category in ('news', 'social', 'search')),
  published_at text,
  fetched_on text not null,
  created_at text not null default (datetime('now'))
);

create unique index if not exists trends_dedupe_idx
  on trends (source_name, title, fetched_on);
create index if not exists trends_fetched_on_idx on trends (fetched_on);

create table if not exists research_topics (
  id integer primary key autoincrement,
  tag text not null unique collate nocase,
  created_at text not null default (datetime('now'))
);

create table if not exists ideas (
  id integer primary key autoincrement,
  trend_id integer references trends (id) on delete set null,
  title text not null,
  angle text not null,
  status text not null default 'new'
    check (status in ('new', 'used', 'dismissed')),
  created_on text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists ideas_created_on_idx on ideas (created_on);

create table if not exists posts (
  id integer primary key autoincrement,
  idea_id integer references ideas (id) on delete set null,
  platform text not null check (platform in ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x')),
  kind text not null default 'organic' check (kind in ('organic', 'ad')),
  caption text not null,
  hashtags text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_on text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists posts_created_on_idx on posts (created_on);
create index if not exists posts_status_idx on posts (status);

create table if not exists post_images (
  id integer primary key autoincrement,
  post_id integer not null references posts (id) on delete cascade,
  variant text not null,
  prompt text not null,
  mime text not null,
  data blob not null,
  selected integer not null default 0,
  created_at text not null default (datetime('now'))
);

create index if not exists post_images_post_idx on post_images (post_id);

create table if not exists brand_profile (
  id integer primary key check (id = 1),
  company text not null default '',
  website text not null default '',
  description text not null default '',
  audience text not null default '',
  tone text not null default '',
  colors text not null default '',
  image_style text not null default '',
  notes text not null default '',
  platforms text not null default 'instagram, facebook, tiktok',
  updated_at text not null default (datetime('now'))
);

create table if not exists competitors (
  id integer primary key autoincrement,
  name text not null,
  website text not null,
  analysis text not null default '',
  topics_json text not null default '[]',
  analyzed_at text,
  created_at text not null default (datetime('now'))
);

create table if not exists studio_images (
  id integer primary key autoincrement,
  post_id integer references posts (id) on delete set null,
  prompt text not null,
  mime text not null,
  data blob not null,
  created_at text not null default (datetime('now'))
);

create table if not exists jobs (
  id integer primary key autoincrement,
  type text not null default 'post_from_trend',
  label text not null default '',
  trend_id integer references trends (id) on delete set null,
  idea_id integer references ideas (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  post_id integer references posts (id) on delete set null,
  error text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists jobs_status_idx on jobs (status);

create table if not exists ai_request_logs (
  id integer primary key autoincrement,
  provider text not null,
  model text not null,
  purpose text not null,
  prompt text not null,
  response text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  cost_usd real not null default 0,
  error text,
  created_at text not null default (datetime('now'))
);
`;
