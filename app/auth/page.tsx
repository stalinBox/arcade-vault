import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function AuthLoader({
  searchParams,
}: Pick<PageProps<"/auth">, "searchParams">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/inicio");

  const params = await searchParams;
  return (
    <AuthForm next={safeNext(first(params.next))} error={first(params.error)} />
  );
}

// Cookies y searchParams se leen dentro de <Suspense> (Cache Components).
export default function AuthPage({ searchParams }: PageProps<"/auth">) {
  return (
    <div className="av-auth-wrap fade-in">
      <Suspense fallback={<div className="auth-card" aria-busy="true" />}>
        <AuthLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
