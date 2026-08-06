import { z } from "zod";
import type { AIMessage } from "@/lib/ai/types";
import {
  POST_PLATFORMS,
  type Idea,
  type PostPlatform,
  type Trend,
} from "@/lib/types/content";

// Prompt builders + the Zod contracts their JSON answers must satisfy.
// (Database-backed, versioned prompt templates arrive with the AI module —
// keeping builders in one file preserves that seam.)

// Length limits clamp instead of reject: by the time we're validating, the
// model call is already paid for — an over-long string is not worth failing
// the pipeline over. The prompts state the budgets so clamping stays rare.
const clamped = (max: number) =>
  z
    .string()
    .min(3)
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s));

export const ideasOutputSchema = z.object({
  ideas: z
    .array(
      z.object({
        trendIndex: z.number().int().min(1),
        title: clamped(160),
        angle: clamped(400),
      }),
    )
    .min(1),
});
export type IdeasOutput = z.infer<typeof ideasOutputSchema>;

export const postsOutputSchema = z.object({
  posts: z
    .array(
      z.object({
        platform: z.enum(POST_PLATFORMS),
        caption: z
          .string()
          .min(10)
          .transform((s) => (s.length > 3000 ? `${s.slice(0, 2999)}…` : s)),
        hashtags: z
          .string()
          .default("")
          .transform((s) => s.slice(0, 300)),
      }),
    )
    .min(1),
});
export type PostsOutput = z.infer<typeof postsOutputSchema>;

const JSON_RULES =
  "Respond with valid JSON only — no markdown fences, no commentary.";

export function buildIdeasPrompt(
  trends: Trend[],
  brandContext = "",
): AIMessage[] {
  const list = trends
    .map((t, i) => `${i + 1}. ${t.title}${t.summary ? ` — ${t.summary}` : ""}`)
    .join("\n");

  return [
    {
      role: "system",
      content:
        "You are a senior social media strategist. You turn today's trends " +
        "into concrete, non-generic content ideas for a marketing team. " +
        (brandContext
          ? `Every idea must be relevant to this brand:\n${brandContext}\n`
          : "") +
        JSON_RULES,
    },
    {
      role: "user",
      content:
        `Today's trends:\n${list}\n\n` +
        "Propose one strong content idea per trend (up to 8). Each idea needs " +
        "a punchy working title (under 120 characters) and an angle explaining " +
        "the hook (under 350 characters). " +
        'JSON shape: {"ideas": [{"trendIndex": number (1-based index of the ' +
        'trend above), "title": string, "angle": string}]}',
    },
  ];
}

/** How organic copy should read on each platform. */
export const PLATFORM_GUIDE: Record<PostPlatform, string> = {
  instagram:
    "Instagram: scroll-stopping first line, conversational, short line breaks, light emoji, under 120 words.",
  facebook:
    "Facebook: relatable and story-led, speaks to the buyer's daily life, clear call to action, minimal emoji, under 150 words.",
  tiktok:
    "TikTok: a short VIDEO concept — a 1-line spoken hook for the first 2 seconds, then 3-4 quick beats (what's shown/said), plus suggested on-screen text. Casual, native, never salesy.",
  youtube:
    "YouTube: a video title (under 70 chars) plus the opening 2-3 lines of the description with the hook and CTA.",
  linkedin:
    "LinkedIn: insight-led, professional, no emoji.",
  x: "X: punchy, under 280 characters.",
};

export function buildPostsPrompt(
  idea: Idea,
  trend: Trend | null,
  brandContext = "",
  platforms: PostPlatform[] = ["instagram", "facebook", "tiktok"],
): AIMessage[] {
  const guide = platforms
    .map((p) => `- ${PLATFORM_GUIDE[p]}`)
    .join("\n");
  const platformList = platforms.map((p) => `"${p}"`).join(" | ");

  return [
    {
      role: "system",
      content:
        "You are a senior social media copywriter writing ORGANIC content — " +
        "native posts that earn attention with value and story, never " +
        "hard-sell ad copy. A soft pointer to the brand at the end is fine; " +
        "no pushy CTAs, no price-led pitches. " +
        (brandContext
          ? `You write as this brand, in its voice:\n${brandContext}\n`
          : "") +
        JSON_RULES,
    },
    {
      role: "user",
      content:
        `Content idea:\n1. ${idea.title}\nAngle: ${idea.angle}\n` +
        (trend ? `Source trend: ${trend.title}\n` : "") +
        `\nWrite one piece of content per platform:\n${guide}\n` +
        `JSON shape: {"posts": [{"platform": ${platformList}, ` +
        '"caption": string, "hashtags": string}]}',
    },
  ];
}

/** Parse a model's JSON answer against a schema, tolerating code fences. */
export function parseAiJson<Schema extends z.ZodTypeAny>(
  schema: Schema,
  text: string,
): z.infer<Schema> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return schema.parse(JSON.parse(cleaned));
}
