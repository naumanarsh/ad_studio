import { ExternalLink, Lightbulb, RefreshCw, Wand2 } from "lucide-react";
import Link from "next/link";
import { RetryImage } from "@/components/retry-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QueuePostButton } from "@/features/research/queue-post-button";
import type { Idea } from "@/lib/types/content";

/** The finished post an idea produced — shown back on the idea's card. */
export type IdeaCreation = { postId: number; imageId: number | null };

export function IdeaList({
  ideas,
  createdByIdea = {},
  pendingIdeaIds = [],
  action = "queue",
}: {
  ideas: Idea[];
  createdByIdea?: Record<number, IdeaCreation>;
  pendingIdeaIds?: number[];
  /** "queue" offers one-click creation; "creator" links to the Creator only. */
  action?: "queue" | "creator";
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => {
        const created = createdByIdea[idea.id];
        const pending = pendingIdeaIds.includes(idea.id);
        return (
          <Card key={idea.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {idea.status === "used" && (
                  <Badge variant="outline">drafted</Badge>
                )}
              </div>
              <p className="text-sm font-medium leading-snug">{idea.title}</p>
              <p className="text-xs text-muted-foreground">{idea.angle}</p>

              {created ? (
                <Link
                  href={`/post/${created.postId}`}
                  className="mt-auto inline-flex items-center gap-2 self-start pt-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {created.imageId !== null && (
                    <RetryImage
                      src={`/api/images/${created.imageId}`}
                      alt=""
                      className="size-8 shrink-0 border object-cover"
                    />
                  )}
                  Open the created post <ExternalLink className="size-3" />
                </Link>
              ) : pending ? (
                <span className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-xs font-medium text-flame">
                  <RefreshCw className="size-3 animate-spin" /> Creating…
                </span>
              ) : action === "creator" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-auto self-start"
                  asChild
                >
                  <Link href={`/studio?ideaId=${idea.id}`}>
                    <Wand2 className="size-4" /> Creator
                  </Link>
                </Button>
              ) : (
                <div className="mt-auto flex items-center gap-3">
                  <QueuePostButton ideaId={idea.id} />
                  <Link
                    href={`/studio?ideaId=${idea.id}`}
                    className="inline-flex items-center gap-1 pt-1 text-xs text-muted-foreground hover:underline"
                    title="Open the Creator prefilled with this idea instead"
                  >
                    <Wand2 className="size-3" /> Creator
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
