import "server-only";

import { XMLParser } from "fast-xml-parser";
import { listTopics } from "@/lib/repositories/topics.repo";
import type { NewTrend } from "@/lib/repositories/trends.repo";
import type { TrendCategory } from "@/lib/types/content";

const FETCH_TIMEOUT_MS = 8000;
const ITEMS_PER_SOURCE = 6;

type FeedFormat = "rss" | "atom" | "mastodon";

type FeedSource = {
  source: NewTrend["source"];
  category: TrendCategory;
  format: FeedFormat;
  name: string;
  url: string;
  /** Set for keyword feeds — carried onto every trend from this feed. */
  topic: string | null;
  /** Host 429s concurrent requests (Reddit) — fetched serially, spaced out. */
  rateLimited?: boolean;
};

const RATE_LIMIT_SPACING_MS = 5000;
const RETRY_AFTER_429_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generic marketing sources — used only when no research topics are
// configured, so a fresh install still produces a brief.
const DEFAULT_SOURCES: FeedSource[] = [
  {
    source: "google_trends",
    category: "search",
    format: "rss",
    name: "Google Trends (US)",
    url: "https://trends.google.com/trending/rss?geo=US",
    topic: null,
  },
  {
    source: "rss",
    category: "news",
    format: "rss",
    name: "Marketing Dive",
    url: "https://www.marketingdive.com/feeds/news/",
    topic: null,
  },
  {
    source: "rss",
    category: "news",
    format: "rss",
    name: "Social Media Today",
    url: "https://www.socialmediatoday.com/feeds/news/",
    topic: null,
  },
];

/**
 * Each topic fans out to one feed per medium:
 * - Bing News RSS — unlike Google News search it carries images, clean
 *   summaries and resolvable article URLs.
 * - Reddit keyword search (Atom), hot posts from the last week.
 * - Mastodon public hashtag timeline (JSON, no auth) — spaces stripped
 *   since hashtags have none.
 * X and Meta expose no free search/trends APIs, so they are absent.
 */
function topicFeeds(tag: string): FeedSource[] {
  const feeds: FeedSource[] = [
    {
      source: "rss",
      category: "news",
      format: "rss",
      name: "News search",
      url: `https://www.bing.com/news/search?q=${encodeURIComponent(tag)}&format=RSS`,
      topic: tag,
    },
    {
      source: "rss",
      category: "social",
      format: "atom",
      name: "Reddit",
      url: `https://www.reddit.com/search.rss?q=${encodeURIComponent(tag)}&sort=hot&t=week`,
      topic: tag,
      rateLimited: true,
    },
  ];
  const hashtag = tag.replace(/[^\p{L}\p{N}]/gu, "");
  if (hashtag) {
    feeds.push({
      source: "rss",
      category: "social",
      format: "mastodon",
      name: "Mastodon",
      url: `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(hashtag)}?limit=20`,
      topic: tag,
    });
  }
  return feeds;
}

const SAMPLE_TRENDS: Array<Pick<NewTrend, "title" | "summary">> = [
  { title: "Short-form video keeps outperforming static posts", summary: "Platforms continue to weight reels and shorts above image posts in reach." },
  { title: "AI-assisted content workflows go mainstream", summary: "Marketing teams adopt AI drafting with human review as the default process." },
  { title: "Community-led growth over paid acquisition", summary: "Brands shift budget from ads to owned communities and newsletters." },
  { title: "UGC and creator partnerships beat studio content", summary: "Authentic creator content outperforms polished brand campaigns on engagement." },
  { title: "Zero-click content on social platforms", summary: "Posts that deliver full value in-feed outperform link-out strategies." },
];

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    });
}

/** Unwrap fast-xml-parser nodes: with attributes on, text lives in "#text". */
function textOf(value: unknown): unknown {
  if (value && typeof value === "object" && "#text" in value) {
    return (value as Record<string, unknown>)["#text"];
  }
  return value;
}

