import { getBrandAssetWithData } from "@/lib/repositories/brand-assets.repo";

/** Serves brand-kit asset bytes stored in SQLite. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const id = Number(assetId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const asset = getBrandAssetWithData(id);
  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "content-type": asset.mime,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
