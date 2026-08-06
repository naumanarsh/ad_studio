"use client";

import { Check, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  suggestHooksAction,
  updatePostContentAction,
} from "@/lib/actions/post.actions";
import type { HookOption } from "@/lib/services/hooks.service";
import type { Post } from "@/lib/types/content";

/** Swap a caption's first non-empty line for the chosen hook. */
function withHook(caption: string, hook: string): string {
  const lines = caption.split("\n");
  const i = lines.findIndex((l) => l.trim().length > 0);
  if (i === -1) return hook;
  lines[i] = hook;
  return lines.join("\n");
}

/**
 * A post's caption + hashtags with in-place editing — the most common
 * marketer action is fixing a word, not regenerating the whole post.
 */
export function EditableCaption({ post }: { post: Post }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [pending, startTransition] = useTransition();
  const [hooks, setHooks] = useState<HookOption[] | null>(null);
  const [hooksLoading, startHooks] = useTransition();

  function fetchHooks() {
    startHooks(async () => {
      const result = await suggestHooksAction({ postId: post.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setHooks(result.data.hooks);
    });
  }

  function applyHook(hook: HookOption) {
    startTransition(async () => {
      const result = await updatePostContentAction({
        postId: post.id,
        caption: withHook(post.caption, hook.text),
        hashtags: post.hashtags,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setHooks(null);
      toast.success("Hook applied.");
      router.refresh();
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updatePostContentAction({
        postId: post.id,
        caption,
        hashtags,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      toast.success("Caption updated.");
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="group/caption relative">
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {post.caption}
        </p>
        {post.hashtags && (
          <p className="mt-3 text-xs text-muted-foreground">{post.hashtags}</p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCaption(post.caption);
              setHashtags(post.hashtags);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-70 hover:underline hover:opacity-100"
          >
            <Pencil className="size-3" /> Edit caption
          </button>
          <button
            type="button"
            onClick={fetchHooks}
            disabled={hooksLoading}
            title="Three alternative first lines, in your approved posts' voice"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-70 hover:underline hover:opacity-100 disabled:opacity-40"
          >
            {hooksLoading ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            Hook ideas
          </button>
        </div>

        {hooks && (
          <div className="mt-2 flex flex-col gap-1.5 border bg-secondary/40 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pick a new first line
              </p>
              <button
                type="button"
                aria-label="Dismiss hook ideas"
                onClick={() => setHooks(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {hooks.map((hook) => (
              <button
                key={hook.text}
                type="button"
                disabled={pending}
                onClick={() => applyHook(hook)}
                className="border bg-background px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
              >
                {hook.text}
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {hook.why}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={Math.min(12, Math.max(4, caption.split("\n").length + 1))}
        disabled={pending}
        className="w-full resize-y border bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <input
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        disabled={pending}
        placeholder="#hashtags"
        className="w-full border bg-transparent px-2 py-1.5 text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          <Check className="size-4" /> Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          <X className="size-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}
