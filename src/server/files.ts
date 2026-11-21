import { env } from "cloudflare:workers";
import { MAX_IMAGE_BYTES } from "@/lib/animation";

// Images and videos live in the app's R2 bucket (resources.r2: ["files"]).

const MAX_VIDEO_BYTES = 95 * 1024 * 1024;

export class UploadError extends Error {}

/** The image's type from its first bytes, or an UploadError a person can act on. */
export async function checkImage(
  file: File,
): Promise<"image/png" | "image/jpeg"> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UploadError("Images must be 10 MB or smaller.");
  }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => head[i] === b)) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  throw new UploadError("Choose a JPG or PNG image.");
}

/** The video's type; only the recorder's formats are kept. */
export function checkVideo(file: File): string {
  if (file.size === 0) throw new UploadError("The video is empty.");
  if (file.size > MAX_VIDEO_BYTES) {
    throw new UploadError("The video is too large to save.");
  }
  const type = file.type.split(";")[0]!.trim().toLowerCase();
  if (type !== "video/webm" && type !== "video/mp4") {
    throw new UploadError("Only WebM or MP4 videos can be saved.");
  }
  return type;
}

export async function putFile(key: string, file: File, contentType: string) {
  await env.files.put(key, file.stream(), {
    httpMetadata: { contentType },
  });
}

export function getFile(key: string) {
  return env.files.get(key);
}

export async function deleteFiles(keys: string[]) {
  if (keys.length) await env.files.delete(keys);
}

/** A project name from a file name: "beach-day.png" → "beach-day". */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return (base || "Untitled").slice(0, 120);
}
