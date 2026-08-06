import "server-only";

import { z } from "zod";
import { getAIProvider } from "@/lib/ai/registry";
import { localDate } from "@/lib/db/client";
import {
  buildIdeasPrompt,
  buildPostsPrompt,
  ideasOutputSchema,
  parseAiJson,
  PLATFORM_GUIDE,
  postsOutputSchema,
} from "@/lib/prompts/marketing";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import * as ideasRepo from "@/lib/repositories/ideas.repo";
import * as postImagesRepo from "@/lib/repositories/post-images.repo";
import * as postsRepo from "@/lib/repositories/posts.repo";
import * as trendsRepo from "@/lib/repositories/trends.repo";
import { activePlatforms, formatBrandContext } from "@/lib/services/brand.service";
import { generatePostImages } from "@/lib/services/image.service";
import { fetchPageText } from "@/lib/services/page-fetch";
import type {
  Idea,
  Post,
  PostImageMeta,
  Trend,
} from "@/lib/types/content";

const MAX_IDEAS = 8;
const IDEAS_TO_DRAFT = 5;

/** Model call + parse only — no writes, so callers can sequence safely. */
async function requestIdeas(input: Trend[]) {
  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "ideas.generate",
    messages: buildIdeasPrompt(input, formatBrandContext(getBrandProfile())),
    json: true,
    temperature: 0.8,
  });
  return parseAiJson(ideasOutputSchema, result.text);
}

function toIdeaRows(
  parsed: Awaited<ReturnType<typeof requestIdeas>>,
  input: Trend[],
) {
  return parsed.ideas.slice(0, MAX_IDEAS).map((idea) => ({
    trend_id: input[idea.trendIndex - 1]?.id ?? null,
    title: idea.title,
    angle: idea.angle,
  }));
}

/** Turn today's trends into stored content ideas. */
export async function generateIdeas(
  trends: Trend[],
  day: string,
): Promise<Idea[]> {
  if (trends.length === 0) return [];
  const input = trends.slice(0, MAX_IDEAS);
  const parsed = await requestIdeas(input);
  return ideasRepo.insertIdeas(toIdeaRows(parsed, input), day);
}

const singlePostSchema = z.object({
  caption: z
    .string()
    .min(10)
    .transform((s) => (s.length > 3000 ? `${s.slice(0, 2999)}…` : s)),
  hashtags: z
    .string()
    .default("")
    .transform((s) => s.slice(0, 300)),
});

export type TrendPostResult = {
  post: Post;
  images: PostImageMeta[];
};

/**
 * The trend → publish-ready post pipeline: fetch and read the source
 * article, write an organic post grounded in its actual facts and in the
 * brand's voice, then art-direct an on-brand visual for it.
 */
export async function createPostFromTrend(
  trendId: number,
): Promise<TrendPostResult> {
  const trend = trendsRepo.getTrend(trendId);
  if (!trend) throw new Error("That trend no longer exists.");

  // Deep-read the source article; degrade to the feed summary if blocked.
  const article = trend.url
    ? await fetchPageText(trend.url).catch(() => null)
    : null;

  const profile = getBrandProfile();
  const brandContext = formatBrandContext(profile);
  const platform =
    activePlatforms(profile).find(
      (p) => p !== "tiktok" && p !== "youtube",
    ) ?? "instagram";

  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "post.from_trend",
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a senior social media copywriter writing ORGANIC content " +
          "— native posts that earn attention with value and story, never " +
          "hard-sell ad copy. A soft pointer to the brand at the end is " +
          "fine. " +
          (brandContext
            ? `You write as this brand, in its voice:\n${brandContext}\n`
            : "") +
          "Respond with valid JSON only — no markdown fences, no commentary.",
      },
      {
        role: "user",
        content:
          `Source story: "${trend.title}" (${trend.source_name})\n` +
          (trend.summary ? `Feed summary: ${trend.summary}\n` : "") +
          (article
            ? `\nFull article content:\n"""\n${article.text}\n"""\n`
            : "\n(The article couldn't be fetched — work from the title and summary.)\n") +
          `\nWrite ONE ${platform} post about this story. Ground it in the ` +
          "article's SPECIFIC facts — numbers, findings, quotes — not " +
          "generic takes; connect it to what our audience cares about. " +
          `${PLATFORM_GUIDE[platform]}\n` +
          'JSON shape: {"caption": string, "hashtags": string}',
      },
    ],
  });
  const parsed = parseAiJson(singlePostSchema, result.text);

  const [post] = postsRepo.insertPosts(
    [
      {
        idea_id: null,
        platform,
        kind: "organic",
        caption: parsed.caption,
        hashtags: parsed.hashtags,
      },
    ],
    localDate(),
  );

  // The matching on-brand visual (art-directed, reviewed, organic rules).
  await generatePostImages(post.id, "single").catch(() => {
    // Copy survives an image failure — the card offers regeneration.
  });
  return {
    post,
    images: postImagesRepo.listImagesForPosts([post.id]),
  };
}

