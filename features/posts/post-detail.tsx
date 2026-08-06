"use client";

import { ArrowLeft, Check, Copy, Download, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ZoomableImage } from "@/components/zoomable-image";
import { EditableCaption } from "@/features/posts/editable-caption";
import { setPostStatusAction } from "@/lib/actions/post.actions";
import {
  POST_PLATFORM_LABELS,
  type Post,
  type PostImageMeta,
  type PostStatus,
} from "@/lib/types/content";

/** Full-size view for publishing: copy the caption, download the image. */
export function PostDetail({
  post,
  images,
}: {
  post: Post;
  images: PostImageMeta[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const image = images.find((i) => i.selected) ?? images.at(-1) ?? null;

  function copyCaption() {
    const text = post.hashtags
      ? `${post.caption}\n\n${post.hashtags}`
      : post.caption;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Caption copied — paste it into your platform."),
      () => toast.error("Couldn't copy — select and copy manually."),
    );
  }

  function setStatus(status: PostStatus) {
    startTransition(async () => {
      const result = await setPostStatusAction({ postId: post.id, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "approved" ? "Approved" : "Rejected");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-flame">
          {POST_PLATFORM_LABELS[post.platform]} ·{" "}
          {post.kind === "ad" ? "paid ad" : "organic post"} · {post.status}
        </p>
        <Link
          href="/research"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3" /> Back to Research
        </Link>
      </div>

      {image && (
        <div className="flex flex-col gap-2">
          <ZoomableImage
            src={`/api/images/${image.id}`}
            alt="Post visual"
            className="w-full border"
          />
          <Button size="sm" variant="outline" className="self-start" asChild>
            <a href={`/api/images/${image.id}`} download={`zappy-post-${post.id}`}>
              <Download className="size-4" /> Download image
            </a>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 border bg-card p-4">
        <EditableCaption post={post} />
        <Button size="sm" className="mt-2 self-start" onClick={copyCaption}>
          <Copy className="size-4" /> Copy caption
        </Button>
      </div>

      {post.status === "pending" && (
        <div className="flex items-center gap-2">
          <Button disabled={pending} onClick={() => setStatus("approved")}>
            <Check className="size-4" /> Approve
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setStatus("rejected")}
          >
            <X className="size-4" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}
