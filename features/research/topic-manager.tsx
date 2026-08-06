"use client";

import { Plus, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addTopicAction,
  refreshResearchAction,
  removeTopicAction,
} from "@/lib/actions/research.actions";
import type { ResearchTopic } from "@/lib/types/content";

export function TopicManager({ topics }: { topics: ResearchTopic[] }) {
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [pending, startTransition] = useTransition();

  function addTopic(event: React.FormEvent) {
    event.preventDefault();
    const value = tag.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await addTopicAction({ tag: value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTag("");
      router.refresh();
    });
  }

  function removeTopic(topic: ResearchTopic) {
    startTransition(async () => {
      const result = await removeTopicAction({ topicId: topic.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function refresh() {
    startTransition(async () => {
      const result = await refreshResearchAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { trends, failedSources, usedSampleData } = result.data;
      if (usedSampleData) {
        toast.warning("All sources were unreachable — showing sample data.");
      } else {
        toast.success(`Collected ${trends} trends.`);
      }
      if (failedSources.length > 0) {
        toast.warning(`Some sources failed: ${failedSources.join(", ")}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="kicker">Research Topics</p>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={refresh}
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Refresh today&apos;s research
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Trends are collected as keyword news searches for each topic — add the
        subjects your brand cares about (e.g. “telehealth”, “healthcare
        marketing”). Without topics, generic marketing feeds are used.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {topics.map((topic) => (
          <span
            key={topic.id}
            className="inline-flex items-center gap-1 border bg-secondary px-2 py-1 text-xs font-medium"
          >
            {topic.tag}
            <button
              type="button"
              aria-label={`Remove topic ${topic.tag}`}
              disabled={pending}
              onClick={() => removeTopic(topic)}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {topics.length === 0 && (
          <span className="text-xs text-muted-foreground">
            No topics yet — using generic marketing feeds.
          </span>
        )}
      </div>
      <form onSubmit={addTopic} className="flex gap-2">
        <Input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="Add a topic, e.g. telehealth"
          className="max-w-xs"
          disabled={pending}
        />
        <Button type="submit" size="sm" disabled={pending || !tag.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
    </div>
  );
}
