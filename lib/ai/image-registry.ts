import "server-only";

import { GeminiImageProvider } from "@/lib/ai/gemini-image-provider";
import type { ImageProvider } from "@/lib/ai/image-types";
import { OpenAIImageProvider } from "@/lib/ai/openai-image-provider";
import { PlaceholderImageProvider } from "@/lib/ai/placeholder-image-provider";

const ADAPTERS: Record<string, () => ImageProvider> = {
  placeholder: () => new PlaceholderImageProvider(),
  gemini: () => new GeminiImageProvider(),
  openai: () => new OpenAIImageProvider(),
};

export function getImageProvider(choice?: string | null): ImageProvider {
  // A user's explicit pick wins, then IMAGE_PROVIDER, then whatever has a key.
  const name =
    choice ??
    process.env.IMAGE_PROVIDER ??
    (process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "placeholder");
  const factory = ADAPTERS[name];
  if (!factory) {
    const known = Object.keys(ADAPTERS).join(", ");
    throw new Error(`Unknown IMAGE_PROVIDER "${name}". Available: ${known}`);
  }
  return factory();
}
