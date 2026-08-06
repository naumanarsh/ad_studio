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
import { ZoomableImage } from "@/components/zoomable-image";
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
  /** Which image model made it — shown on the version chip. */
  model?: string;
  /** What the compliance reviewer concluded for this render. */
  review?: { checked: boolean; approved: boolean; autoFixed: boolean };
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
  // A style pick auto-routes to its best model until the user overrides.
  const [modelTouched, setModelTouched] = useState(false);
  const [batch, setBatch] = useState(false);
  const [useKit, setUseKit] = useState(true);
  const [pending, startTransition] = useTransition();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Honest stage labels while generating — nothing gets faster, but the
  // user sees where the pipeline is instead of a bare spinner.
  useEffect(() => {
    if (!pending || startedAt === null) return;
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [pending, startedAt]);

  function stageLabel(edit: boolean, runs: number): string {
    if (edit) return `Applying your edit… ${elapsed}s`;
    const what = runs > 1 ? `${runs} concepts` : "the image";
    if (elapsed < 35) return `Writing the brief… ${elapsed}s`;
    if (elapsed < 75) return `Rendering ${what}… ${elapsed}s`;
    return `Compliance review… ${elapsed}s`;
  }

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
    const request = {
      prompt: fullPrompt,
      postId,
      baseImageId: isEdit ? current.studioId : undefined,
      basePostImageId: isEdit ? current.postImageId : undefined,
      uploads: attachments.map((a) => ({ mime: a.mime, data: a.data })),
      kind,
      model,
      useBrandKit: useKit,
    };
    const runs = batch && !isEdit ? 3 : 1;
    setStartedAt(Date.now());
    setElapsed(0);
    startTransition(async () => {
      const results = await Promise.all(
        Array.from({ length: runs }, () =>
          generateStudioImageAction(request),
        ),
      );
      const succeeded = results.filter((r) => r.ok);
      const failed = results.find((r) => !r.ok);
      if (succeeded.length === 0) {
        toast.error(failed && !failed.ok ? failed.error : "Generation failed.");
        return;
      }
      const fresh: Version[] = succeeded.map((r) => {
        const { image, review } = (r as Extract<typeof r, { ok: true }>).data;
        return {
          uid: `studio-${image.id}`,
          src: `/api/studio-images/${image.id}`,
          studioId: image.id,
          model: image.model,
          review,
        };
      });
      setVersions((v) => [...v, ...fresh]);
      setCurrentUid(fresh.at(-1)!.uid);
      setEditing(true);
      setPrompt("");
      toast.success(
        isEdit
          ? "Edit applied"
          : runs > 1
            ? `${succeeded.length} concepts ready — flip through the versions to pick one.`
            : "Image ready",
      );
      if (failed && !failed.ok && succeeded.length < runs) {
        toast.warning(`One concept failed: ${failed.error}`);
      }
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
          <ZoomableImage
            src={current.src}
            alt="Ad image"
            className="w-full border"
          />
          <div className="flex flex-wrap items-center gap-2">
            {current.review?.checked && (
              <span
                title={
                  current.review.autoFixed
                    ? "The reviewer found issues and applied one automatic fix pass."
                    : current.review.approved
                      ? "Reviewed against Meta health-ad rules and the design brief."
                      : "The reviewer flagged issues it couldn't auto-fix — check the image closely."
                }
                className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium ${
                  current.review.approved
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                }`}
              >
                {current.review.autoFixed
                  ? "✓ Compliance · auto-fixed"
                  : current.review.approved
                    ? "✓ Compliance checked"
                    : "⚠ Review flagged issues"}
              </span>
            )}
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
                    title={`Version ${i + 1}${version.model ? ` · ${version.model}` : ""}`}
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
              title={choice.title}
              onClick={() => {
                setModel(choice.value);
                setModelTouched(true);
              }}
              className={`border px-2 py-0.5 text-xs transition-colors ${
                model === choice.value
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {choice.label}
              <span className="ml-1 opacity-60">· {choice.hint}</span>
            </button>
          ))}
          {!isEdit && (
            <>
              <button
                type="button"
                title="Generate three different concepts at once and pick the best"
                onClick={() => setBatch((b) => !b)}
                className={`ml-2 border px-2 py-0.5 text-xs transition-colors ${
                  batch
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                3 concepts
              </button>
              <button
                type="button"
                title="Attach your saved logo and product shots from the Brand page"
                onClick={() => setUseKit((k) => !k)}
                className={`border px-2 py-0.5 text-xs transition-colors ${
                  useKit
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Brand kit
              </button>
            </>
          )}
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
                onClick={() => {
                  const next = styleKey === template.key ? null : template.key;
                  setStyleKey(next);
                  // Route to the archetype's best model unless the user
                  // explicitly picked one.
                  if (next && !modelTouched) {
                    setModel(template.recommendedModel);
                  }
                }}
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
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Attachments stay for every step — logo, product, references.
          </span>
          <Button
            className="ml-auto"
            disabled={pending || !prompt.trim()}
            onClick={run}
          >
            {pending ? (
              <>
                <RefreshCw className="size-4 animate-spin" />{" "}
                {stageLabel(isEdit, batch && !isEdit ? 3 : 1)}
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
