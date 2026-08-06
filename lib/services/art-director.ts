import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { designBriefFor, PLATFORM_ASPECT } from "@/lib/prompts/ad-design";
import { parseAiJson } from "@/lib/prompts/marketing";
import {
  listRecentResponses,
  recordAiRequest,
} from "@/lib/repositories/ai-logs.repo";
import { listImageBriefsByStatus } from "@/lib/repositories/posts.repo";
import type { BrandProfile, Post } from "@/lib/types/content";

const MODEL = process.env.AI_MODEL ?? "claude-opus-5";
const PRICING = { input: 5, output: 25 }; // USD per MTok, opus tier

function brandLines(brand: BrandProfile | null): string {
  if (!brand?.company) return "";
  return [
    `Brand: ${brand.company} — ${brand.description}`,
    brand.audience && `Audience: ${brand.audience}`,
    brand.colors && `Brand colors: ${brand.colors}`,
    brand.image_style && `House image style: ${brand.image_style}`,
    brand.notes && `Compliance cautions: ${brand.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function callClaude(
  purpose: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  system: string,
): Promise<string> {
  const client = new Anthropic();
  const start = Date.now();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("The model declined this request.");
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    recordAiRequest({
      provider: "claude",
      model: response.model,
      purpose,
      prompt: JSON.stringify(content).slice(0, 4000),
      response: text,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: Date.now() - start,
      cost_usd:
        (response.usage.input_tokens * PRICING.input +
          response.usage.output_tokens * PRICING.output) /
        1e6,
      error: null,
    });
    return text;
  } catch (error) {
    recordAiRequest({
      provider: "claude",
      model: MODEL,
      purpose,
      prompt: JSON.stringify(content).slice(0, 4000),
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
 * The learning loop: briefs behind posts the team APPROVED are quality
 * exemplars; rejected ones are anti-examples. Every review decision the
 * team makes sharpens the next brief.
 */
function outcomeExemplarsBlock(): string {
  const strip = (brief: string) =>
    brief.replace(/^[^\n]*\n/, "").replace(/\s+/g, " ").slice(0, 220);
  const winners = listImageBriefsByStatus("approved", 3).map(strip);
  const losers = listImageBriefsByStatus("rejected", 2).map(strip);
  if (winners.length === 0 && losers.length === 0) return "";
  let block = "";
  if (winners.length > 0) {
    block +=
      "\n\nBriefs the team APPROVED — study what they share (subject choice, tone, composition discipline) and channel those qualities. Do NOT copy the concepts themselves:\n" +
      winners.map((w) => `- ${w}`).join("\n");
  }
  if (losers.length > 0) {
    block +=
      "\n\nBriefs the team REJECTED — identify what likely failed and avoid it:\n" +
      losers.map((l) => `- ${l}`).join("\n");
  }
  return block;
}

/** Excerpts of recent briefs so new concepts don't repeat them. */
function recentConceptsBlock(): string {
  const recent = listRecentResponses("image.brief", 3).map((r) =>
    r.replace(/\s+/g, " ").slice(0, 180),
  );
  if (recent.length === 0) return "";
  return (
    "\n\nRecent ads already used these concepts — design something VISUALLY DIFFERENT (different subject, setting, and device; do not default to a person on a couch or in bed with a phone):\n" +
    recent.map((r) => `- ${r}`).join("\n")
  );
}

function artDirectorSystem(kind: "organic" | "ad"): string {
  const role =
    kind === "ad"
      ? "You are an award-winning paid-social creative director designing ONE specific, scroll-stopping AD creative."
      : "You are an award-winning brand content director designing ONE specific, scroll-worthy ORGANIC feed visual — content, not an ad.";
  return (
    `${role} Describe it as a complete brief for an image-generation ` +
    "model. Your brief must specify: the concept and why it earns a pause; " +
    "the exact scene or composition (subject, setting, camera, light); any " +
    "text to typeset (write it, complete, no ellipsis) and where it sits; " +
    "exact colors from the brand palette; and the mood. Vary your work: " +
    "different subjects, settings, ages, and visual devices across pieces " +
    "— never a formula. Follow these hard rules:\n" +
    designBriefFor(kind) +
    "\nRespond with the brief only — no preamble, no options, one concept."
  );
}

/**
 * Claude as art director: analyze the post + brand + platform and produce
 * a specific, opinionated creative concept for the image model — instead
 * of a one-size-fits-all template prompt.
 */
export async function designImageBrief(
  post: Post,
  brand: BrandProfile | null,
): Promise<string> {
  return await callClaude(
    "image.brief",
    [
      {
        type: "text",
        text:
          `${brandLines(brand)}\n\n` +
          `Platform & format: ${PLATFORM_ASPECT[post.platform]}\n\n` +
          `The ${post.kind === "ad" ? "ad" : "post"}'s copy:\n"""\n${post.caption.slice(0, 700)}\n"""\n` +
          recentConceptsBlock() +
          outcomeExemplarsBlock() +
          "\n\nWrite the image-generation brief now.",
      },
    ],
    artDirectorSystem(post.kind),
  );
}

