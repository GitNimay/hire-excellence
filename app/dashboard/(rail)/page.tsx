import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Feed } from "@/components/feed";
import { getFeed, getFollowingIds } from "@/lib/feed";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const [initial, followingIds] = await Promise.all([getFeed(user.id, "for-you"), getFollowingIds(user.id)]);

  return <Feed viewer={{ id: user.id, name: user.fullName || user.username || "You", imageUrl: user.imageUrl }} initial={initial} followingIds={followingIds} />;
}
