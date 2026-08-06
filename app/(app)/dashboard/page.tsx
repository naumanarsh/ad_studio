import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { IdeaList, type IdeaCreation } from "@/features/dashboard/idea-list";
import { PostGrid } from "@/features/dashboard/post-grid";
import {
  RegenerateBriefButton,
  RunBriefButton,
} from "@/features/dashboard/run-brief-button";
import { TrendList } from "@/features/dashboard/trend-list";
import { listRecentJobs } from "@/lib/repositories/jobs.repo";
import { listImagesForPosts } from "@/lib/repositories/post-images.repo";
import { listPostsForIdeas } from "@/lib/repositories/posts.repo";
import { getTodaysBrief } from "@/lib/services/brief.service";
import type { PostImageMeta } from "@/lib/types/content";

export const metadata: Metadata = { title: "Morning Brief" };
export const dynamic = "force-dynamic";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="kicker">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{count}</span>
      </h2>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const brief = getTodaysBrief();
  const imagesByPost: Record<number, PostImageMeta[]> = {};
  for (const image of listImagesForPosts(brief.posts.map((p) => p.id))) {
    (imagesByPost[image.post_id] ??= []).push(image);
  }
  // Which ideas are being worked on or already produced a post — shown
  // back on the idea cards.
  const pendingIdeaIds = listRecentJobs()
    .filter(
      (j) => (j.status === "queued" || j.status === "running") && j.idea_id,
    )
    .map((j) => j.idea_id!) as number[];
  const createdByIdea: Record<number, IdeaCreation> = {};
  for (const post of listPostsForIdeas(brief.ideas.map((i) => i.id))) {
    if (post.idea_id !== null && !createdByIdea[post.idea_id]) {
      createdByIdea[post.idea_id] = { postId: post.id, imageId: null };
    }
  }
  const ideaThumbs: Record<number, number> = {};
  for (const image of listImagesForPosts(
    Object.values(createdByIdea).map((c) => c.postId),
  )) {
    if (image.selected || !ideaThumbs[image.post_id]) {
      ideaThumbs[image.post_id] = image.id;
    }
  }
  for (const creation of Object.values(createdByIdea)) {
    creation.imageId = ideaThumbs[creation.postId] ?? null;
  }

  const hasContent =
    brief.trends.length + brief.ideas.length + brief.posts.length > 0;
  const pendingCount = brief.posts.filter(
    (p) => p.status === "pending",
  ).length;
  const adPosts = brief.posts.filter((p) => p.kind === "ad");
  const organicPosts = brief.posts.filter((p) => p.kind === "organic");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Sparkles className="size-8 text-muted-foreground" />
        <div>
          <h1 className="display">
            Your morning brief isn&apos;t <em>ready</em> yet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One click pulls today&apos;s trends, generates ideas and drafts
            posts for review.
          </p>
        </div>
        <RunBriefButton hasContent={false} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display">
            What wants a <em>decision</em> today
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {today}
            {pendingCount > 0 &&
              ` · ${pendingCount} draft${pendingCount === 1 ? "" : "s"} waiting for review`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RegenerateBriefButton />
          <RunBriefButton hasContent />
        </div>
      </div>

      {(adPosts.length > 0 || organicPosts.length > 0) && (
        <Tabs
          defaultValue={organicPosts.length > 0 ? "organic" : "ads"}
          className="gap-4"
        >
          <TabsList>
            {organicPosts.length > 0 && (
              <TabsTrigger value="organic">
                Organic Posts · {organicPosts.length}
              </TabsTrigger>
            )}
            {adPosts.length > 0 && (
              <TabsTrigger value="ads">
                Ad Drafts · {adPosts.length}
              </TabsTrigger>
            )}
          </TabsList>
          {organicPosts.length > 0 && (
            <TabsContent value="organic">
              <PostGrid posts={organicPosts} imagesByPost={imagesByPost} />
            </TabsContent>
          )}
          {adPosts.length > 0 && (
            <TabsContent value="ads">
              <PostGrid posts={adPosts} imagesByPost={imagesByPost} />
            </TabsContent>
          )}
        </Tabs>
      )}

      {brief.ideas.length > 0 && (
        <Section title="Generated Ideas" count={brief.ideas.length}>
          <IdeaList
            ideas={brief.ideas}
            createdByIdea={createdByIdea}
            pendingIdeaIds={pendingIdeaIds}
            action="creator"
          />
        </Section>
      )}

      {brief.trends.length > 0 && (
        <Section title="Today's Trends" count={brief.trends.length}>
          <TrendList trends={brief.trends} />
        </Section>
      )}
    </div>
  );
}
