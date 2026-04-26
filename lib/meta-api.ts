export const META_API_VERSION = process.env.META_API_VERSION || "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export type AssetRef =
  | { kind: "image"; url: string; label: string }
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
  video_id?: string;
  thumbnail_url?: string;
  object_story_spec?: {
    link_data?: {
      picture?: string;
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
  }
  if (creative.video_id) {
    refs.push({ kind: "video", videoId: creative.video_id, label: "video" });
  }

  const linkData = creative.object_story_spec?.link_data;
  const videoData = creative.object_story_spec?.video_data;
  if (videoData?.video_id) {
    refs.push({ kind: "video", videoId: videoData.video_id, label: "video" });
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
    }
  });

  const feed = creative.asset_feed_spec;
  (feed?.images || []).forEach((img, i) => {
    if (img.url) {
      const idx = String(i + 1).padStart(2, "0");
      refs.push({ kind: "image", url: img.url, label: `${idx}-dynamic-image` });
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
    const key = r.kind === "image" ? `i:${r.url}` : `v:${r.videoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
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
  return graphGet<MetaAd>(adId, token, {
    fields:
      "name,creative{id,object_type,image_url,video_id,thumbnail_url,object_story_spec,asset_feed_spec}",
  });
}

export async function resolveVideoSource(videoId: string, token: string): Promise<string> {
  const v = await graphGet<{ source?: string }>(videoId, token, { fields: "source" });
  if (!v.source) throw new MetaApiError(`Video ${videoId} has no source URL`, 404);
  return v.source;
}

export async function resolveAssetUrls(
  refs: AssetRef[],
  token: string,
): Promise<ResolvedAsset[]> {
  const out: ResolvedAsset[] = [];
  for (const ref of refs) {
    if (ref.kind === "image") {
      out.push({ kind: "image", url: ref.url, label: ref.label });
    } else {
      const url = ref.url || (await resolveVideoSource(ref.videoId, token));
      out.push({ kind: "video", url, label: ref.label });
    }
  }
  return out;
}
