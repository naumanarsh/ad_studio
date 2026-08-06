import "server-only";

import { z } from "zod";
import { getAIProvider } from "@/lib/ai/registry";
import { parseAiJson } from "@/lib/prompts/marketing";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import * as postsRepo from "@/lib/repositories/posts.repo";
import { localDate } from "@/lib/db/client";
import { activePlatforms, formatBrandContext } from "@/lib/services/brand.service";
import { assertWithinDailyBudget } from "@/lib/services/budget.service";
import { generatePostImages } from "@/lib/services/image.service";
import { POST_PLATFORMS, type Post, type PostPlatform } from "@/lib/types/content";

const clampText = (max: number) =>
  z.string().transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s));

const adsOutputSchema = z.object({
  ads: z
    .array(
      z.object({
        platform: z.enum(POST_PLATFORMS),
        caption: clampText(3000),
        hashtags: z
          .string()
          .default("")
          .transform((s) => s.slice(0, 300)),
      }),
    )
    .min(1)
    .transform((ads) => ads.slice(0, 8)),
});

/** How paid ad copy differs per platform. */
const AD_PLATFORM_GUIDE: Record<PostPlatform, string> = {
  instagram:
    "Instagram ad: first line is the headline hook (under 60 chars), then 40-90 words of primary text driving to the offer, direct CTA at the end.",
  facebook:
    "Facebook ad: first line is the headline hook, then 60-120 words of primary text — problem, offer, proof, CTA.",
  tiktok:
    "TikTok ad: a short paid VIDEO ad script — spoken hook (first 2s), 3-4 beats showing problem → offer → proof, end-card CTA text.",
  youtube:
    "YouTube ad: a 15-30s video ad script — hook in first 5s, offer, CTA, plus the video title.",
  linkedin: "LinkedIn ad: professional, insight-then-offer, clear CTA.",
  x: "X ad: punchy, under 280 characters, direct offer + CTA.",
};

export type AdCampaign = {
  ads: Post[];
  imagesGenerated: number;
};

/**
 * Generate a complete paid campaign for what the user wants to promote:
 * offer-led copy per platform, then the ad creative for each image
 * platform (video platforms get scripts, not stills). Independent of the
 * daily trend pipeline.
 */
export async function generateAds(
  promo: string,
  imageModel?: string | null,
): Promise<AdCampaign> {
  assertWithinDailyBudget();
  const profile = getBrandProfile();
  const brandContext = formatBrandContext(profile);
  const platforms = activePlatforms(profile);
  const guide = platforms.map((p) => `- ${AD_PLATFORM_GUIDE[p]}`).join("\n");
  const platformList = platforms.map((p) => `"${p}"`).join(" | ");

  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "ads.generate",
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a senior performance-marketing copywriter. You write " +
          "paid ad copy that converts: concrete offer, sharp hook, zero " +
          "fluff, honest claims only. " +
          (brandContext
            ? `You write for this brand:\n${brandContext}\n`
            : "") +
          "Respond with valid JSON only — no markdown fences, no commentary.",
      },
      {
        role: "user",
        content:
          `What to promote:\n"""\n${promo.slice(0, 800)}\n"""\n\n` +
          `Write one ad per platform:\n${guide}\n` +
          `JSON shape: {"ads": [{"platform": ${platformList}, ` +
          '"caption": string (headline hook as the first line), "hashtags": string}]}',
      },
    ],
  });

  const parsed = parseAiJson(adsOutputSchema, result.text);
  const ads = postsRepo.insertPosts(
    parsed.ads.map((ad) => ({
      idea_id: null,
      platform: ad.platform,
      kind: "ad" as const,
      caption: ad.caption,
      hashtags: ad.hashtags,
    })),
    localDate(),
  );

  // An ad isn't done without its creative — render them now, in parallel.
  // Video platforms keep scripts only; per-ad failures never sink the copy.
  const imageAds = ads.filter(
    (ad) => ad.platform !== "tiktok" && ad.platform !== "youtube",
  );
  const rendered = await Promise.allSettled(
    imageAds.map((ad) => generatePostImages(ad.id, "single", imageModel)),
  );
  const imagesGenerated = rendered.filter(
    (r) => r.status === "fulfilled",
  ).length;

  return { ads, imagesGenerated };
}
