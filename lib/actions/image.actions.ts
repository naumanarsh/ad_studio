"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { IMAGE_MODEL_VALUES } from "@/lib/ai/image-choices";
import * as imagesRepo from "@/lib/repositories/post-images.repo";
import { toUserMessage } from "@/lib/services/errors";
import {
  generatePostImages,
  type ImageGenerationSummary,
} from "@/lib/services/image.service";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import type { PostImageMeta } from "@/lib/types/content";

function revalidatePostPages(): void {
  revalidatePath("/dashboard");
  revalidatePath("/research");
  revalidatePath("/studio");
}

const postIdSchema = z.object({
  postId: z.number().int().positive(),
  mode: z.enum(["single", "variants"]).default("single"),
  model: z.enum(IMAGE_MODEL_VALUES).optional(),
});

export async function generatePostImagesAction(
  input: unknown,
): Promise<ActionResult<ImageGenerationSummary>> {
  const parsed = parseInput(postIdSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const summary = await generatePostImages(
      parsed.data.postId,
      parsed.data.mode,
      parsed.data.model,
    );
    revalidatePostPages();
    return ok(summary);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const imageIdSchema = z.object({ imageId: z.number().int().positive() });

export async function selectPostImageAction(
  input: unknown,
): Promise<ActionResult<PostImageMeta>> {
  const parsed = parseInput(imageIdSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const image = imagesRepo.selectImage(parsed.data.imageId);
    if (!image) return fail("That image no longer exists.");
    revalidatePostPages();
    return ok(image);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
