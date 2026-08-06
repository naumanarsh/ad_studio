"use client";

import { ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { RetryImage } from "@/components/retry-image";
import { Button } from "@/components/ui/button";
import {
  deleteBrandAssetAction,
  uploadBrandAssetAction,
} from "@/lib/actions/brand.actions";
import type {
  BrandAssetKind,
  BrandAssetMeta,
} from "@/lib/repositories/brand-assets.repo";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * The brand kit: logo + product shots stored once, auto-attached to every
 * ad generation so the team never re-uploads them.
 */
export function BrandAssetManager({ assets }: { assets: BrandAssetMeta[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<BrandAssetKind>("product");
  const [pending, startTransition] = useTransition();

  function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is over 5 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const [, data] = (reader.result as string).split(",", 2);
        startTransition(async () => {
          const result = await uploadBrandAssetAction({
            kind,
            name: file.name,
            mime: file.type,
            data,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            kind === "logo" ? "Logo saved" : "Product shot saved",
          );
          router.refresh();
        });
      };
      reader.readAsDataURL(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove(asset: BrandAssetMeta) {
    startTransition(async () => {
      const result = await deleteBrandAssetAction({ assetId: asset.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border bg-card p-4">
      <div>
        <p className="text-sm font-medium">Brand kit</p>
        <p className="text-xs text-muted-foreground">
          Your logo and product shots, attached automatically to every ad
          generation — so the images always feature the real thing.
        </p>
      </div>

      {assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assets.map((asset) => (
            <span
              key={asset.id}
              className="relative inline-flex flex-col items-center gap-1 border bg-secondary/50 p-1.5"
              title={asset.name}
            >
              <RetryImage
                src={`/api/brand-assets/${asset.id}`}
                alt={asset.name}
                className="size-16 border object-contain"
              />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {asset.kind}
              </span>
              <button
                type="button"
                aria-label={`Remove ${asset.name}`}
                className="absolute -right-1.5 -top-1.5 border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                onClick={() => remove(asset)}
                disabled={pending}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["product", "Product shot"],
            ["logo", "Logo"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`border px-2 py-0.5 text-xs transition-colors ${
              kind === value
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" /> Add {kind === "logo" ? "logo" : "product shots"}
        </Button>
      </div>
    </div>
  );
}
