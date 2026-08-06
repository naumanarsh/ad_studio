import "server-only";

import { getDb } from "@/lib/db/client";
import type { BrandProfile } from "@/lib/types/content";

export type BrandFields = Omit<BrandProfile, "id" | "updated_at">;

export function getBrandProfile(): BrandProfile | null {
  const row = getDb()
    .prepare(`select * from brand_profile where id = 1`)
    .get();
  return (row as BrandProfile | undefined) ?? null;
}

export function saveBrandProfile(fields: BrandFields): BrandProfile {
  return getDb()
    .prepare(
      `insert into brand_profile
         (id, company, website, description, audience, tone, colors, image_style, notes, platforms, updated_at)
       values (1, @company, @website, @description, @audience, @tone, @colors, @image_style, @notes, @platforms, datetime('now'))
       on conflict (id) do update set
         company = @company, website = @website, description = @description,
         audience = @audience, tone = @tone, colors = @colors,
         image_style = @image_style, notes = @notes, platforms = @platforms,
         updated_at = datetime('now')
       returning *`,
    )
    .get(fields) as BrandProfile;
}
