"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/features/dashboard/post-card";
import { bulkSetPostStatusAction } from "@/lib/actions/post.actions";
import type { Post, PostImageMeta } from "@/lib/types/content";

/**
 * PostCard grid with multi-select bulk review — a 16-draft morning brief
 * shouldn't take 16 clicks to clear.
 */
export function PostGrid({
  posts,
  imagesByPost,
}: {
  posts: Post[];
  imagesByPost: Record<number, PostImageMeta[]>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const selectable = posts.filter((p) => p.status === "pending");

  function toggle(postId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function bulk(status: "approved" | "rejected") {
    const postIds = [...selected];
    startTransition(async () => {
      const result = await bulkSetPostStatusAction({ postIds, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.data.updated} post${result.data.updated === 1 ? "" : "s"} ${status}.`,
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selectable.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="hover:underline"
            onClick={() =>
              setSelected((prev) =>
                prev.size === selectable.length
                  ? new Set()
                  : new Set(selectable.map((p) => p.id)),
              )
            }
          >
            {selected.size === selectable.length
              ? "Clear selection"
              : `Select all ${selectable.length} pending`}
          </button>
          {selected.size > 0 && <span>· {selected.size} selected</span>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            images={imagesByPost[post.id] ?? []}
            selected={selected.has(post.id)}
            onToggleSelect={
              post.status === "pending" ? () => toggle(post.id) : undefined
            }
          />
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex items-center gap-2 border bg-background px-4 py-2 shadow-lg">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <Button size="sm" disabled={pending} onClick={() => bulk("approved")}>
            <Check className="size-4" /> Approve all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => bulk("rejected")}
          >
            <X className="size-4" /> Reject all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
