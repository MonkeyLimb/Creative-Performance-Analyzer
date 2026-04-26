#!/usr/bin/env node
// Phase 0 validation: confirm we can pull creative assets for a real ad.
// Usage:
//   META_TOKEN=... META_AD_ID=... node scripts/validate-meta-creative.mjs
//   META_TOKEN=... node scripts/validate-meta-creative.mjs <adId>

const API_VERSION = process.env.META_API_VERSION || "v21.0";
const TOKEN = process.env.META_TOKEN;
const AD_ID = process.argv[2] || process.env.META_AD_ID;

if (!TOKEN) {
  console.error("Missing META_TOKEN env var.");
  process.exit(1);
}
if (!AD_ID) {
  console.error("Missing ad id. Pass META_AD_ID env or argv[2].");
  process.exit(1);
}

const BASE = `https://graph.facebook.com/${API_VERSION}`;

async function graph(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${path}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || json.error) {
    const msg = json.error?.message || `HTTP ${res.status}`;
    throw new Error(`Graph ${path} failed: ${msg}`);
  }
  return json;
}

function extractRefs(creative) {
  const refs = [];
  const cre = creative || {};
  if (cre.image_url) refs.push({ kind: "image", url: cre.image_url, label: "image" });
  if (cre.video_id) refs.push({ kind: "video", videoId: cre.video_id, label: "video" });

  const linkData = cre.object_story_spec?.link_data;
  const children = linkData?.child_attachments || [];
  children.forEach((child, i) => {
    if (child.video_id) {
      refs.push({ kind: "video", videoId: child.video_id, label: `carousel-${i + 1}-video` });
    } else if (child.picture) {
      refs.push({ kind: "image", url: child.picture, label: `carousel-${i + 1}-image` });
    }
  });

  const feed = cre.asset_feed_spec || {};
  (feed.images || []).forEach((img, i) => {
    if (img.url) refs.push({ kind: "image", url: img.url, label: `dynamic-image-${i + 1}` });
  });
  (feed.videos || []).forEach((v, i) => {
    if (v.video_id) refs.push({ kind: "video", videoId: v.video_id, label: `dynamic-video-${i + 1}` });
  });

  return refs;
}

async function probe(url) {
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

(async () => {
  console.log(`Ad: ${AD_ID}  (API ${API_VERSION})`);
  const ad = await graph(AD_ID, {
    fields:
      "name,creative{id,object_type,image_url,video_id,thumbnail_url,object_story_spec,asset_feed_spec}",
  });
  console.log(`Name: ${ad.name || "(unnamed)"}`);
  if (!ad.creative) {
    console.error("No creative on this ad.");
    process.exit(2);
  }
  const refs = extractRefs(ad.creative);
  console.log(`Extracted ${refs.length} asset ref(s).`);

  for (const ref of refs) {
    if (ref.kind === "video" && ref.videoId) {
      try {
        const v = await graph(ref.videoId, { fields: "source" });
        ref.url = v.source;
      } catch (e) {
        console.log(`  - ${ref.label} [video ${ref.videoId}]: lookup failed: ${e.message}`);
        continue;
      }
    }
    if (!ref.url) {
      console.log(`  - ${ref.label}: no URL`);
      continue;
    }
    const probed = await probe(ref.url);
    console.log(
      `  - ${ref.label} [${ref.kind}] ${probed.ok ? "OK" : "FAIL"} status=${probed.status}${
        probed.contentType ? ` ct=${probed.contentType}` : ""
      }`,
    );
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
