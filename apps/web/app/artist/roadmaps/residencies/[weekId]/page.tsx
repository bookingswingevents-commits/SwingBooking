'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { getArtistIdentity } from '@/lib/artistIdentity';

type RoadmapEntry = { label: string; value: string };
type RoadmapScheduleEntry = { day: string; time: string; place: string; notes?: string };

type RoadmapContent = {
  intro?: string;
  contacts?: RoadmapEntry[];
  addresses?: RoadmapEntry[];
  access?: RoadmapEntry[];
  lodging?: RoadmapEntry[];
  meals?: RoadmapEntry[];
  schedule?: RoadmapScheduleEntry[];
  logistics?: RoadmapEntry[];
  notes?: string;
};

type RoadmapTemplate = {
  id: string;
  title: string;
  content: RoadmapContent;
};

type WeekRow = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  week_type?: 'calm' | 'strong' | null;
  residencies: {
    id: string;
    name: string;
    clients?: { name: string }[] | null;
  }[] | null;
};

function renderList(items?: RoadmapEntry[]) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {items.map((it, idx) => (
        <li key={`${it.label}-${idx}`}>
          <span className="font-medium">{it.label} :</span> {it.value}
        </li>
      ))}
    </ul>
  );
}

export default function ArtistResidencyRoadmapPage() {
  const params = useParams<{ weekId: string }>();
  const weekId = params?.weekId;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [template, setTemplate] = useState<RoadmapTemplate | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }
        const identity = await getArtistIdentity(supabase);
        if (!identity.artistId) {
          setError('Votre compte artiste n’est pas relié.');
          return;
        }

        const { data: booking } = await supabase
          .from('week_bookings')
          .select(
            'id, status, residency_week_id, residency_weeks!inner(id, start_date_sun, end_date_sun, week_type, residencies(id, name, clients(name)))'
          )
          .eq('artist_id', identity.artistId)
          .eq('status', 'CONFIRMED')
          .eq('residency_week_id', weekId)
          .maybeSingle();
        const wk = (booking?.residency_weeks?.[0] as WeekRow | null) ?? null;
        if (!wk) {
          setError('Aucune feuille de route disponible pour cette semaine.');
          return;
        }
        setWeek(wk);

        const residency = wk.residencies?.[0] ?? null;
        const residencyId = residency?.id;
        const weekType = wk.week_type ?? 'calm';
        const { data: templates } = await supabase
          .from('roadmap_templates')
          .select('id, title, content, week_type')
          .eq('residency_id', residencyId);
        const picked =
          templates?.find((t: any) => t.week_type === weekType) ??
          templates?.find((t: any) => t.week_type === 'calm') ??
          null;
        setTemplate(picked as RoadmapTemplate | null);
      } catch (e: any) {
        setError(e?.message ?? 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [weekId, router]);

  const clientName = useMemo(() => {
    const res = week?.residencies?.[0];
    return res?.clients?.[0]?.name ?? null;
  }, [week]);

  if (loading) return <div className="text-slate-500">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feuille de route</h1>
          {week ? (
            <p className="text-sm text-slate-600">
              {week.residencies?.[0]?.name ?? 'Programmation'}
              {clientName ? ` • ${clientName}` : ''} •{' '}
              {fmtDateFR(week.start_date_sun)} → {fmtDateFR(week.end_date_sun)}
            </p>
          ) : null}
        </div>
        <Link href="/artist/roadmaps" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      ) : null}

      {!template ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
          Aucune feuille de route disponible pour le moment.
        </div>
      ) : (
        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold">{template.title}</h2>
          {template.content?.intro ? (
            <p className="text-sm text-slate-700">{template.content.intro}</p>
          ) : null}

          {template.content?.contacts?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Contacts</div>
              {renderList(template.content.contacts)}
            </div>
          ) : null}

          {template.content?.addresses?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Adresses</div>
              {renderList(template.content.addresses)}
            </div>
          ) : null}

          {template.content?.access?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Accès</div>
              {renderList(template.content.access)}
            </div>
          ) : null}

          {template.content?.lodging?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Logement</div>
              {renderList(template.content.lodging)}
            </div>
          ) : null}

          {template.content?.meals?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Repas</div>
              {renderList(template.content.meals)}
            </div>
          ) : null}

          {template.content?.schedule?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Planning</div>
              <ul className="space-y-2 text-sm text-slate-700">
                {template.content.schedule.map((s, idx) => (
                  <li key={`${s.day}-${idx}`} className="rounded-lg border p-2">
                    <div className="font-medium">
                      {s.day} • {s.time}
                    </div>
                    <div>{s.place}</div>
                    {s.notes ? <div className="text-xs text-slate-500">{s.notes}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {template.content?.logistics?.length ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Logistique</div>
              {renderList(template.content.logistics)}
            </div>
          ) : null}

          {template.content?.notes ? (
            <div>
              <div className="text-sm font-medium text-slate-600">Notes</div>
              <p className="text-sm text-slate-700">{template.content.notes}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
