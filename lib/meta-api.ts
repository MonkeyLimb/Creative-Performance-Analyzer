export const META_API_VERSION = process.env.META_API_VERSION || "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export type AssetRef =
  | { kind: "image"; url: string; label: string }
  | { kind: "image-hash"; hash: string; label: string }
  | { kind: "video"; videoId: string; url?: string; label: string };

export type ResolvedAsset = {
  kind: "image" | "video";
  url: string;
  label: string;
};

export type MetaCreative = {
  id?: string;
  object_type?: string;
  image_url?: string;
  image_hash?: string;
  video_id?: string;
  thumbnail_url?: string;
  object_story_spec?: {
    link_data?: {
      picture?: string;
      image_hash?: string;
      video_id?: string;
      child_attachments?: Array<{
        picture?: string;
        video_id?: string;
        image_hash?: string;
      }>;
    };
    video_data?: {
      video_id?: string;
      image_url?: string;
      image_hash?: string;
    };
  };
  asset_feed_spec?: {
    images?: Array<{ url?: string; hash?: string }>;
    videos?: Array<{ video_id?: string; thumbnail_url?: string }>;
  };
};

export type MetaAd = {
  id?: string;
  name?: string;
  account_id?: string;
  creative?: MetaCreative;
};

export class MetaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

export function extractAssetRefs(creative: MetaCreative | undefined): AssetRef[] {
  if (!creative) return [];
  const refs: AssetRef[] = [];

  if (creative.image_url) {
    refs.push({ kind: "image", url: creative.image_url, label: "image" });
  } else if (creative.image_hash) {
    refs.push({ kind: "image-hash", hash: creative.image_hash, label: "image" });
  }
  if (creative.video_id) {
    refs.push({ kind: "video", videoId: creative.video_id, label: "video" });
  }

  const linkData = creative.object_story_spec?.link_data;
  const videoData = creative.object_story_spec?.video_data;
  if (videoData?.video_id) {
    refs.push({ kind: "video", videoId: videoData.video_id, label: "video" });
  } else if (videoData?.image_hash) {
    refs.push({ kind: "image-hash", hash: videoData.image_hash, label: "video-thumb" });
  }
  if (linkData?.image_hash && !linkData.picture) {
    refs.push({ kind: "image-hash", hash: linkData.image_hash, label: "image" });
  } else if (linkData?.picture) {
    refs.push({ kind: "image", url: linkData.picture, label: "image" });
  }

  const children = linkData?.child_attachments || [];
  children.forEach((child, i) => {
    const idx = String(i + 1).padStart(2, "0");
    if (child.video_id) {
      refs.push({
        kind: "video",
        videoId: child.video_id,
        label: `${idx}-carousel-video`,
      });
    } else if (child.picture) {
      refs.push({
        kind: "image",
        url: child.picture,
        label: `${idx}-carousel-image`,
      });
    } else if (child.image_hash) {
      refs.push({
        kind: "image-hash",
        hash: child.image_hash,
        label: `${idx}-carousel-image`,
      });
    }
  });

  const feed = creative.asset_feed_spec;
  (feed?.images || []).forEach((img, i) => {
    const idx = String(i + 1).padStart(2, "0");
    if (img.url) {
      refs.push({ kind: "image", url: img.url, label: `${idx}-dynamic-image` });
    } else if (img.hash) {
      refs.push({
        kind: "image-hash",
        hash: img.hash,
        label: `${idx}-dynamic-image`,
      });
    }
  });
  (feed?.videos || []).forEach((v, i) => {
    if (v.video_id) {
      const idx = String(i + 1).padStart(2, "0");
      refs.push({
        kind: "video",
        videoId: v.video_id,
        label: `${idx}-dynamic-video`,
      });
    }
  });

  return dedupeRefs(refs);
}

