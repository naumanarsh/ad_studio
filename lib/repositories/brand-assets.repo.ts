import "server-only";

import { getDb } from "@/lib/db/client";

export type BrandAssetKind = "logo" | "product";

export type BrandAssetMeta = {
  id: number;
  kind: BrandAssetKind;
  name: string;
  mime: string;
  created_at: string;
};

const META_COLUMNS = "id, kind, name, mime, created_at";

export function insertBrandAsset(asset: {
  kind: BrandAssetKind;
  name: string;
  mime: string;
  data: Buffer;
}): BrandAssetMeta {
  return getDb()
    .prepare(
      `insert into brand_assets (kind, name, mime, data)
       values (@kind, @name, @mime, @data)
       returning ${META_COLUMNS}`,
    )
    .get(asset) as BrandAssetMeta;
}

export function listBrandAssets(): BrandAssetMeta[] {
  return getDb()
    .prepare(`select ${META_COLUMNS} from brand_assets order by id asc`)
    .all() as BrandAssetMeta[];
}

/** The kit attached to generations: the logo plus newest product shots. */
export function listBrandKit(maxProducts = 3): Array<
  BrandAssetMeta & { data: Buffer }
> {
  const logo = getDb()
    .prepare(
      `select ${META_COLUMNS}, data from brand_assets
        where kind = 'logo' order by id desc limit 1`,
    )
    .all();
  const products = getDb()
    .prepare(
      `select ${META_COLUMNS}, data from brand_assets
        where kind = 'product' order by id desc limit ?`,
    )
    .all(maxProducts);
  return [...logo, ...products] as Array<BrandAssetMeta & { data: Buffer }>;
}

export function getBrandAssetWithData(
  id: number,
): { mime: string; data: Buffer } | null {
  const row = getDb()
    .prepare(`select mime, data from brand_assets where id = ?`)
    .get(id);
  return (row as { mime: string; data: Buffer } | undefined) ?? null;
}

export function deleteBrandAsset(id: number): boolean {
  return getDb().prepare(`delete from brand_assets where id = ?`).run(id)
    .changes > 0;
}
