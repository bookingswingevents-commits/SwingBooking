// app/catalogue/page.tsx
import Link from "next/link";
import CatalogueCard from "@/components/CatalogueCard";

/**
 * Récupère la liste des formats depuis l’API interne /api/formats
 */
async function getFormats() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/formats`, { cache: "no-store" });
    if (!res.ok) {
      console.error("Erreur API /api/formats:", res.status, await res.text());
      return [];
    }
    return res.json();
  } catch (e) {
    console.error("Erreur API /api/formats:", e);
    return [];
  }
}

/**
 * Page Catalogue (Server Component)
 */
export default async function Catalogue() {
  const formats: any[] = await getFormats();
  const hasFormats = Array.isArray(formats) && formats.length > 0;

  // On détecte le format “Événement sur mesure” (par slug ou par titre)
  const customFormat = hasFormats
    ? formats.find(
        (f) =>
          f?.slug === "custom-event" || f?.title === "Événement sur mesure"
      )
    : null;

  // On enlève ce format de la liste affichée dans la grille
  const visibleFormats = customFormat
    ? formats.filter((f) => f.id !== customFormat.id)
    : formats;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Catalogue</h1>

      {!hasFormats || !visibleFormats.length ? (
        <p className="text-slate-500">
          Aucun format standard disponible pour le moment.
        </p>
      ) : (
        <>
          {/* Cartes des formats standards (sans “Événement sur mesure”) */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleFormats.map((f: any) => (
              <CatalogueCard key={f.id} format={f} />
            ))}
          </div>

          {/* Bandeau "événement sur mesure" en bas du catalogue */}
          <div className="mt-8">
            <div className="border rounded-2xl p-5 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Vous ne trouvez pas exactement ce que vous cherchez&nbsp;?
                </h2>
                <p className="text-sm text-slate-600">
                  Créez un événement sur mesure en décrivant votre besoin (horaires,
                  ambiance, contraintes, budget…) et nous trouverons l&apos;artiste
                  adapté pour vous.
                </p>
              </div>

              {customFormat ? (
                // On réutilise le format caché pour que le flux reste identique côté requêtes
                <Link
                  href={`/request/new?format=${customFormat.id}`}
                  className="btn btn-primary self-start md:self-auto"
                >
                  Créer mon événement sur mesure
                </Link>
              ) : (
                // Fallback si pour une raison X le format n’est pas en base
                <Link
                  href="/request/new"
                  className="btn btn-outline self-start md:self-auto"
                >
                  Créer une demande personnalisée
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
