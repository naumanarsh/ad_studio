"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { setPostStatus, updatePostContent } from "@/lib/repositories/posts.repo";
import { toUserMessage } from "@/lib/services/errors";
import {
  createPostFromTrend,
  type TrendPostResult,
} from "@/lib/services/generation.service";
import { suggestHooks, type HookOption } from "@/lib/services/hooks.service";
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

const updateContentSchema = z.object({
  postId: z.number().int().positive(),
  caption: z.string().trim().min(3, "The caption can't be empty.").max(3000),
  hashtags: z.string().trim().max(300).default(""),
});

export async function updatePostContentAction(
  input: unknown,
): Promise<ActionResult<Post>> {
  const parsed = parseInput(updateContentSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const post = updatePostContent(
      parsed.data.postId,
      parsed.data.caption,
      parsed.data.hashtags,
    );
    if (!post) return fail("That post no longer exists.");
    revalidatePath("/dashboard");
    revalidatePath("/research");
    revalidatePath("/studio");
    return ok(post);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const bulkStatusSchema = z.object({
  postIds: z.array(z.number().int().positive()).min(1).max(100),
  status: z.enum(POST_STATUSES),
});

export async function bulkSetPostStatusAction(
  input: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const parsed = parseInput(bulkStatusSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    let updated = 0;
    for (const postId of parsed.data.postIds) {
      if (setPostStatus(postId, parsed.data.status)) updated += 1;
    }
    revalidatePath("/dashboard");
    revalidatePath("/research");
    return ok({ updated });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const hooksSchema = z.object({ postId: z.number().int().positive() });

export async function suggestHooksAction(
  input: unknown,
): Promise<ActionResult<{ hooks: HookOption[] }>> {
  const parsed = parseInput(hooksSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const hooks = await suggestHooks(parsed.data.postId);
    return ok({ hooks });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
