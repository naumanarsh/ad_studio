"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { localDate } from "@/lib/db/client";
import * as topicsRepo from "@/lib/repositories/topics.repo";
import * as trendsRepo from "@/lib/repositories/trends.repo";
import { collectTrends } from "@/lib/services/research.service";
import { toUserMessage } from "@/lib/services/errors";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import type { ResearchTopic } from "@/lib/types/content";

function revalidateResearch(): void {
  revalidatePath("/research");
  revalidatePath("/dashboard");
}

const addTopicSchema = z.object({
  tag: z
    .string()
    .trim()
    .min(2, "Topics need at least 2 characters.")
    .max(60, "Keep topics under 60 characters."),
});

export async function addTopicAction(
  input: unknown,
): Promise<ActionResult<ResearchTopic>> {
  const parsed = parseInput(addTopicSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const topic = topicsRepo.addTopic(parsed.data.tag);
    revalidateResearch();
    return ok(topic);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const removeTopicSchema = z.object({
  topicId: z.number().int().positive(),
});

export async function removeTopicAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = parseInput(removeTopicSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    if (!topicsRepo.removeTopic(parsed.data.topicId)) {
      return fail("That topic no longer exists.");
    }
    revalidateResearch();
    return ok(null);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export type RefreshSummary = {
  trends: number;
  failedSources: string[];
  usedSampleData: boolean;
};

/**
 * Re-collect today's research from the current sources, replacing what was
 * fetched earlier — used after changing topics so the day's trends match.
 */
export async function refreshResearchAction(): Promise<
  ActionResult<RefreshSummary>
> {
  try {
    const research = await collectTrends();
    const date = localDate();
    trendsRepo.deleteTrendsForDay(date);
    trendsRepo.insertTrends(research.trends, date);
    revalidateResearch();
    return ok({
      trends: research.trends.length,
      failedSources: research.failedSources,
      usedSampleData: research.usedSampleData,
    });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
