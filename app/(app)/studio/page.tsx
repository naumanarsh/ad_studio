import type { Metadata } from "next";
import { SectionTabs, type Section } from "@/components/section-tabs";
import { AdGenerator } from "@/features/ads/ad-generator";
import { PostCard } from "@/features/dashboard/post-card";
import { JobQueueList } from "@/features/research/job-queue-list";
import { ImageStudio, type Version } from "@/features/studio/image-studio";
import { ReadyPostList } from "@/features/studio/ready-post-list";
import { TrendPostCreator } from "@/features/studio/trend-post-creator";
import { getBrandProfile } from "@/lib/repositories/brand.repo";
import { getCompetitor } from "@/lib/repositories/competitors.repo";
import { getIdea } from "@/lib/repositories/ideas.repo";
import { countPendingJobs, listRecentJobs } from "@/lib/repositories/jobs.repo";
import { listImagesForPosts } from "@/lib/repositories/post-images.repo";
import { getPost, listAds, listPostsByIds } from "@/lib/repositories/posts.repo";
import { listStudioImagesForContext } from "@/lib/repositories/studio-images.repo";
import { getTrend } from "@/lib/repositories/trends.repo";
import { resumeJobQueue } from "@/lib/services/job-queue.service";
import {
  defaultPromptForPost,
  intentForCompetitorTopic,
  intentForIdea,
  intentForTrend,
} from "@/lib/services/studio.service";
import type { CompetitorTopic, PostImageMeta } from "@/lib/types/content";

export const metadata: Metadata = { title: "Creator" };
export const dynamic = "force-dynamic";

