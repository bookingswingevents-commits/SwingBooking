export default function StatusBadge({ label }: { label: string }) {
  return (
    <span className="text-xs uppercase tracking-wide text-slate-500">
      {label}
    </span>
  );
}
