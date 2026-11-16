import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

// Solo los tipos del registro. Otros (recovery, magiclink, email_change…) abrirían
// sesión por una ruta que no es la suya: cada flujo futuro tendrá su propia ruta.
const CONFIRM_TYPES = ["signup", "email"] as const satisfies EmailOtpType[];
type ConfirmType = (typeof CONFIRM_TYPES)[number];

function isConfirmType(value: string | null): value is ConfirmType {
  return CONFIRM_TYPES.some((t) => t === value);
}

// Enlace del correo de confirmación: verifica el token e inicia sesión.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const next = safeNext(params.get("next"));

  if (tokenHash && isConfirmType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/auth?error=confirm", request.nextUrl.origin),
  );
}
