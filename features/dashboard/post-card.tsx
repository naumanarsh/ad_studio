"use client";

import { Check, Download, ImagePlus, Palette, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { RetryImage } from "@/components/retry-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EditableCaption } from "@/features/posts/editable-caption";
import {
  generatePostImagesAction,
  selectPostImageAction,
} from "@/lib/actions/image.actions";
import { setPostStatusAction } from "@/lib/actions/post.actions";
import {
  POST_PLATFORM_LABELS,
  type Post,
  type PostImageMeta,
  type PostStatus,
} from "@/lib/types/content";

const DECIDED_STYLES: Record<
  Exclude<PostStatus, "pending">,
  { label: string; dot: string; text: string }
> = {
  approved: {
    label: "Approved",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
};

export function PostCard({
  post,
  images = [],
  selected = false,
  onToggleSelect,
}: {
  post: Post;
  images?: PostImageMeta[];
  /** Multi-select state, when rendered inside a bulk-review grid. */
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [imagesPending, startImagesTransition] = useTransition();

  function setStatus(status: PostStatus) {
    startTransition(async () => {
      const result = await setPostStatusAction({ postId: post.id, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "approved" ? "Post approved" : "Post rejected");
      router.refresh();
    });
  }

  function generateImages(mode: "single" | "variants") {
    startImagesTransition(async () => {
      const result = await generatePostImagesAction({ postId: post.id, mode });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.generated.length === 1
          ? "On-brand image ready"
          : `${result.data.generated.length} variants ready — click one to pick it`,
      );
      for (const failure of result.data.failed) {
        toast.warning(failure);
      }
      router.refresh();
    });
  }

  function selectImage(image: PostImageMeta) {
    if (image.selected) return;
    startImagesTransition(async () => {
      const result = await selectPostImageAction({ imageId: image.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  const isVideo = post.platform === "tiktok" || post.platform === "youtube";
  const downloadImage = images.find((i) => i.selected) ?? images.at(-1) ?? null;

  return (
    <Card
      className={`relative flex flex-col ${selected ? "ring-2 ring-primary" : ""}`}
    >
      {onToggleSelect && (
        <button
          type="button"
          aria-label={selected ? "Deselect post" : "Select post"}
          onClick={onToggleSelect}
          className={`absolute right-3 top-3 z-10 flex size-5 items-center justify-center border transition-colors ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background text-transparent hover:border-primary"
          }`}
        >
          <Check className="size-3.5" />
        </button>
      )}
      <CardContent className="flex-1">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-flame">
          {POST_PLATFORM_LABELS[post.platform]} ·{" "}
          {post.kind === "ad"
            ? isVideo
              ? "video ad"
              : "paid ad"
            : isVideo
              ? "video script"
              : "organic post"}
        </p>
        <EditableCaption post={post} />
        {images.length > 0 && (
          <div
            className={`mt-4 grid gap-2 ${
              images.length === 1 ? "max-w-56 grid-cols-1" : "grid-cols-4"
            }`}
          >
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => selectImage(image)}
                disabled={imagesPending}
                title={
                  image.selected
                    ? `${image.variant} (selected)`
                    : `Use the ${image.variant.toLowerCase()} variant`
                }
                className={`group relative aspect-square overflow-hidden border transition-shadow ${
                  image.selected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                    : "hover:ring-1 hover:ring-primary/50"
                }`}
              >
                <RetryImage
                  src={`/api/images/${image.id}`}
                  alt={image.variant}
                  className="size-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                  {image.variant}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {post.status === "pending" ? (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => setStatus("approved")}
            >
              <Check className="size-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setStatus("rejected")}
            >
              <X className="size-4" /> Reject
            </Button>
          </>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${DECIDED_STYLES[post.status].text}`}
          >
            <span
              className={`size-1.5 rounded-full ${DECIDED_STYLES[post.status].dot}`}
            />
            {DECIDED_STYLES[post.status].label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {downloadImage && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              asChild
              title="Download the selected image"
            >
              <a
                href={`/api/images/${downloadImage.id}`}
                download={`zappy-post-${post.id}`}
              >
                <Download className="size-4" /> Download
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={imagesPending}
            onClick={() => generateImages("single")}
          >
            {imagesPending ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <ImagePlus className="size-4" />
                {images.length > 0 ? "New image" : "Generate image"}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            asChild
            title="Open in Image Studio — custom prompt, upload a reference, edit iteratively"
          >
            <Link href={`/studio?postId=${post.id}`}>
              <Palette className="size-4" /> Studio
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
