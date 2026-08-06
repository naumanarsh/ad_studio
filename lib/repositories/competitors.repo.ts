import "server-only";

import { getDb } from "@/lib/db/client";
import type { Competitor } from "@/lib/types/content";

export function listCompetitors(): Competitor[] {
  return getDb()
    .prepare(`select * from competitors order by name collate nocase asc`)
    .all() as Competitor[];
}

export function getCompetitor(id: number): Competitor | null {
  const row = getDb().prepare(`select * from competitors where id = ?`).get(id);
  return (row as Competitor | undefined) ?? null;
}

export function addCompetitor(name: string, website: string): Competitor {
  return getDb()
    .prepare(
      `insert into competitors (name, website) values (?, ?) returning *`,
    )
    .get(name, website) as Competitor;
}

export function removeCompetitor(id: number): boolean {
  return getDb().prepare(`delete from competitors where id = ?`).run(id)
    .changes > 0;
}

export function saveAnalysis(
  id: number,
  analysis: string,
  topicsJson: string,
): Competitor | null {
  const row = getDb()
    .prepare(
      `update competitors
         set analysis = ?, topics_json = ?, analyzed_at = datetime('now')
       where id = ? returning *`,
    )
    .get(analysis, topicsJson, id);
  return (row as Competitor | undefined) ?? null;
}
