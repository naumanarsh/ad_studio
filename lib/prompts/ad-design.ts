import type { PostKind, PostPlatform } from "@/lib/types/content";

/**
 * The house design brief for every generated ad image. Encodes (a) the
 * #1 failure-mode guard — models typesetting the whole caption into an
 * article-like infographic — and (b) researched 2026 Meta health-ad rules:
 * no before/after bodies, no negative self-perception framing, no
 * competitor drug names, situation-not-person copy.
 */
export const AD_DESIGN_BRIEF = `Design a modern, premium social-media ad — the quality of a top DTC health brand's paid creative: calm palette, soft natural light, direct but kind copy that names the problem without shaming anyone.
Hard rules:
- This is an AD, not an infographic or article. Typeset at most: ONE short hook line (7 words or fewer) as the only large text, optionally one small supporting line, and one small CTA pill or price tag. NEVER paragraphs, icon grids, feature rows, or competing text blocks. (A structured list is allowed ONLY when the chosen style template explicitly calls for one.)
- One clear focal subject and ONE proof point (a price, a quote, or a single stat) — not several. Generous negative space. Instantly readable on a phone at feed size: large type, strong contrast between text and background.
- Modern typography: clean geometric sans-serif, consistent weights, professional alignment. Every text line complete and correctly spelled — never truncated, never ending in an ellipsis.
- Simple, uncluttered backgrounds from the brand palette. Photography (when used): soft natural light, real-feeling everyday people in their 30s–50s, aspirational but authentic — no sterile stock-photo gloss.
- Health-ad compliance (non-negotiable, Meta rejects violations): NO before/after body comparisons or transformation imagery. NO body-flaw visuals — no pinched fat, scales, tape measures, shrinking-body devices — and no framing that provokes negative self-perception. Describe the situation, never the viewer ("Refills that arrive on time", not "Struggling with your weight?"). NO competitor drug brand names, packaging, or logos. No needles piercing skin.
- No emoji in typeset text, no watermarks, no invented certification badges or award seals, no functional-looking OS chrome (fake close buttons, fake play buttons).`;

/**
 * The counterpart for ORGANIC posts: visuals that read as native feed
 * content, never as a paid ad unit.
 */
export const ORGANIC_VISUAL_BRIEF = `Design a scroll-worthy ORGANIC social media visual — it must look like great native content from a brand's feed, NOT a paid advertisement.
Hard rules:
- No CTA buttons, no price tags, no offer badges, no promo frames — nothing that reads as an ad unit.
- Text in the image: at most ONE short overlay line (7 words or fewer), or no text at all. Never paragraphs, lists, or feature grids.
- One clear focal subject; authentic, editorial, feed-native aesthetic that would earn a pause even from someone who doesn't know the brand.
- Brand presence stays subtle: brand color accents or a small logo at most.
- Photography (when used): natural light, candid, real-feeling. No sterile stock-photo look.
- Health-content rules: NO before/after body comparisons; no body-flaw imagery (scales, tape measures, pinched fat) or negative self-perception framing; frame situations, never the viewer's body; no competitor drug brand names or packaging.
- No emoji in typeset text. Every text line complete — never truncated or ending in an ellipsis.
- No watermarks, no other brands' logos.`;

/** The right visual rules for a piece of content. */
export function designBriefFor(kind: PostKind): string {
  return kind === "ad" ? AD_DESIGN_BRIEF : ORGANIC_VISUAL_BRIEF;
}

/** Output format per platform. */
export const PLATFORM_ASPECT: Record<PostPlatform, string> = {
  instagram: "4:5 vertical (Instagram feed)",
  facebook: "4:5 vertical (Facebook feed)",
  tiktok: "9:16 vertical full-screen (TikTok)",
  youtube: "16:9 horizontal (YouTube thumbnail)",
  linkedin: "1:1 square (LinkedIn feed)",
  x: "16:9 horizontal (X timeline)",
};

