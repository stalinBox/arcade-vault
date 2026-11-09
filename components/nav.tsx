"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Section = "inicio" | "biblioteca" | "salon" | "acerca" | "auth";

function sectionOf(pathname: string): Section | null {
  if (pathname === "/inicio") return "inicio";
  if (pathname === "/biblioteca" || pathname.startsWith("/juego/") || pathname.startsWith("/jugar/")) return "biblioteca";
  if (pathname === "/salon") return "salon";
  if (pathname === "/acerca") return "acerca";
  if (pathname === "/auth") return "auth";
  return null;
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const section = sectionOf(usePathname());
  const active = (s: Section) => (section === s ? "active" : "");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/inicio" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/inicio" className={active("inicio")}>Inicio</Link>
          <Link href="/biblioteca" className={active("biblioteca")}>Biblioteca</Link>
          <Link href="/salon" className={active("salon")}>Salón de la Fama</Link>
          <Link href="/acerca" className={active("acerca")}>Acerca de</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        <Link href="/auth" className="btn auth-btn">Iniciar Sesión</Link>
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
          aria-controls="av-mobile-panel"
        >
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside id="av-mobile-panel" className={"av-mobile-panel" + (open ? " open" : "")} inert={!open}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link href="/inicio" className={active("inicio")} onClick={close}>Inicio</Link>
        <Link href="/biblioteca" className={active("biblioteca")} onClick={close}>Biblioteca</Link>
        <Link href="/salon" className={active("salon")} onClick={close}>Salón de la Fama</Link>
        <Link href="/acerca" className={active("acerca")} onClick={close}>Acerca de</Link>
        <Link href="/auth" className={active("auth")} onClick={close}>Iniciar Sesión</Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
