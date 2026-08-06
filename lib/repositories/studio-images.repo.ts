import "server-only";

import { getDb } from "@/lib/db/client";

export type StudioImageMeta = {
  id: number;
  post_id: number | null;
  prompt: string;
  mime: string;
  model: string;
  created_at: string;
};

const META_COLUMNS = "id, post_id, prompt, mime, model, created_at";

export function insertStudioImage(image: {
  post_id: number | null;
  prompt: string;
  mime: string;
  model: string;
  data: Buffer;
}): StudioImageMeta {
  return getDb()
    .prepare(
      `insert into studio_images (post_id, prompt, mime, model, data)
       values (@post_id, @prompt, @mime, @model, @data)
       returning ${META_COLUMNS}`,
    )
    .get(image) as StudioImageMeta;
}

export function getStudioImageWithData(
  id: number,
): { mime: string; data: Buffer; post_id: number | null } | null {
  const row = getDb()
    .prepare(`select mime, data, post_id from studio_images where id = ?`)
    .get(id);
  return (
    (row as { mime: string; data: Buffer; post_id: number | null } | undefined) ??
    null
  );
}

/**
 * Recent results for one context (a post's studio session, or the
 * standalone creator when postId is null) — oldest first for the strip.
 */
export function listStudioImagesForContext(
  postId: number | null,
  limit = 6,
): StudioImageMeta[] {
  const db = getDb();
  const rows =
    postId === null
      ? db
          .prepare(
            `select ${META_COLUMNS} from studio_images
              where post_id is null order by id desc limit ?`,
          )
          .all(limit)
      : db
          .prepare(
            `select ${META_COLUMNS} from studio_images
              where post_id = ? order by id desc limit ?`,
          )
          .all(postId, limit);
  return (rows as StudioImageMeta[]).reverse();
}
