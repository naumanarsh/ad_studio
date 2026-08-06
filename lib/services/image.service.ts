import "server-only";

import { getImageProvider } from "@/lib/ai/image-registry";
import type {
  ImageProvider,
  ImageReference,
  ImageResult,
} from "@/lib/ai/image-types";
import {
  designBriefFor,
  extractHook,
  PLATFORM_ASPECT,
  STYLE_TEMPLATES,
} from "@/lib/prompts/ad-design";
import { recordAiRequest } from "@/lib/repositories/ai-logs.repo";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import {
  critiqueAdImage,
  designImageBrief,
} from "@/lib/services/art-director";
import * as imagesRepo from "@/lib/repositories/post-images.repo";
import * as postsRepo from "@/lib/repositories/posts.repo";
import type { BrandProfile, Post, PostImageMeta } from "@/lib/types/content";

// Four distinct modern layouts for the "variants" spread.
const VARIANTS = STYLE_TEMPLATES.slice(0, 4).map((t) => ({
  key: t.label,
  direction: t.brief,
}));

function brandBlock(brand: BrandProfile | null): string {
  if (!brand || !brand.company) {
    return "Brand feel: trustworthy, modern healthcare; forest green and warm cream accents where they fit naturally.";
  }
  const lines = [
    `Brand: ${brand.company} — ${brand.description}`,
    brand.audience && `Audience: ${brand.audience}`,
    brand.colors && `Brand colors: ${brand.colors}`,
    brand.image_style && `House image style: ${brand.image_style}`,
    brand.notes && `Avoid: ${brand.notes}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildPrompt(
  post: Post,
  brand: BrandProfile | null,
  variantKey: string,
  direction: string,
): string {
  const hook = extractHook(post.caption);
  // First line is the variant label — the placeholder provider renders it.
  return (
    `${variantKey}\n` +
    `${designBriefFor(post.kind)}\n\n` +
    `${brandBlock(brand)}\n\n` +
    `Format: ${PLATFORM_ASPECT[post.platform]}.\n` +
    (hook ? `Hook line to feature (the ONLY large text): "${hook}"\n` : "") +
    `What the ad is about (context only — NEVER typeset this text in the image):\n` +
    `${post.caption.slice(0, 300)}\n\n` +
    `Layout: ${direction}`
  );
}

/**
 * The default single image: one on-brand visual chosen to fit the caption,
 * rather than a spread of styles.
 */
const ON_BRAND_VARIANT = {
  key: "On-brand",
  direction: `Choose the single most fitting of these layouts for this ad and execute it flawlessly: ${STYLE_TEMPLATES.map((t) => `${t.label} (${t.brief})`).join(" | ")}`,
};

export type ImageGenerationSummary = {
  generated: PostImageMeta[];
  failed: string[];
};

export type ImageMode = "single" | "variants";

/** One logged generation call. */
async function generateOne(
  provider: ImageProvider,
  prompt: string,
  references?: ImageReference[],
): Promise<ImageResult> {
  const start = Date.now();
  try {
    const image = await provider.generate({
      purpose: "post.image",
      prompt,
      references,
    });
    recordAiRequest({
      provider: provider.name,
      model: image.model,
      purpose: "post.image",
      prompt,
      response: `(${image.mime}, ${image.data.length} bytes)`,
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: Date.now() - start,
      cost_usd: image.costUsd,
      error: null,
    });
    return image;
  } catch (error) {
    recordAiRequest({
      provider: provider.name,
      model: "unknown",
      purpose: "post.image",
      prompt,
      response: "",
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: Date.now() - start,
      cost_usd: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * The quality path for the default single image:
 * 1. Claude (art director) analyzes post + brand + platform → creative brief
 * 2. The image model renders it
 * 3. Claude reviews the render against the brief → one auto-fix pass
 * Every step degrades gracefully — a failed brief falls back to the
 * template prompt; a failed review keeps the first render.
 */
async function generateArtDirected(
  post: Post,
  brand: BrandProfile | null,
  provider: ImageProvider,
): Promise<ImageGenerationSummary> {
  let brief: string | null = null;
  let prompt: string;
  try {
    brief = await designImageBrief(post, brand);
    prompt = `On-brand\n${brief}`;
  } catch {
    prompt = buildPrompt(
      post,
      brand,
      ON_BRAND_VARIANT.key,
      ON_BRAND_VARIANT.direction,
    );
  }

  let image = await generateOne(provider, prompt);
  const failed: string[] = [];
  // Real image models can revise from a reference; the placeholder can't.
  if (brief && provider.name !== "placeholder") {
    try {
      const review = await critiqueAdImage(
        { mime: image.mime, data: image.data },
        brief,
      );
      if (!review.approved && review.fixes) {
        image = await generateOne(
          provider,
          `Revise this ad image. Apply exactly these fixes and change nothing else:\n${review.fixes}`,
          [{ mime: image.mime, data: image.data.toString("base64") }],
        );
      }
    } catch {
      // Review is best-effort — the first render still ships.
    }
  }

  imagesRepo.deleteImagesForPost(post.id);
  const meta = imagesRepo.insertImage({
    post_id: post.id,
    variant: "On-brand",
    prompt,
    mime: image.mime,
    data: image.data,
  });
  return { generated: [meta], failed };
}

/**
 * Generate ad images for a post, replacing any previous set. Default mode
 * is one art-directed on-brand image; "variants" spreads across four
 * layout styles. Degrades per-image: one failure doesn't sink the rest.
 */
export async function generatePostImages(
  postId: number,
  mode: ImageMode = "single",
  model?: string | null,
): Promise<ImageGenerationSummary> {
  const post = postsRepo.getPost(postId);
  if (!post) {
    throw new Error("That post no longer exists.");
  }

  const brand = getBrandProfile();
  const provider = getImageProvider(model);

  if (mode === "single") {
    return generateArtDirected(post, brand, provider);
  }

  const directions = VARIANTS;
  const results = await Promise.allSettled(
    directions.map(async ({ key, direction }) => {
      const prompt = buildPrompt(post, brand, key, direction);
      const image = await generateOne(provider, prompt);
      return { key, prompt, image };
    }),
  );

  const generated: ImageGenerationSummary["generated"] = [];
  const failed: string[] = [];
  const succeeded = results.some((r) => r.status === "fulfilled");
  if (succeeded) {
    imagesRepo.deleteImagesForPost(postId);
  }

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const { key, prompt, image } = result.value;
      generated.push(
        imagesRepo.insertImage({
          post_id: postId,
          variant: key,
          prompt,
          mime: image.mime,
          data: image.data,
        }),
      );
    } else {
      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      failed.push(`${directions[i].key}: ${reason}`);
    }
  });

  if (generated.length === 0) {
    throw new Error(failed[0] ?? "Image generation failed.");
  }
  return { generated, failed };
}
