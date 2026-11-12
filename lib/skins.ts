"use client";

// Shared skin + color-mode helpers. Client-safe: no server imports.
import { useCallback, useSyncExternalStore } from "react";

export type SkinId = "classic" | "neon" | "retro";
export type ColorMode = "dark" | "light";

export const SKINS: { id: SkinId; label: string }[] = [
  { id: "classic", label: "CLÁSICO" },
  { id: "neon", label: "NEÓN" },
  { id: "retro", label: "RETRO" },
];

export const DEFAULT_SKIN: SkinId = "classic";
export const DEFAULT_COLOR_MODE: ColorMode = "dark";
export const THEME_STORAGE_KEY = "av:theme";

const isSkinId = (v: unknown): v is SkinId =>
  v === "classic" || v === "neon" || v === "retro";

// ── Skin per game (localStorage `av:skin:<gameId>`) ──────────────────────────
// In-memory fallback keeps the choice for the session when storage is blocked.
const memory = new Map<string, SkinId>();
const skinListeners = new Set<() => void>();

function readSkin(key: string): SkinId {
  try {
    const stored = window.localStorage.getItem(key);
    if (isSkinId(stored)) return stored;
  } catch {
    // storage unavailable: use the in-memory value
  }
  return memory.get(key) ?? DEFAULT_SKIN;
}

function subscribeSkin(onChange: () => void) {
  skinListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    skinListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSkin(gameId: string): [SkinId, (skin: SkinId) => void] {
  const key = `av:skin:${gameId}`;
  const skin = useSyncExternalStore(
    subscribeSkin,
    () => readSkin(key),
    () => DEFAULT_SKIN,
  );
  const setSkin = useCallback(
    (next: SkinId) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // storage unavailable: memory keeps it for this session
      }
      skinListeners.forEach((l) => l());
    },
    [key],
  );
  return [skin, setSkin];
}

// ── Global color mode (`data-theme` on <html>) ───────────────────────────────
function readColorMode(): ColorMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribeColorMode(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function useColorMode(): ColorMode {
  return useSyncExternalStore(
    subscribeColorMode,
    readColorMode,
    () => DEFAULT_COLOR_MODE,
  );
}

/** Applies the mode to <html> and persists it in `av:theme`. */
export function setColorMode(mode: ColorMode) {
  document.documentElement.dataset.theme = mode;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // storage unavailable: the mode lasts until reload
  }
}
