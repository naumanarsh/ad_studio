"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import * as competitorsRepo from "@/lib/repositories/competitors.repo";
import {
  analyzeCompetitor,
  remixCompetitorTopic,
} from "@/lib/services/competitor.service";
import { toUserMessage } from "@/lib/services/errors";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import type { Competitor } from "@/lib/types/content";

const addSchema = z.object({
  name: z.string().trim().min(2, "Name the competitor.").max(120),
  website: z.string().trim().min(4, "Enter their website.").max(300),
});

export async function addCompetitorAction(
  input: unknown,
): Promise<ActionResult<Competitor>> {
  const parsed = parseInput(addSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const competitor = competitorsRepo.addCompetitor(
      parsed.data.name,
      parsed.data.website,
    );
    revalidatePath("/research");
    return ok(competitor);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const idSchema = z.object({ competitorId: z.number().int().positive() });

export async function removeCompetitorAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = parseInput(idSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    if (!competitorsRepo.removeCompetitor(parsed.data.competitorId)) {
      return fail("That competitor no longer exists.");
    }
    revalidatePath("/research");
    return ok(null);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function analyzeCompetitorAction(
  input: unknown,
): Promise<ActionResult<Competitor>> {
  const parsed = parseInput(idSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const competitor = await analyzeCompetitor(parsed.data.competitorId);
    revalidatePath("/research");
    return ok(competitor);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const remixSchema = z.object({
  competitorId: z.number().int().positive(),
  topicIndex: z.number().int().min(0),
});

export async function remixTopicAction(
  input: unknown,
): Promise<ActionResult<{ ideaTitle: string; posts: number }>> {
  const parsed = parseInput(remixSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const { idea, posts } = await remixCompetitorTopic(
      parsed.data.competitorId,
      parsed.data.topicIndex,
    );
    revalidatePath("/dashboard");
    revalidatePath("/research");
    return ok({ ideaTitle: idea.title, posts: posts.length });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
