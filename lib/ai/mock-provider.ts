import type {
  AIProvider,
  CompletionRequest,
  CompletionResult,
} from "@/lib/ai/types";

const ANGLES = [
  "Contrarian take — challenge the common advice",
  "Behind-the-scenes — show how it's actually done",
  "Checklist — turn it into 5 actionable steps",
  "Case study — a before/after story",
  "Myth-busting — what everyone gets wrong",
  "Quick win — one thing to try today",
  "Trend reaction — what this means for your audience",
  "Data point — lead with a surprising number",
];

const TOPIC_MAX_CHARS = 90;

/** Pull "Title" lines out of the prompt so mock output stays on-topic. */
function extractTopics(prompt: string): string[] {
  const topics = [...prompt.matchAll(/^\d+\.\s*(.+)$/gm)].map((m) => {
    const topic = m[1].split(" — ")[0].trim();
    return topic.length > TOPIC_MAX_CHARS
      ? `${topic.slice(0, TOPIC_MAX_CHARS - 1)}…`
      : topic;
  });
  return topics.length > 0 ? topics : ["Marketing in 2026"];
}

function ideasJson(prompt: string): string {
  const topics = extractTopics(prompt);
  const ideas = topics.slice(0, 8).map((topic, i) => ({
    trendIndex: i + 1,
    title: `${ANGLES[i % ANGLES.length].split(" — ")[0]}: ${topic}`,
    angle: `${ANGLES[i % ANGLES.length].split(" — ")[1]} for "${topic}".`,
  }));
  return JSON.stringify({ ideas });
}

function postsJson(prompt: string): string {
  const topic = extractTopics(prompt)[0];
  const posts = [
    {
      platform: "instagram",
      caption: `Everyone's talking about ${topic} — here's the part nobody mentions.\n\nWe broke it down into 3 things you can actually use this week. Save this for your next planning session. 👇`,
      hashtags: "#marketing #contentstrategy #socialmediatips",
    },
    {
      platform: "facebook",
      caption: `${topic} is trending, and most brands will get it wrong.\n\nThe ones that win won't be the ones who move fastest — they'll be the ones who connect it to what their audience already cares about.`,
      hashtags: "#marketing #socialmedia",
    },
  ];
  return JSON.stringify({ posts });
}

/**
 * Deterministic offline adapter. It keeps the entire pipeline runnable with
 * no API key: output is templated but derived from the real prompt content,
 * so downstream parsing, storage and UI behave exactly as with a live model.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const prompt = request.messages.map((m) => m.content).join("\n");
    // Simulate a bit of model latency so loading states are visible.
    await new Promise((resolve) => setTimeout(resolve, 300));

    let text: string;
    switch (request.purpose) {
      case "ideas.generate":
        text = ideasJson(prompt);
        break;
      case "posts.generate":
        text = postsJson(prompt);
        break;
      default:
        text = request.json
          ? "{}"
          : `Mock response for purpose "${request.purpose}".`;
    }

    return {
      text,
      model: "mock-1",
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil(text.length / 4),
      costUsd: 0,
    };
  }
}
