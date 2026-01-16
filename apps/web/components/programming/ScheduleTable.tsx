type RoadmapScheduleEntry = {
  date: string;
  time?: string;
  place?: string;
  notes?: string;
};

type ScheduleTableProps = {
  items: RoadmapScheduleEntry[];
};

export default function ScheduleTable({ items }: ScheduleTableProps) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <div className="text-sm font-medium text-slate-600">Planning</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Horaire</th>
              <th className="text-left px-3 py-2 font-medium">Lieu</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry, idx) => (
              <tr key={`schedule-${idx}`} className="border-t border-slate-200">
                <td className="px-3 py-2">{entry.date}</td>
                <td className="px-3 py-2">{entry.time ?? '—'}</td>
                <td className="px-3 py-2">{entry.place ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">{entry.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
