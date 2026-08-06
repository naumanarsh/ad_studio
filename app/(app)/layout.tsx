import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TopNav } from "@/components/layout/top-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
          <div>
            <p className="kicker">Zappy Growth · Ad Studio</p>
            <p className="font-heading text-2xl font-semibold tracking-tight">
              Ad Studio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TopNav />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
