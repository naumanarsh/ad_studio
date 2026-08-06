"use client";

import { X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { RetryImage } from "@/components/retry-image";

/**
 * RetryImage that opens a full-screen lightbox on click — ad creatives
 * carry disclaimers and microtext that need a close look before sign-off.
 */
export function ZoomableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFull(false);
          setOpen(true);
        }}
        className="group/zoom relative block w-full cursor-zoom-in"
        title="Click to inspect full-size"
      >
        <RetryImage src={src} alt={alt} className={className} />
        <span className="absolute right-2 top-2 border bg-background/80 p-1 opacity-0 transition-opacity group-hover/zoom:opacity-100">
          <ZoomIn className="size-3.5" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt || "Image preview"}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 border border-white/30 bg-black/40 p-1.5 text-white hover:bg-black/70"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </button>
          <div
            className={
              full
                ? "max-h-full max-w-full overflow-auto"
                : "flex max-h-full max-w-full items-center justify-center"
            }
            onClick={(e) => {
              e.stopPropagation();
              setFull((f) => !f);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={
                full
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-[88svh] max-w-full cursor-zoom-in object-contain"
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
