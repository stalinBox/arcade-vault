// Asteroids palettes per skin × color mode. The engine reads every color from here.
import type { ColorMode, SkinId } from "@/lib/skins";

export type Palette = {
  /** Canvas background. */
  board: string;
  ship: string;
  /** Thruster flame stroke. */
  flame: string;
  /** Asteroid outline. */
  asteroid: string;
  /** Flat asteroid fill under the outline; `null` = hollow. */
  asteroidFill: string | null;
  bullet: string;
  /** Explosion debris as `r, g, b`; alpha fades with particle life. */
  particleRgb: string;
  /** Overlay title (GAME OVER, PAUSA). */
  title: string;
  /** Overlay subtitle. */
  subtitle: string;
  /** `ctx.shadowBlur` for strokes; 0 = no glow. */
  glow: number;
  /** Stroke width for ship and asteroids. */
  lineWidth: number;
  /** Stroke width for explosion debris. */
  particleWidth: number;
  /** Chunky 8-bit look: square bullets and mitred corners. */
  pixel: boolean;
};

const classicDark: Palette = {
  board: "#000",
  ship: "#fff",
  flame: "rgba(255, 130, 0, 0.85)",
  asteroid: "#fff",
  asteroidFill: null,
  bullet: "#fff",
  particleRgb: "255,255,255",
  title: "#fff",
  subtitle: "rgba(255,255,255,0.65)",
  glow: 0,
  lineWidth: 1.5,
  particleWidth: 1,
  pixel: false,
};

export const SKIN_PALETTES: Record<SkinId, Record<ColorMode, Palette>> = {
  classic: {
    dark: classicDark,
    light: {
      ...classicDark,
      board: "#eef0f5",
      ship: "#0d0f1a",
      flame: "rgba(184, 70, 0, 0.9)",
      asteroid: "#1c1f2e",
      bullet: "#0d0f1a",
      particleRgb: "28,31,46",
      title: "#0d0f1a",
      subtitle: "rgba(13,15,26,0.72)",
    },
  },
  neon: {
    dark: {
      board: "#07041a",
      ship: "#00f5ff",
      flame: "#f5ff00",
      asteroid: "#ff2d8a",
      asteroidFill: null,
      bullet: "#f5ff00",
      particleRgb: "0,255,136",
      title: "#00f5ff",
      subtitle: "rgba(230,233,255,0.78)",
      glow: 14,
      lineWidth: 2,
      particleWidth: 1.5,
      pixel: false,
    },
    light: {
      board: "#f1eefc",
      ship: "#00606c",
      flame: "#9a5a00",
      asteroid: "#c2005a",
      asteroidFill: null,
      bullet: "#5b4d00",
      particleRgb: "0,122,66",
      title: "#00606c",
      subtitle: "rgba(36,26,74,0.8)",
      glow: 4,
      lineWidth: 2,
      particleWidth: 1.5,
      pixel: false,
    },
  },
  retro: {
    // Green phosphor monochrome.
    dark: {
      board: "#031207",
      ship: "#7dff9a",
      flame: "#33ff66",
      asteroid: "#33ff66",
      asteroidFill: "#0b3517",
      bullet: "#c8ffd4",
      particleRgb: "51,255,102",
      title: "#33ff66",
      subtitle: "#1fbf4a",
      glow: 0,
      lineWidth: 3,
      particleWidth: 3,
      pixel: true,
    },
    // 4-shade handheld LCD.
    light: {
      board: "#c4cfa1",
      ship: "#1f2a14",
      flame: "#3e5a26",
      asteroid: "#1f2a14",
      asteroidFill: "#8b9c5f",
      bullet: "#1f2a14",
      particleRgb: "46,66,28",
      title: "#1f2a14",
      subtitle: "#2e421c",
      glow: 0,
      lineWidth: 3,
      particleWidth: 3,
      pixel: true,
    },
  },
};
