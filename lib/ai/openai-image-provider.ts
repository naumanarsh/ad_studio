import "server-only";

import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
} from "@/lib/ai/image-types";
import { AppError } from "@/lib/services/errors";

const DEFAULT_MODEL = "gpt-image-2";
/** Rough per-image price for the default quality tier. */
const COST_PER_IMAGE_USD = 0.05;
const API_BASE = "https://api.openai.com/v1";

type ImagesResponse = {
  error?: { message?: string };
  data?: Array<{ b64_json?: string }>;
};

/** GPT Image supports three fixed sizes — pick the closest to the aspect. */
function sizeForAspect(aspect?: string): string {
  if (!aspect) return "auto";
  const [w, h] = aspect.split(":").map(Number);
  if (!w || !h) return "auto";
  if (w === h) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

/**
 * OpenAI's GPT Image model via the Images API. Fresh prompts hit
 * /images/generations; requests with reference images hit /images/edits,
 * which revises the attached images per the prompt.
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai";
  private readonly model = process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_MODEL;

  async generate(request: ImageRequest): Promise<ImageResult> {
    return this.attempt(request, 0);
  }

  private async attempt(
    request: ImageRequest,
    tries: number,
  ): Promise<ImageResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new AppError("OPENAI_API_KEY is not set.");
    }

    const references = request.references ?? [];
    let response: Response;
    if (references.length > 0) {
      const form = new FormData();
      form.append("model", this.model);
      form.append("prompt", request.prompt);
      form.append("size", sizeForAspect(request.aspect));
      references.forEach((ref, i) => {
        form.append(
          "image[]",
          new Blob([Buffer.from(ref.data, "base64")], { type: ref.mime }),
          `reference-${i + 1}.${ref.mime.split("/")[1] ?? "png"}`,
        );
      });
      response = await fetch(`${API_BASE}/images/edits`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
    } else {
      response = await fetch(`${API_BASE}/images/generations`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: request.prompt,
          size: sizeForAspect(request.aspect),
        }),
        signal: AbortSignal.timeout(180_000),
      });
    }

    const body = (await response.json()) as ImagesResponse;
    if (!response.ok) {
      const message = body.error?.message ?? `HTTP ${response.status}`;
      // Transient capacity errors — retry once before surfacing.
      if (
        tries === 0 &&
        (response.status === 429 ||
          response.status >= 500 ||
          /overloaded|try again/i.test(message))
      ) {
        await new Promise((r) => setTimeout(r, 3000));
        return this.attempt(request, tries + 1);
      }
      if (/quota|billing|insufficient/i.test(message)) {
        throw new AppError(
          "OpenAI image quota exceeded — check the billing on your OpenAI " +
            "account.",
        );
      }
      throw new AppError(`Image model error: ${message.slice(0, 200)}`);
    }

    const image = body.data?.find((d) => d.b64_json);
    if (!image?.b64_json) {
      throw new AppError(
        "The image model returned no image — try rephrasing the prompt.",
      );
    }

    return {
      data: Buffer.from(image.b64_json, "base64"),
      mime: "image/png",
      model: this.model,
      costUsd: COST_PER_IMAGE_USD,
    };
  }
}
