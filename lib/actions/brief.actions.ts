"use server";

import { revalidatePath } from "next/cache";
import { toUserMessage } from "@/lib/services/errors";
import { regenerateBrief, runMorningBrief } from "@/lib/services/brief.service";
import { fail, ok, type ActionResult } from "@/lib/types/result";
import type { BriefSummary } from "@/lib/types/content";

export async function runMorningBriefAction(): Promise<
  ActionResult<BriefSummary>
> {
  try {
    const summary = await runMorningBrief();
    revalidatePath("/dashboard");
    return ok(summary);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}

/** Discard today's ideas and drafts, rewrite them from the current trends. */
export async function regenerateBriefAction(): Promise<
  ActionResult<BriefSummary>
> {
  try {
    const summary = await regenerateBrief();
    revalidatePath("/dashboard");
    return ok(summary);
  } catch (error) {
    return fail(toUserMessage(error));
  }
}
