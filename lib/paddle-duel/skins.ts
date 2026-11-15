// Paddle Duel palettes per skin × color mode. The engine reads every color from here.
import type { ColorMode, SkinId } from "@/lib/skins";

export type Palette = {
  /** Canvas background. */
  board: string;
  /** Dashed center line. */
  line: string;
  /** Player paddle. */
  player: string;
  /** CPU paddle. */
  cpu: string;
  ball: string;
  /** Overlay body text. */
  text: string;
  /** Popups and overlay titles tied to the player (score, "¡PUNTO!"). */
  playerText: string;
  /** Overlay titles tied to the CPU ("PUNTO CPU", "GAME OVER"). */
  cpuText: string;
  /** Streak and smash popups. */
  accentText: string;
  /** Veil drawn over the board on PAUSA and GAME OVER. */
  veil: string;
  /** `ctx.shadowBlur` for paddles and ball; 0 = no glow. */
  glow: number;
  /** Width of the center line. */
  lineWidth: number;
};

export const SKIN_PALETTES: Record<SkinId, Record<ColorMode, Palette>> = {
  // Original look: dark is the shipped palette, light darkens strokes on a pale board.
  classic: {
    dark: {
      board: "#05050f",
      line: "rgba(255, 255, 255, 0.25)",
      player: "#00f5ff",
      cpu: "#ff006e",
      ball: "#f5ff00",
      text: "#ffffff",
      playerText: "#00f5ff",
      cpuText: "#ff006e",
      accentText: "#f5ff00",
      veil: "rgba(0, 0, 0, 0.6)",
      glow: 12,
      lineWidth: 2,
    },
    light: {
      board: "#f2f2f8",
      line: "rgba(5, 5, 15, 0.3)",
      player: "#007a87",
      cpu: "#c4004f",
      ball: "#7d7400",
      text: "#05050f",
      playerText: "#006b77",
      cpuText: "#b3003f",
      accentText: "#6b6300",
      veil: "rgba(255, 255, 255, 0.7)",
      glow: 4,
      lineWidth: 2,
    },
  },
  // Saturated accents with strong glow on a near-black board.
  neon: {
    dark: {
      board: "#02020a",
      line: "rgba(0, 245, 255, 0.4)",
      player: "#00ffa3",
      cpu: "#ff2bd6",
      ball: "#fff700",
      text: "#e6fbff",
      playerText: "#00ffa3",
      cpuText: "#ff2bd6",
      accentText: "#fff700",
      veil: "rgba(0, 0, 0, 0.6)",
      glow: 24,
      lineWidth: 2,
    },
    light: {
      board: "#eef3fb",
      line: "rgba(10, 10, 36, 0.3)",
      player: "#008a57",
      cpu: "#b8008f",
      ball: "#7a6f00",
      text: "#0a0a24",
      playerText: "#006b43",
      cpuText: "#a00080",
      accentText: "#6b6100",
      veil: "rgba(255, 255, 255, 0.7)",
      glow: 6,
      lineWidth: 2,
    },
  },
  // Four-tone 8-bit green, flat fills, no glow, chunky center line.
  retro: {
    dark: {
      board: "#0f380f",
      line: "#306230",
      player: "#9bbc0f",
      cpu: "#6fb23a",
      ball: "#e0f8d0",
      text: "#e0f8d0",
      playerText: "#9bbc0f",
      cpuText: "#8fd05a",
      accentText: "#e0f8d0",
      veil: "rgba(15, 56, 15, 0.7)",
      glow: 0,
      lineWidth: 4,
    },
    light: {
      board: "#e0f8d0",
      line: "#8bac0f",
      player: "#0f380f",
      cpu: "#306230",
      ball: "#0f380f",
      text: "#0f380f",
      playerText: "#0f380f",
      cpuText: "#306230",
      accentText: "#0f380f",
      veil: "rgba(224, 248, 208, 0.7)",
      glow: 0,
      lineWidth: 4,
    },
  },
};
