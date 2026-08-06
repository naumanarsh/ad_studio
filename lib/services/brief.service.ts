import "server-only";

import { localDate } from "@/lib/db/client";
import * as ideasRepo from "@/lib/repositories/ideas.repo";
import * as postsRepo from "@/lib/repositories/posts.repo";
import * as trendsRepo from "@/lib/repositories/trends.repo";
import {
  generateIdeas,
  generatePosts,
  regenerateIdeasAndPosts,
} from "@/lib/services/generation.service";
import { collectTrends } from "@/lib/services/research.service";
import type { BriefSummary, Idea, Post, Trend } from "@/lib/types/content";

export type MorningBrief = {
  date: string;
  trends: Trend[];
  ideas: Idea[];
  posts: Post[];
};

/** Everything already generated for today — what the dashboard renders. */
export function getTodaysBrief(): MorningBrief {
  const date = localDate();
  return {
    date,
    trends: trendsRepo.listTrendsForDay(date),
    ideas: ideasRepo.listIdeasForDay(date),
    posts: postsRepo.listPostsForDay(date),
  };
}

/**
 * The core pipeline: research → ideas → drafted posts, all for today.
 * Idempotent per day — a second run only fills in stages that are empty.
 * (Runs inline for now; moves to a scheduled background job with the
 * jobs module so it's already done before the team logs in.)
 */
export async function runMorningBrief(): Promise<BriefSummary> {
  const date = localDate();

  let trends = trendsRepo.listTrendsForDay(date);
  if (trends.length === 0) {
    const research = await collectTrends();
    trendsRepo.insertTrends(research.trends, date);
    trends = trendsRepo.listTrendsForDay(date);
  }

  let ideas = ideasRepo.listIdeasForDay(date);
  if (ideas.length === 0) {
    ideas = await generateIdeas(trends, date);
  }

  let posts = postsRepo.listPostsForDay(date);
  if (posts.length === 0) {
    const trendsById = new Map(trends.map((t) => [t.id, t]));
    posts = await generatePosts(ideas, trendsById, date);
  }

  return {
    date,
    trends: trends.length,
    ideas: ideas.length,
    posts: posts.length,
  };
}

// Concurrent regenerate requests (double-click, two tabs) would interleave
// deletes and inserts and trip foreign keys — share one in-flight run.
let regenerateInFlight: Promise<BriefSummary> | null = null;

/**
 * Throw away today's ideas and drafts and regenerate them from the current
 * trends — for when research changed mid-day and the drafts are stale.
 * Trends are kept (refresh them on the Research tab); approvals on the
 * discarded drafts are lost.
 */
export function regenerateBrief(): Promise<BriefSummary> {
  regenerateInFlight ??= doRegenerateBrief().finally(() => {
    regenerateInFlight = null;
  });
  return regenerateInFlight;
}

async function doRegenerateBrief(): Promise<BriefSummary> {
  const date = localDate();

  let trends = trendsRepo.listTrendsForDay(date);
  if (trends.length === 0) {
    const research = await collectTrends();
    trendsRepo.insertTrends(research.trends, date);
    trends = trendsRepo.listTrendsForDay(date);
  }

  // Generates first, deletes only on success — a failed model call must
  // not wipe the day's existing content.
  const { ideas, posts } = await regenerateIdeasAndPosts(trends, date);

  return {
    date,
    trends: trends.length,
    ideas: ideas.length,
    posts: posts.length,
  };
}
