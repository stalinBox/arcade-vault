export interface GameLoop {
  /** Schedules a frame if the loop is asleep. The first dt after waking is 0. Idempotent. */
  wake(): void;
  /** Cancels the pending frame and listeners. Idempotent. */
  destroy(): void;
}

/**
 * `frame(now, dt)` runs once per frame; `dt` is the ms since the previous
 * frame, 0 on the first frame after waking (clamping is up to the engine).
 * Return `true` to keep going, `false` to sleep (that frame already drew).
 * The loop starts on creation, stops while the tab is hidden and resumes
 * when it is visible again, unless the engine put it to sleep.
 */
export function createGameLoop(
  frame: (now: number, dt: number) => boolean,
): GameLoop {
  let rafId = 0;
  let last: number | null = null;
  let sleeping = false;
  let destroyed = false;

  function schedule(): void {
    if (destroyed || rafId !== 0 || document.hidden) return;
    rafId = requestAnimationFrame(tick);
  }

  function tick(now: number): void {
    rafId = 0;
    if (destroyed) return;
    const dt = last === null ? 0 : now - last;
    last = now;
    if (frame(now, dt)) schedule();
    else if (rafId === 0) sleeping = true; // rafId !== 0: frame() woke the loop
  }

  function onVisibility(): void {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!sleeping) {
      last = null;
      schedule();
    }
  }

  document.addEventListener("visibilitychange", onVisibility);
  schedule();

  return {
    wake() {
      sleeping = false;
      if (rafId === 0) {
        last = null;
        schedule();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      rafId = 0;
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
