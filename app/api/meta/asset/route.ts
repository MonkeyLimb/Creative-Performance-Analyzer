import { NextRequest } from "next/server";
import archiver from "archiver";
import { Readable } from "node:stream";
import {
  MetaApiError,
  extensionFor,
  extractAssetRefs,
  fetchAd,
  fetchAdAssetBreakdown,
  mergeRefs,
  resolveAssetUrls,
  safeFilename,
  summarizeCreative,
} from "@/lib/meta-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: { adId?: string; debug?: "shape" };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const adId = (body.adId || "").trim();
  if (!adId) return jsonError("Missing adId", 400);

  const token = getToken(req);
  if (!token) return jsonError("Missing Meta access token", 401);

  try {
    const ad = await fetchAd(adId, token);

    if (body.debug === "shape") {
      const filename = `${safeFilename(ad.name || `ad-${adId}`)}-${adId}-creative.json`;
      return new Response(JSON.stringify(ad, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const creativeRefs = extractAssetRefs(ad.creative);
    const breakdown = await fetchAdAssetBreakdown(adId, token);
    const refs = mergeRefs(creativeRefs, breakdown.refs);
    const shape = summarizeCreative(ad.creative);
    if (refs.length === 0) {
      return jsonError(
        `No assets found. Creative: ${shape}. Breakdown errors: ${breakdown.errors.join("; ") || "none"}`,
        404,
      );
    }

    const resolved = await resolveAssetUrls(refs, token, ad.account_id);
    if (resolved.length === 0) {
      return jsonError(
        "Found asset references but could not resolve any URLs (image hashes may need ads_management scope)",
        502,
      );
    }
    const archive = archiver("zip", { zlib: { level: 6 } });

    let appended = 0;
    for (const asset of resolved) {
      const res = await fetch(asset.url, { cache: "no-store" });
      if (!res.ok || !res.body) continue;
      const ext = extensionFor(
        asset.kind,
        res.headers.get("content-type"),
        asset.url,
      );
      const name = `${asset.label}.${ext}`;
      archive.append(Readable.fromWeb(res.body as never), { name });
      appended++;
    }

    if (appended === 0) {
      return jsonError("Asset URLs were unreachable", 502);
    }

    const filename = `${safeFilename(ad.name || `ad-${adId}`)}-${adId}.zip`;
    archive.finalize();

    return new Response(Readable.toWeb(archive) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Asset-Found": String(refs.length),
        "X-Asset-Creative": String(creativeRefs.length),
        "X-Asset-Breakdown": String(breakdown.refs.length),
        "X-Asset-Resolved": String(resolved.length),
        "X-Asset-Added": String(appended),
        "X-Creative-Shape": shape,
      },
    });
  } catch (e) {
    if (e instanceof MetaApiError) {
      return jsonError(e.message, e.status);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(msg, 500);
  }
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
