import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth-redirect";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function AuthLoader({
  searchParams,
}: Pick<PageProps<"/auth">, "searchParams">) {
  // Con sesión, `proxy.ts` redirige antes de llegar aquí.
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
