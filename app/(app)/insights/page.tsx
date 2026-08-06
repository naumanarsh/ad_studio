import type { Metadata } from "next";
import {
  listDailySpend,
  listImageModelStats,
  spendSummary,
  todaySpendUsd,
} from "@/lib/repositories/ai-logs.repo";
import { countPostsByStatusSince } from "@/lib/repositories/posts.repo";
import { dailyBudgetUsd } from "@/lib/services/budget.service";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

// Bar color: theme flame, snapped into the dataviz lightness band and
// validated (contrast, chroma) against both mode surfaces.
const BAR = "bg-[oklch(0.55_0.17_33)] dark:bg-[oklch(0.65_0.15_40)]";

function usd(n: number): string {
  return n >= 10 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

function friendlyModel(model: string): string {
  if (model.includes("gemini")) return "Nano Banana";
  if (model.includes("gpt-image")) return "GPT Image";
  if (model.includes("claude")) return "Claude";
  return model;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-3xl font-semibold tracking-tight">
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function InsightsPage() {
  const days = listDailySpend(14);
  const summary = spendSummary(30);
  const models = listImageModelStats(30);
  const approved = countPostsByStatusSince("approved", 30);

  const imageTotal = summary.imageOk + summary.imageFailed;
  const successRate =
    imageTotal > 0 ? Math.round((summary.imageOk / imageTotal) * 100) : null;
  const costPerApproved = approved > 0 ? summary.totalUsd / approved : null;

  const max = Math.max(...days.map((d) => d.usd), 0.001);
  const maxDay = days.reduce((a, b) => (b.usd > a.usd ? b : a), days[0]);
  const lastDay = days[days.length - 1];
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="kicker">Insights</p>
        <h1 className="display mt-2">
          What the studio <em>costs and delivers</em>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live from the studio&apos;s own request log — every AI call, its
          cost and outcome. Last 30 days unless noted.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="AI spend · 30d"
          value={usd(summary.totalUsd)}
          sub={`today ${usd(todaySpendUsd())} of $${dailyBudgetUsd().toFixed(0)} daily budget`}
        />
        <Tile
          label="Images created · 30d"
          value={String(summary.imageOk)}
          sub={summary.imageFailed > 0 ? `${summary.imageFailed} failed` : "no failures"}
        />
        <Tile
          label="Image success rate"
          value={successRate === null ? "—" : `${successRate}%`}
        />
        <Tile
          label="Cost per approved post"
          value={costPerApproved === null ? "—" : usd(costPerApproved)}
          sub={`${approved} approved`}
        />
      </div>

      <section className="flex flex-col gap-3 border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Daily AI spend — last 14 days</h2>
          <span className="text-xs text-muted-foreground">
            peak {usd(maxDay.usd)}
          </span>
        </div>

        <div className="flex h-40 items-end gap-[2px] border-b">
          {days.map((d) => {
            const pct = Math.max(d.usd > 0 ? 4 : 0, (d.usd / max) * 100);
            const labeled =
              (d.day === maxDay.day && maxDay.usd > 0) ||
              (d.day === lastDay.day && lastDay.usd > 0);
            return (
              <div
                key={d.day}
                className="group relative flex h-full flex-1 flex-col justify-end"
              >
                {labeled && (
                  <span className="mb-1 text-center text-[10px] text-muted-foreground">
                    {usd(d.usd)}
                  </span>
                )}
                <div
                  className={`w-full rounded-t-[4px] ${d.usd > 0 ? BAR : "bg-muted"}`}
                  style={{ height: `${d.usd > 0 ? pct : 2}%` }}
                />
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap border bg-background px-1.5 py-0.5 text-[10px] group-hover:block">
                  {fmtDay(d.day)} · {usd(d.usd)} · {d.calls} calls
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{fmtDay(days[0].day)}</span>
          <span>{fmtDay(lastDay.day)}</span>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:underline">
            View as table
          </summary>
          <table className="mt-2 w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 font-medium">Spend</th>
                <th className="py-1 font-medium">Calls</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-b border-border/50">
                  <td className="py-1">{fmtDay(d.day)}</td>
                  <td className="py-1">${d.usd.toFixed(3)}</td>
                  <td className="py-1">{d.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="flex flex-col gap-3 border bg-card p-4">
        <h2 className="text-sm font-medium">
          Image models — successful generations, last 30 days
        </h2>
        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No image generations yet — create something in the Creator first.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">Model</th>
                <th className="py-2 font-medium">Images</th>
                <th className="py-2 font-medium">Avg time</th>
                <th className="py-2 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model} className="border-b border-border/50">
                  <td className="py-2">
                    {friendlyModel(m.model)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {m.model}
                    </span>
                  </td>
                  <td className="py-2">{m.images}</td>
                  <td className="py-2">{(m.avg_ms / 1000).toFixed(1)}s</td>
                  <td className="py-2">${m.usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">
          Tip: once both models have real volume, the winner per format shows
          up here — route your style presets accordingly.
        </p>
      </section>
    </div>
  );
}
