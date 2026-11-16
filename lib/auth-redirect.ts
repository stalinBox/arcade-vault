const FALLBACK = "/inicio";

/**
 * Devuelve `next` solo si es una ruta interna (`/algo`); si no, `/inicio`.
 * Rechaza `//host` y `/\host`: el navegador los trata como URL de otro dominio.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//") || next.startsWith("/\\")) return FALLBACK;
  return next;
}
