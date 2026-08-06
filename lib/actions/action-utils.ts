import "server-only";

import type { z } from "zod";
import { fail, type ActionResult } from "@/lib/types/result";

/** Parse action input; on failure produce a field-level ActionResult error. */
export function parseInput<Schema extends z.ZodTypeAny>(
  schema: Schema,
  input: unknown,
):
  | { success: true; data: z.infer<Schema> }
  | { success: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      result: fail(
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors,
      ),
    };
  }
  return { success: true, data: parsed.data };
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
