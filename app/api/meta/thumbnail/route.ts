import { NextRequest } from "next/server";
import {
  MetaApiError,
  fetchAd,
  pickThumbnailUrl,
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
  let body: { adId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const adId = (body.adId || "").trim();
  if (!adId) return jsonResponse({ error: "Missing adId" }, 400);

  const token = getToken(req);
  if (!token) return jsonResponse({ error: "Missing Meta access token" }, 401);

  try {
    const ad = await fetchAd(adId, token);
    const imageUrl = pickThumbnailUrl(ad.creative);
    return jsonResponse({ adId, imageUrl }, 200);
  } catch (e) {
    if (e instanceof MetaApiError) return jsonResponse({ error: e.message }, e.status);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
