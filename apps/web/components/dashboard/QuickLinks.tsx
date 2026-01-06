import Link from 'next/link';

type LinkItem = { href: string; label: string; exists?: boolean };

export function QuickLinks({ items }: { items: LinkItem[] }) {
  const filtered = items.filter((i) => i.exists !== false);
  if (!filtered.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((i) => (
        <Link key={i.href} href={i.href} className="btn">
          {i.label}
        </Link>
      ))}
    </div>
  );
}
