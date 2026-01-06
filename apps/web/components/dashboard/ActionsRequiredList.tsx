import Link from 'next/link';
import { DashboardAction } from '@/lib/dashboardActions';

export function ActionsRequiredList({ actions }: { actions: DashboardAction[] }) {
  const safe = actions.map((a, idx) => ({
    ...a,
    id: a.id || `${a.type}-${a.href}-${idx}`,
  }));

  return (
    <section className="border rounded-2xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Actions requises</h3>
        <span className="text-xs text-slate-500">
          {safe.length} action{safe.length > 1 ? 's' : ''} à traiter
        </span>
      </div>
      {safe.length === 0 ? (
        <div className="rounded-xl border border-dashed p-3 text-sm text-slate-600 bg-slate-50">
          Aucune action requise pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {safe.slice(0, 5).map((a, idx) => (
            <li key={`${a.id}-${idx}`}>
              <Link
                href={a.href}
                className="block rounded-xl border p-3 hover:border-[var(--brand)] hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{a.title}</div>
                  <span className="text-[10px] uppercase text-slate-500">
                    Priorité {a.priority}
                  </span>
                </div>
                {a.description ? (
                  <div className="text-sm text-slate-600 mt-1">{a.description}</div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
