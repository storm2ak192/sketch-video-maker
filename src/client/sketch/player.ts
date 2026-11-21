import {
  QUALITIES,
  fillSecondsOf,
  totalSeconds,
  type AnimationOptions,
} from "@/lib/animation";
import { handSprite } from "./hands";
import { traceStrokes, workingSize } from "./strokes";

// Renders the hand-drawn animation of one picture at a given time: strokes
// drawn in order over the sketch time, then shading or colour brushed in over
// the fill time, then the finished picture held.

export type Phase = "ready" | "sketch" | "fill" | "hold" | "done";

const BOARD = "#ffffff";
const INK = "#1c1c1c";
const BANDS = 7;

export interface Scene {
  width: number;
  height: number;
  /** Strokes in frame pixels, with each one's length. */
  lines: Float32Array[];
  lengths: number[];
  total: number;
  color: HTMLCanvasElement;
  gray: HTMLCanvasElement;
  box: { x: number; y: number; w: number; h: number };
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function buildScene(
  img: HTMLImageElement,
  quality: AnimationOptions["quality"],
): Scene {
  const { width, height } = QUALITIES[quality];
  const scale = Math.min(
    (width * 0.9) / img.naturalWidth,
    (height * 0.9) / img.naturalHeight,
  );
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const box = {
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    w,
    h,
  };

  const work = workingSize(img.naturalWidth, img.naturalHeight);
  const small = canvasOf(work.width, work.height);
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.fillStyle = BOARD;
  sctx.fillRect(0, 0, work.width, work.height);
  sctx.drawImage(img, 0, 0, work.width, work.height);
  const strokes = traceStrokes(
    sctx.getImageData(0, 0, work.width, work.height).data,
    work.width,
    work.height,
  );
  const sx = w / work.width;
  const sy = h / work.height;
  const lines = strokes.lines.map((line) => {
    const out = new Float32Array(line.length);
    for (let k = 0; k < line.length; k += 2) {
      out[k] = box.x + line[k]! * sx;
      out[k + 1] = box.y + line[k + 1]! * sy;
    }
    return out;
  });
  const lengths = lines.map((line) => {
    let len = 0;
    for (let k = 2; k < line.length; k += 2) {
      len += Math.hypot(line[k]! - line[k - 2]!, line[k + 1]! - line[k - 1]!);
    }
    return len;
  });

  const color = canvasOf(width, height);
  const cctx = color.getContext("2d", { willReadFrequently: true })!;
  cctx.fillStyle = BOARD;
  cctx.fillRect(0, 0, width, height);
  cctx.drawImage(img, box.x, box.y, w, h);
  const gray = canvasOf(width, height);
  const gctx = gray.getContext("2d")!;
  const data = cctx.getImageData(0, 0, width, height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  gctx.putImageData(data, 0, 0);

  return {
    width,
    height,
    lines,
    lengths,
    total: lengths.reduce((a, b) => a + b, 0),
    color,
    gray,
    box,
  };
}

export function phaseAt(options: AnimationOptions, t: number): Phase {
  const fill = fillSecondsOf(options);
  if (t < options.sketchSeconds) return "sketch";
  if (t < options.sketchSeconds + fill) return "fill";
  if (t < totalSeconds(options)) return "hold";
  return "done";
}

/** Draws frames of one scene onto one canvas, keeping work between frames. */
export class Renderer {
  private lines: HTMLCanvasElement;
  private paint: HTMLCanvasElement;
  private drawnLength = 0;
  private painted = 0;
  private lastTip: [number, number] | null = null;
  private ctx: CanvasRenderingContext2D;

  constructor(
    private canvas: HTMLCanvasElement,
    private scene: Scene,
    private options: AnimationOptions,
  ) {
    canvas.width = scene.width;
    canvas.height = scene.height;
    this.ctx = canvas.getContext("2d")!;
    this.lines = canvasOf(scene.width, scene.height);
    this.paint = canvasOf(scene.width, scene.height);
  }

  private reset() {
    this.lines
      .getContext("2d")!
      .clearRect(0, 0, this.scene.width, this.scene.height);
    this.paint
      .getContext("2d")!
      .clearRect(0, 0, this.scene.width, this.scene.height);
    this.drawnLength = 0;
    this.painted = 0;
    this.lastTip = null;
  }

  /** Strokes up to `target` length; returns where the pen is. */
  private drawLines(target: number): [number, number] | null {
    const { lines, lengths } = this.scene;
    const ctx = this.lines.getContext("2d")!;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, this.scene.height / 420);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let start = 0;
    let tip: [number, number] | null = null;
    for (let s = 0; s < lines.length; s++) {
      const end = start + lengths[s]!;
      if (end <= this.drawnLength) {
        start = end;
        continue;
      }
      if (start >= target) break;
      const line = lines[s]!;
      const from = Math.max(this.drawnLength, start) - start;
      const to = Math.min(target, end) - start;
      let walked = 0;
      ctx.beginPath();
      let begun = false;
      for (let k = 2; k < line.length; k += 2) {
        const x0 = line[k - 2]!,
          y0 = line[k - 1]!,
          x1 = line[k]!,
          y1 = line[k + 1]!;
        const seg = Math.hypot(x1 - x0, y1 - y0);
        if (walked + seg >= from && walked <= to) {
          const a = seg ? Math.max(0, (from - walked) / seg) : 0;
          const b = seg ? Math.min(1, (to - walked) / seg) : 1;
          const ax = x0 + (x1 - x0) * a,
            ay = y0 + (y1 - y0) * a;
          const bx = x0 + (x1 - x0) * b,
            by = y0 + (y1 - y0) * b;
          if (!begun) {
            ctx.moveTo(ax, ay);
            begun = true;
          }
          ctx.lineTo(bx, by);
          tip = [bx, by];
        }
        walked += seg;
        if (walked > to) break;
      }
      ctx.stroke();
      start = end;
    }
    this.drawnLength = Math.max(
      this.drawnLength,
      Math.min(target, this.scene.total),
    );
    return tip;
  }

  /** The brush's point at fill progress p: back and forth across bands. */
  private brushAt(p: number): [number, number] {
    const { box } = this.scene;
    const band = Math.min(BANDS - 1, Math.floor(p * BANDS));
    const f = p * BANDS - band;
    const y = box.y + ((band + 0.5) / BANDS) * box.h;
    const x = band % 2 === 0 ? box.x + f * box.w : box.x + (1 - f) * box.w;
    return [x, y];
  }

  /** Brushes the fill in up to progress p; returns the brush point. */
  private drawFill(p: number): [number, number] {
    const source =
      this.options.sketchStyle === "gray" ? this.scene.gray : this.scene.color;
    const ctx = this.paint.getContext("2d")!;
    if (p >= 1) {
      ctx.drawImage(source, 0, 0);
      this.painted = 1;
      return this.brushAt(1);
    }
    const pattern = ctx.createPattern(source, "no-repeat");
    if (pattern) ctx.strokeStyle = pattern;
    ctx.lineWidth = (this.scene.box.h / BANDS) * 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const steps = 24;
    const [sx, sy] = this.brushAt(this.painted);
    ctx.moveTo(sx, sy);
    for (let k = 1; k <= steps; k++) {
      const q = this.painted + ((p - this.painted) * k) / steps;
      const [x, y] = this.brushAt(q);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    this.painted = p;
    return this.brushAt(p);
  }

  /** The finished picture, as shown before playing and after the end. */
  renderFinal() {
    this.render(totalSeconds(this.options), false);
  }

  render(t: number, showHand = true) {
    const { sketchSeconds } = this.options;
    const fill = fillSecondsOf(this.options);
    const { total } = this.scene;
    const sketchTarget = Math.min(1, t / sketchSeconds) * total;
    const fillP =
      fill > 0 ? Math.min(1, Math.max(0, (t - sketchSeconds) / fill)) : 0;
    if (sketchTarget < this.drawnLength || (fill > 0 && fillP < this.painted)) {
      this.reset();
    }
    let tip = this.drawLines(sketchTarget);
    if (t >= sketchSeconds && this.drawnLength < total) {
      tip = this.drawLines(total);
    }
    if (fill > 0 && t > sketchSeconds) tip = this.drawFill(fillP);
    if (tip) this.lastTip = tip;
    else tip = this.lastTip;

    const ctx = this.ctx;
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, this.scene.width, this.scene.height);
    ctx.drawImage(this.paint, 0, 0);
    ctx.drawImage(this.lines, 0, 0);

    const phase = phaseAt(this.options, t);
    if (showHand && tip && (phase === "sketch" || phase === "fill")) {
      const sprite = handSprite(this.options.hand, this.scene.height * 0.55);
      if (sprite) {
        ctx.drawImage(sprite.canvas, tip[0] - sprite.tip, tip[1] - sprite.tip);
      }
    }
  }
}
