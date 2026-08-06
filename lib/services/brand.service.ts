import "server-only";

import { z } from "zod";
import { getAIProvider } from "@/lib/ai/registry";
import { parseAiJson } from "@/lib/prompts/marketing";
import * as brandRepo from "@/lib/repositories/brand.repo";
import { fetchPageText } from "@/lib/services/page-fetch";
import {
  POST_PLATFORMS,
  type BrandProfile,
  type PostPlatform,
} from "@/lib/types/content";

const brandAnalysisSchema = z.object({
  company: z.string().transform((s) => s.slice(0, 120)),
  description: z.string().transform((s) => s.slice(0, 600)),
  audience: z.string().transform((s) => s.slice(0, 400)),
  tone: z.string().transform((s) => s.slice(0, 400)),
  colors: z.string().transform((s) => s.slice(0, 200)),
  image_style: z.string().transform((s) => s.slice(0, 400)),
  notes: z.string().transform((s) => s.slice(0, 600)),
});

/** Fetch the brand's website and distill it into a reusable profile. */
export async function analyzeBrandWebsite(
  website: string,
): Promise<BrandProfile> {
  const page = await fetchPageText(website);

  const provider = getAIProvider();
  const result = await provider.complete({
    purpose: "brand.analyze",
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You are a brand strategist. You distill a company's website into " +
          "a compact brand profile that will be injected into every ad-copy " +
          "and ad-image prompt this company generates. Be specific to THIS " +
          "company — no generic filler. Respond with valid JSON only.",
      },
      {
        role: "user",
        content:
          `Website: ${page.url}\nPage title: ${page.title}\n\n` +
          `Page content:\n"""\n${page.text}\n"""\n\n` +
          "Produce the brand profile as JSON with exactly these string fields:\n" +
          '{"company": "official name", ' +
          '"description": "what they sell and the concrete value, 2-3 sentences", ' +
          '"audience": "who buys, their situation and motivation", ' +
          '"tone": "voice for social copy: 3-5 adjectives plus a sentence on style", ' +
          '"colors": "brand palette as css hex codes if inferable, else best guess with names", ' +
          '"image_style": "art direction for ad images that fits this brand", ' +
          '"notes": "compliance or positioning cautions for ads in this industry"}',
      },
    ],
  });

  const parsed = parseAiJson(brandAnalysisSchema, result.text);
  const existing = brandRepo.getBrandProfile();
  return brandRepo.saveBrandProfile({
    ...parsed,
    website: page.url,
    platforms: existing?.platforms ?? "instagram, facebook, tiktok",
  });
}

/** The brand's active ad platforms, parsed and validated. */
export function activePlatforms(
  profile: BrandProfile | null,
): PostPlatform[] {
  const raw = profile?.platforms ?? "";
  const parsed = raw
    .split(/[,\s]+/)
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is PostPlatform =>
      (POST_PLATFORMS as readonly string[]).includes(p),
    );
  return parsed.length > 0 ? parsed : ["instagram", "facebook", "tiktok"];
}

/** Compact prompt block describing the brand — "" when no profile yet. */
export function formatBrandContext(profile: BrandProfile | null): string {
  if (!profile || !profile.company) return "";
  const lines = [
    `Brand: ${profile.company} (${profile.website})`,
    profile.description && `What they offer: ${profile.description}`,
    profile.audience && `Audience: ${profile.audience}`,
    profile.tone && `Voice: ${profile.tone}`,
    profile.notes && `Cautions: ${profile.notes}`,
  ].filter(Boolean);
  return lines.join("\n");
}
