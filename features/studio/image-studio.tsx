"use client";

import {
  ArrowLeft,
  Check,
  Download,
  Paperclip,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { RetryImage } from "@/components/retry-image";
import { Button } from "@/components/ui/button";
import {
  attachStudioImageAction,
  generateStudioImageAction,
} from "@/lib/actions/studio.actions";
import {
  IMAGE_MODEL_CHOICES,
  type ImageModelChoice,
} from "@/lib/ai/image-choices";
import { STYLE_TEMPLATES } from "@/lib/prompts/ad-design";

type Attachment = {
  id: string;
  name: string;
  mime: string;
  data: string;
  preview: string;
};

/** One entry in the version strip — a studio result or the post's image. */
export type Version = {
  uid: string;
  src: string;
  studioId?: number;
  postImageId?: number;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOADS = 4;

export function ImageStudio({
  postId,
  contextTag = "standalone",
  initialPrompt,
  initialVersions,
  defaultKind,
}: {
  postId: number | null;
  /** What we're creating from (e.g. "idea-75") — scopes session recovery. */
  contextTag?: string;
  initialPrompt: string;
  /** Prior generations for this context — survives reloads. */
  initialVersions: Version[];
  defaultKind: "organic" | "ad";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState(
    initialVersions.length > 0 ? "" : initialPrompt,
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [currentUid, setCurrentUid] = useState<string | null>(
    initialVersions.at(-1)?.uid ?? null,
  );
  const [editing, setEditing] = useState(true);
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [kind, setKind] = useState<"organic" | "ad">(defaultKind);
  const [model, setModel] = useState<ImageModelChoice>("gemini");
  const [pending, startTransition] = useTransition();

  // Post-context strips reload from the server; everything else recovers
  // from sessionStorage, so a dev reload or remount never eats a result.
  // A fresh browser session still opens clean.
  const storageKey = `studio-versions:${contextTag}`;
  useEffect(() => {
    if (postId !== null || initialVersions.length > 0) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Version[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setVersions(parsed);
        setCurrentUid(parsed.at(-1)?.uid ?? null);
        setPrompt("");
      }
    } catch {
      // Corrupt or unavailable storage — start clean.
    }
    // Restore once per mount for this context only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (postId !== null || versions.length === 0) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(versions));
    } catch {
      // Storage full/blocked — the strip just won't survive a reload.
    }
  }, [versions, storageKey, postId]);

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
        const url = reader.result as string;
        const [, data] = url.split(",", 2);
        setAttachments((a) =>
          a.length >= MAX_UPLOADS
            ? (toast.error(`Up to ${MAX_UPLOADS} attachments.`), a)
            : [
                ...a,
                {
                  id: `${file.name}-${file.size}-${a.length}`,
                  name: file.name,
                  mime: file.type,
                  data,
                  preview: url,
                },
              ],
        );
      };
      reader.readAsDataURL(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const current = versions.find((v) => v.uid === currentUid) ?? null;
  const isEdit = editing && current !== null;

  function switchToFresh() {
    setEditing(false);
    if (!prompt.trim()) setPrompt(initialPrompt);
  }

  function run() {
    const text = prompt.trim();
    if (!text) return;
    const style = STYLE_TEMPLATES.find((t) => t.key === styleKey);
    const fullPrompt =
      style && !isEdit ? `${text}\n\nLayout style: ${style.brief}` : text;
    startTransition(async () => {
      const result = await generateStudioImageAction({
        prompt: fullPrompt,
        postId,
        baseImageId: isEdit ? current.studioId : undefined,
        basePostImageId: isEdit ? current.postImageId : undefined,
        uploads: attachments.map((a) => ({ mime: a.mime, data: a.data })),
        kind,
        model,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const version: Version = {
        uid: `studio-${result.data.id}`,
        src: `/api/studio-images/${result.data.id}`,
        studioId: result.data.id,
      };
      setVersions((v) => [...v, version]);
      setCurrentUid(version.uid);
      setEditing(true);
      setPrompt("");
      toast.success(isEdit ? "Edit applied" : "Image ready");
    });
  }

  function attachToPost() {
    if (!current?.studioId || !postId) return;
    startTransition(async () => {
      const result = await attachStudioImageAction({
        studioImageId: current.studioId!,
        postId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Attached to the post as its visual.");
      router.push("/dashboard");
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Result */}
      {current ? (
        <>
          <RetryImage
            src={current.src}
            alt="Ad image"
            className="w-full border"
          />
          <div className="flex flex-wrap items-center gap-2">
            {postId && current.studioId && (
              <Button size="sm" onClick={attachToPost} disabled={pending}>
                <Check className="size-4" /> Use for post
              </Button>
            )}
            {postId && current.postImageId && (
              <span className="text-xs text-muted-foreground">
                This is the post&apos;s current image — describe a change
                below to edit it.
              </span>
            )}
            <Button size="sm" variant="outline" asChild>
              <a href={current.src} download>
                <Download className="size-4" /> Download
              </a>
            </Button>
            {versions.length > 1 && (
              <div className="ml-auto flex flex-wrap gap-1.5">
                {versions.map((version, i) => (
                  <button
                    key={version.uid}
                    type="button"
                    onClick={() => setCurrentUid(version.uid)}
                    title={`Version ${i + 1}`}
                    className={`relative size-12 overflow-hidden border ${
                      version.uid === currentUid
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <RetryImage
                      src={version.src}
                      alt={`Version ${i + 1}`}
                      className="size-full object-cover"
                    />
                    <span className="absolute right-0 top-0 bg-black/60 px-0.5 text-[9px] text-white">
                      v{i + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* The one composer */}
      <div className="flex flex-col gap-2 border bg-card p-3">
        {current && (
          <div className="flex items-center gap-2 text-xs">
            {isEdit ? (
              <>
                <span className="border bg-secondary px-2 py-0.5 font-medium">
                  Editing v{versions.findIndex((v) => v.uid === currentUid) + 1}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={switchToFresh}
                >
                  Start fresh instead
                </button>
              </>
            ) : (
              <>
                <span className="border px-2 py-0.5 font-medium text-muted-foreground">
                  New image
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => setEditing(true)}
                >
                  Edit v{versions.findIndex((v) => v.uid === currentUid) + 1}{" "}
                  instead
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Model:</span>
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

        {!isEdit && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Making:</span>
            {(
              [
                ["ad", "Ad creative"],
                ["organic", "Organic post"],
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
          </div>
        )}

        {!isEdit && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Style:</span>
            {STYLE_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                title={template.brief}
                onClick={() =>
                  setStyleKey((k) => (k === template.key ? null : template.key))
                }
                className={`border px-2 py-0.5 text-xs transition-colors ${
                  styleKey === template.key
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 border bg-secondary/50 p-1 pr-1.5"
                title={a.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.preview}
                  alt={a.name}
                  className="size-8 border object-cover"
                />
                <span className="max-w-24 truncate text-xs">{a.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setAttachments((list) => list.filter((x) => x.id !== a.id))
                  }
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
          rows={isEdit ? 3 : 8}
          disabled={pending}
          placeholder={
            isEdit
              ? 'What should change? e.g. "Replace the text logo with my attached logo, top-right"'
              : "Describe the ad image you want — a short idea is enough, the art director fills in the rest…"
          }
          className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none"
        />

        <div className="flex items-center gap-2">
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
            disabled={pending || attachments.length >= MAX_UPLOADS}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" /> Attach
          </Button>
          <span className="text-xs text-muted-foreground">
            Attachments stay for every step — logo, product, references.
          </span>
          <Button
            className="ml-auto"
            disabled={pending || !prompt.trim()}
            onClick={run}
          >
            {pending ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Working…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {isEdit ? "Apply edit" : "Generate"}
              </>
            )}
          </Button>
        </div>
      </div>

      {postId && (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3" /> Back to Today
        </Link>
      )}
    </div>
  );
}
