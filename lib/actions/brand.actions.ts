"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/actions/action-utils";
import {
  deleteBrandAsset,
  insertBrandAsset,
  type BrandAssetMeta,
} from "@/lib/repositories/brand-assets.repo";
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

// ~5MB of base64 per asset upload.
const uploadAssetSchema = z.object({
  kind: z.enum(["logo", "product"]),
  name: z.string().trim().max(120).default(""),
  mime: z.string().startsWith("image/").max(60),
  data: z.string().min(10).max(7_000_000),
});

export async function uploadBrandAssetAction(
  input: unknown,
): Promise<ActionResult<BrandAssetMeta>> {
  const parsed = parseInput(uploadAssetSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const asset = insertBrandAsset({
      kind: parsed.data.kind,
      name: parsed.data.name,
      mime: parsed.data.mime,
      data: Buffer.from(parsed.data.data, "base64"),
    });
    revalidatePath("/brand");
    return ok(asset);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

const deleteAssetSchema = z.object({ assetId: z.number().int().positive() });

export async function deleteBrandAssetAction(
  input: unknown,
): Promise<ActionResult<{ deleted: boolean }>> {
  const parsed = parseInput(deleteAssetSchema, input);
  if (!parsed.success) return parsed.result;

  try {
    const deleted = deleteBrandAsset(parsed.data.assetId);
    revalidatePath("/brand");
    return ok({ deleted });
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
