// Snake palettes per skin × color mode. The engine reads every color from here.
import type { ColorMode, SkinId } from "@/lib/skins";

export type Palette = {
  /** Canvas background. */
  board: string;
  /** Grid lines; `null` = no grid. */
  grid: string | null;
  body: string;
  head: string;
  /** Fruit color when drawn as a shape (block style or sprite fallback). */
  food: string;
  /** `sprite` = fruits.png; `block` = flat chunky shape in `food`. */
  foodStyle: "sprite" | "block";
  /** `ctx.filter` applied to fruit sprites ("none" = untouched). */
  foodFilter: string;
  /** Halo behind sprites so they stand out on light boards; `null` = none. */
  foodHalo: string | null;
  /** Overlay title (PAUSA, GAME OVER). */
  title: string;
  /** Overlay subtitle. */
  sub: string;
  /** Translucent layer under the overlay text. */
  veil: string;
  /** `ctx.shadowBlur` for snake, fruit and title; 0 = no glow. */
  glow: number;
  /** Gap in px between a segment and its cell edge. */
  inset: number;
};

const classicDark: Palette = {
  board: "#0a0a18",
  grid: "#16163a",
  body: "#00ff88",
  head: "#00f5ff",
  food: "#ff006e",
  foodStyle: "sprite",
  foodFilter: "none",
  foodHalo: null,
  title: "#00f5ff",
  sub: "#8a8fb5",
  veil: "rgba(10, 10, 24, 0.72)",
  glow: 0,
  inset: 1,
};

export const SKIN_PALETTES: Record<SkinId, Record<ColorMode, Palette>> = {
  classic: {
    dark: classicDark,
    light: {
      ...classicDark,
      board: "#eef0f5",
      grid: "#d6d9e6",
      body: "#007a45",
      head: "#006570",
      food: "#c0004f",
      foodHalo: "rgba(20, 22, 40, 0.55)",
      title: "#006570",
      sub: "#4a4f6e",
      veil: "rgba(238, 240, 245, 0.86)",
    },
  },
  neon: {
    dark: {
      board: "#07041a",
      grid: "#1a0f3d",
      body: "#00ff88",
      head: "#00f5ff",
      food: "#ff2d8a",
      foodStyle: "sprite",
      foodFilter: "saturate(1.6) brightness(1.15)",
      foodHalo: null,
      title: "#ff5ca8",
      sub: "rgba(230, 233, 255, 0.78)",
      veil: "rgba(7, 4, 26, 0.86)",
      glow: 12,
      inset: 2,
    },
    light: {
      board: "#f1eefc",
      grid: "#ddd5f5",
      body: "#007a42",
      head: "#00606c",
      food: "#c2005a",
      foodStyle: "sprite",
      foodFilter: "saturate(1.4) contrast(1.15)",
      foodHalo: "rgba(36, 26, 74, 0.5)",
      title: "#b0005a",
      sub: "rgba(36, 26, 74, 0.8)",
      veil: "rgba(241, 238, 252, 0.8)",
      glow: 4,
      inset: 2,
    },
  },
  retro: {
    // Amber phosphor monochrome.
    dark: {
      board: "#140b02",
      grid: null,
      body: "#ffb000",
      head: "#ffd36b",
      food: "#ff8a1f",
      foodStyle: "block",
      foodFilter: "none",
      foodHalo: null,
      title: "#ffb000",
      sub: "#d18f00",
      veil: "rgba(20, 11, 2, 0.86)",
      glow: 0,
      inset: 2,
    },
    // 4-shade handheld LCD.
    light: {
      board: "#c4cfa1",
      grid: null,
      body: "#2e421c",
      head: "#1f2a14",
      food: "#1f2a14",
      foodStyle: "block",
      foodFilter: "none",
      foodHalo: null,
      title: "#1f2a14",
      sub: "#2e421c",
      veil: "rgba(196, 207, 161, 0.82)",
      glow: 0,
      inset: 2,
    },
  },
};
