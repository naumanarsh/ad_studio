export type ImageReference = {
  mime: string;
  /** Base64-encoded image bytes. */
  data: string;
};

export type ImageRequest = {
  /** Stable identifier for what this call does, e.g. "post.image". */
  purpose: string;
  prompt: string;
  /**
   * Optional input images (uploaded reference, or a previous result to
   * edit) — models like Nano Banana revise these per the prompt.
   */
  references?: ImageReference[];
  /**
   * Output aspect ratio, e.g. "4:5" — enforced via the provider API, not
   * just the prompt text (models often ignore prose aspect requests).
   */
  aspect?: string;
};

export type ImageResult = {
  /** Raw image bytes. */
  data: Buffer;
  mime: string;
  model: string;
  costUsd: number;
};

/**
 * The image-generation port — mirrors AIProvider for pictures. Adapters
 * (Gemini "Nano Banana", and later OpenAI/Ideogram/Recraft) are selected
 * by the image registry, never imported by callers.
 */
export interface ImageProvider {
  readonly name: string;
  generate(request: ImageRequest): Promise<ImageResult>;
}
