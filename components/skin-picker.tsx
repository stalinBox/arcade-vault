"use client";

import { useId } from "react";
import { SKINS, type SkinId } from "@/lib/skins";

/** Skin selector for the player HUD: native radios, so arrows/Tab work. */
export function SkinPicker({
  value,
  onChange,
}: {
  value: SkinId;
  onChange: (skin: SkinId) => void;
}) {
  const id = useId();
  return (
    <div
      className="hud-skin"
      role="radiogroup"
      aria-labelledby={`${id}-l`}
      // The engine listens on window and preventDefaults arrows/Space: keep
      // them here so the radios stay keyboard-operable.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="l" id={`${id}-l`}>
        Estilo
      </div>
      <div className="skin-opts">
        {SKINS.map((s) => (
          <label key={s.id} className={`skin-opt skin-${s.id}`}>
            <input
              type="radio"
              name={`${id}-skin`}
              value={s.id}
              checked={value === s.id}
              onChange={(e) => {
                onChange(s.id);
                // Hand the keyboard back to the game.
                e.currentTarget.blur();
              }}
            />
            <span>
              <i aria-hidden="true" />
              {s.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
