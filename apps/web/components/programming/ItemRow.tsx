import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';

export type ItemRowProps = {
  title: string;
  subtitle: string;
  status: string;
  trailing?: ReactNode;
};

export default function ItemRow({ title, subtitle, status, trailing }: ItemRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="space-y-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-slate-600">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label={status} />
        {trailing}
      </div>
    </div>
  );
}
