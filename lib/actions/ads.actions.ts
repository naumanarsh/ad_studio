"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import { IMAGE_MODEL_VALUES } from "@/lib/ai/image-choices";
import { generateAds } from "@/lib/services/ads.service";
import { toUserMessage } from "@/lib/services/errors";
import { fail, ok, type ActionResult } from "@/lib/types/result";

const generateSchema = z.object({
  promo: z
    .string()
    .trim()
    .min(5, "Describe what you want to promote.")
    .max(800),
  model: z.enum(IMAGE_MODEL_VALUES).optional(),
});

export async function generateAdsAction(
  input: unknown,
): Promise<ActionResult<{ count: number; images: number }>> {
  const parsed = parseInput(generateSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const campaign = await generateAds(parsed.data.promo, parsed.data.model);
    revalidatePath("/studio");
    revalidatePath("/dashboard");
    return ok({
      count: campaign.ads.length,
      images: campaign.imagesGenerated,
    });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