/** Image formats Claude can look at directly. */
const CLAUDE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * Expand a thin user request ("make an insta ad") into a full creative
 * brief, using the brand, (when opened from a draft) the post's copy, and
 * — critically — the user's attached assets. The brief must be built
 * AROUND the attachments: the image model composites those exact files,
 * so a brief that describes an imagined product produces a generic
 * look-alike instead of the user's real one.
 */
export async function expandUserImageIntent(
  intent: string,
  brand: BrandProfile | null,
  post: Post | null,
  kindOverride?: "organic" | "ad",
  uploads: Array<{ mime: string; data: string }> = [],
): Promise<string> {
  const kind = kindOverride ?? post?.kind ?? "ad";
  const visibleUploads = uploads
    .filter((u) => CLAUDE_IMAGE_MIMES.has(u.mime))
    .slice(0, 4);
  const uploadRules =
    uploads.length > 0
      ? `\n\nThe user attached ${uploads.length} image${uploads.length === 1 ? "" : "s"}` +
        (visibleUploads.length > 0 ? " (shown above)" : "") +
        " — their REAL assets: product photos, logo, or visual references. " +
        "The image model receives these exact files and composites them into " +
        "the design. Hard rules for your brief:\n" +
        "- The attached assets ARE the subject. Build the concept, scene, " +
        "lighting and layout around featuring them exactly as provided.\n" +
        '- Refer to them as "the attached product photo" / "attached Image N". ' +
        "Never describe their shape, packaging, colors or labels from " +
        "imagination — the attachments define those.\n" +
        "- Never invent a replacement, redesign, or generic stand-in for " +
        "anything shown in the attachments.\n" +
        "- Any variety guidance above applies to scene and styling only — " +
        "the attached assets stay the hero."
      : "";
  return await callClaude(
    "image.brief",
    [
      ...visibleUploads.map((u) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: u.mime as "image/jpeg" | "image/png" | "image/webp",
          data: u.data,
        },
      })),
      {
        type: "text",
        text:
          `${brandLines(brand)}\n\n` +
          `Platform & format: ${post ? PLATFORM_ASPECT[post.platform] : "4:5 vertical (Instagram feed)"}\n\n` +
          (post ? `The ad's copy:\n"""\n${post.caption.slice(0, 700)}\n"""\n\n` : "") +
          `The user's request: "${intent.slice(0, 500)}"` +
          recentConceptsBlock() +
          outcomeExemplarsBlock() +
          uploadRules +
          "\n\nWrite the image-generation brief now, honoring the user's request.",
      },
    ],
    artDirectorSystem(kind),
  );
}

const critiqueSchema = z.object({
  approved: z.boolean(),
  fixes: z.string().transform((s) => s.slice(0, 1200)),
});

/**
 * Claude as reviewer: look at the generated image against the brief and
 * either approve it or dictate precise fixes for one revision pass.
 */
export async function critiqueAdImage(
  image: { mime: string; data: Buffer },
  brief: string,
): Promise<{ approved: boolean; fixes: string }> {
  const text = await callClaude(
    "image.critique",
    [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mime as "image/jpeg" | "image/png" | "image/webp",
          data: image.data.toString("base64"),
        },
      },
      {
        type: "text",
        text:
          `This ad image was generated from the brief below. Review it like a ` +
          `demanding creative director signing off paid media.\n\nBrief:\n${brief.slice(0, 1500)}\n\n` +
          `Check, in order:\n` +
          `1. Meta health-ad compliance (instant rejection risks): before/after ` +
          `body comparisons or transformation imagery; scales, tape measures, ` +
          `pinched-fat or other body-flaw visuals; copy that addresses the ` +
          `viewer's body or provokes negative self-perception; competitor drug ` +
          `brand names, packaging or logos; needles piercing skin; invented ` +
          `certification badges or award seals.\n` +
          `2. Craft: garbled or misspelled text anywhere (including label ` +
          `microtext — if tiny text is gibberish, direct it to be softly ` +
          `defocused); clutter or extra text blocks; low text/background ` +
          `contrast or type too small to read at phone feed size; off-brand ` +
          `colors; amateur composition; anything that violates the brief.\n` +
          `Respond with JSON only: {"approved": boolean, "fixes": ` +
          `"if not approved: precise, imperative edit instructions for the ` +
          `image model, biggest problems first"}`,
      },
    ],
    "You are a meticulous creative director reviewing ad creatives before they run. Respond with valid JSON only.",
  );
  return parseAiJson(critiqueSchema, text);
}
