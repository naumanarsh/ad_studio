import "server-only";

import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { getAIProvider } from "@/lib/ai/registry";
import { parseAiJson } from "@/lib/prompts/marketing";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import * as competitorsRepo from "@/lib/repositories/competitors.repo";
import * as ideasRepo from "@/lib/repositories/ideas.repo";
import { localDate } from "@/lib/db/client";
import { formatBrandContext } from "@/lib/services/brand.service";
import { generatePosts } from "@/lib/services/generation.service";
import { fetchPageText } from "@/lib/services/page-fetch";
import type { Competitor, CompetitorTopic, Idea, Post } from "@/lib/types/content";

const clamp = (max: number) => z.string().transform((s) => s.slice(0, max));

const competitorAnalysisSchema = z.object({
  summary: clamp(900),
  topics: z
    .array(z.object({ topic: clamp(160), angle: clamp(320) }))
    .min(1)
    .transform((topics) => topics.slice(0, 8)),
});

/** Recent news headlines mentioning the competitor — best effort. */
async function fetchNewsHeadlines(query: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`,
      {
        headers: { "user-agent": "Mozilla/5.0 (compatible; ad-studio/0.1)" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const parsed = new XMLParser().parse(await response.text()) as {
      rss?: { channel?: { item?: Array<{ title?: string; description?: string }> } };
    };
    const items = parsed.rss?.channel?.item ?? [];
    return (Array.isArray(items) ? items : [items])
      .slice(0, 8)
      .map((i) => `${i.title ?? ""} — ${i.description ?? ""}`.slice(0, 240));
  } catch {
    return [];
  }
}

/**
 * Fetch a competitor's site + recent news and distill how they market:
 * positioning, and the concrete topics/angles they push.
 */
export async function analyzeCompetitor(id: number): Promise<Competitor> {
  const competitor = competitorsRepo.getCompetitor(id);
  if (!competitor) throw new Error("That competitor no longer exists.");

  // Many brand sites block server fetches — degrade to news-only analysis.
  const [pageResult, headlines] = await Promise.all([
    fetchPageText(competitor.website).catch(() => null),
    fetchNewsHeadlines(competitor.name),
  ]);
  if (!pageResult && headlines.length === 0) {
    throw new Error(
      `${competitor.name}'s site blocks automated access and no recent news was found — nothing to analyze.`,
    );
  }
  const page = pageResult ?? { url: competitor.website, title: "", text: "" };

  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "competitor.analyze",
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a competitive marketing analyst. From a competitor's " +
          "website and recent news, extract how they market: their " +
          "positioning and the specific content topics and angles they use. " +
          "Be concrete — name their actual offers, claims and hooks. " +
          "Respond with valid JSON only.",
      },
      {
        role: "user",
        content:
          `Competitor: ${competitor.name} (${competitor.website})\n` +
          (page.text
            ? `Site title: ${page.title}\n\nSite content:\n"""\n${page.text}\n"""\n\n`
            : "Their site blocks automated access — analyze from the news mentions below and what you know of this company.\n\n") +
          (headlines.length > 0
            ? `Recent news mentions:\n${headlines.map((h) => `- ${h}`).join("\n")}\n\n`
            : "") +
          "Return JSON: {\"summary\": \"their positioning, offers and marketing style, 3-5 sentences\", " +
          "\"topics\": [{\"topic\": \"a content/ad topic they push\", \"angle\": \"the specific hook or claim they use for it\"}] (4-8 topics)}",
      },
    ],
  });

  const parsed = parseAiJson(competitorAnalysisSchema, result.text);
  const saved = competitorsRepo.saveAnalysis(
    id,
    parsed.summary,
    JSON.stringify(parsed.topics),
  );
  if (!saved) throw new Error("That competitor no longer exists.");
  return saved;
}

const remixIdeaSchema = z.object({
  title: clamp(160),
  angle: clamp(400),
});

/**
 * Take a topic a competitor is running and produce OUR version of it —
 * reframed for our brand and audience, never copied — then draft posts
 * for it immediately.
 */
export async function remixCompetitorTopic(
  competitorId: number,
  topicIndex: number,
): Promise<{ idea: Idea; posts: Post[] }> {
  const competitor = competitorsRepo.getCompetitor(competitorId);
  if (!competitor) throw new Error("That competitor no longer exists.");

  const topics = JSON.parse(competitor.topics_json) as CompetitorTopic[];
  const topic = topics[topicIndex];
  if (!topic) throw new Error("That topic no longer exists — re-analyze.");

  const brandContext = formatBrandContext(getBrandProfile());
  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "competitor.remix",
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a senior content strategist. A competitor runs a content " +
          "topic; create OUR brand's take on the same territory — a fresh " +
          "angle that fits our voice and audience, and ideally one-ups their " +
          "framing. Never copy their wording. " +
          (brandContext ? `Our brand:\n${brandContext}\n` : "") +
          "Respond with valid JSON only.",
      },
      {
        role: "user",
        content:
          `Competitor ${competitor.name} runs this topic:\n` +
          `Topic: ${topic.topic}\nTheir angle: ${topic.angle}\n\n` +
          "Create our version. JSON: {\"title\": \"punchy working title, under 120 chars\", " +
          "\"angle\": \"our hook and why it beats theirs, under 350 chars\"}",
      },
    ],
  });

  const parsed = parseAiJson(remixIdeaSchema, result.text);
  const day = localDate();
  const [idea] = ideasRepo.insertIdeas(
    [{ trend_id: null, title: parsed.title, angle: parsed.angle }],
    day,
  );
  const posts = await generatePosts([idea], new Map(), day);
  return { idea, posts };
}
