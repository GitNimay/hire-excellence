"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import * as actions from "@/app/dashboard/actions";
import type { Comment } from "@/app/dashboard/actions";
import type { FeedPost, FeedTab } from "@/lib/feed";
import { isVideo, MAX_COMMENT_CHARS, MAX_IMAGES, MAX_POST_CHARS, maxBytes, MEDIA_TYPES } from "@/lib/media";
import type { FeedEvent } from "@/lib/realtime";
import { Avatar, Icon, icons } from "./ui";

type Viewer = { id: string; name: string; imageUrl?: string };
type Page = { posts: FeedPost[]; next: string | null };

const iconBtn = "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong");

function ago(ms: number) {
  const m = (Date.now() - ms) / 60_000;
  if (m < 1) return "now";
  if (m < 60) return `${Math.floor(m)}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  if (m < 10080) return `${Math.floor(m / 1440)}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Home timeline, or a single post when `single` (share links). Live via /api/realtime. */
export function Feed({ viewer, initial, followingIds, single }: { viewer: Viewer; initial: Page; followingIds: string[]; single?: boolean }) {
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [page, setPage] = useState(initial);
  const [fresh, setFresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(() => new Set(followingIds));
  const sentinel = useRef<HTMLDivElement>(null);

  const patch = (id: string, fn: (p: FeedPost) => Partial<FeedPost>) =>
    setPage((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) }));

  async function load(t: FeedTab, append = false) {
    setLoading(true);
    try {
      const res = await actions.loadFeed(t, append ? (page.next ?? undefined) : undefined);
      setPage((pg) => (append ? { posts: [...pg.posts, ...res.posts.filter((p) => !pg.posts.some((q) => q.entryId === p.entryId))], next: res.next } : res));
      if (!append) setFresh(0);
    } finally {
      setLoading(false);
    }
  }

  const onEvent = useEffectEvent((e: FeedEvent) => {
    if (e.t === "stats") patch(e.id, () => ({ likes: e.likes, comments: e.comments, reposts: e.reposts }));
    else if (e.t === "delete") setPage((pg) => ({ ...pg, posts: pg.posts.filter((p) => p.entryId !== e.id && p.id !== e.id) }));
    else if (!single && e.authorId !== viewer.id && (tab === "for-you" || following.has(e.authorId))) setFresh((n) => n + 1);
  });

  // Realtime: one socket, exponential reconnect, heartbeat answered by the Durable Object without waking it
  useEffect(() => {
    let ws: WebSocket | undefined;
    let stopped = false;
    let retry = 0;
    let ping = 0;
    let timer = 0;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/realtime`);
      ws.onopen = () => {
        retry = 0;
        ping = window.setInterval(() => ws?.send("ping"), 25_000);
      };
      ws.onmessage = (m) => {
        if (m.data !== "pong") onEvent(JSON.parse(m.data));
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (!stopped) timer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ping);
      ws?.close();
    };
  }, []);

  const loadMore = useEffectEvent(() => {
    if (page.next && !loading) load(tab, true);
  });
  useEffect(() => {
    if (!sentinel.current) return;
    const io = new IntersectionObserver((es) => es[0].isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, []);

  const handlers = {
    async like(p: FeedPost) {
      patch(p.id, (q) => ({ liked: !q.liked, likes: q.likes + (q.liked ? -1 : 1) }));
      try {
        await actions.toggleLike(p.id);
      } catch {
        patch(p.id, (q) => ({ liked: !q.liked, likes: q.likes + (q.liked ? -1 : 1) }));
      }
    },
    async repost(p: FeedPost) {
      patch(p.id, (q) => ({ reposted: !q.reposted, reposts: q.reposts + (q.reposted ? -1 : 1) }));
      try {
        await actions.toggleRepost(p.id);
      } catch {
        patch(p.id, (q) => ({ reposted: !q.reposted, reposts: q.reposts + (q.reposted ? -1 : 1) }));
      }
    },
    async follow(authorId: string) {
      const { following: now } = await actions.toggleFollow(authorId);
      setFollowing((s) => {
        const n = new Set(s);
        if (now) n.add(authorId);
        else n.delete(authorId);
        return n;
      });
      setPage((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.author.id === authorId ? { ...p, following: now } : p)) }));
    },
    async remove(p: FeedPost) {
      if (!confirm("Delete this post?")) return;
      await actions.deletePost(p.entryId);
      setPage((pg) => ({ ...pg, posts: pg.posts.filter((q) => q.entryId !== p.entryId && q.id !== p.entryId) }));
    },
  };

  return (
    <>
      {!single && (
        <>
          <header className="sticky top-0 z-10 flex h-14 border-b border-border bg-background/80 backdrop-blur">
            {(["for-you", "following"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => {
                  setTab(t);
                  load(t);
                }}
                className={`relative flex-1 text-sm transition-colors hover:bg-surface ${tab === t ? "font-medium text-foreground" : "text-muted"}`}
              >
                {t === "for-you" ? "For you" : "Following"}
                {tab === t && <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 w-12 rounded-full bg-link" />}
              </button>
            ))}
          </header>
          <Composer viewer={viewer} onPosted={(p) => setPage((pg) => ({ ...pg, posts: [p, ...pg.posts] }))} />
        </>
      )}

      {fresh > 0 && (
        <div className="sticky top-16 z-10 flex justify-center">
          <button
            type="button"
            onClick={() => {
              load(tab);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-2 h-8 rounded-full bg-link px-4 text-sm font-medium text-background shadow-lg"
          >
            Show {fresh} new {fresh === 1 ? "post" : "posts"}
          </button>
        </div>
      )}

      {page.posts.map((p) => (
        <PostCard key={p.entryId} post={p} viewerId={viewer.id} openComments={single} {...handlers} />
      ))}

      {!single && (
        <div ref={sentinel} className="py-8 text-center text-sm text-muted">
          {loading ? "Loading…" : page.posts.length === 0 ? (tab === "following" ? "Follow people to see their posts here." : "No posts yet. Be the first to share something.") : page.next ? "" : "You're all caught up."}
        </div>
      )}
    </>
  );
}

function Composer({ viewer, onPosted }: { viewer: Viewer; onPosted: (p: FeedPost) => void }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const all = [...files.map((f) => f.file), ...picked];
    const videos = all.filter((f) => isVideo(f.type)).length;
    const bad = picked.find((f) => !MEDIA_TYPES[f.type]);
    const big = picked.find((f) => f.size > maxBytes(f.type));
    if (bad) setError("Only JPEG, PNG, WebP, GIF, MP4 and WebM are supported");
    else if (big) setError(`${big.name} is too large (max ${maxBytes(big.type) / 1024 / 1024} MB)`);
    else if (videos > 1 || (videos && all.length > 1) || all.length > MAX_IMAGES) setError(`Add up to ${MAX_IMAGES} images or 1 video`);
    else {
      setError("");
      setFiles((fs) => [...fs, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    }
  }

  function removeFile(i: number) {
    URL.revokeObjectURL(files[i].url);
    setFiles((fs) => fs.filter((_, j) => j !== i));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const keys: string[] = [];
      for (const { file } of files) {
        const res = await fetch("/api/uploads", { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        const json = (await res.json()) as { key?: string; error?: string };
        if (!res.ok || !json.key) throw new Error(json.error || "Upload failed");
        keys.push(json.key);
      }
      const res = await actions.createPost({ body, media: keys });
      if ("error" in res) throw new Error(res.error);
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
      setBody("");
      onPosted(res.post);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const canPost = !busy && (body.trim().length > 0 || files.length > 0);
  const hasVideo = files.some((f) => isVideo(f.file.type));

  return (
    <section className="flex gap-3 border-b border-border p-4">
      <Avatar name={viewer.name} src={viewer.imageUrl} />
      <div className="min-w-0 flex-1">
        <textarea
          rows={Math.min(8, Math.max(2, body.split("\n").length))}
          value={body}
          maxLength={MAX_POST_CHARS}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && canPost && submit()}
          placeholder="Share an update or opportunity"
          aria-label="Write a post"
          className="w-full resize-none bg-transparent pt-2 text-[15px] placeholder:text-muted outline-none"
        />
        {files.length > 0 && (
          <div className={`mt-2 grid gap-2 ${files.length > 1 ? "grid-cols-2" : ""}`}>
            {files.map((f, i) => (
              <div key={f.url} className="relative overflow-hidden rounded-xl border border-border bg-surface">
                {isVideo(f.file.type) ? (
                  <video src={f.url} controls className="max-h-[360px] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img src={f.url} alt="" className={`w-full object-cover ${files.length > 1 ? "aspect-square" : "max-h-[360px]"}`} />
                )}
                <button type="button" aria-label="Remove" onClick={() => removeFile(i)} disabled={busy} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black">
                  <Icon d={icons.close} size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1">
            <input ref={imageInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
            <input ref={videoInput} type="file" hidden accept="video/mp4,video/webm" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
            <button type="button" className={iconBtn} disabled={busy || hasVideo || files.length >= MAX_IMAGES} onClick={() => imageInput.current?.click()}>
              <Icon d={icons.photo} size={16} />
              <span className="hidden sm:inline">Photo</span>
            </button>
            <button type="button" className={iconBtn} disabled={busy || files.length > 0} onClick={() => videoInput.current?.click()}>
              <Icon d={icons.video} size={16} />
              <span className="hidden sm:inline">Video</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {body.length > MAX_POST_CHARS - 200 && <span className="text-xs tabular-nums text-muted">{MAX_POST_CHARS - body.length}</span>}
            <button type="button" disabled={!canPost} onClick={submit} className="h-8 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60">
              {busy ? (files.length ? "Uploading…" : "Posting…") : "Post"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type Handlers = {
  like: (p: FeedPost) => void;
  repost: (p: FeedPost) => void;
  follow: (authorId: string) => void;
  remove: (p: FeedPost) => void;
};

function PostCard({ post: p, viewerId, openComments, like, repost, follow, remove }: { post: FeedPost; viewerId: string; openComments?: boolean } & Handlers) {
  const [menu, setMenu] = useState(false);
  const [showComments, setShowComments] = useState(!!openComments);
  const [copied, setCopied] = useState(false);
  const mine = p.author.id === viewerId;
  const ownEntry = p.repostedBy ? p.repostedBy.id === viewerId : mine;

  async function share() {
    const url = `${location.origin}/dashboard/post/${p.id}`;
    if (navigator.share) {
      await navigator.share({ url, title: `Post by ${p.author.name}` }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <article className="border-b border-border p-4">
      {p.repostedBy && (
        <p className="mb-2 ml-[52px] flex items-center gap-1.5 text-xs text-muted">
          <Icon d={icons.repost} size={12} />
          {p.repostedBy.id === viewerId ? "You" : p.repostedBy.name} reposted
        </p>
      )}
      <div className="flex gap-3">
        <Avatar name={p.author.name} src={p.author.imageUrl ?? undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm">
                <span className="truncate font-medium">{p.author.name}</span>
                <Link href={`/dashboard/post/${p.id}`} className="shrink-0 text-muted hover:underline" suppressHydrationWarning>
                  · {ago(p.createdAt)}
                </Link>
                {!mine && !p.following && (
                  <button type="button" onClick={() => follow(p.author.id)} className="ml-1 shrink-0 text-sm font-medium text-link hover:underline">
                    Follow
                  </button>
                )}
              </p>
              {p.author.headline && <p className="truncate text-xs text-muted">{p.author.headline}</p>}
            </div>
            {(ownEntry || (!mine && p.following)) && (
              <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setMenu(false)}>
                <button type="button" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground">
                  <Icon d={icons.more} size={18} />
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm shadow-xl">
                    {ownEntry && !p.repostedBy && (
                      <button type="button" role="menuitem" onClick={() => (setMenu(false), remove(p))} className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-surface-hover">
                        <Icon d={icons.trash} size={14} /> Delete post
                      </button>
                    )}
                    {ownEntry && p.repostedBy && (
                      <button type="button" role="menuitem" onClick={() => (setMenu(false), repost(p))} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-hover">
                        <Icon d={icons.repost} size={14} /> Undo repost
                      </button>
                    )}
                    {!mine && p.following && (
                      <button type="button" role="menuitem" onClick={() => (setMenu(false), follow(p.author.id))} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-hover">
                        <Icon d={icons.connect} size={14} /> Unfollow {p.author.name.split(" ")[0]}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {p.body && <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{p.body}</p>}
          <MediaGrid media={p.media} />

          <div className="-ml-2 mt-2 flex justify-between sm:max-w-[420px]">
            <button type="button" aria-label="Like" aria-pressed={p.liked} onClick={() => like(p)} className={`${iconBtn} ${p.liked ? "text-danger hover:text-danger" : ""}`}>
              <Icon d={icons.like} size={16} className={p.liked ? "fill-current" : ""} />
              <span className="tabular-nums">{p.likes}</span>
            </button>
            <button type="button" aria-label="Comment" aria-expanded={showComments} onClick={() => setShowComments((s) => !s)} className={`${iconBtn} ${showComments ? "text-foreground" : ""}`}>
              <Icon d={icons.comment} size={16} />
              <span className="tabular-nums">{p.comments}</span>
            </button>
            <button
              type="button"
              aria-label="Repost"
              aria-pressed={p.reposted}
              disabled={mine}
              title={mine ? "You can't repost your own post" : undefined}
              onClick={() => repost(p)}
              className={`${iconBtn} ${p.reposted ? "text-emerald-400 hover:text-emerald-400" : ""}`}
            >
              <Icon d={icons.repost} size={16} />
              <span className="tabular-nums">{p.reposts}</span>
            </button>
            <button type="button" aria-label="Share" onClick={share} className={iconBtn}>
              <Icon d={icons.share} size={16} />
              {copied && <span className="text-xs">Link copied</span>}
            </button>
          </div>

          {showComments && <Comments postId={p.id} count={p.comments} />}
        </div>
      </div>
    </article>
  );
}

function MediaGrid({ media }: { media: FeedPost["media"] }) {
  if (media.length === 0) return null;
  const src = (key: string) => `/api/media/${key}`;
  if (isVideo(media[0].type)) {
    return <video src={src(media[0].key)} controls playsInline preload="metadata" className="mt-3 max-h-[520px] w-full rounded-xl border border-border bg-black" />;
  }
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-xl border border-border ${media.length > 1 ? "grid-cols-2" : ""}`}>
      {media.map((m) => (
        <a key={m.key} href={src(m.key)} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated R2 media, served by /api/media */}
          <img src={src(m.key)} alt="" loading="lazy" decoding="async" className={`w-full bg-surface object-cover ${media.length > 1 ? "aspect-square" : "max-h-[520px]"}`} />
        </a>
      ))}
    </div>
  );
}

function Comments({ postId, count }: { postId: string; count: number }) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // (Re)load when opened and whenever the live count changes, so others' comments appear in realtime
  useEffect(() => {
    let live = true;
    actions.loadComments(postId).then((c) => live && setItems(c), () => live && setError("Couldn't load comments"));
    return () => {
      live = false;
    };
  }, [postId, count]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await actions.addComment(postId, body);
      if ("error" in res) throw new Error(res.error);
      setItems(res.comments);
      setBody("");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_COMMENT_CHARS}
          placeholder="Add a comment"
          aria-label="Add a comment"
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted outline-none focus:border-ring"
        />
        <button type="submit" disabled={busy || !body.trim()} className="h-9 rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:opacity-60">
          Reply
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {items === null ? (
        <p className="text-sm text-muted">Loading comments…</p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar name={c.author.name} src={c.author.imageUrl ?? undefined} size={28} />
              <div className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2">
                <p className="text-xs">
                  <span className="font-medium">{c.author.name}</span>{" "}
                  <span className="text-muted" suppressHydrationWarning>· {ago(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
