import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostDetail } from "@/features/posts/post-detail";
import { listImagesForPosts } from "@/lib/repositories/post-images.repo";
import { getPost } from "@/lib/repositories/posts.repo";

export const metadata: Metadata = { title: "Post" };
export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const id = Number(postId);
  const post = Number.isInteger(id) && id > 0 ? getPost(id) : null;
  if (!post) notFound();

  return <PostDetail post={post} images={listImagesForPosts([post.id])} />;
}