function cleanText(value: unknown, maxLength: number): string | null {
  const raw = textOf(value);
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const text = decodeEntities(String(raw).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanUrl(value: unknown): string | null {
  const raw = textOf(value);
  if (typeof raw !== "string") return null;
  const url = decodeEntities(raw.trim());
  return /^https?:\/\//.test(url) ? url.slice(0, 500) : null;
}

/** Bing item links go through apiclick.aspx; the real article URL is inside. */
function resolveArticleUrl(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.pathname.includes("apiclick")) {
      const target = url.searchParams.get("url");
      if (target && /^https?:\/\//.test(target)) return target.slice(0, 500);
    }
  } catch {
    return link;
  }
  return link;
}

/**
 * Best image for an item, across the dialects our sources use:
 * Bing `News:Image`, Google Trends `ht:picture`, MRSS `media:content` /
 * `media:thumbnail`, RSS `enclosure`, or the first <img> in the body HTML.
 */
function extractImage(item: Record<string, unknown>): string | null {
  const direct =
    cleanUrl(item["News:Image"]) ?? cleanUrl(item["ht:picture"]);
  if (direct) return direct.replace(/^http:\/\//, "https://");

  const mediaContents = toArray(item["media:content"]).concat(
    toArray(item["media:thumbnail"]),
  ) as Array<Record<string, unknown> | undefined>;
  for (const media of mediaContents) {
    const url = cleanUrl(media?.["@_url"]);
    if (url) return url;
  }

  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  const enclosureType = enclosure?.["@_type"];
  if (typeof enclosureType !== "string" || enclosureType.startsWith("image/")) {
    const url = cleanUrl(enclosure?.["@_url"]);
    if (url) return url;
  }

  for (const key of ["description", "content"]) {
    const body = textOf(item[key]);
    if (typeof body === "string") {
      const match = body.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match) return cleanUrl(decodeEntities(match[1]));
    }
  }
  return null;
}

function parseRssItems(
  feed: FeedSource,
  xml: string,
): Array<NewTrend | null> {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  }).parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const items = toArray(parsed.rss?.channel?.item) as Array<
    Record<string, unknown>
  >;

  return items.map((item): NewTrend | null => {
    const title = cleanText(item.title, 200);
    if (!title) return null;
    // Per-item publication (Bing's News:Source) beats the feed label.
    const sourceName = cleanText(item["News:Source"], 60) ?? feed.name;
    return {
      source: feed.source,
      source_name: sourceName,
      title,
      url: resolveArticleUrl(cleanUrl(item.link)),
      summary: cleanText(item.description, 280),
      image_url: extractImage(item),
      topic: feed.topic,
      category: feed.category,
      published_at: cleanText(item.pubDate, 60),
    };
  });
}

/** Reddit's search feed is Atom: <feed><entry> with href links. */
function parseAtomItems(
  feed: FeedSource,
  xml: string,
): Array<NewTrend | null> {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  }).parse(xml) as { feed?: { entry?: unknown } };
  const entries = toArray(parsed.feed?.entry) as Array<
    Record<string, unknown>
  >;

  return entries.map((entry): NewTrend | null => {
    const title = cleanText(entry.title, 200);
    if (!title) return null;
    const link = toArray(entry.link)[0] as
      | Record<string, unknown>
      | undefined;
    const subreddit = (entry.category as Record<string, unknown> | undefined)?.[
      "@_label"
    ];
    return {
      source: feed.source,
      source_name:
        typeof subreddit === "string" && subreddit.trim()
          ? subreddit.trim().slice(0, 60)
          : feed.name,
      title,
      url: cleanUrl(link?.["@_href"]),
      summary: cleanText(entry.content, 280),
      image_url: extractImage(entry),
      topic: feed.topic,
      category: feed.category,
      published_at: cleanText(entry.updated, 60),
    };
  });
}

type MastodonStatus = {
  content?: string;
  url?: string;
  created_at?: string;
  favourites_count?: number;
  reblogs_count?: number;
  account?: { display_name?: string; acct?: string };
  media_attachments?: Array<{ type?: string; preview_url?: string }>;
};

