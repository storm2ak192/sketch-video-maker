import { HANDS, type HandId } from "@/lib/animation";

// The drawn hands: one sprite per hand, holding a pen or a marker whose tip
// sits at the sprite's top-left corner, the arm leaving the frame bottom-right.

const SKINS = [
  { fill: "#f5d3b5", line: "#c18f6c", shade: "#e8bc98" },
  { fill: "#dfa97f", line: "#9f6b46", shade: "#cc946a" },
  { fill: "#b37c55", line: "#744a2f", shade: "#9e6a46" },
  { fill: "#76482d", line: "#3f2415", shade: "#643b23" },
] as const;

const UNIT = 400;
/** Where the tip is in the sprite, in sprite pixels per unit. */
const TIP = 16;

const cache = new Map<string, HTMLCanvasElement>();

/** The hand's sprite at `size` pixels, and the offset of its tip. */
export function handSprite(id: HandId, size: number) {
  if (id === "none") return null;
  const key = `${id}:${Math.round(size)}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = drawHand(id, Math.round(size));
    cache.set(key, canvas);
  }
  return { canvas, tip: (TIP / UNIT) * size };
}

function drawHand(id: Exclude<HandId, "none">, size: number) {
  const hand = HANDS.find((h) => h.id === id)!;
  const skin = SKINS[hand.skin];
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(size / UNIT, size / UNIT);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 8;

  // Sleeve and wrist leaving the frame.
  ctx.save();
  ctx.translate(300, 300);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = hand.tool === "pen" ? "#3b4a6b" : "#4d6b4a";
  roundRect(ctx, -10, -78, 260, 156, 30);
  ctx.fill();
  ctx.restore();

  // The pen or marker along the diagonal from the tip.
  ctx.save();
  ctx.translate(TIP, TIP);
  ctx.rotate(Math.atan2(250, 210));
  if (hand.tool === "pen") {
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(34, -8);
    ctx.lineTo(34, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c9ccd1";
    ctx.fillRect(34, -9, 22, 18);
    ctx.fillStyle = "#e4483f";
    roundRect(ctx, 56, -11, 250, 22, 8);
    ctx.fill();
  } else {
    ctx.fillStyle = "#1d1d1d";
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(30, -13);
    ctx.lineTo(30, 13);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0f0f0";
    roundRect(ctx, 30, -19, 270, 38, 10);
    ctx.fill();
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(30, -19, 26, 38);
  }
  ctx.restore();

  ctx.shadowColor = "transparent";
  ctx.fillStyle = skin.fill;
  ctx.strokeStyle = skin.line;
  ctx.lineWidth = 4;

  // Palm.
  ctx.save();
  ctx.translate(250, 250);
  ctx.rotate(-Math.PI / 5);
  ctx.beginPath();
  ctx.ellipse(0, 0, 112, 92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Curled fingers beneath the pen.
  for (const [x, y, r] of [
    [176, 236, 30],
    [196, 272, 28],
    [222, 304, 26],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.35, r, Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Index finger along the pen and the thumb across it.
  finger(ctx, 210, 170, 104, 118, 21);
  finger(ctx, 232, 236, 120, 160, 23);
  ctx.strokeStyle = skin.shade;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(250, 290);
  ctx.quadraticCurveTo(290, 270, 320, 230);
  ctx.stroke();
  return canvas;
}

function finger(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
) {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  const len = Math.hypot(x1 - x0, y1 - y0);
  roundRect(ctx, -r, -r, len + r * 2, r * 2, r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
