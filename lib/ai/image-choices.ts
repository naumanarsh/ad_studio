/**
 * User-selectable image models — shared between the picker UI and the
 * server actions that validate the choice. Values are image-registry
 * adapter names.
 */
export const IMAGE_MODEL_CHOICES = [
  { value: "gemini", label: "Nano Banana" },
  { value: "openai", label: "GPT Image 2" },
] as const;

export type ImageModelChoice = (typeof IMAGE_MODEL_CHOICES)[number]["value"];

export const IMAGE_MODEL_VALUES = IMAGE_MODEL_CHOICES.map(
  (c) => c.value,
) as ["gemini", "openai"];
