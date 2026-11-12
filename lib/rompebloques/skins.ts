// Rompebloques palettes per skin × color mode. The engine reads every color from here.
// `classic` draws the PNG atlas; `neon` / `retro` draw flat shapes on canvas.
import type { ColorMode, SkinId } from "@/lib/skins";
import type { BlockColor } from "./sprites";

export type Palette = {
  /** Whole canvas (side bands around the play field). */
  board: string;
  /** Play field background (600x600 px, centered). */
  field: string;
  /** Field border; `null` = no border. */
  fieldEdge: string | null;
  /** `true` = PNG sprites (classic); `false` = canvas shapes. */
  sprites: boolean;
  /** Rim stroked around sprites so they separate from a light board; `null` = none. */
  spriteOutline: string | null;
  /** Block fill per block type (shape mode and explosions). */
  blocks: Record<BlockColor, string>;
  /** Bottom bevel on shape blocks; `null` = flat. */
  blockShade: string | null;
  paddle: string;
  /** Paddle end caps in shape mode. */
  paddleCap: string;
  ball: string;
  /** Overlay title (PAUSA, GAME OVER, ¡GANASTE!). */
  title: string;
  /** Hints and overlay subtitle. */
  text: string;
  /** Pause veil over the whole canvas. */
  veil: string;
  /** Explosion sprite filter for gray blocks (sprite mode). */
  grayFilter: string;
  /** `ctx.shadowBlur` for shapes and titles; 0 = no glow. */
  glow: number;
  /** Chunky 8-bit look: square ball, wide gaps. */
  pixel: boolean;
};

// Main tone of each sprite in the atlas (names follow the original game).
const SPRITE_TONES: Record<BlockColor, string> = {
  gray: "#9998ab",
  red: "#c02a3e",
  yellow: "#d9bd4c",
  cyan: "#4fc99c",
  magenta: "#632ff4",
  hotpink: "#fc7d1c",
  green: "#44aaf3",
};

const classicDark: Palette = {
  board: "#1b1b2f",
  field: "#1b1b2f",
  fieldEdge: null,
  sprites: true,
  // Subtle rim (3.54:1 on #1b1b2f): red/purple bricks and paddle tips fall below 3:1 alone.
  spriteOutline: "#6b7099",
  blocks: SPRITE_TONES,
  blockShade: null,
  paddle: "#babac5",
  paddleCap: "#af2a44",
  ball: "#babac5",
  title: "#fff",
  text: "#fff",
  veil: "rgba(0, 0, 0, 0.5)",
  grayFilter: "grayscale(1)",
  glow: 0,
  pixel: false,
};

export const SKIN_PALETTES: Record<SkinId, Record<ColorMode, Palette>> = {
  classic: {
    dark: classicDark,
    // Same atlas on a daylight board; a dark rim keeps pale sprites readable.
    light: {
      ...classicDark,
      board: "#d9dbe7",
      field: "#eceef5",
      fieldEdge: "#454a6b",
      spriteOutline: "#12142a",
      title: "#12142a",
      text: "#2a2e4a",
      veil: "rgba(236, 238, 245, 0.72)",
    },
  },
  neon: {
    dark: {
      board: "#05030f",
      field: "#0a0620",
      fieldEdge: "#00f5ff",
      sprites: false,
      spriteOutline: null,
      blocks: {
        gray: "#d6d3ff",
        hotpink: "#ff2d8a",
        red: "#ff4d5e",
        yellow: "#f5ff00",
        cyan: "#00f5ff",
        magenta: "#c45bff",
        green: "#00ff88",
      },
      blockShade: "rgba(5, 3, 15, 0.35)",
      paddle: "#00f5ff",
      paddleCap: "#ff2d8a",
      ball: "#f5ff00",
      title: "#00f5ff",
      text: "#e6e9ff",
      veil: "rgba(5, 3, 15, 0.6)",
      grayFilter: "none",
      glow: 14,
      pixel: false,
    },
    light: {
      board: "#e4e0f5",
      field: "#f4f2fd",
      fieldEdge: "#006875",
      sprites: false,
      spriteOutline: null,
      blocks: {
        gray: "#3d3858",
        hotpink: "#c0004f",
        red: "#b3122a",
        yellow: "#745c00",
        cyan: "#006875",
        magenta: "#7a22c9",
        green: "#006e43",
      },
      blockShade: "rgba(18, 20, 42, 0.25)",
      paddle: "#006875",
      paddleCap: "#c0004f",
      ball: "#12142a",
      title: "#006875",
      text: "#241a4a",
      veil: "rgba(244, 242, 253, 0.72)",
      grayFilter: "none",
      glow: 4,
      pixel: false,
    },
  },
  retro: {
    // Green phosphor monochrome.
    dark: {
      board: "#020a04",
      field: "#031207",
      fieldEdge: "#1fbf4a",
      sprites: false,
      spriteOutline: null,
      blocks: {
        gray: "#c8ffd4",
        hotpink: "#7dff9a",
        red: "#33ff66",
        yellow: "#1fbf4a",
        cyan: "#33ff66",
        magenta: "#1fbf4a",
        green: "#7dff9a",
      },
      blockShade: null,
      paddle: "#7dff9a",
      paddleCap: "#33ff66",
      ball: "#c8ffd4",
      title: "#33ff66",
      text: "#7dff9a",
      veil: "rgba(2, 10, 4, 0.7)",
      grayFilter: "none",
      glow: 0,
      pixel: true,
    },
    // 4-shade handheld LCD.
    light: {
      board: "#aab78a",
      field: "#c4cfa1",
      fieldEdge: "#1f2a14",
      sprites: false,
      spriteOutline: null,
      blocks: {
        gray: "#1f2a14",
        hotpink: "#2e421c",
        red: "#3e5a26",
        yellow: "#2e421c",
        cyan: "#3e5a26",
        magenta: "#1f2a14",
        green: "#3e5a26",
      },
      blockShade: null,
      paddle: "#1f2a14",
      paddleCap: "#3e5a26",
      ball: "#1f2a14",
      title: "#1f2a14",
      text: "#1f2a14",
      veil: "rgba(196, 207, 161, 0.75)",
      grayFilter: "none",
      glow: 0,
      pixel: true,
    },
  },
};
