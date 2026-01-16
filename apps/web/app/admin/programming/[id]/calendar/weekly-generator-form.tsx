"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type WeeklyGeneratorFormProps = {
  programId: string;
};

type GeneratorState = {
  pending: boolean;
  error?: string;
  details?: string;
  success?: string;
  start_date: string;
  end_date: string;
};

export default function WeeklyGeneratorForm({ programId }: WeeklyGeneratorFormProps) {
  const router = useRouter();
  const [state, setState] = useState<GeneratorState>({
    pending: false,
    error: undefined,
    details: undefined,
    success: undefined,
    start_date: '',
    end_date: '',
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const start_date = String(formData.get('start_date') ?? '').trim();
    const end_date = String(formData.get('end_date') ?? '').trim();

    setState((prev) => ({
      ...prev,
      pending: true,
      error: undefined,
      details: undefined,
      success: undefined,
      start_date,
      end_date,
    }));

    try {
      const response = await fetch(`/api/admin/programming/${programId}/generate-weeks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date, end_date }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        details?: string;
        createdCount?: number;
      };

      if (!response.ok || !payload.ok) {
        setState((prev) => ({
          ...prev,
          pending: false,
          error: payload.error ?? 'Generation impossible.',
          details: payload.details,
          success: undefined,
        }));
        return;
      }

      const createdCount = payload.createdCount ?? 0;
      setState((prev) => ({
        ...prev,
        pending: false,
        error: undefined,
        details: undefined,
        success: `${createdCount} semaine${createdCount > 1 ? 's' : ''} generee${createdCount > 1 ? 's' : ''}.`,
      }));
      router.refresh();
    } catch (error) {
      console.error('[programming/calendar] GENERATE_WEEKS_CLIENT_FAILED', error);
      setState((prev) => ({
        ...prev,
        pending: false,
        error: 'Generation impossible.',
        details: 'Erreur reseau. Merci de reessayer.',
        success: undefined,
      }));
    }
  };

  return (
    <div className="space-y-3">
      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
          <div>{state.error}</div>
          {state.details ? <div className="text-rose-600">{state.details}</div> : null}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
          {state.success}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="start_date">
            Debut
          </label>
          <input
            id="start_date"
            name="start_date"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD ou DD/MM/YYYY"
            className="border rounded-lg px-3 py-2 w-full"
            defaultValue={state.start_date}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="end_date">
            Fin
          </label>
          <input
            id="end_date"
            name="end_date"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD ou DD/MM/YYYY"
            className="border rounded-lg px-3 py-2 w-full"
            defaultValue={state.end_date}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={state.pending}>
          {state.pending ? 'Generation...' : 'Generer les semaines'}
        </button>
      </form>
    </div>
  );
}
