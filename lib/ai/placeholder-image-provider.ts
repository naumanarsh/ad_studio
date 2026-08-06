import "server-only";

import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
} from "@/lib/ai/image-types";

// The app's editorial palette, so placeholders look intentional in the UI.
const SWATCHES = [
  ["#2e5544", "#f7f4e9"],
  ["#c0512b", "#f7f4e9"],
  ["#8c9f74", "#22352c"],
  ["#d9b98a", "#22352c"],
];

function hashCode(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Offline stand-in: renders a labeled SVG swatch instead of calling a
 * model, so the variant flow is fully clickable with no API key.
 */
export class PlaceholderImageProvider implements ImageProvider {
  readonly name = "placeholder";

  async generate(request: ImageRequest): Promise<ImageResult> {
    // First line of the prompt is the variant label (see image.service).
    const label = request.prompt.split("\n")[0].slice(0, 40);
    const [bg, fg] = SWATCHES[hashCode(request.prompt) % SWATCHES.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="${bg}"/>
  <circle cx="400" cy="340" r="130" fill="${fg}" opacity="0.25"/>
  <text x="400" y="640" text-anchor="middle" font-family="Georgia, serif"
    font-size="40" fill="${fg}">${label}</text>
  <text x="400" y="700" text-anchor="middle" font-family="sans-serif"
    font-size="24" fill="${fg}" opacity="0.7">placeholder — add a paid Gemini key</text>
</svg>`;
    return {
      data: Buffer.from(svg, "utf-8"),
      mime: "image/svg+xml",
      model: "placeholder",
      costUsd: 0,
    };
  }
}
