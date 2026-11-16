const FALLBACK = "/inicio";
const BASE = "http://internal.invalid";
// Tab/CR/LF los elimina el parser de URL: `/\t/evil.com` acabaría en `//evil.com`.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Devuelve `next` solo si es una ruta interna (`/algo`); si no, `/inicio`.
 * Rechaza `//host`, `/\host` y caracteres de control: el navegador los trata
 * como URL de otro dominio.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//") || next.startsWith("/\\")) return FALLBACK;
  if (CONTROL_CHARS.test(next)) return FALLBACK;
  if (new URL(next, BASE).origin !== BASE) return FALLBACK;
  return next;
}
