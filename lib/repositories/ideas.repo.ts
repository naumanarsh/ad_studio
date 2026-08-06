import "server-only";

import { getDb } from "@/lib/db/client";
import type { Idea } from "@/lib/types/content";

export type NewIdea = {
  trend_id: number | null;
  title: string;
  angle: string;
};

export function insertIdeas(ideas: NewIdea[], createdOn: string): Idea[] {
  const db = getDb();
  const insert = db.prepare(
    `insert into ideas (trend_id, title, angle, created_on)
     values (@trend_id, @title, @angle, @created_on)
     returning *`,
  );
  const run = db.transaction((rows: NewIdea[]) =>
    rows.map((row) => insert.get({ ...row, created_on: createdOn }) as Idea),
  );
  return run(ideas);
}

export function getIdea(id: number): Idea | null {
  const row = getDb().prepare(`select * from ideas where id = ?`).get(id);
  return (row as Idea | undefined) ?? null;
}

export function listIdeasForDay(createdOn: string): Idea[] {
  return getDb()
    .prepare(`select * from ideas where created_on = ? order by id asc`)
    .all(createdOn) as Idea[];
}

/** Clear a day's ideas so the brief can regenerate them. */
export function deleteIdeasForDay(createdOn: string): number {
  return getDb()
    .prepare(`delete from ideas where created_on = ?`)
    .run(createdOn).changes;
}

export function markIdeaUsed(id: number): void {
  getDb().prepare(`update ideas set status = 'used' where id = ?`).run(id);
}
