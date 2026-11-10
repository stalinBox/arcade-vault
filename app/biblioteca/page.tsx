import { Suspense } from "react";
import { Library } from "@/components/library";
import { getCatalog } from "@/lib/games";

async function LibraryLoader() {
  const games = await getCatalog();
  return <Library games={games} />;
}

// `getCatalog` lee cookies (cliente de servidor): va dentro de <Suspense> (Cache Components).
export default function Biblioteca() {
  return (
    <Suspense fallback={<div className="fade-in" aria-busy="true" />}>
      <LibraryLoader />
    </Suspense>
  );
}
