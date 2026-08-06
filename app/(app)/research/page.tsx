import type { Metadata } from "next";
import { CompetitorManager } from "@/features/competitors/competitor-manager";
import { IdeaList, type IdeaCreation } from "@/features/dashboard/idea-list";
import { PostGrid } from "@/features/dashboard/post-grid";
import { SectionTabs, type Section } from "@/components/section-tabs";
import { TopicManager } from "@/features/research/topic-manager";
import { TrendTabs } from "@/features/research/trend-tabs";
import { listCompetitors } from "@/lib/repositories/competitors.repo";
import { listRecentJobs } from "@/lib/repositories/jobs.repo";
import { listImagesForPosts } from "@/lib/repositories/post-images.repo";
import { listPostsForIdeas } from "@/lib/repositories/posts.repo";
import { listTopics } from "@/lib/repositories/topics.repo";
import { getTodaysBrief } from "@/lib/services/brief.service";
import type { PostImageMeta } from "@/lib/types/content";

export const metadata: Metadata = { title: "Research" };
export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const brief = getTodaysBrief();
  const topics = listTopics();
  const competitors = listCompetitors();
  const drafts = brief.posts.filter((p) => p.kind === "organic");
  const imagesByPost: Record<number, PostImageMeta[]> = {};
  for (const image of listImagesForPosts(drafts.map((p) => p.id))) {
    (imagesByPost[image.post_id] ??= []).push(image);
  }

  // Creation status shown back at the source: which trends/ideas are being
  // worked on right now, and which already produced a post.
  const jobs = listRecentJobs();
  const isPending = (s: string) => s === "queued" || s === "running";
  const pendingTrendIds = jobs
    .filter((j) => isPending(j.status) && j.trend_id)
    .map((j) => j.trend_id!) as number[];
  const pendingIdeaIds = jobs
    .filter((j) => isPending(j.status) && j.idea_id)
    .map((j) => j.idea_id!) as number[];

  const createdByTrend: Record<number, IdeaCreation> = {};
  for (const job of jobs) {
    if (
      job.status === "done" &&
      job.trend_id &&
      job.post_id &&
      !createdByTrend[job.trend_id]
    ) {
      createdByTrend[job.trend_id] = { postId: job.post_id, imageId: null };
    }
  }
  const createdByIdea: Record<number, IdeaCreation> = {};
  for (const post of listPostsForIdeas(brief.ideas.map((i) => i.id))) {
    if (post.idea_id !== null && !createdByIdea[post.idea_id]) {
      createdByIdea[post.idea_id] = { postId: post.id, imageId: null };
    }
  }
  const creations = [
    ...Object.values(createdByTrend),
    ...Object.values(createdByIdea),
  ];
  const thumbByPost: Record<number, number> = {};
  for (const image of listImagesForPosts(creations.map((c) => c.postId))) {
    if (image.selected || !thumbByPost[image.post_id]) {
      thumbByPost[image.post_id] = image.id;
    }
  }
  for (const creation of creations) {
    creation.imageId = thumbByPost[creation.postId] ?? null;
  }

  const sections: Section[] = [
    {
      value: "market",
      label: "Market",
      count: brief.trends.length,
      title: (
        <>
          What the world is <em>talking</em> about
        </>
      ),
      description:
        "Today's trends from your topics — news and social, deduped and refreshable.",
    },
    {
      value: "competitors",
      label: "Competitors",
      count: competitors.length,
      title: (
        <>
          What your rivals are <em>running</em>
        </>
      ),
      description:
        "Their positioning and the angles they push — remix any of it into your version.",
    },
    {
      value: "ideas",
      label: "Ideas",
      count: brief.ideas.length,
      title: (
        <>
          Angles worth <em>making</em>
        </>
      ),
      description:
        "Content ideas generated from today's research — create a visual from any of them.",
    },
    {
      value: "drafts",
      label: "Drafts",
      count: drafts.length,
      title: (
        <>
          Drafts waiting on <em>you</em>
        </>
      ),
      description:
        "Today's organic post drafts — review, add visuals, approve.",
    },
  ];

  const contents = {
    market: (
      <div className="flex flex-col gap-6">
        <TopicManager topics={topics} />
        {brief.trends.length > 0 ? (
          <TrendTabs
            trends={brief.trends}
            createdByTrend={createdByTrend}
            pendingTrendIds={pendingTrendIds}
          />
        ) : (
          <p className="border px-4 py-6 text-sm text-muted-foreground">
            No research collected yet — add topics above and refresh, or run
            the brief from the Today tab.
          </p>
        )}
      </div>
    ),
    competitors: <CompetitorManager competitors={competitors} />,
    ideas:
      brief.ideas.length > 0 ? (
        <IdeaList
          ideas={brief.ideas}
          createdByIdea={createdByIdea}
          pendingIdeaIds={pendingIdeaIds}
        />
      ) : (
        <p className="border px-4 py-6 text-sm text-muted-foreground">
          No ideas yet — run the brief from the Today tab, or remix a
          competitor topic.
        </p>
      ),
    drafts:
      drafts.length > 0 ? (
        <PostGrid posts={drafts} imagesByPost={imagesByPost} />
      ) : (
        <p className="border px-4 py-6 text-sm text-muted-foreground">
          No organic drafts today — run the brief from the Today tab.
        </p>
      ),
  };

  return <SectionTabs kicker="Research" sections={sections} contents={contents} />;
}
