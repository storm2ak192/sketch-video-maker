// Shared helpers for the release checks: images made in code, multipart uploads.
import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An RGB PNG whose pixels come from `pixel(x, y) => [r, g, b]`. */
export function makePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A small landscape: sky, sun, two hills, a cabin with a roof and door. */
export function landscapePng(width = 640, height = 400) {
  const s = width / 640;
  return makePng(width, height, (x, y) => {
    const X = x / s;
    const Y = y / s;
    // cabin
    if (X > 380 && X < 500 && Y > 230 && Y < 320) {
      if (X > 425 && X < 455 && Y > 270) return [90, 50, 30];
      if (X > 395 && X < 415 && Y > 250 && Y < 270) return [250, 230, 140];
      return [180, 90, 60];
    }
    if (Y < 230 && Y > 170 && Math.abs(X - 440) < (Y - 170) * 1.2)
      return [120, 40, 40];
    // sun
    if ((X - 140) ** 2 + (Y - 90) ** 2 < 45 ** 2) return [250, 200, 60];
    // hills
    const hill1 = 280 - 70 * Math.sin((X / 640) * Math.PI);
    const hill2 = 330 - 40 * Math.cos((X / 320) * Math.PI);
    if (Y > hill2) return [70, 140, 70];
    if (Y > hill1) return [110, 170, 90];
    return [150 + Y / 5, 200 + Y / 10, 245];
  });
}

/** A multipart body with one file field. */
export function fileForm(field, name, type, bytes, extra = {}) {
  const form = new FormData();
  form.set(field, new Blob([bytes], { type }), name);
  for (const [k, v] of Object.entries(extra)) form.set(k, String(v));
  return form;
}

export async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Not JSON (${response.status}): ${text.slice(0, 300)}`);
  }
}
