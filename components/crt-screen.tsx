// Visual-only CRT frame: the arena is a static CSS scene, no game loop.
export function CrtScreen({ title }: { title: string }) {
  return (
    <div className="crt">
      <div className="crt-screen">
        <div className="game-arena">
          <div className="grid-floor"></div>
          <div className="enemy e1"></div>
          <div className="enemy e2"></div>
          <div className="enemy e3"></div>
          <div className="player-ship"></div>
        </div>
      </div>
      <div className="crt-bottom">
        <span className="led">SEÑAL OK</span>
        <span>{title} · CRT-83 · 60 HZ</span>
        <span>CARGA · 1MB</span>
      </div>
    </div>
  );
}
