/**
 * User-selectable image models — shared between the picker UI and the
 * server actions that validate the choice. Values are image-registry
 * adapter names.
 */
export const IMAGE_MODEL_CHOICES = [
  {
    value: "gemini",
    label: "Nano Banana",
    hint: "photo",
    title:
      "Best for photography-led ads, product compositing and quick iterative edits.",
  },
  {
    value: "openai",
    label: "GPT Image 2",
    hint: "text & layout",
    title:
      "Best for typography-heavy layouts — offer stacks, comparisons, testimonials, notes-style.",
  },
] as const;

export type ImageModelChoice = (typeof IMAGE_MODEL_CHOICES)[number]["value"];

export const IMAGE_MODEL_VALUES = IMAGE_MODEL_CHOICES.map(
  (c) => c.value,
) as ["gemini", "openai"];
