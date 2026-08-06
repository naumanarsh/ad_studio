import "server-only";

import { getDb } from "@/lib/db/client";
import type {
  Post,
  PostKind,
  PostPlatform,
  PostStatus,
} from "@/lib/types/content";

export type NewPost = {
  idea_id: number | null;
  platform: PostPlatform;
  kind?: PostKind;
  caption: string;
  hashtags: string;
};

export function insertPosts(posts: NewPost[], createdOn: string): Post[] {
  const db = getDb();
  const insert = db.prepare(
    `insert into posts (idea_id, platform, kind, caption, hashtags, created_on)
     values (@idea_id, @platform, @kind, @caption, @hashtags, @created_on)
     returning *`,
  );
  const run = db.transaction((rows: NewPost[]) =>
    rows.map(
      (row) =>
        insert.get({
          kind: "organic",
          ...row,
          created_on: createdOn,
        }) as Post,
    ),
  );
  return run(posts);
}

/** Recent paid-ad drafts, newest first — the Ads tab list. */
export function listAds(limit = 30): Post[] {
  return getDb()
    .prepare(`select * from posts where kind = 'ad' order by id desc limit ?`)
    .all(limit) as Post[];
}

/** Posts created from the given ideas, newest first. */
export function listPostsForIdeas(ideaIds: number[]): Post[] {
  if (ideaIds.length === 0) return [];
  const placeholders = ideaIds.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `select * from posts where idea_id in (${placeholders}) order by id desc`,
    )
    .all(...ideaIds) as Post[];
}

/** Fetch a set of posts by id, newest first. */
export function listPostsByIds(ids: number[]): Post[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `select * from posts where id in (${placeholders}) order by id desc`,
    )
    .all(...ids) as Post[];
}

export function getPost(id: number): Post | null {
  const row = getDb().prepare(`select * from posts where id = ?`).get(id);
  return (row as Post | undefined) ?? null;
}

export function listPostsForDay(createdOn: string): Post[] {
  return getDb()
    .prepare(`select * from posts where created_on = ? order by id asc`)
    .all(createdOn) as Post[];
}

/** Clear a day's drafts so the brief can regenerate them. */
export function deletePostsForDay(createdOn: string): number {
  return getDb()
    .prepare(`delete from posts where created_on = ?`)
    .run(createdOn).changes;
}

export function setPostStatus(id: number, status: PostStatus): Post | null {
  const row = getDb()
    .prepare(
      `update posts
       set status = ?, updated_at = datetime('now')
       where id = ?
       returning *`,
    )
    .get(status, id);
  return (row as Post | undefined) ?? null;
}
