import { describe, expect, it } from "vitest";
import { extractAssetRefs, extensionFor, safeFilename } from "./meta-api";

describe("extractAssetRefs", () => {
  it("returns empty for missing creative", () => {
    expect(extractAssetRefs(undefined)).toEqual([]);
    expect(extractAssetRefs({})).toEqual([]);
  });

  it("extracts a single image", () => {
    const refs = extractAssetRefs({
      image_url: "https://cdn.example.com/a.jpg",
    });
    expect(refs).toEqual([
      { kind: "image", url: "https://cdn.example.com/a.jpg", label: "image" },
    ]);
  });

  it("extracts a single video", () => {
    const refs = extractAssetRefs({ video_id: "12345" });
    expect(refs).toEqual([
      { kind: "video", videoId: "12345", label: "video" },
    ]);
  });

  it("extracts video from object_story_spec.video_data", () => {
    const refs = extractAssetRefs({
      object_story_spec: { video_data: { video_id: "999" } },
    });
    expect(refs).toEqual([{ kind: "video", videoId: "999", label: "video" }]);
  });

  it("extracts a carousel with mixed image and video children", () => {
    const refs = extractAssetRefs({
      object_story_spec: {
        link_data: {
          child_attachments: [
            { picture: "https://cdn.example.com/c1.jpg" },
            { video_id: "vid-2" },
            { picture: "https://cdn.example.com/c3.jpg" },
          ],
        },
      },
    });
    expect(refs).toEqual([
      {
        kind: "image",
        url: "https://cdn.example.com/c1.jpg",
        label: "01-carousel-image",
      },
      { kind: "video", videoId: "vid-2", label: "02-carousel-video" },
      {
        kind: "image",
        url: "https://cdn.example.com/c3.jpg",
        label: "03-carousel-image",
      },
    ]);
  });

  it("extracts dynamic creative images and videos", () => {
    const refs = extractAssetRefs({
      asset_feed_spec: {
        images: [
          { url: "https://cdn.example.com/d1.jpg" },
          { url: "https://cdn.example.com/d2.jpg" },
        ],
        videos: [{ video_id: "dv-1" }],
      },
    });
    expect(refs).toEqual([
      {
        kind: "image",
        url: "https://cdn.example.com/d1.jpg",
        label: "01-dynamic-image",
      },
      {
        kind: "image",
        url: "https://cdn.example.com/d2.jpg",
        label: "02-dynamic-image",
      },
      { kind: "video", videoId: "dv-1", label: "01-dynamic-video" },
    ]);
  });

  it("dedupes repeated image urls and video ids", () => {
    const refs = extractAssetRefs({
      image_url: "https://cdn.example.com/a.jpg",
      object_story_spec: {
        link_data: {
          child_attachments: [{ picture: "https://cdn.example.com/a.jpg" }],
        },
      },
    });
    expect(refs).toEqual([
      { kind: "image", url: "https://cdn.example.com/a.jpg", label: "image" },
    ]);
  });
});

describe("safeFilename", () => {
  it("strips path-unsafe characters", () => {
    expect(safeFilename("My Ad / 2025 :: v2")).toBe("My_Ad_2025_v2");
  });

  it("falls back to 'creative' when fully stripped", () => {
    expect(safeFilename("///")).toBe("creative");
  });
});

describe("extensionFor", () => {
  it("uses content-type when present for images", () => {
    expect(extensionFor("image", "image/png", "x")).toBe("png");
    expect(extensionFor("image", "image/webp", "x")).toBe("webp");
    expect(extensionFor("image", "image/jpeg", "x")).toBe("jpg");
  });

  it("falls back to URL extension for images", () => {
    expect(extensionFor("image", null, "https://x/y.png?bust=1")).toBe("png");
    expect(extensionFor("image", null, "https://x/y.JPG")).toBe("jpg");
  });

  it("defaults videos to mp4", () => {
    expect(extensionFor("video", null, "https://x/y")).toBe("mp4");
    expect(extensionFor("video", "video/quicktime", "x")).toBe("mov");
  });
});
