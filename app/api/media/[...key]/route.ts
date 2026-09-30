import { auth } from "@clerk/nextjs/server";
import { env } from "cloudflare:workers";

/** Serves post media from R2 to signed-in users, with Range support so videos can seek. */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const key = (await params).key.map(decodeURIComponent).join("/");
  const obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  // Keys are random and immutable; "private" keeps shared caches from serving auth-gated media
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  // Stored type comes from our allowlist; never let the browser sniff it into something executable
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");

  if (!("body" in obj)) return new Response(null, { status: 304, headers }); // onlyIf (If-None-Match) matched

  const range = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (range && request.headers.has("Range")) {
    const offset = range.suffix != null ? obj.size - range.suffix : (range.offset ?? 0);
    const length = range.suffix ?? range.length ?? obj.size - offset;
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("Content-Length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { headers });
}
