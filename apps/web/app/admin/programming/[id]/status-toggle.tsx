"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeProgrammingStatus } from '@/lib/programming/status';

type StatusToggleProps = {
  programId: string;
  status?: string | null;
};

export default function StatusToggle({ programId, status }: StatusToggleProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const normalized = normalizeProgrammingStatus(status ?? 'DRAFT');
  const isActive = normalized === 'ACTIVE';
  const nextStatus = isActive ? 'DRAFT' : 'ACTIVE';

  const handleClick = async () => {
    setPending(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/admin/programming/${programId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'Mise à jour impossible.');
        setPending(false);
        return;
      }
      setMessage(isActive ? 'Programmation mise en brouillon.' : 'Programmation publiée.');
      setPending(false);
      router.refresh();
    } catch (err) {
      console.error('[programming/status] UPDATE_FAILED', err);
      setError('Erreur réseau. Merci de réessayer.');
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button className="btn btn-primary" type="button" onClick={handleClick} disabled={pending}>
        {pending
          ? 'Mise à jour...'
          : isActive
            ? 'Mettre en brouillon'
            : 'Publier la programmation'}
      </button>
      {message ? <div className="text-xs text-emerald-700">{message}</div> : null}
      {error ? <div className="text-xs text-rose-700">{error}</div> : null}
    </div>
  );
}
