"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { setPostStatus } from "@/lib/repositories/posts.repo";
import { toUserMessage } from "@/lib/services/errors";
import {
  createPostFromTrend,
  type TrendPostResult,
} from "@/lib/services/generation.service";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import { POST_STATUSES, type Post } from "@/lib/types/content";

const setStatusSchema = z.object({
  postId: z.number().int().positive(),
  status: z.enum(POST_STATUSES),
});

const fromTrendSchema = z.object({
  trendId: z.number().int().positive(),
});

/** Trend → article analysis → brand-voice caption → on-brand image. */
export async function createPostFromTrendAction(
  input: unknown,
): Promise<ActionResult<TrendPostResult>> {
  const parsed = parseInput(fromTrendSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const result = await createPostFromTrend(parsed.data.trendId);
    revalidatePath("/dashboard");
    revalidatePath("/research");
    return ok(result);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

export async function setPostStatusAction(
  input: unknown,
): Promise<ActionResult<Post>> {
  const parsed = parseInput(setStatusSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const post = setPostStatus(parsed.data.postId, parsed.data.status);
    if (!post) return fail("That post no longer exists.");
    revalidatePath("/dashboard");
    return ok(post);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
