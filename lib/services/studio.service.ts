import "server-only";

import { getImageProvider } from "@/lib/ai/image-registry";
import type { ImageReference } from "@/lib/ai/image-types";
import {
  designBriefFor,
  extractHook,
  PLATFORM_ASPECT,
} from "@/lib/prompts/ad-design";
import { recordAiRequest } from "@/lib/repositories/ai-logs.repo";
import { listBrandKit } from "@/lib/repositories/brand-assets.repo";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import * as postImagesRepo from "@/lib/repositories/post-images.repo";
import { getPost } from "@/lib/repositories/posts.repo";
import { assertWithinDailyBudget } from "@/lib/services/budget.service";
import * as studioRepo from "@/lib/repositories/studio-images.repo";
import type { StudioImageMeta } from "@/lib/repositories/studio-images.repo";
import {
  critiqueAdImage,
  expandUserImageIntent,
} from "@/lib/services/art-director";
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

/** What the reviewer did to a fresh generation. */
export type StudioReview = {
  checked: boolean;
  approved: boolean;
  autoFixed: boolean;
};

export type StudioGenerationResult = {
  image: StudioImageMeta;
  review: StudioReview;
};

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
  /** Attach the stored brand kit (logo + product shots). Default true. */
  useBrandKit?: boolean;
}): Promise<StudioGenerationResult> {
  assertWithinDailyBudget();
  const hasBase = Boolean(input.baseImageId || input.basePostImageId);
  // The stored brand kit rides along on fresh generations, so the team
  // never re-uploads the logo and the model never invents look-alikes.
  const kit =
    !hasBase && (input.useBrandKit ?? true) ? listBrandKit() : [];
  const kitReferences: ImageReference[] = kit.map((asset) => ({
    mime: asset.mime,
    data: asset.data.toString("base64"),
  }));

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
        [...kitReferences, ...(input.uploads ?? [])],
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
  kit.forEach((asset, i) => {
    references.push(kitReferences[i]);
    manifest.push(
      asset.kind === "logo"
        ? `Image ${references.length}: the brand's official logo. Reproduce it EXACTLY — same shapes, colors and lettering. Never redraw or restyle it.`
        : `Image ${references.length}: the brand's real product photo. When the design features the product, composite THIS one faithfully — never an invented version.`,
    );
  });
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
        (kit.length + (input.uploads ?? []).length > 0
          ? "\n\nNon-negotiable: the attached brand/user assets are the real " +
            "products/brand elements — composite them exactly as provided; " +
            "never paint a look-alike or substitute."
          : "")
      : userPrompt;

  const provider = getImageProvider(input.model);
  const image = await generateLogged(provider, prompt, input.prompt, {
    aspect: STUDIO_ASPECT,
    references,
  });

  // Quality gate on fresh generations: the reviewer checks compliance and
  // craft against the brief, and dictates one auto-fix pass if needed.
  const review: StudioReview = {
    checked: false,
    approved: true,
    autoFixed: false,
  };
  let finalImage = image;
  if (!hasBase) {
    try {
      const verdict = await critiqueAdImage(
        { mime: image.mime, data: image.data },
        userPrompt,
      );
      review.checked = true;
      review.approved = verdict.approved;
      if (!verdict.approved && verdict.fixes) {
        finalImage = await generateLogged(
          provider,
          `Revise this ad image. Apply exactly these fixes and change nothing else:\n${verdict.fixes}`,
          input.prompt,
          {
            aspect: STUDIO_ASPECT,
            references: [
              { mime: image.mime, data: image.data.toString("base64") },
            ],
          },
        );
        review.autoFixed = true;
        review.approved = true;
      }
    } catch {
      // Review is best-effort — the first render still ships.
    }
  }

  const meta = studioRepo.insertStudioImage({
    post_id: input.postId,
    prompt: input.prompt,
    mime: finalImage.mime,
    model: finalImage.model,
    data: finalImage.data,
  });
  return { image: meta, review };
}

// Studio output format: Meta feed portrait unless a post dictates otherwise.
const STUDIO_ASPECT = "4:5";

/** One logged studio generation call. */
async function generateLogged(
  provider: ReturnType<typeof getImageProvider>,
  prompt: string,
  loggedPrompt: string,
  opts: { aspect?: string; references?: ImageReference[] } = {},
) {
  const start = Date.now();
  try {
    const image = await provider.generate({
      purpose: "studio.image",
      prompt,
      references: opts.references,
      aspect: opts.aspect,
    });
    recordAiRequest({
      provider: provider.name,
      model: image.model,
      purpose: "studio.image",
      prompt: loggedPrompt,
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
      purpose: "studio.image",
      prompt: loggedPrompt,
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
