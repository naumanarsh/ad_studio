import "server-only";

import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
} from "@/lib/ai/image-types";
import { AppError } from "@/lib/services/errors";

const DEFAULT_MODEL = "gemini-3.1-flash-image";
/** Rough per-image price for the flash image tier. */
const COST_PER_IMAGE_USD = 0.04;
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GenerateContentResponse = {
  error?: { message?: string };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
        text?: string;
      }>;
    };
  }>;
};

/** Google's Gemini image model ("Nano Banana") via the REST API. */
export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";
  private readonly model = process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL;

  async generate(request: ImageRequest): Promise<ImageResult> {
    return this.attempt(request, 0);
  }

  private async attempt(
    request: ImageRequest,
    tries: number,
  ): Promise<ImageResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError("GEMINI_API_KEY is not set.");
    }

    const response = await fetch(
      `${API_BASE}/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...(request.references ?? []).map((ref) => ({
                  inlineData: { mimeType: ref.mime, data: ref.data },
                })),
                { text: request.prompt },
              ],
            },
          ],
          ...(request.aspect
            ? {
                generationConfig: {
                  imageConfig: { aspectRatio: request.aspect },
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );

    const body = (await response.json()) as GenerateContentResponse;
    if (!response.ok) {
      const message = body.error?.message ?? `HTTP ${response.status}`;
      // Transient capacity errors — retry once before surfacing.
      if (tries === 0 && /high demand|overloaded|try again|503/i.test(message)) {
        await new Promise((r) => setTimeout(r, 3000));
        return this.attempt(request, tries + 1);
      }
      if (/quota|billing/i.test(message)) {
        throw new AppError(
          "Gemini image quota exceeded — image generation needs a paid-tier " +
            "key (enable billing in Google AI Studio).",
        );
      }
      throw new AppError(`Image model error: ${message.slice(0, 200)}`);
    }

    const parts = body.candidates?.[0]?.content?.parts ?? [];
    const image = parts.find((p) => p.inlineData?.data);
    if (!image?.inlineData?.data) {
      const reply = parts.find((p) => p.text)?.text?.trim();
      throw new AppError(
        reply
          ? `The image model answered with text instead of an image: "${reply.slice(0, 160)}" — add more detail to your prompt.`
          : "The image model returned no image — try rephrasing the prompt.",
      );
    }

    return {
      data: Buffer.from(image.inlineData.data, "base64"),
      mime: image.inlineData.mimeType ?? "image/png",
      model: this.model,
      costUsd: COST_PER_IMAGE_USD,
    };
  }
}
