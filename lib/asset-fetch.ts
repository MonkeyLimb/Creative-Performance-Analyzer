// Client-side helpers for pulling thumbnails into the Markdown export.
//
// Two stages:
//   1. fetchThumbnailUrls — resolve { adId -> hosted Meta CDN URL } via our
//      /api/meta/thumbnail route. Cheap, fast (single Graph call per ad).
//   2. urlsToDataUris — for "portable" mode, download each image and inline
//      it as a base64 data URI. Expensive (downloads the bytes), but the
//      resulting .md file renders offline.
//
// Both helpers cap concurrency to avoid hammering Meta or the user's network.

export type ThumbnailUrlMap = Map<string, string | null>;

const CONCURRENCY = 4;

export async function fetchThumbnailUrls(
  adIds: string[],
  token: string,
): Promise<ThumbnailUrlMap> {
  const unique = Array.from(new Set(adIds.filter((id) => !!id)));
  const out: ThumbnailUrlMap = new Map();
  if (!token || unique.length === 0) return out;

  await mapPool(unique, CONCURRENCY, async (adId) => {
    try {
      const res = await fetch("/api/meta/thumbnail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adId }),
      });
      if (!res.ok) {
        out.set(adId, null);
        return;
      }
      const data = (await res.json()) as { imageUrl?: string | null };
      out.set(adId, data.imageUrl ?? null);
    } catch {
      out.set(adId, null);
    }
  });

  return out;
}

export async function urlsToDataUris(
  urls: string[],
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(urls.filter((u) => !!u)));
  const out = new Map<string, string | null>();
  if (unique.length === 0) return out;

  await mapPool(unique, CONCURRENCY, async (url) => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        out.set(url, null);
        return;
      }
      const buf = await res.arrayBuffer();
      const mime = res.headers.get("content-type") || "image/jpeg";
      const base64 = arrayBufferToBase64(buf);
      out.set(url, `data:${mime};base64,${base64}`);
    } catch {
      out.set(url, null);
    }
  });

  return out;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Chunk to avoid hitting argument-length limits on very large buffers.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}
