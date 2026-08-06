import { ActivityPill } from "@/components/layout/activity-pill";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TopNav } from "@/components/layout/top-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="kicker">Zappy Growth · Ad Studio</p>
            <p className="font-heading text-2xl font-semibold tracking-tight">
              Ad Studio
            </p>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-3">
            <ActivityPill />
            <TopNav />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      <footer className="border-t px-6 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Zappy Growth · Ad Studio — the internal creative studio.</span>
          <span>
            AI-drafted content — a human reviews everything before it ships.
          </span>
        </div>
      </footer>
    </div>
  );
}
