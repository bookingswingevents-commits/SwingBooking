import { Suspense } from 'react';
import NewRequestClient from './new-client';

export default function AdminNewRequestPage() {
  return (
    <Suspense fallback={<div className="text-slate-500">Chargement…</div>}>
      <NewRequestClient />
    </Suspense>
  );
}
