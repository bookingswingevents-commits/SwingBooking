import { RoadmapData } from '@/lib/roadmap';

function renderList(items: { label: string; value: string }[]) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {items.map((it, idx) => (
        <li key={`${it.label}-${idx}`}>
          {it.label ? <span className="font-medium">{it.label} :</span> : null}{' '}
          {it.value}
        </li>
      ))}
    </ul>
  );
}

export default function RoadmapPreview({ data }: { data: RoadmapData }) {
  if (!data.sections.length && !data.notes) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
        Aucune feuille de route disponible pour le moment.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{data.title}</h2>
        {data.subtitle ? <div className="text-sm text-slate-600">{data.subtitle}</div> : null}
      </div>

      {data.intro ? <p className="text-sm text-slate-700">{data.intro}</p> : null}

      {data.sections.map((section) => (
        <div key={section.id} className="space-y-2">
          <div className="text-sm font-medium text-slate-600">{section.title}</div>
          {section.kind === 'list' && renderList(section.items ?? [])}
          {section.kind === 'text' && section.text ? (
            <p className="text-sm text-slate-700">{section.text}</p>
          ) : null}
          {section.kind === 'schedule' ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {(section.schedule ?? []).map((s, idx) => (
                <li key={`${section.id}-${idx}`} className="rounded-lg border p-2">
                  <div className="font-medium">
                    {[s.day, s.time].filter(Boolean).join(' • ')}
                  </div>
                  {s.place ? <div>{s.place}</div> : null}
                  {s.notes ? <div className="text-xs text-slate-500">{s.notes}</div> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}

      {data.notes ? (
        <div>
          <div className="text-sm font-medium text-slate-600">Notes</div>
          <p className="text-sm text-slate-700">{data.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
