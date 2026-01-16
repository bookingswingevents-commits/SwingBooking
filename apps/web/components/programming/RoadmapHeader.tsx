type RoadmapHeaderProps = {
  title: string;
  period: string;
  artistName?: string | null;
};

export default function RoadmapHeader({ title, period, artistName }: RoadmapHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-slate-600">{period}</p>
      {artistName ? <p className="text-xs text-slate-500">Artiste: {artistName}</p> : null}
    </div>
  );
}