/** The aspect code passed to image-model APIs (enforced, not prose). */
export const PLATFORM_ASPECT_CODE: Record<PostPlatform, string> = {
  instagram: "4:5",
  facebook: "4:5",
  tiktok: "9:16",
  youtube: "16:9",
  linkedin: "1:1",
  x: "16:9",
};

export type StyleTemplate = {
  key: string;
  label: string;
  brief: string;
  /**
   * The image model that suits this archetype best: "openai" (GPT Image)
   * for typography-heavy layouts, "gemini" (Nano Banana) for
   * photography-led ones. The Creator auto-suggests it.
   */
  recommendedModel: "gemini" | "openai";
};

/**
 * Research-backed static-ad archetypes (2026 Meta/DTC-health data: statics
 * drive 60–70% of conversions; problem→solution, testimonial, comparison,
 * offer-stack and feed-native "non-ad" formats lead). Before/after split
 * layouts are deliberately absent — Meta bans them for weight-loss ads.
 * The first four double as the "variants" spread.
 */
export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    key: "hook-photo",
    recommendedModel: "gemini",
    label: "Photo + hook",
    brief:
      "Full-bleed lifestyle photograph of a calm everyday moment in soft natural light, the hook line overlaid in bold high-contrast type, and a small CTA pill in a lower corner.",
  },
  {
    key: "product-hero",
    recommendedModel: "gemini",
    label: "Product hero",
    brief:
      "Minimal product hero: the product centered on a solid soft brand-color background with one natural shadow, hook line above, small CTA below. Category-leader minimalism — nothing else on the canvas.",
  },
  {
    key: "problem-solution",
    recommendedModel: "gemini",
    label: "Problem → solution",
    brief:
      "Problem-to-solution layout: the top names an everyday friction in one short line (frame the situation — waiting rooms, pharmacy lines, confusing pricing — never the viewer's body), the lower two-thirds shows the calm resolution scene with the product or service, plus a small CTA. Visual mood shifts from muted to warm.",
  },
  {
    key: "us-vs-old",
    recommendedModel: "openai",
    label: "Old way vs new",
    brief:
      'Two-column comparison card: "The old way" vs the brand\'s way, maximum 3 tiny rows per column (3–4 words each — this template may use its structured list). The old way stays generic (waiting rooms, opaque pricing) — never a named competitor. Hook line across the top, CTA pill below.',
  },
  {
    key: "benefit-stack",
    recommendedModel: "openai",
    label: "Offer stack",
    brief:
      "Offer stack card: flat brand-color background, the price or offer as the largest element, up to 3 short check-marked benefit lines (3–4 words each — this template may use its structured list), one CTA button. High contrast, retargeting-grade clarity.",
  },
  {
    key: "testimonial",
    recommendedModel: "openai",
    label: "Testimonial",
    brief:
      'Testimonial card: one short, real-sounding customer quote in large type with quotation marks, a 5-star row, first name + age, on a soft brand-tinted background. Include tiny "Results vary" microtext near the quote.',
  },
  {
    key: "notes-native",
    recommendedModel: "openai",
    label: "Notes app",
    brief:
      "Feed-native \"doesn't look like an ad\" format: styled like a personal phone note — plain pale background, casual sans-serif text, a short conversational thought or tiny list in the writer's own words, zero ad polish, no logos beyond a small wordmark. Stylized only — no functional-looking OS buttons or chrome. The scroll-stopper is that it reads as a real person's note.",
  },
  {
    key: "ugc",
    recommendedModel: "gemini",
    label: "UGC style",
    brief:
      "Casual creator-content style: looks like a candid phone photo — natural imperfect framing, everyday setting, real-feeling person — with one short caption-style text sticker. Native to the feed, not an obvious ad.",
  },
];

/** The one large text line allowed in the image — from a caption. */
export function extractHook(caption: string): string {
  const firstLine =
    caption
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}
