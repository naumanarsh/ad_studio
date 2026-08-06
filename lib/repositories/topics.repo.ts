import "server-only";

import { getDb } from "@/lib/db/client";
import type { ResearchTopic } from "@/lib/types/content";

export function listTopics(): ResearchTopic[] {
  return getDb()
    .prepare(`select * from research_topics order by tag collate nocase asc`)
    .all() as ResearchTopic[];
}

/** Add a topic tag; returns the existing row if the tag is already tracked. */
export function addTopic(tag: string): ResearchTopic {
  const db = getDb();
  db.prepare(`insert or ignore into research_topics (tag) values (?)`).run(tag);
  return db
    .prepare(`select * from research_topics where tag = ? collate nocase`)
    .get(tag) as ResearchTopic;
}

export function removeTopic(id: number): boolean {
  return getDb().prepare(`delete from research_topics where id = ?`).run(id)
    .changes > 0;
}
