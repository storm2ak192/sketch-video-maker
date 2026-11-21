import { z } from "zod";

// The animation choices a project keeps, shared by the pages, the server and the drawing engine.

export const HANDS = [
  { id: "pen-light", label: "Pen, light skin", tool: "pen", skin: 0 },
  { id: "pen-medium", label: "Pen, medium skin", tool: "pen", skin: 1 },
  { id: "pen-tan", label: "Pen, tan skin", tool: "pen", skin: 2 },
  { id: "pen-dark", label: "Pen, dark skin", tool: "pen", skin: 3 },
  { id: "marker-light", label: "Marker, light skin", tool: "marker", skin: 0 },
  {
    id: "marker-medium",
    label: "Marker, medium skin",
    tool: "marker",
    skin: 1,
  },
  { id: "marker-tan", label: "Marker, tan skin", tool: "marker", skin: 2 },
  { id: "marker-dark", label: "Marker, dark skin", tool: "marker", skin: 3 },
] as const;

export type HandId = (typeof HANDS)[number]["id"] | "none";
const HAND_IDS = ["none", ...HANDS.map((h) => h.id)] as [HandId, ...HandId[]];

export const SKETCH_STYLES = [
  { id: "bw", label: "Black & white" },
  { id: "gray", label: "Gray" },
  { id: "color", label: "Colour" },
] as const;
export type SketchStyle = (typeof SKETCH_STYLES)[number]["id"];

export const QUALITIES = {
  "720p": { label: "720p", width: 1280, height: 720 },
  "1080p": { label: "1080p HD", width: 1920, height: 1080 },
} as const;
export type Quality = keyof typeof QUALITIES;

/** Seconds the finished picture stays on screen at the end of a video. */
const HOLD_SECONDS = 2;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png"] as const;

export const optionsSchema = z
  .object({
    hand: z.enum(HAND_IDS),
    sketchStyle: z.enum(["bw", "gray", "color"]),
    sketchSeconds: z.number().int().min(1).max(50),
    fillSeconds: z.number().int().min(0).max(50),
    quality: z.enum(["720p", "1080p"]),
  })
  .strict();
export type AnimationOptions = z.infer<typeof optionsSchema>;

export const DEFAULT_OPTIONS: AnimationOptions = {
  hand: "pen-light",
  sketchStyle: "color",
  sketchSeconds: 10,
  fillSeconds: 5,
  quality: "1080p",
};

/** Seconds of colour or shading; black & white has none. */
export function fillSecondsOf(options: AnimationOptions): number {
  return options.sketchStyle === "bw" ? 0 : options.fillSeconds;
}

/** The whole video: sketch, then fill, then the hold. */
export function totalSeconds(options: AnimationOptions): number {
  return options.sketchSeconds + fillSecondsOf(options) + HOLD_SECONDS;
}

/** 7 as "0:07", 65 as "1:05". */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024)
    return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