/** Public hashtag timeline — ranked here by engagement, not recency. */
function parseMastodonItems(
  feed: FeedSource,
  body: string,
): Array<NewTrend | null> {
  const statuses = JSON.parse(body) as MastodonStatus[];
  if (!Array.isArray(statuses)) return [];

  return statuses
    .map((status) => ({
      status,
      engagement:
        (status.favourites_count ?? 0) + (status.reblogs_count ?? 0),
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .map(({ status }): NewTrend | null => {
      const title = cleanText(status.content, 160);
      if (!title) return null;
      const author =
        status.account?.display_name?.trim() || status.account?.acct?.trim();
      const image = status.media_attachments?.find(
        (m) => m.type === "image" && m.preview_url,
      );
      return {
        source: feed.source,
        source_name: author ? `${feed.name} · ${author}`.slice(0, 60) : feed.name,
        title,
        url: cleanUrl(status.url),
        summary: cleanText(status.content, 280),
        image_url: cleanUrl(image?.preview_url),
        topic: feed.topic,
        category: feed.category,
        published_at: cleanText(status.created_at, 60),
      };
    });
}

const PARSERS: Record<
  FeedFormat,
  (feed: FeedSource, body: string) => Array<NewTrend | null>
> = {
  rss: parseRssItems,
  atom: parseAtomItems,
  mastodon: parseMastodonItems,
};

async function fetchFeed(feed: FeedSource, attempt = 0): Promise<NewTrend[]> {
  const response = await fetch(feed.url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ad-studio/0.1)",
      accept:
        feed.format === "mastodon" ? "application/json" : "application/xml, text/xml, */*",
    },
    cache: "no-store",
  });
  if (response.status === 429 && attempt === 0) {
    await sleep(RETRY_AFTER_429_MS);
    return fetchFeed(feed, 1);
  }
  if (!response.ok) {
    throw new Error(`${feed.name}: HTTP ${response.status}`);
  }

  const body = await response.text();
  return PARSERS[feed.format](feed, body)
    .filter((t): t is NewTrend => t !== null)
    .slice(0, ITEMS_PER_SOURCE);
}

/** Canonical URL for duplicate detection: no hash, no tracking params. */
function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mkt_tok|ref$)/i.test(key)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Case/punctuation-insensitive title key for duplicate detection. */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Drop same-story duplicates within a run — the same article matched by
 * two topics, or the same story surfacing on several feeds. First
 * occurrence wins; sources are ordered news-first, so the richest
 * version (image, publication name) is the one kept.
 */
function dedupeTrends(trends: NewTrend[]): NewTrend[] {
  const seen = new Set<string>();
  const unique: NewTrend[] = [];
  for (const trend of trends) {
    const keys = [`t:${titleKey(trend.title)}`];
    if (trend.url) keys.push(`u:${normalizeUrlKey(trend.url)}`);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    unique.push(trend);
  }
  return unique;
}

export type ResearchResult = {
  trends: NewTrend[];
  /** Sources that failed this run (shown to the user, never fatal). */
  failedSources: string[];
  usedSampleData: boolean;
};

/**
 * Pull today's trends; degrade per-source, never throw.
 * With research topics configured, each topic fans out to news and social
 * keyword feeds — trends stay on-industry. Without topics, generic
 * marketing feeds keep the pipeline alive.
 */
export async function collectTrends(): Promise<ResearchResult> {
  const topics = listTopics();
  const sources =
    topics.length > 0
      ? topics.flatMap((t) => topicFeeds(t.tag))
      : DEFAULT_SOURCES;

  type Settled = { source: FeedSource; trends: NewTrend[] | null };
  const settle = async (source: FeedSource): Promise<Settled> => {
    try {
      return { source, trends: await fetchFeed(source) };
    } catch {
      return { source, trends: null };
    }
  };

  // Rate-limited hosts get one spaced-out request at a time; the rest
  // run concurrently alongside them.
  const parallel = sources.filter((s) => !s.rateLimited);
  const serial = sources.filter((s) => s.rateLimited);
  const [parallelResults, serialResults] = await Promise.all([
    Promise.all(parallel.map(settle)),
    (async () => {
      const out: Settled[] = [];
      for (const [i, source] of serial.entries()) {
        if (i > 0) await sleep(RATE_LIMIT_SPACING_MS);
        out.push(await settle(source));
      }
      return out;
    })(),
  ]);

  const trends: NewTrend[] = [];
  const failedSources: string[] = [];
  for (const { source, trends: fetched } of [
    ...parallelResults,
    ...serialResults,
  ]) {
    if (fetched) {
      trends.push(...fetched);
    } else {
      failedSources.push(
        source.topic ? `${source.name} · ${source.topic}` : source.name,
      );
    }
  }

  if (trends.length > 0) {
    return {
      trends: dedupeTrends(trends),
      failedSources,
      usedSampleData: false,
    };
  }

  // Fully offline: fall back to bundled samples so the pipeline still runs.
  return {
    trends: SAMPLE_TRENDS.map((t) => ({
      source: "sample",
      source_name: "Sample data",
      title: t.title,
      summary: t.summary ?? null,
      url: null,
      image_url: null,
      topic: null,
      category: "news",
      published_at: null,
    })),
    failedSources,
    usedSampleData: true,
  };
}
