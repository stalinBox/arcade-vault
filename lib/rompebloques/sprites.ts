export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

const row = (sy: number): Frame[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]> = {
  red: row(176),
  cyan: row(192),
  green: row(208),
  magenta: row(224),
  yellow: row(240),
  hotpink: row(256),
  gray: row(176),
};

export const EXPLOSION_DURATION = 150;

const block = (sy: number): Frame => ({ sx: 32, sy, sw: 32, sh: 16 });

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 } as Frame,
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 } as Frame,
  blocks: {
    gray: block(288),
    red: block(176),
    yellow: block(240),
    cyan: block(192),
    magenta: block(224),
    hotpink: block(256),
    green: block(208),
  } as Record<BlockColor, Frame>,
};

const SPRITESHEET_SRC = "/games/rompebloques/spritesheet-breakout.png";

let sheet: HTMLCanvasElement | null = null;
const pending: Array<() => void> = [];
let loading = false;

/** Loads the spritesheet once; `cb` runs when it is ready (immediately if cached). */
export function loadSprites(cb: () => void): void {
  if (sheet) {
    cb();
    return;
  }
  pending.push(cb);
  if (loading) return;
  loading = true;

  const img = new Image();
  img.onload = () => {
    const oc = document.createElement("canvas");
    oc.width = img.width;
    oc.height = img.height;
    oc.getContext("2d")?.drawImage(img, 0, 0);
    sheet = oc;
    pending.splice(0).forEach((f) => f());
  };
  img.onerror = () => {
    loading = false;
    console.error("Failed to load spritesheet");
  };
  img.src = SPRITESHEET_SRC;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!sheet) return;
  ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: "paddle" | "ball" | `block_${BlockColor}`,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const frame = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6) as BlockColor]
    : SPRITES[name as "paddle" | "ball"];
  if (frame) drawFrame(ctx, frame, x, y, w, h);
}
