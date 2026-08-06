import "server-only";

import { getDb } from "@/lib/db/client";
import type { Trend, TrendCategory, TrendSource } from "@/lib/types/content";

export type NewTrend = {
  source: TrendSource;
  source_name: string;
  title: string;
  url: string | null;
  summary: string | null;
  image_url: string | null;
  topic: string | null;
  category: TrendCategory;
  published_at: string | null;
};

/**
 * Insert trends for a day, silently skipping duplicates: same-day ones via
 * the unique index, and stories already shown on a previous day within the
 * look-back window (feeds resurface articles for days).
 */
const DEDUPE_LOOKBACK_DAYS = 7;

export function insertTrends(trends: NewTrend[], fetchedOn: string): number {
  const db = getDb();
  const seenRecently = db.prepare(
    `select 1 from trends
      where fetched_on < @fetched_on
        and fetched_on >= date(@fetched_on, '-${DEDUPE_LOOKBACK_DAYS} day')
        and (title = @title or (url is not null and url = @url))
      limit 1`,
  );
  const insert = db.prepare(
    `insert or ignore into trends
       (source, source_name, title, url, summary, image_url, topic, category, published_at, fetched_on)
     values (@source, @source_name, @title, @url, @summary, @image_url, @topic, @category, @published_at, @fetched_on)`,
  );
  const run = db.transaction((rows: NewTrend[]) => {
    let inserted = 0;
    for (const row of rows) {
      const recent = seenRecently.get({
        fetched_on: fetchedOn,
        title: row.title,
        url: row.url,
      });
      if (recent) continue;
      inserted += insert.run({ ...row, fetched_on: fetchedOn }).changes;
    }
    return inserted;
  });
  return run(trends);
}

export function listTrendsForDay(fetchedOn: string): Trend[] {
  return getDb()
    .prepare(
      `select * from trends where fetched_on = ? order by id asc`,
    )
    .all(fetchedOn) as Trend[];
}

/** Clear a day's research so it can be re-collected with new sources. */
export function deleteTrendsForDay(fetchedOn: string): number {
  return getDb()
    .prepare(`delete from trends where fetched_on = ?`)
    .run(fetchedOn).changes;
}

export function getTrend(id: number): Trend | null {
  const row = getDb().prepare(`select * from trends where id = ?`).get(id);
  return (row as Trend | undefined) ?? null;
}
