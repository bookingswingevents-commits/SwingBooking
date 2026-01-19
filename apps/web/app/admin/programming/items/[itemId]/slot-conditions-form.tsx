"use client";

import { useState } from 'react';

type ConditionsPayload = {
  fee_cents?: number | null;
  currency?: string | null;
  is_net?: boolean | null;
  performances_count?: number | null;
  lodging_included?: boolean | null;
  meals_included?: boolean | null;
  notes?: string | null;
};

type SlotConditionsFormProps = {
  itemId: string;
  initialConditions: ConditionsPayload;
  hasOverride: boolean;
};

function toCents(value: string) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
}

export default function SlotConditionsForm({
  itemId,
  initialConditions,
  hasOverride,
}: SlotConditionsFormProps) {
  const [state, setState] = useState({
    pending: false,
    message: '',
    error: '',
    fee: initialConditions.fee_cents ? String(initialConditions.fee_cents / 100) : '',
    currency: initialConditions.currency ?? 'EUR',
    is_net: initialConditions.is_net ?? true,
    performances_count: initialConditions.performances_count ? String(initialConditions.performances_count) : '',
    lodging_included: initialConditions.lodging_included ?? false,
    meals_included: initialConditions.meals_included ?? false,
    notes: initialConditions.notes ?? '',
  });
  const [overrideState, setOverrideState] = useState(hasOverride);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState((prev) => ({ ...prev, pending: true, error: '', message: '' }));

    const payload: ConditionsPayload = {
      fee_cents: state.fee ? toCents(state.fee) : null,
      currency: state.currency || 'EUR',
      is_net: state.is_net,
      performances_count: state.performances_count ? Number(state.performances_count) : null,
      lodging_included: state.lodging_included,
      meals_included: state.meals_included,
      notes: state.notes?.trim() ? state.notes.trim() : '',
    };

    try {
      const response = await fetch(`/api/admin/programming/items/${itemId}/conditions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions_override: payload }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setState((prev) => ({
          ...prev,
          pending: false,
          error: result.error ?? 'Mise à jour impossible.',
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        pending: false,
        message: 'Conditions enregistrées.',
        error: '',
      }));
      setOverrideState(true);
    } catch (error) {
      console.error('[programming/conditions] SAVE_FAILED', error);
      setState((prev) => ({
        ...prev,
        pending: false,
        error: 'Erreur réseau. Merci de réessayer.',
      }));
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fee">
          Cachet (€)
        </label>
        <input
          id="fee"
          name="fee"
          type="text"
          inputMode="decimal"
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Ex: 1500"
          value={state.fee}
          onChange={(event) => setState((prev) => ({ ...prev, fee: event.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="performances">
          Nombre de prestations
        </label>
        <input
          id="performances"
          name="performances"
          type="number"
          min="0"
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Ex: 2"
          value={state.performances_count}
          onChange={(event) => setState((prev) => ({ ...prev, performances_count: event.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="currency">
          Devise
        </label>
        <select
          id="currency"
          name="currency"
          className="border rounded-lg px-3 py-2 w-full"
          value={state.currency}
          onChange={(event) => setState((prev) => ({ ...prev, currency: event.target.value }))}
        >
          <option value="EUR">EUR</option>
          <option value="CHF">CHF</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Cachet net</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`btn ${state.is_net ? 'btn-primary' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, is_net: true }))}
          >
            Net
          </button>
          <button
            type="button"
            className={`btn ${!state.is_net ? 'btn-primary' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, is_net: false }))}
          >
            Brut
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Logement inclus</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`btn ${state.lodging_included ? 'btn-primary' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, lodging_included: true }))}
          >
            Oui
          </button>
          <button
            type="button"
            className={`btn ${!state.lodging_included ? 'btn-primary' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, lodging_included: false }))}
          >
            Non
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Repas inclus</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`btn ${state.meals_included ? 'btn-primary' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, meals_included: true }))}
          >
            Oui
          </button>
          <button
            type="button"
            className={`btn ${!state.meals_included ? 'btn-primary' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, meals_included: false }))}
          >
            Non
          </button>
        </div>
      </div>
      <div className="md:col-span-2 space-y-1">
        <label className="text-sm font-medium" htmlFor="notes">
          Notes / logistique
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Infos utiles pour l'artiste (adresse, horaire, matériel, contact)."
          value={state.notes}
          onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
        />
      </div>

      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" type="submit" disabled={state.pending}>
          {state.pending ? 'Enregistrement...' : 'Enregistrer les conditions'}
        </button>
        <span className="text-xs text-slate-500">
          {overrideState ? 'Conditions spécifiques au créneau.' : 'Conditions par défaut de la programmation.'}
        </span>
        {state.message ? (
          <span className="text-xs text-emerald-700">{state.message}</span>
        ) : null}
        {state.error ? (
          <span className="text-xs text-rose-700">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
