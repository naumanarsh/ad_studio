"use client";

import { Megaphone, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAdsAction } from "@/lib/actions/ads.actions";
import {
  IMAGE_MODEL_CHOICES,
  type ImageModelChoice,
} from "@/lib/ai/image-choices";

export function AdGenerator({ defaultPromo }: { defaultPromo: string }) {
  const router = useRouter();
  const [promo, setPromo] = useState(defaultPromo);
  const [model, setModel] = useState<ImageModelChoice>("gemini");
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateAdsAction({ promo, model });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.data.count} ads ready${result.data.images > 0 ? ` with ${result.data.images} creatives` : ""} — review below.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border bg-card p-4">
      <label className="text-sm font-medium" htmlFor="ad-promo">
        What are we promoting?
      </label>
      <textarea
        id="ad-promo"
        value={promo}
        onChange={(e) => setPromo(e.target.value)}
        rows={3}
        disabled={pending}
        className="border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        placeholder="The offer, product, or angle — e.g. compounded semaglutide from $159/mo, no insurance needed"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Image model:</span>
        {IMAGE_MODEL_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => setModel(choice.value)}
            className={`border px-2 py-0.5 text-xs transition-colors ${
              model === choice.value
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          One paid ad per platform from your Brand settings — copy plus an
          art-directed ad creative (video platforms get scripts). Takes a
          minute or two.
        </p>
        <Button onClick={generate} disabled={pending || promo.trim().length < 5}>
          {pending ? (
            <>
              <RefreshCw className="size-4 animate-spin" /> Writing ads…
            </>
          ) : (
            <>
              <Megaphone className="size-4" /> Generate ads
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
