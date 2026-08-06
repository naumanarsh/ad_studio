import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IdeaCreation } from "@/features/dashboard/idea-list";
import { TrendCards } from "@/features/research/trend-cards";
import {
  TREND_CATEGORIES,
  TREND_CATEGORY_LABELS,
  type Trend,
} from "@/lib/types/content";

/** Today's trends split by medium; collapses to a flat list for one medium. */
export function TrendTabs({
  trends,
  createdByTrend,
  pendingTrendIds,
}: {
  trends: Trend[];
  createdByTrend?: Record<number, IdeaCreation>;
  pendingTrendIds?: number[];
}) {
  const cardProps = { createdByTrend, pendingTrendIds };
  const categories = TREND_CATEGORIES.filter((category) =>
    trends.some((t) => t.category === category),
  );
  if (categories.length <= 1) {
    return <TrendCards trends={trends} {...cardProps} />;
  }

  return (
    <Tabs defaultValue="all" className="gap-4">
      <TabsList>
        <TabsTrigger value="all">All · {trends.length}</TabsTrigger>
        {categories.map((category) => (
          <TabsTrigger key={category} value={category}>
            {TREND_CATEGORY_LABELS[category]} ·{" "}
            {trends.filter((t) => t.category === category).length}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="all">
        <TrendCards trends={trends} {...cardProps} />
      </TabsContent>
      {categories.map((category) => (
        <TabsContent key={category} value={category}>
          <TrendCards
            trends={trends.filter((t) => t.category === category)}
            {...cardProps}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
