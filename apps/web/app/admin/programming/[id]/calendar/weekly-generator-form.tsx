"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

type GenerateWeeksState = {
  ok: boolean;
  error?: string;
  details?: string;
  createdCount?: number;
  start_date?: string;
  end_date?: string;
};

type WeeklyGeneratorFormProps = {
  programId: string;
  action: (prevState: GenerateWeeksState, formData: FormData) => Promise<GenerateWeeksState>;
  initialState: GenerateWeeksState;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? 'Generation...' : 'Generer les semaines'}
    </button>
  );
}

export default function WeeklyGeneratorForm({ programId, action, initialState }: WeeklyGeneratorFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!state.ok) {
      refreshedRef.current = false;
    }
    if (state.ok && state.createdCount && !refreshedRef.current) {
      refreshedRef.current = true;
      router.refresh();
    }
  }, [state.ok, state.createdCount, router]);

  return (
    <div className="space-y-3">
      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
          <div>{state.error}</div>
          {state.details ? <div className="text-rose-600">{state.details}</div> : null}
        </div>
      ) : null}
      {state.ok && state.createdCount ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
          {state.createdCount} semaine{state.createdCount > 1 ? 's' : ''} generee
          {state.createdCount > 1 ? 's' : ''}.
        </div>
      ) : null}
      <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <input type="hidden" name="program_id" value={programId} />
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="start_date">
            Debut
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            className="border rounded-lg px-3 py-2 w-full"
            defaultValue={state.start_date ?? ''}
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
            type="date"
            className="border rounded-lg px-3 py-2 w-full"
            defaultValue={state.end_date ?? ''}
            required
          />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}
