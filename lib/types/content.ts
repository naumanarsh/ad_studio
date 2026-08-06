export const TREND_SOURCES = ["google_trends", "rss", "sample"] as const;
export type TrendSource = (typeof TREND_SOURCES)[number];

export const TREND_CATEGORIES = ["news", "social", "search"] as const;
export type TrendCategory = (typeof TREND_CATEGORIES)[number];

export const TREND_CATEGORY_LABELS: Record<TrendCategory, string> = {
  news: "News",
  social: "Social",
  search: "Search trends",
};

export const IDEA_STATUSES = ["new", "used", "dismissed"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const POST_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "linkedin",
  "x",
] as const;
export type PostPlatform = (typeof POST_PLATFORMS)[number];

export const POST_STATUSES = ["pending", "approved", "rejected"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_KINDS = ["organic", "ad"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const POST_PLATFORM_LABELS: Record<PostPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

export type Trend = {
  id: number;
  source: TrendSource;
  source_name: string;
  title: string;
  url: string | null;
  summary: string | null;
  image_url: string | null;
  /** Research topic tag this trend was found for, null for default feeds. */
  topic: string | null;
  category: TrendCategory;
  published_at: string | null;
  fetched_on: string;
  created_at: string;
};

export type ResearchTopic = {
  id: number;
  tag: string;
  created_at: string;
};

export type Idea = {
  id: number;
  trend_id: number | null;
  title: string;
  angle: string;
  status: IdeaStatus;
  created_on: string;
  created_at: string;
};

export type Post = {
  id: number;
  idea_id: number | null;
  platform: PostPlatform;
  kind: PostKind;
  caption: string;
  hashtags: string;
  status: PostStatus;
  created_on: string;
  created_at: string;
  updated_at: string;
};

/** Image metadata sent to the UI — bytes are served via /api/images/[id]. */
export type PostImageMeta = {
  id: number;
  post_id: number;
  variant: string;
  selected: number;
  created_at: string;
};

export type AiRequestLog = {
  id: number;
  provider: string;
  model: string;
  purpose: string;
  prompt: string;
  response: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  error: string | null;
  created_at: string;
};

export type BrandProfile = {
  id: number;
  company: string;
  website: string;
  description: string;
  audience: string;
  tone: string;
  colors: string;
  image_style: string;
  notes: string;
  /** Comma-separated active ad platforms, e.g. "instagram, facebook, tiktok". */
  platforms: string;
  updated_at: string;
};

export type CompetitorTopic = {
  topic: string;
  angle: string;
};

export type Competitor = {
  id: number;
  name: string;
  website: string;
  analysis: string;
  topics_json: string;
  analyzed_at: string | null;
  created_at: string;
};

/** Summary returned by a morning-brief run. */
export type BriefSummary = {
  date: string;
  trends: number;
  ideas: number;
  posts: number;
};
