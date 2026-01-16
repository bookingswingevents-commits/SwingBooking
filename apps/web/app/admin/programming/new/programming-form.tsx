'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';

type ActionState = {
  error?: string | null;
  fields?: {
    title: string;
    client_id: string;
    program_type: string;
  };
};

type ClientRow = { id: string; name: string };

type Props = {
  clients: ClientRow[];
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
};

const defaultFields = { title: '', client_id: '', program_type: 'WEEKLY_RESIDENCY' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Création...' : 'Créer la programmation'}
    </button>
  );
}

export default function ProgrammingForm({ clients, action }: Props) {
  const [state, formAction] = useFormState(action, {
    error: null,
    fields: defaultFields,
  });
  const [fields, setFields] = useState(state.fields ?? defaultFields);

  useEffect(() => {
    setFields(state.fields ?? defaultFields);
  }, [state.fields]);

  return (
    <form action={formAction} className="rounded-xl border p-5 space-y-4 bg-white">
      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="title">
          Titre de la programmation
        </label>
        <input
          id="title"
          name="title"
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Nom interne"
          required
          value={fields.title}
          onChange={(e) => setFields((prev) => ({ ...prev, title: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="client_id">
          Client
        </label>
        <select
          id="client_id"
          name="client_id"
          className="border rounded-lg px-3 py-2 w-full"
          required
          value={fields.client_id}
          onChange={(e) => setFields((prev) => ({ ...prev, client_id: e.target.value }))}
        >
          <option value="">Selectionner un client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="program_type">
          Type de programmation
        </label>
        <select
          id="program_type"
          name="program_type"
          className="border rounded-lg px-3 py-2 w-full"
          required
          value={fields.program_type}
          onChange={(e) => setFields((prev) => ({ ...prev, program_type: e.target.value }))}
        >
          <option value="WEEKLY_RESIDENCY">Résidence hebdomadaire</option>
          <option value="MULTI_DATES">Dates multiples</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton />
        <Link href="/admin/programming" className="btn">
          Annuler
        </Link>
      </div>
    </form>
  );
}