/**
 * The idea → publish-ready post pipeline: develop the stored idea (and the
 * trend article it came from, when linked) into an organic post in the
 * brand's voice, then art-direct an on-brand visual for it.
 */
export async function createPostFromIdea(
  ideaId: number,
): Promise<TrendPostResult> {
  const idea = ideasRepo.getIdea(ideaId);
  if (!idea) throw new Error("That idea no longer exists.");

  const trend =
    idea.trend_id !== null ? trendsRepo.getTrend(idea.trend_id) : null;
  const article = trend?.url
    ? await fetchPageText(trend.url).catch(() => null)
    : null;

  const profile = getBrandProfile();
  const brandContext = formatBrandContext(profile);
  const platform =
    activePlatforms(profile).find(
      (p) => p !== "tiktok" && p !== "youtube",
    ) ?? "instagram";

  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "post.from_idea",
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a senior social media copywriter writing ORGANIC content " +
          "— native posts that earn attention with value and story, never " +
          "hard-sell ad copy. A soft pointer to the brand at the end is " +
          "fine. " +
          (brandContext
            ? `You write as this brand, in its voice:\n${brandContext}\n`
            : "") +
          "Respond with valid JSON only — no markdown fences, no commentary.",
      },
      {
        role: "user",
        content:
          `Content idea: "${idea.title}"\nAngle: ${idea.angle}\n` +
          (trend
            ? `\nIt came from this story: "${trend.title}" (${trend.source_name})\n` +
              (trend.summary ? `Feed summary: ${trend.summary}\n` : "")
            : "") +
          (article
            ? `\nFull article content:\n"""\n${article.text}\n"""\n`
            : "") +
          `\nWrite ONE ${platform} post developing this idea along its angle. ` +
          (article
            ? "Ground it in the article's SPECIFIC facts — numbers, findings, quotes — not generic takes; "
            : "") +
          "connect it to what our audience cares about. " +
          `${PLATFORM_GUIDE[platform]}\n` +
          'JSON shape: {"caption": string, "hashtags": string}',
      },
    ],
  });
  const parsed = parseAiJson(singlePostSchema, result.text);

  const [post] = postsRepo.insertPosts(
    [
      {
        idea_id: idea.id,
        platform,
        kind: "organic",
        caption: parsed.caption,
        hashtags: parsed.hashtags,
      },
    ],
    localDate(),
  );
  ideasRepo.markIdeaUsed(idea.id);

  // The matching on-brand visual (art-directed, reviewed, organic rules).
  await generatePostImages(post.id, "single").catch(() => {
    // Copy survives an image failure — the card offers regeneration.
  });
  return {
    post,
    images: postImagesRepo.listImagesForPosts([post.id]),
  };
}

/**
 * Replace a day's ideas and posts. The new ideas are generated and parsed
 * BEFORE the old content is deleted, so a failed model call or bad response
 * leaves the existing brief untouched.
 */
export async function regenerateIdeasAndPosts(
  trends: Trend[],
  day: string,
): Promise<{ ideas: Idea[]; posts: Post[] }> {
  if (trends.length === 0) return { ideas: [], posts: [] };
  const input = trends.slice(0, MAX_IDEAS);
  const parsed = await requestIdeas(input);

  postsRepo.deletePostsForDay(day);
  ideasRepo.deleteIdeasForDay(day);
  const ideas = ideasRepo.insertIdeas(toIdeaRows(parsed, input), day);

  const trendsById = new Map(trends.map((t) => [t.id, t]));
  const posts = await generatePosts(ideas, trendsById, day);
  return { ideas, posts };
}

/** Draft platform posts for the strongest ideas of the day. */
export async function generatePosts(
  ideas: Idea[],
  trendsById: Map<number, Trend>,
  day: string,
): Promise<Post[]> {
  const provider = getAIProvider();
  const profile = getBrandProfile();
  const brandContext = formatBrandContext(profile);
  const platforms = activePlatforms(profile);
  const drafted: Post[] = [];

  for (const idea of ideas.slice(0, IDEAS_TO_DRAFT)) {
    const trend =
      idea.trend_id !== null ? (trendsById.get(idea.trend_id) ?? null) : null;
    const result = await provider.complete({
      purpose: "posts.generate",
      messages: buildPostsPrompt(idea, trend, brandContext, platforms),
      json: true,
      temperature: 0.8,
    });
    const parsed = parseAiJson(postsOutputSchema, result.text);

    const rows = parsed.posts.map((post) => ({
      idea_id: idea.id,
      platform: post.platform,
      caption: post.caption,
      hashtags: post.hashtags,
    }));
    drafted.push(...postsRepo.insertPosts(rows, day));
    ideasRepo.markIdeaUsed(idea.id);
  }

  return drafted;
}
