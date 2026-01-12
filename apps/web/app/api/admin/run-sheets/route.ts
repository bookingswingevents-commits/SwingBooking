import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, getAdminAuth } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Utilitaire env
function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variables d'environnement manquantes: ${name}`);
  return v;
}

/**
 * POST /api/admin/run-sheets
 * Body JSON:
 *  - proposal_id?: string
 *  - request_id?: string
 *
 * Auth:
 *  - Authorization: Bearer <access_token>
 *  - L'utilisateur doit avoir role = 'admin' dans profiles
 *
 * Effet:
 *  - Tente une liste de RPC côté DB (tu peux en avoir une seule ou plusieurs variantes):
 *      - admin_send_runsheets
 *      - admin_send_run_sheets
 *      - admin_send_feuilles_de_route
 *      - admin_send_roadmap
 *  - Essaie d'abord avec _proposal_id (si fourni), puis avec _request_id
 *  - Retourne 'attempts' avec le résultat détaillé de chaque essai
 */
export async function POST(req: Request) {
  try {
    const SUPABASE_URL = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SRK = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    // ---- Auth côté SSR (cookies Supabase)
    const supabase = await createSupabaseServerClient();
    const { user, isAdmin } = await getAdminAuth(supabase);
    if (!user) {
      return NextResponse.json({ error: "NO_USER" }, { status: 401 });
    }

    // Client SRK pour bypass RLS (vérif rôle + RPC)
    const supaSrv = createClient(SUPABASE_URL, SRK, {
      global: { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Vérifier rôle admin
    if (!isAdmin) {
      return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });
    }

    // Body
    const body = await req.json().catch(() => ({} as any));
    const proposal_id: string | undefined = body?.proposal_id ?? body?.proposalId ?? undefined;
    const request_id: string | undefined = body?.request_id ?? body?.requestId ?? undefined;

    if (!proposal_id && !request_id) {
      return NextResponse.json(
        { error: "Champ manquant: proposal_id ou request_id" },
        { status: 400 }
      );
    }

    // Liste des RPC à tenter
    const RPCS = [
      "admin_send_runsheets",
      "admin_send_run_sheets",
      "admin_send_feuilles_de_route",
      "admin_send_roadmap",
    ];

    type Attempt = { fn: string; args: Record<string, any>; ok: boolean; error?: string };

    const attempts: Attempt[] = [];

    // Helper pour essayer une RPC et logguer le résultat
    async function tryOne(fn: string, args: Record<string, any>) {
      const { error } = await supaSrv.rpc(fn, args);
      if (error) {
        attempts.push({ fn, args, ok: false, error: error.message });
        return false;
      }
      attempts.push({ fn, args, ok: true });
      return true;
    }

    // 1) d'abord avec proposal_id
    if (proposal_id) {
      for (const fn of RPCS) {
        const ok = await tryOne(fn, { _proposal_id: proposal_id });
        if (ok) {
          return NextResponse.json({ ok: true, via: fn, attempts });
        }
      }
    }

    // 2) sinon avec request_id
    if (request_id) {
      for (const fn of RPCS) {
        const ok = await tryOne(fn, { _request_id: request_id });
        if (ok) {
          return NextResponse.json({ ok: true, via: fn, attempts });
        }
      }
    }

    // Rien n'a fonctionné → remonter les tentatives pour debug rapide côté UI
    return NextResponse.json(
      {
        error: "Aucune RPC n'a abouti (vérifier noms / signatures / RLS / rôle).",
        attempts,
      },
      { status: 500 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur serveur" }, { status: 500 });
  }
}
