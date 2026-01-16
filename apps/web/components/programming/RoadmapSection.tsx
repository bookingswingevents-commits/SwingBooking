type RoadmapEntry = { label: string; value: string };

type RoadmapSectionProps = {
  title: string;
  items: RoadmapEntry[];
};

export default function RoadmapSection({ title, items }: RoadmapSectionProps) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <ul className="space-y-1 text-sm text-slate-700">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`}>
            {item.label ? <span className="font-medium">{item.label} :</span> : null} {item.value}
          </li>
        ))}
      </ul>
    </section>
  );
}
