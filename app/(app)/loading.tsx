/** Group-level route skeleton — pages are dynamic and AI-heavy. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy>
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 bg-muted" />
        <div className="h-9 w-2/3 max-w-md bg-muted" />
        <div className="h-4 w-1/2 max-w-sm bg-muted" />
      </div>
      <div className="h-8 w-72 max-w-full bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-56 border bg-muted/50" />
        <div className="h-56 border bg-muted/50" />
      </div>
    </div>
  );
}
