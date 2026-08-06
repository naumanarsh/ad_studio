import "server-only";

import { getImageProvider } from "@/lib/ai/image-registry";
import type { ImageReference } from "@/lib/ai/image-types";
import {
  designBriefFor,
  extractHook,
  PLATFORM_ASPECT,
} from "@/lib/prompts/ad-design";
import { recordAiRequest } from "@/lib/repositories/ai-logs.repo";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import * as postImagesRepo from "@/lib/repositories/post-images.repo";
import { getPost } from "@/lib/repositories/posts.repo";
import * as studioRepo from "@/lib/repositories/studio-images.repo";
import type { StudioImageMeta } from "@/lib/repositories/studio-images.repo";
import { expandUserImageIntent } from "@/lib/services/art-director";
import type { Post, PostImageMeta } from "@/lib/types/content";

// Below this, a fresh-generation prompt is too thin for a good image —
// the art director expands it into a full creative brief first.
const THIN_PROMPT_CHARS = 280;

/** Editable starting prompt for a post — shown in the Studio composer. */
export function defaultPromptForPost(post: Post): string {
  const brand = getBrandProfile();
  const hook = extractHook(post.caption);
  const lines: string[] = [
    `Create a ${PLATFORM_ASPECT[post.platform]} ad image${brand?.company ? ` for ${brand.company}` : ""}.`,
  ];
  if (brand?.description) lines.push(`About the brand: ${brand.description}`);
  if (brand?.colors) lines.push(`Brand colors: ${brand.colors}`);
  if (brand?.image_style) lines.push(`House style: ${brand.image_style}`);
  lines.push(
    "",
    designBriefFor(post.kind),
    "",
    hook ? `Hook line to feature (the ONLY large text): "${hook}"` : "",
    `What the ad is about (context only — never typeset this in the image):`,
    post.caption.slice(0, 300),
  );
  return lines.filter((l) => l !== "").join("\n");
}

// Short creation intents for context arriving from other pages. Kept under
// the thin-prompt threshold on purpose: the art director expands them with
// full brand + design context at generation time.

export function intentForTrend(trend: {
  title: string;
  summary: string | null;
}): string {
  return `Create a scroll-stopping social visual reacting to this trend: "${trend.title}"${trend.summary ? ` — ${trend.summary.slice(0, 120)}` : ""}`;
}

export function intentForIdea(idea: { title: string; angle: string }): string {
  return `Create the visual for this content idea: "${idea.title}" — ${idea.angle.slice(0, 140)}`;
}

export function intentForCompetitorTopic(
  competitorName: string,
  topic: { topic: string; angle: string },
): string {
  return `Competitor ${competitorName} runs this angle: "${topic.topic}" (${topic.angle.slice(0, 100)}). Create OUR brand's stronger take on it as a visual.`;
}

export async function generateStudioImage(input: {
  prompt: string;
  postId: number | null;
  /** Iterate: revise a previous studio result. */
  baseImageId?: number;
  /** Iterate on a post's existing generated image. */
  basePostImageId?: number;
  /** Uploaded reference images (base64) — logos, product shots, old ads. */
  uploads?: ImageReference[];
  /** What we're making — picks the ad vs organic design rules. */
  kind?: "organic" | "ad";
  /** Which image model renders it — defaults to the configured provider. */
  model?: string | null;
}): Promise<StudioImageMeta> {
  const hasBase = Boolean(input.baseImageId || input.basePostImageId);
  let userPrompt = input.prompt;
  // Vague fresh requests ("make an insta ad") get art-directed into a
  // full brief; edits and already-detailed prompts pass through as-is.
  let expanded = false;
  if (!hasBase && userPrompt.length < THIN_PROMPT_CHARS) {
    try {
      userPrompt = await expandUserImageIntent(
        userPrompt,
        getBrandProfile(),
        input.postId ? getPost(input.postId) : null,
        input.kind,
        input.uploads ?? [],
      );
      expanded = true;
    } catch {
      // Expansion is best-effort — the raw prompt still works.
    }
  }
  // Fresh generations that bypassed the art director (detailed prompts,
  // style-chip prompts) still get the house rules — compliance included.
  if (!hasBase && !expanded) {
    userPrompt = `${userPrompt}\n\nHouse design rules:\n${designBriefFor(input.kind ?? "ad")}`;
  }

  const references: ImageReference[] = [];
  const manifest: string[] = [];

  if (hasBase) {
    const base = input.baseImageId
      ? studioRepo.getStudioImageWithData(input.baseImageId)
      : postImagesRepo.getImageWithData(input.basePostImageId!);
    if (!base) throw new Error("That image no longer exists.");
    references.push({ mime: base.mime, data: base.data.toString("base64") });
    manifest.push(
      `Image 1: the CURRENT ad design. Apply the user's instruction to this exact image — change only what is asked, keep everything else identical.`,
    );
  }
  for (const upload of input.uploads ?? []) {
    references.push(upload);
    manifest.push(
      `Image ${references.length}: an asset supplied by the user (their logo, product photo, or visual reference). Reproduce it EXACTLY as provided — same shapes, colors and lettering. Never redraw, restyle, or replace it with an invented version.`,
    );
  }

  // Models follow attached images far more faithfully when each one's role
  // is spelled out — this manifest is what makes "use MY logo" work.
  const prompt =
    manifest.length > 0
      ? `You are given ${references.length} attached image${references.length === 1 ? "" : "s"}.\n` +
        `${manifest.join("\n")}\n\nUser instruction:\n${userPrompt}` +
        ((input.uploads ?? []).length > 0
          ? "\n\nNon-negotiable: the attached user assets are the real " +
            "products/brand elements — composite them exactly as provided; " +
            "never paint a look-alike or substitute."
          : "")
      : userPrompt;

  const provider = getImageProvider(input.model);
  const start = Date.now();
  try {
    const image = await provider.generate({
      purpose: "studio.image",
      prompt,
      references,
    });
    recordAiRequest({
      provider: provider.name,
      model: image.model,
      purpose: "studio.image",
      prompt: input.prompt,
      response: `(${image.mime}, ${image.data.length} bytes)`,
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: Date.now() - start,
      cost_usd: image.costUsd,
      error: null,
    });
    return studioRepo.insertStudioImage({
      post_id: input.postId,
      prompt: input.prompt,
      mime: image.mime,
      data: image.data,
    });
  } catch (error) {
    recordAiRequest({
      provider: provider.name,
      model: "unknown",
      purpose: "studio.image",
      prompt: input.prompt,
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

/** Copy a studio result onto a post as its selected visual. */
export function attachStudioImageToPost(
  studioImageId: number,
  postId: number,
): PostImageMeta {
  const image = studioRepo.getStudioImageWithData(studioImageId);
  if (!image) throw new Error("That image no longer exists.");
  const inserted = postImagesRepo.insertImage({
    post_id: postId,
    variant: "Studio",
    prompt: "(made in Image Studio)",
    mime: image.mime,
    data: image.data,
  });
  return postImagesRepo.selectImage(inserted.id) ?? inserted;
}
