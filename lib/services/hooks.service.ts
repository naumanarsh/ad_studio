import "server-only";

import { z } from "zod";
import { parseAiJson } from "@/lib/prompts/marketing";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import { getPost, listHooksByStatus } from "@/lib/repositories/posts.repo";
import { callClaude } from "@/lib/services/art-director";
import { assertWithinDailyBudget } from "@/lib/services/budget.service";
import { formatBrandContext } from "@/lib/services/brand.service";
import { POST_PLATFORM_LABELS } from "@/lib/types/content";

const hooksSchema = z.object({
  hooks: z
    .array(
      z.object({
        text: z.string().min(3).transform((s) => s.slice(0, 150)),
        why: z.string().transform((s) => s.slice(0, 120)),
      }),
    )
    .min(1)
    .max(3),
});

export type HookOption = { text: string; why: string };

/**
 * Three alternative hooks (first lines) for a post — the line that decides
 * most of feed performance. The critic is built into the generation rules,
 * and the team's own approved hooks steer the style.
 */
export async function suggestHooks(postId: number): Promise<HookOption[]> {
  assertWithinDailyBudget();
  const post = getPost(postId);
  if (!post) throw new Error("That post no longer exists.");

  const brandContext = formatBrandContext(getBrandProfile());
  const winners = listHooksByStatus("approved", 5);

  const text = await callClaude(
    "copy.hooks",
    [
      {
        type: "text",
        text:
          (brandContext ? `${brandContext}\n\n` : "") +
          `Platform: ${POST_PLATFORM_LABELS[post.platform]}\n\n` +
          `The post (its current first line is the hook being replaced):\n"""\n${post.caption.slice(0, 900)}\n"""\n` +
          (winners.length > 0
            ? `\nHooks from posts this team APPROVED — match their energy and voice, never their literal words:\n${winners.map((w) => `- ${w}`).join("\n")}\n`
            : "") +
          `\nWrite THREE alternative opening hooks for this exact post. Rules (these are the critique — obey all):\n` +
          `- ≤ 100 characters, so nothing truncates before the fold.\n` +
          `- Each takes a DIFFERENT angle (e.g. tension, specificity/number, curiosity) — no rephrasings of each other.\n` +
          `- Must be true to the post body that follows — no promises the post doesn't keep.\n` +
          `- Health compliance: describe the situation, never the reader ("Refills that arrive on time", not "Struggling with your weight?"); no negative self-perception; no competitor drug names; no guaranteed outcomes ("get prescribed", "lose X lbs").\n` +
          `- No emoji unless the brand voice uses them; no clickbait ellipses.\n` +
          `Respond with JSON only: {"hooks": [{"text": "...", "why": "one short line on the angle"}]}`,
      },
    ],
    "You are a senior social copywriter known for scroll-stopping first lines. Respond with valid JSON only.",
  );

  return parseAiJson(hooksSchema, text).hooks;
}
