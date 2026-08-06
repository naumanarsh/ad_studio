import { getStudioImageWithData } from "@/lib/repositories/studio-images.repo";

/** Serves Image Studio results stored in SQLite. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await params;
  const id = Number(imageId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const image = getStudioImageWithData(id);
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      "content-type": image.mime,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
