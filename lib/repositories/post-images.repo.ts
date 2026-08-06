import "server-only";

import { getDb } from "@/lib/db/client";
import type { PostImageMeta } from "@/lib/types/content";

export type NewPostImage = {
  post_id: number;
  variant: string;
  prompt: string;
  mime: string;
  data: Buffer;
};

const META_COLUMNS = "id, post_id, variant, selected, created_at";

export function insertImage(image: NewPostImage): PostImageMeta {
  return getDb()
    .prepare(
      `insert into post_images (post_id, variant, prompt, mime, data)
       values (@post_id, @variant, @prompt, @mime, @data)
       returning ${META_COLUMNS}`,
    )
    .get(image) as PostImageMeta;
}

/** Image metadata (no bytes) for a set of posts — what the UI renders. */
export function listImagesForPosts(postIds: number[]): PostImageMeta[] {
  if (postIds.length === 0) return [];
  const placeholders = postIds.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `select ${META_COLUMNS} from post_images
        where post_id in (${placeholders}) order by id asc`,
    )
    .all(...postIds) as PostImageMeta[];
}

export function getImageWithData(
  id: number,
): { mime: string; data: Buffer } | null {
  const row = getDb()
    .prepare(`select mime, data from post_images where id = ?`)
    .get(id);
  return (row as { mime: string; data: Buffer } | undefined) ?? null;
}

/** Mark one image as the post's chosen visual, unselecting its siblings. */
export function selectImage(id: number): PostImageMeta | null {
  const db = getDb();
  const run = db.transaction(() => {
    const image = db
      .prepare(`select post_id from post_images where id = ?`)
      .get(id) as { post_id: number } | undefined;
    if (!image) return null;
    db.prepare(`update post_images set selected = 0 where post_id = ?`).run(
      image.post_id,
    );
    return db
      .prepare(
        `update post_images set selected = 1 where id = ?
         returning ${META_COLUMNS}`,
      )
      .get(id) as PostImageMeta;
  });
  return run();
}

export function deleteImagesForPost(postId: number): number {
  return getDb()
    .prepare(`delete from post_images where post_id = ?`)
    .run(postId).changes;
}
