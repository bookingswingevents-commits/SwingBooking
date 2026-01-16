import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { generateRoadmap } from '@/lib/programming/roadmap';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

type RoadmapEntry = { label: string; value: string };

type RoadmapScheduleEntry = { date: string; time?: string; place?: string; notes?: string };

type RoadmapOutput = {
  schedule: RoadmapScheduleEntry[];
  fees: RoadmapEntry[];
  venues: RoadmapEntry[];
  lodging: RoadmapEntry[];
  meals: RoadmapEntry[];
  logistics: RoadmapEntry[];
  contacts: RoadmapEntry[];
};

async function getArtistId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: byUser } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUser?.id) return byUser.id;

  const { data: byId } = await supabase
    .from('artists')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  return byId?.id ?? null;
}

function renderList(items: RoadmapEntry[]) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {items.map((item, idx) => (
        <li key={`${item.label}-${idx}`}>
          {item.label ? <span className="font-medium">{item.label} :</span> : null} {item.value}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, items }: { title: string; items: RoadmapEntry[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {renderList(items)}
    </div>
  );
}

export default async function ArtistBookingRoadmapPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const artistId = await getArtistId();
  if (!artistId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-red-600">Compte artiste non lie.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const { data: booking } = await supabase
    .from('programming_bookings')
    .select('id, artist_id, status, option_json, conditions_snapshot_json, programming_items(id, item_type, start_date, end_date, status, metadata_json, programming_programs(id, name, program_type, conditions_json))')
    .eq('id', id)
    .eq('artist_id', artistId)
    .maybeSingle();

  if (!booking) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-slate-500">Booking introuvable.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
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

  if (!item || !program) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Feuille de route</h1>
        <p className="text-slate-500">Informations manquantes.</p>
        <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const roadmap = generateRoadmap({
    program: {
      id: program.id,
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
      metadata_json: item.metadata_json ?? {},
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
  }) as RoadmapOutput;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Feuille de route</h1>
          <p className="text-sm text-slate-600">{program.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/programming/bookings/${booking.id}/roadmap.pdf`}
            className="btn"
            target="_blank"
            rel="noreferrer"
          >
            Telecharger PDF
          </a>
          <Link href="/dashboard" className="text-sm underline text-[var(--brand)]">
            ← Retour
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-5 space-y-4">
        {roadmap.schedule.length ? (
          <div>
            <div className="text-sm font-medium text-slate-600">Planning</div>
            <ul className="space-y-2 text-sm text-slate-700">
              {roadmap.schedule.map((entry, idx) => (
                <li key={`schedule-${idx}`} className="rounded-lg border p-2">
                  <div className="font-medium">
                    {[entry.date, entry.time].filter(Boolean).join(' • ')}
                  </div>
                  {entry.place ? <div>{entry.place}</div> : null}
                  {entry.notes ? <div className="text-xs text-slate-500">{entry.notes}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Section title="Frais" items={roadmap.fees} />
        <Section title="Lieux" items={roadmap.venues} />
        <Section title="Logement" items={roadmap.lodging} />
        <Section title="Repas" items={roadmap.meals} />
        <Section title="Logistique" items={roadmap.logistics} />
        <Section title="Contacts" items={roadmap.contacts} />
      </section>
    </div>
  );
}
