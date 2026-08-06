"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { IMAGE_MODEL_VALUES } from "@/lib/ai/image-choices";
import type { StudioImageMeta } from "@/lib/repositories/studio-images.repo";
import { toUserMessage } from "@/lib/services/errors";
import {
  attachStudioImageToPost,
  generateStudioImage,
} from "@/lib/services/studio.service";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import type { PostImageMeta } from "@/lib/types/content";

// ~5MB of base64 per attachment; up to 4 attachments per request.
const MAX_REF_CHARS = 7_000_000;

const generateSchema = z.object({
  prompt: z.string().trim().min(3, "Describe the image you want.").max(4000),
  postId: z.number().int().positive().nullable().default(null),
  baseImageId: z.number().int().positive().optional(),
  basePostImageId: z.number().int().positive().optional(),
  kind: z.enum(["organic", "ad"]).optional(),
  model: z.enum(IMAGE_MODEL_VALUES).optional(),
  uploads: z
    .array(
      z.object({
        mime: z.string().startsWith("image/").max(60),
        data: z.string().min(10).max(MAX_REF_CHARS),
      }),
    )
    .max(4)
    .default([]),
});

export async function generateStudioImageAction(
  input: unknown,
): Promise<ActionResult<StudioImageMeta>> {
  const parsed = parseInput(generateSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const image = await generateStudioImage(parsed.data);
    return ok(image);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const attachSchema = z.object({
  studioImageId: z.number().int().positive(),
  postId: z.number().int().positive(),
});

export async function attachStudioImageAction(
  input: unknown,
): Promise<ActionResult<PostImageMeta>> {
  const parsed = parseInput(attachSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const image = attachStudioImageToPost(
      parsed.data.studioImageId,
      parsed.data.postId,
    );
    revalidatePath("/dashboard");
    revalidatePath("/research");
    return ok(image);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
