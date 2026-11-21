import {
  QUALITIES,
  totalSeconds,
  type AnimationOptions,
} from "@/lib/animation";
import { Renderer, type Scene } from "./player";

// Records the animation into a video in the browser: frames drawn on a canvas
// in real time, captured and encoded by MediaRecorder.

const TYPES = [
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function recordingSupported() {
  return (
    typeof MediaRecorder !== "undefined" &&
    TYPES.some((t) => MediaRecorder.isTypeSupported(t))
  );
}

export async function recordVideo(
  scene: Scene,
  options: AnimationOptions,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<File> {
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t))!;
  const canvas = document.createElement("canvas");
  const renderer = new Renderer(canvas, scene, options);
  renderer.render(0);
  const stream = canvas.captureStream(30);
  const { height } = QUALITIES[options.quality];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: height >= 1080 ? 8_000_000 : 5_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const total = totalSeconds(options);
  recorder.start(1000);
  const started = performance.now();
  await new Promise<void>((resolve, reject) => {
    const frame = () => {
      if (signal.aborted) {
        reject(new DOMException("Cancelled", "AbortError"));
        return;
      }
      const t = (performance.now() - started) / 1000;
      renderer.render(Math.min(t, total));
      onProgress(Math.min(1, t / total));
      if (t >= total + 0.1) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }).finally(() => {
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  });
  await stopped;
  const type = mimeType.split(";")[0]!;
  const ext = type === "video/mp4" ? "mp4" : "webm";
  return new File(chunks, `animation.${ext}`, { type });
}
