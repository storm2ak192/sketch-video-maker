import { describe, expect, it } from "vitest";
import { traceStrokes, workingSize } from "./strokes";

function picture(
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  ink: number[],
) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = inside(x, y) ? ink : [255, 255, 255];
      px.set([r!, g!, b!, 255], (y * w + x) * 4);
    }
  }
  return px;
}

describe("traceStrokes", () => {
  it("outlines a shape and nothing else", () => {
    const px = picture(
      80,
      60,
      (x, y) => x >= 20 && x < 60 && y >= 15 && y < 45,
      [0, 0, 0],
    );
    const { lines } = traceStrokes(px, 80, 60);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (let k = 0; k < line.length; k += 2) {
        const x = line[k]!;
        const y = line[k + 1]!;
        const nearEdge =
          Math.min(Math.abs(x - 20), Math.abs(x - 60)) < 4 ||
          Math.min(Math.abs(y - 15), Math.abs(y - 45)) < 4;
        expect(nearEdge).toBe(true);
      }
    }
  });

  it("finds edges between colours of the same brightness", () => {
    // Yellow on light blue: nearly equal in gray.
    const px = new Uint8ClampedArray(60 * 60 * 4);
    for (let i = 0; i < 3600; i++) {
      const x = i % 60;
      const y = (i / 60) | 0;
      const sun = (x - 30) ** 2 + (y - 30) ** 2 < 15 ** 2;
      px.set(sun ? [250, 200, 60, 255] : [180, 215, 245, 255], i * 4);
    }
    expect(traceStrokes(px, 60, 60).lines.length).toBeGreaterThan(0);
  });

  it("draws nothing for a blank picture", () => {
    const px = picture(40, 40, () => false, [0, 0, 0]);
    expect(traceStrokes(px, 40, 40).lines).toEqual([]);
  });

  it("works on a reduced copy of large pictures", () => {
    expect(workingSize(4000, 2000)).toEqual({ width: 480, height: 240 });
    expect(workingSize(300, 200)).toEqual({ width: 300, height: 200 });
  });
});
