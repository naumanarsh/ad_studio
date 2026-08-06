import type { Metadata } from "next";
import { BrandForm } from "@/features/brand/brand-form";
import { getBrandProfile } from "@/lib/repositories/brand.repo";

export const metadata: Metadata = { title: "Brand" };
export const dynamic = "force-dynamic";

export default function BrandPage() {
  const profile = getBrandProfile();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="kicker">Brand</p>
        <h1 className="display mt-2">
          Teach the studio <em>who you are</em>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This profile is injected into every idea, caption and ad-image
          prompt, so everything comes out sounding — and looking — like you.
        </p>
      </div>
      <BrandForm profile={profile} />
    </div>
  );
}
