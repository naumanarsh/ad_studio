import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Trend } from "@/lib/types/content";

/** Compact trend list for the dashboard — the Research page has the cards. */
export function TrendList({ trends }: { trends: Trend[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {trends.map((trend) => (
        <li key={trend.id} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {trend.url ? (
                <a
                  href={trend.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {trend.title}
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                trend.title
              )}
            </p>
            {trend.summary && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {trend.summary}
              </p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0">
            {trend.source_name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