function toId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    postId?: string;
    trendId?: string;
    ideaId?: string;
    competitorId?: string;
    topicIndex?: string;
  }>;
}) {
  const params = await searchParams;

  // Context from wherever the user came from.
  const post = toId(params.postId) ? getPost(toId(params.postId)!) : null;
  const trend = toId(params.trendId) ? getTrend(toId(params.trendId)!) : null;
  const idea = toId(params.ideaId) ? getIdea(toId(params.ideaId)!) : null;
  const competitor = toId(params.competitorId)
    ? getCompetitor(toId(params.competitorId)!)
    : null;

  let initialPrompt = "";
  let context = "";
  if (post) {
    initialPrompt = defaultPromptForPost(post);
    context = "Prefilled from your draft and brand.";
  } else if (trend) {
    initialPrompt = intentForTrend(trend);
    context = `Creating from the trend “${trend.title.slice(0, 60)}”.`;
  } else if (idea) {
    initialPrompt = intentForIdea(idea);
    context = `Creating from the idea “${idea.title.slice(0, 60)}”.`;
  } else if (competitor) {
    const topics = JSON.parse(competitor.topics_json) as CompetitorTopic[];
    const topic = topics[Number(params.topicIndex ?? 0)] ?? topics[0];
    if (topic) {
      initialPrompt = intentForCompetitorTopic(competitor.name, topic);
      context = `Making our take on ${competitor.name}'s “${topic.topic.slice(0, 50)}” angle.`;
    }
  }

  // The Creator opens clean — the only history that loads is the history
  // of the specific post being reworked (the Ready → regenerate flow).
  const postImages = post ? listImagesForPosts([post.id]) : [];
  const currentImage =
    postImages.find((i) => i.selected) ?? postImages.at(-1) ?? null;
  const initialVersions: Version[] = [
    ...(currentImage
      ? [
          {
            uid: `post-${currentImage.id}`,
            src: `/api/images/${currentImage.id}`,
            postImageId: currentImage.id,
          },
        ]
      : []),
    ...(post
      ? listStudioImagesForContext(post.id).map((image) => ({
          uid: `studio-${image.id}`,
          src: `/api/studio-images/${image.id}`,
          studioId: image.id,
        }))
      : []),
  ];

  // Queue mode data — recover interrupted jobs and keep draining.
  resumeJobQueue();
  const jobs = listRecentJobs();
  const pendingJobs = countPendingJobs();
  // Finished jobs leave the queue and surface as full posts in Ready.
  const activeJobs = jobs.filter((j) => j.status !== "done");
  const readyPostIds = jobs
    .filter((j) => j.status === "done" && j.post_id)
    .map((j) => j.post_id!) as number[];
  const readyPosts = listPostsByIds(readyPostIds);
  const readyImagesByPost: Record<number, PostImageMeta[]> = {};
  for (const image of listImagesForPosts(readyPostIds)) {
    (readyImagesByPost[image.post_id] ??= []).push(image);
  }

  // Campaign mode data.
  const ads = listAds();
  const brand = getBrandProfile();
  const adImagesByPost = new Map<number, PostImageMeta[]>();
  for (const image of listImagesForPosts(ads.map((a) => a.id))) {
    const list = adImagesByPost.get(image.post_id) ?? [];
    list.push(image);
    adImagesByPost.set(image.post_id, list);
  }

  const sections: Section[] = [
    {
      value: "image",
      label: "Image",
      title: (
        <>
          Make the ad <em>look</em> right
        </>
      ),
      description:
        (context ||
          "Describe an image, attach your logo or product shots, then refine with plain-language edits.") +
        (context ? " Generate, then refine with plain-language edits." : ""),
    },
    {
      value: "campaign",
      label: "Campaign",
      count: ads.length,
      title: (
        <>
          Paid ads, built to <em>convert</em>
        </>
      ),
      description:
        "Describe a promotion — get platform-native ad copy plus art-directed creatives, ready to review.",
    },
    {
      value: "queue",
      label: "Queue",
      count: pendingJobs,
      title: (
        <>
          Being made <em>for you</em>
        </>
      ),
      description:
        "Queued posts process one by one — finished ones move to the Ready tab.",
    },
    {
      value: "ready",
      label: "Ready",
      count: readyPosts.length,
      title: (
        <>
          Ready to <em>publish</em>
        </>
      ),
      description:
        "Click a post to open it — download the image, copy the caption, or jump to the Image tab to regenerate.",
    },
  ];

  const contents = {
    image: (
      <div className="flex flex-col gap-6">
        {trend && <TrendPostCreator trend={trend} />}
        <ImageStudio
          postId={post?.id ?? null}
          contextTag={
            post
              ? `post-${post.id}`
              : trend
                ? `trend-${trend.id}`
                : idea
                  ? `idea-${idea.id}`
                  : competitor
                    ? `competitor-${competitor.id}`
                    : "standalone"
          }
          initialPrompt={initialPrompt}
          initialVersions={initialVersions}
          defaultKind={post?.kind ?? (trend ? "organic" : "ad")}
        />
      </div>
    ),
    campaign: (
      <div className="flex flex-col gap-6">
        <AdGenerator
          defaultPromo={
            brand?.description
              ? `Promote: ${brand.description.slice(0, 200)}`
              : ""
          }
        />
        {ads.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {ads.map((ad) => (
              <PostCard
                key={ad.id}
                post={ad}
                images={adImagesByPost.get(ad.id) ?? []}
              />
            ))}
          </div>
        ) : (
          <p className="border px-4 py-6 text-sm text-muted-foreground">
            No ads yet — describe a promotion above to generate your first
            campaign.
          </p>
        )}
      </div>
    ),
    queue: <JobQueueList jobs={activeJobs} />,
    ready: (
      <ReadyPostList posts={readyPosts} imagesByPost={readyImagesByPost} />
    ),
  };

  // In-page navigations (e.g. Ready → “Regenerate in Image tab”) keep this
  // component mounted — remount on context change so the right tab shows.
  const contextKey = [
    params.tab,
    params.postId,
    params.trendId,
    params.ideaId,
    params.competitorId,
  ].join("|");

  return (
    <SectionTabs
      key={contextKey}
      kicker="Creator"
      sections={sections}
      contents={contents}
      defaultValue={
        params.tab === "campaign" ||
        params.tab === "queue" ||
        params.tab === "ready"
          ? params.tab
          : "image"
      }
    />
  );
}
