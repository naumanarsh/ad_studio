"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import * as brandRepo from "@/lib/repositories/brand.repo";
import { analyzeBrandWebsite } from "@/lib/services/brand.service";
import { toUserMessage } from "@/lib/services/errors";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import type { BrandProfile } from "@/lib/types/content";

const analyzeSchema = z.object({
  website: z.string().trim().min(4, "Enter your website address."),
});

export async function analyzeBrandAction(
  input: unknown,
): Promise<ActionResult<BrandProfile>> {
  const parsed = parseInput(analyzeSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const profile = await analyzeBrandWebsite(parsed.data.website);
    revalidatePath("/brand");
    return ok(profile);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const saveSchema = z.object({
  company: z.string().trim().max(120),
  website: z.string().trim().max(300),
  description: z.string().trim().max(600),
  audience: z.string().trim().max(400),
  tone: z.string().trim().max(400),
  colors: z.string().trim().max(200),
  image_style: z.string().trim().max(400),
  notes: z.string().trim().max(600),
  platforms: z.string().trim().max(200),
});

export async function saveBrandAction(
  input: unknown,
): Promise<ActionResult<BrandProfile>> {
  const parsed = parseInput(saveSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const profile = brandRepo.saveBrandProfile(parsed.data);
    revalidatePath("/brand");
    return ok(profile);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
