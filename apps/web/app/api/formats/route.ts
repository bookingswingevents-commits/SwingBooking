// app/api/formats/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const fallbackFormats = [
  { id: 1, slug: "dj-set-2h", title: "DJ Set 2h", description: "Performance DJ de 2 heures", image_url: null },
  { id: 2, slug: "live-band-1h", title: "Live Band 1h", description: "Groupe live 60 minutes", image_url: null },
];

/**
 * GET /api/formats
 * Récupère les formats et convertit les chemins storage en URLs publiques stables.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Mode fallback pour les tests/e2e ou environnement offline
    if (!supabaseUrl || !supabaseKey) {
      console.warn("SUPABASE non configuré pour /api/formats, retour fallback.");
      return NextResponse.json(fallbackFormats);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("event_formats")
      .select("*")
      .order("title", { ascending: true });

    if (error) {
      console.error("Erreur Supabase event_formats:", error);
      return NextResponse.json(fallbackFormats);
    }

    const formats =
      data?.map((f: any) => {
        let imageUrl: string | null = f.image_url || null;

        // Si c'est un chemin de stockage interne → on le convertit en URL publique
        if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
          const normalizedPath = imageUrl.replace(
            /^\/?storage\/v1\/object\/public\/catalogue\//,
            ""
          );

          const { data: publicUrlData } = supabase.storage
            .from("catalogue")
            .getPublicUrl(normalizedPath);

          imageUrl = publicUrlData?.publicUrl ?? null;
        }

        return { ...f, image_url: imageUrl };
      }) ?? [];

    return NextResponse.json(formats);
  } catch (err) {
    console.error("Erreur serveur /api/formats:", err);
    return NextResponse.json(fallbackFormats);
  }
}
