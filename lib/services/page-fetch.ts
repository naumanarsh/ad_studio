import "server-only";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS = 8_000;

// Marketing sites often 406 plain fetches — look like a real browser.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

export type FetchedPage = {
  url: string;
  title: string;
  /** Visible text content, whitespace-collapsed and length-capped. */
  text: string;
};

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Fetch a page and reduce it to clean text for model analysis. */
export async function fetchPageText(url: string): Promise<FetchedPage> {
  const target = normalizeUrl(url);
  const response = await fetch(target, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${target}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const title =
    /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARS);

  if (!text) {
    throw new Error(`No readable content at ${target}.`);
  }
  return { url: target, title, text };
}
