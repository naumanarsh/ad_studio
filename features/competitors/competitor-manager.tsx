"use client";

import {
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addCompetitorAction,
  analyzeCompetitorAction,
  removeCompetitorAction,
  remixTopicAction,
} from "@/lib/actions/competitor.actions";
import type { Competitor, CompetitorTopic } from "@/lib/types/content";

function adLibraryLinks(name: string) {
  const q = encodeURIComponent(name);
  return [
    {
      label: "Meta Ad Library",
      href: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${q}&search_type=keyword_unordered`,
    },
    {
      label: "LinkedIn Ads",
      href: `https://www.linkedin.com/ad-library/search?companyName=${q}`,
    },
  ];
}

function parseTopics(json: string): CompetitorTopic[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CompetitorManager({
  competitors,
}: {
  competitors: Competitor[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function add(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addCompetitorAction({ name, website });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      setWebsite("");
      toast.success(`${result.data.name} added — analyze them to pull their playbook.`);
      router.refresh();
    });
  }

  function analyze(competitor: Competitor) {
    setBusyId(competitor.id);
    startTransition(async () => {
      const result = await analyzeCompetitorAction({
        competitorId: competitor.id,
      });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${competitor.name} analyzed.`);
      router.refresh();
    });
  }

  function remove(competitor: Competitor) {
    if (!window.confirm(`Remove ${competitor.name}?`)) return;
    startTransition(async () => {
      const result = await removeCompetitorAction({
        competitorId: competitor.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remix(competitor: Competitor, topicIndex: number) {
    setBusyId(competitor.id);
    startTransition(async () => {
      const result = await remixTopicAction({
        competitorId: competitor.id,
        topicIndex,
      });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Our take drafted: "${result.data.ideaTitle}" — ${result.data.posts} posts on Today.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="comp-name">
            Competitor
          </label>
          <Input
            id="comp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hims & Hers"
            className="w-56"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="comp-site">
            Website
          </label>
          <Input
            id="comp-site"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="hims.com"
            className="w-56"
            disabled={pending}
          />
        </div>
        <Button type="submit" disabled={pending || !name.trim() || !website.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>

      {competitors.length === 0 && (
        <p className="border px-4 py-6 text-sm text-muted-foreground">
          No competitors yet — add the brands whose marketing you want to
          watch and learn from.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {competitors.map((competitor) => {
          const topics = parseTopics(competitor.topics_json);
          const busy = busyId === competitor.id && pending;
          return (
            <Card key={competitor.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-lg font-semibold">
                    {competitor.name}
                  </span>
                  <a
                    href={/^https?:/.test(competitor.website) ? competitor.website : `https://${competitor.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  >
                    {competitor.website}
                    <ExternalLink className="size-3" />
                  </a>
                  <div className="ml-auto flex items-center gap-1">
                    {adLibraryLinks(competitor.name).map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 border px-2 py-1 text-xs hover:bg-accent"
                        title={`Browse their live ads in the ${link.label}`}
                      >
                        <Search className="size-3" /> {link.label}
                      </a>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => analyze(competitor)}
                    >
                      {busy ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      {competitor.analyzed_at ? "Re-analyze" : "Analyze"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => remove(competitor)}
                      aria-label={`Remove ${competitor.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {competitor.analysis ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {competitor.analysis}
                    </p>
                    {topics.length > 0 && (
                      <ul className="flex flex-col divide-y border">
                        {topics.map((topic, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {topic.topic}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {topic.angle}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => remix(competitor, i)}
                                title="Generate our brand's take on this topic and draft posts for it"
                              >
                                <Wand2 className="size-4" /> Remix for us
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                asChild
                                title="Open the Creator with our take on this angle"
                              >
                                <a
                                  href={`/studio?competitorId=${competitor.id}&topicIndex=${i}`}
                                >
                                  Create
                                </a>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not analyzed yet — click Analyze to pull their positioning
                    and the topics they push.
                  </p>
                )}

                {competitor.analyzed_at && (
                  <Badge variant="outline" className="self-start">
                    analyzed {competitor.analyzed_at.slice(0, 16)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
