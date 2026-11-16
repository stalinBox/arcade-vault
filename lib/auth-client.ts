"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CurrentUser = { id: string; username: string } | null;

/**
 * Usuario con sesión y su `username` de `profiles`. `undefined` = cargando.
 * Se vuelve a comprobar en cada cambio de ruta: el login por email lo hace una
 * server action (cookie puesta en el servidor), que no dispara onAuthStateChange.
 */
export function useCurrentUser(): CurrentUser | undefined {
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | undefined>(undefined);
  const current = useRef<CurrentUser | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const resolve = async (id: string | undefined) => {
      if (id && current.current?.id === id) return;
      let next: CurrentUser = null;
      if (id) {
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", id)
          .maybeSingle();
        if (data) next = { id, username: data.username };
      }
      if (cancelled) return;
      current.current = next;
      setUser(next);
    };

    supabase.auth.getUser().then(({ data }) => resolve(data.user?.id));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // ya lo cubre getUser()
      // Fuera del callback: llamar a Supabase dentro puede bloquearse.
      setTimeout(() => resolve(session?.user.id), 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname]);

  return user;
}