function dedupeRefs(refs: AssetRef[]): AssetRef[] {
  const seen = new Set<string>();
  const out: AssetRef[] = [];
  for (const r of refs) {
    const key =
      r.kind === "image"
        ? `i:${r.url}`
        : r.kind === "image-hash"
          ? `h:${r.hash}`
          : `v:${r.videoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function summarizeCreative(creative: MetaCreative | undefined): string {
  if (!creative) return "(no creative)";
  const keys = Object.keys(creative).filter((k) => creative[k as keyof MetaCreative] != null);
  const parts: string[] = [...keys];
  const oss = creative.object_story_spec;
  if (oss) {
    const ossKeys = Object.keys(oss).filter((k) => (oss as Record<string, unknown>)[k] != null);
    parts.push(`object_story_spec[${ossKeys.join(",")}]`);
  }
  const feed = creative.asset_feed_spec;
  if (feed) {
    parts.push(
      `asset_feed_spec[images:${feed.images?.length ?? 0},videos:${feed.videos?.length ?? 0}]`,
    );
  }
  return parts.join(" ");
}

export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "creative"
  );
}

export function extensionFor(
  kind: "image" | "video",
  contentType: string | null,
  url: string,
): string {
  const ct = (contentType || "").toLowerCase();
  if (kind === "video") {
    if (ct.includes("mp4")) return "mp4";
    if (ct.includes("quicktime")) return "mov";
    if (ct.includes("webm")) return "webm";
    return "mp4";
  }
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  const m = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
  return "jpg";
}

async function graphGet<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${META_API_BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new MetaApiError(`Non-JSON response from Meta (${path})`, 502);
  }
  const obj = json as { error?: { message?: string; code?: number } };
  if (!res.ok || obj.error) {
    const msg = obj.error?.message || `Meta API error (HTTP ${res.status})`;
    let mapped = res.status;
    if (res.status === 400 && /(token|OAuth|session)/i.test(msg)) mapped = 401;
    throw new MetaApiError(msg, mapped);
  }
  return json as T;
}

export async function fetchAd(adId: string, token: string): Promise<MetaAd> {
  const creativeFields = [
    "id",
    "object_type",
    "image_url",
    "image_hash",
    "video_id",
    "thumbnail_url",
    "object_story_spec{link_data{picture,image_hash,video_id,child_attachments.limit(50){picture,image_hash,video_id}},video_data{video_id,image_hash,image_url}}",
    "asset_feed_spec{images.limit(100){hash,url},videos.limit(100){video_id,thumbnail_url,thumbnail_hash}}",
  ].join(",");
  return graphGet<MetaAd>(adId, token, {
    fields: `name,account_id,creative{${creativeFields}}`,
  });
}

export async function resolveVideoSource(videoId: string, token: string): Promise<string> {
  const v = await graphGet<{ source?: string }>(videoId, token, { fields: "source" });
  if (!v.source) throw new MetaApiError(`Video ${videoId} has no source URL`, 404);
  return v.source;
}

export async function resolveImageHashes(
  accountId: string,
  hashes: string[],
  token: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (hashes.length === 0) return map;
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const json = await graphGet<{
    data?: Array<{ hash?: string; url?: string; permalink_url?: string }>;
  }>(`${act}/adimages`, token, {
    fields: "hash,url,permalink_url",
    hashes: JSON.stringify(hashes),
    limit: "200",
  });
  for (const img of json.data || []) {
    if (img.hash && (img.url || img.permalink_url)) {
      map.set(img.hash, img.url || img.permalink_url || "");
    }
  }
  return map;
}

export async function resolveAssetUrls(
  refs: AssetRef[],
  token: string,
  accountId?: string,
): Promise<ResolvedAsset[]> {
  const hashes = refs
    .filter((r): r is Extract<AssetRef, { kind: "image-hash" }> => r.kind === "image-hash")
    .map((r) => r.hash);
  const hashMap =
    hashes.length > 0 && accountId
      ? await resolveImageHashes(accountId, hashes, token)
      : new Map<string, string>();

  const out: ResolvedAsset[] = [];
  for (const ref of refs) {
    if (ref.kind === "image") {
      out.push({ kind: "image", url: ref.url, label: ref.label });
    } else if (ref.kind === "image-hash") {
      const url = hashMap.get(ref.hash);
      if (url) out.push({ kind: "image", url, label: ref.label });
    } else {
      const url = ref.url || (await resolveVideoSource(ref.videoId, token));
      out.push({ kind: "video", url, label: ref.label });
    }
  }
  return out;
}
