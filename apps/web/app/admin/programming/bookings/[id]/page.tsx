import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAdminAuth } from '@/lib/supabaseServer';
import { generateRoadmap } from '@/lib/programming/roadmap';
import RoadmapHeader from '@/components/programming/RoadmapHeader';
import RoadmapSection from '@/components/programming/RoadmapSection';
import ScheduleTable from '@/components/programming/ScheduleTable';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminProgrammingBookingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { user, isAdmin } = await getAdminAuth(supabase);
  if (!user) redirect('/login');
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-red-600">Acces refuse (admin requis).</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: booking } = await supabase
    .from('programming_bookings')
    .select('id, artist_id, status, option_json, conditions_snapshot_json, artists(stage_name), programming_items(id, item_type, start_date, end_date, status, meta_json, programming_programs(id, title, program_type, conditions_json))')
    .eq('id', id)
    .maybeSingle();

  if (!booking) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-slate-500">Confirmation introuvable.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const item = Array.isArray(booking.programming_items)
    ? booking.programming_items[0]
    : booking.programming_items;
  const program = Array.isArray(item?.programming_programs)
    ? item?.programming_programs[0]
    : item?.programming_programs;
  const artistRow = Array.isArray((booking as any)?.artists)
    ? (booking as any).artists[0]
    : (booking as any)?.artists;

  if (!item || !program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-slate-500">Informations manquantes.</p>
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const roadmap = generateRoadmap({
    program: {
      id: program.id,
      title: program.title ?? 'Programmation',
      program_type: program.program_type,
      conditions_json: program.conditions_json ?? {},
    },
    item: {
      id: item.id,
      program_id: program.id,
      item_type: item.item_type,
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      meta_json: item.meta_json ?? {},
    },
    booking: {
      id: booking.id,
      item_id: item.id,
      artist_id: booking.artist_id,
      status: booking.status,
      conditions_snapshot_json: booking.conditions_snapshot_json ?? {},
      option_json: booking.option_json ?? {},
      option: booking.option_json ?? null,
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3">
        <RoadmapHeader
          title={program.title ?? 'Programmation'}
          period={`${item.start_date} → ${item.end_date}`}
          artistName={artistRow?.stage_name ?? null}
        />
        <Link href="/admin/programming" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      <section className="rounded-2xl border bg-white p-5 space-y-4">
        <ScheduleTable items={roadmap.schedule} />
        <RoadmapSection title="Frais" items={roadmap.fees} />
        <RoadmapSection title="Lieux" items={roadmap.venues} />
        <RoadmapSection title="Logement" items={roadmap.lodging} />
        <RoadmapSection title="Repas" items={roadmap.meals} />
        <RoadmapSection title="Acces" items={roadmap.access} />
        <RoadmapSection title="Logistique" items={roadmap.logistics} />
        <RoadmapSection title="Contacts" items={roadmap.contacts} />
      </section>
    </div>
  );
}
