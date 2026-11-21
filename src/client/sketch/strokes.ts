// Turns a picture into pen strokes: grayscale, smoothing, gradient edges with
// thinning and hysteresis, then each edge traced into a polyline, strokes
// ordered so the pen moves to the nearest unfinished line next.

interface Strokes {
  /** Polylines in the source's working pixels: x0, y0, x1, y1, ... */
  lines: Float32Array[];
  width: number;
  height: number;
}

const WORK_SIZE = 480;
const DIRS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;

export function workingSize(w: number, h: number) {
  const s = Math.min(1, WORK_SIZE / Math.max(w, h));
  return {
    width: Math.max(8, Math.round(w * s)),
    height: Math.max(8, Math.round(h * s)),
  };
}

/** Strokes from RGBA pixels (already drawn over white). */
export function traceStrokes(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Strokes {
  const n = width * height;
  // Each colour channel smoothed; the strongest channel's gradient wins, so
  // edges between colours of equal brightness are found too.
  const channels = [0, 1, 2].map((c) => {
    const plane = new Float32Array(n);
    for (let i = 0; i < n; i++) plane[i] = rgba[i * 4 + c]!;
    return blur(blur(plane, width, height), width, height);
  });

  const mag = new Float32Array(n);
  const dir = new Uint8Array(n);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      let best = 0;
      let bx = 0;
      let by = 0;
      for (const smooth of channels) {
        const a = smooth[i - width - 1]!,
          b = smooth[i - width]!,
          c = smooth[i - width + 1]!,
          d = smooth[i - 1]!,
          f = smooth[i + 1]!,
          g = smooth[i + width - 1]!,
          h = smooth[i + width]!,
          k = smooth[i + width + 1]!;
        const gx = c + 2 * f + k - a - 2 * d - g;
        const gy = g + 2 * h + k - a - 2 * b - c;
        const m = gx * gx + gy * gy;
        if (m > best) {
          best = m;
          bx = gx;
          by = gy;
        }
      }
      mag[i] = Math.sqrt(best);
      let angle = (Math.atan2(by, bx) * 180) / Math.PI;
      if (angle < 0) angle += 180;
      dir[i] =
        angle < 22.5 || angle >= 157.5
          ? 0
          : angle < 67.5
            ? 1
            : angle < 112.5
              ? 2
              : 3;
    }
  }

  // Thin to one-pixel ridges.
  const thin = new Float32Array(n);
  const kept: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const m = mag[i]!;
      if (m < 1) continue;
      const step =
        dir[i] === 0
          ? 1
          : dir[i] === 1
            ? width + 1
            : dir[i] === 2
              ? width
              : width - 1;
      if (m >= mag[i - step]! && m >= mag[i + step]!) {
        thin[i] = m;
        kept.push(m);
      }
    }
  }
  if (!kept.length) return { lines: [], width, height };
  kept.sort((p, q) => p - q);
  const high = Math.max(60, kept[Math.floor(kept.length * 0.8)]!);
  const low = high * 0.45;

  // Hysteresis: weak ridges stay only when joined to strong ones.
  const edge = new Uint8Array(n);
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (thin[i]! >= high) {
      edge[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i / width) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (!edge[j] && thin[j]! >= low) {
        edge[j] = 1;
        stack.push(j);
      }
    }
  }

  return { lines: orderAndTrace(edge, width, height), width, height };
}

function blur(src: Float32Array, w: number, h: number) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx]!;
          count++;
        }
      }
      out[y * w + x] = sum / count;
    }
  }
  return out;
}

const CELL = 8;

function orderAndTrace(edge: Uint8Array, w: number, h: number) {
  const gw = Math.ceil(w / CELL);
  const gh = Math.ceil(h / CELL);
  const cells: number[][] = Array.from({ length: gw * gh }, () => []);
  for (let i = 0; i < edge.length; i++) {
    if (edge[i]) {
      const x = i % w;
      const y = (i / w) | 0;
      cells[((y / CELL) | 0) * gw + ((x / CELL) | 0)]!.push(i);
    }
  }
  const cursor = new Int32Array(gw * gh);
  const visited = new Uint8Array(edge.length);

  const nearest = (px: number, py: number): number => {
    const cx = Math.min(gw - 1, (px / CELL) | 0);
    const cy = Math.min(gh - 1, (py / CELL) | 0);
    const maxR = Math.max(gw, gh);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= maxR; r++) {
      for (let gy = cy - r; gy <= cy + r; gy++) {
        if (gy < 0 || gy >= gh) continue;
        for (let gx = cx - r; gx <= cx + r; gx++) {
          if (gx < 0 || gx >= gw) continue;
          if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== r) continue;
          const c = gy * gw + gx;
          const list = cells[c]!;
          while (cursor[c]! < list.length && visited[list[cursor[c]!]!])
            cursor[c]++;
          for (let k = cursor[c]!; k < list.length; k++) {
            const i = list[k]!;
            if (visited[i]) continue;
            const d = ((i % w) - px) ** 2 + (((i / w) | 0) - py) ** 2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
      // Anything in a farther ring is at least r cells away.
      if (best >= 0 && bestD <= (r * CELL) ** 2) break;
    }
    return best;
  };

  const lines: Float32Array[] = [];
  let px = 0;
  let py = 0;
  for (;;) {
    const start = nearest(px, py);
    if (start < 0) break;
    const points: number[] = [];
    let i = start;
    let ddx = 0;
    let ddy = 0;
    for (;;) {
      visited[i] = 1;
      const x = i % w;
      const y = (i / w) | 0;
      points.push(x + 0.5, y + 0.5);
      let next = -1;
      let score = -Infinity;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!edge[j] || visited[j]) continue;
        const s =
          (dx * ddx + dy * ddy) / Math.hypot(dx, dy) - (dx && dy ? 0.05 : 0);
        if (s > score) {
          score = s;
          next = j;
        }
      }
      if (next < 0) break;
      ddx = (next % w) - x;
      ddy = ((next / w) | 0) - y;
      i = next;
    }
    px = points[points.length - 2]!;
    py = points[points.length - 1]!;
    if (points.length >= 8) lines.push(simplify(points));
  }
  return lines;
}

/** Keeps every second point of long runs; the ends stay. */
function simplify(points: number[]): Float32Array {
  if (points.length <= 8) return Float32Array.from(points);
  const out: number[] = [];
  for (let k = 0; k < points.length; k += 4)
    out.push(points[k]!, points[k + 1]!);
  const lx = points[points.length - 2]!;
  const ly = points[points.length - 1]!;
  if (out[out.length - 2] !== lx || out[out.length - 1] !== ly)
    out.push(lx, ly);
  return Float32Array.from(out);
}
