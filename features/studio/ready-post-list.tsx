"use client";

import { ChevronDown, Copy, Download, Palette } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { RetryImage } from "@/components/retry-image";
import { Button } from "@/components/ui/button";
import {
  POST_PLATFORM_LABELS,
  type Post,
  type PostImageMeta,
} from "@/lib/types/content";

/**
 * Compact click-to-expand list of finished queue posts. A row opens into
 * the publish essentials — image + download, caption + copy — and links
 * to the Image tab for regeneration.
 */
export function ReadyPostList({
  posts,
  imagesByPost,
}: {
  posts: Post[];
  imagesByPost: Record<number, PostImageMeta[]>;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (posts.length === 0) {
    return (
      <p className="border px-4 py-6 text-sm text-muted-foreground">
        Nothing ready yet — posts you queue land here once they&apos;re
        created.
      </p>
    );
  }

  function copyContent(post: Post) {
    const text = post.hashtags
      ? `${post.caption}\n\n${post.hashtags}`
      : post.caption;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Caption copied — paste it into your platform."),
      () => toast.error("Couldn't copy — select and copy manually."),
    );
  }

  return (
    <ul className="divide-y border">
      {posts.map((post) => {
        const images = imagesByPost[post.id] ?? [];
        const image = images.find((i) => i.selected) ?? images.at(-1) ?? null;
        const open = openId === post.id;
        const isVideo = post.platform === "tiktok" || post.platform === "youtube";
        return (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : post.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50"
            >
              {image ? (
                <RetryImage
                  src={`/api/images/${image.id}`}
                  alt=""
                  className="size-12 shrink-0 border object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-flame">
                  {POST_PLATFORM_LABELS[post.platform]} ·{" "}
                  {isVideo ? "video script" : "organic post"}
                </p>
                <p className="truncate text-sm font-medium">{post.caption}</p>
              </div>
              <ChevronDown
                className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>

            {open && (
              <div className="flex flex-col gap-4 border-t bg-card px-4 py-4">
                {image && (
                  <div className="flex flex-col gap-2">
                    <RetryImage
                      src={`/api/images/${image.id}`}
                      alt="Post visual"
                      className="w-full max-w-sm border"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start"
                      asChild
                    >
                      <a
                        href={`/api/images/${image.id}`}
                        download={`zappy-post-${post.id}`}
                      >
                        <Download className="size-4" /> Download image
                      </a>
                    </Button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {post.caption}
                  </p>
                  {post.hashtags && (
                    <p className="text-xs text-muted-foreground">
                      {post.hashtags}
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="self-start"
                    onClick={() => copyContent(post)}
                  >
                    <Copy className="size-4" /> Copy caption
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start text-muted-foreground"
                  asChild
                  title="Rework the image in the Image tab — the prompt and content come along"
                >
                  <Link href={`/studio?postId=${post.id}`}>
                    <Palette className="size-4" /> Regenerate in Image tab
                  </Link>
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
