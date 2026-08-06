"use client";

import { RefreshCw, Save, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeBrandAction, saveBrandAction } from "@/lib/actions/brand.actions";
import type { BrandProfile } from "@/lib/types/content";

type Fields = Omit<BrandProfile, "id" | "updated_at">;

const EMPTY: Fields = {
  company: "",
  website: "",
  description: "",
  audience: "",
  tone: "",
  colors: "",
  image_style: "",
  notes: "",
  platforms: "instagram, facebook, tiktok",
};

const FIELD_META: Array<{
  key: keyof Fields;
  label: string;
  hint: string;
  rows?: number;
}> = [
  { key: "company", label: "Company", hint: "Official name used in prompts." },
  { key: "description", label: "What you offer", hint: "Products, value, proof — 2-3 sentences.", rows: 3 },
  { key: "audience", label: "Audience", hint: "Who buys and why.", rows: 2 },
  { key: "tone", label: "Voice & tone", hint: "How your copy should sound.", rows: 2 },
  { key: "colors", label: "Brand colors", hint: "Hex codes or names, used in image prompts." },
  { key: "image_style", label: "Image style", hint: "Art direction for generated ad images.", rows: 2 },
  { key: "notes", label: "Cautions", hint: "Compliance / claims to avoid — injected into every prompt.", rows: 2 },
  { key: "platforms", label: "Ad platforms", hint: "Where you run content, comma-separated: instagram, facebook, tiktok, youtube. Drafts are written for exactly these." },
];

export function BrandForm({ profile }: { profile: BrandProfile | null }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(
    profile
      ? {
          company: profile.company,
          website: profile.website,
          description: profile.description,
          audience: profile.audience,
          tone: profile.tone,
          colors: profile.colors,
          image_style: profile.image_style,
          notes: profile.notes,
          platforms: profile.platforms || EMPTY.platforms,
        }
      : EMPTY,
  );
  const [pending, startTransition] = useTransition();

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function analyze() {
    if (!fields.website.trim()) {
      toast.error("Enter your website first.");
      return;
    }
    startTransition(async () => {
      const result = await analyzeBrandAction({ website: fields.website });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const p = result.data;
      setFields({
        company: p.company,
        website: p.website,
        description: p.description,
        audience: p.audience,
        tone: p.tone,
        colors: p.colors,
        image_style: p.image_style,
        notes: p.notes,
        platforms: p.platforms || EMPTY.platforms,
      });
      toast.success("Brand profile drafted from your website — review and save.");
      router.refresh();
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveBrandAction(fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Brand profile saved — all future ideas, drafts and images use it.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="brand-website">
          Website
        </label>
        <div className="flex gap-2">
          <Input
            id="brand-website"
            value={fields.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="zappyhealth.com"
            disabled={pending}
          />
          <Button onClick={analyze} disabled={pending} variant="outline">
            {pending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Analyze site
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fetches your site and drafts the profile below with AI — edit
          anything before saving.
        </p>
      </div>

      {FIELD_META.map(({ key, label, hint, rows }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={`brand-${key}`}>
            {label}
          </label>
          {rows ? (
            <textarea
              id={`brand-${key}`}
              value={fields[key]}
              onChange={(e) => set(key, e.target.value)}
              rows={rows}
              disabled={pending}
              className="border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          ) : (
            <Input
              id={`brand-${key}`}
              value={fields[key]}
              onChange={(e) => set(key, e.target.value)}
              disabled={pending}
            />
          )}
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      ))}

      <div>
        <Button onClick={save} disabled={pending}>
          <Save className="size-4" /> Save brand profile
        </Button>
      </div>
    </div>
  );
}
