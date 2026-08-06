"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { toUserMessage } from "@/lib/services/errors";
import {
  enqueuePostFromIdea,
  enqueuePostFromTrend,
} from "@/lib/services/job-queue.service";
import { fail, ok, type ActionResult } from "@/lib/types/result";

const queueSchema = z.object({ trendId: z.number().int().positive() });

export async function queuePostFromTrendAction(
  input: unknown,
): Promise<ActionResult<{ position: number }>> {
  const parsed = parseInput(queueSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const { position } = enqueuePostFromTrend(parsed.data.trendId);
    revalidatePath("/research");
    return ok({ position });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const queueIdeaSchema = z.object({ ideaId: z.number().int().positive() });

export async function queuePostFromIdeaAction(
  input: unknown,
): Promise<ActionResult<{ position: number }>> {
  const parsed = parseInput(queueIdeaSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const { position } = enqueuePostFromIdea(parsed.data.ideaId);
    revalidatePath("/research");
    return ok({ position });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
