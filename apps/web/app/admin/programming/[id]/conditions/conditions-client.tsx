'use client';

import { useMemo, useState } from 'react';

type Entry = { label: string; value: string };

type FeeOption = { label: string; amount_cents?: number | null };

type ConditionsState = {
  fees?: { options?: FeeOption[] };
  lodging?: { items?: Entry[] };
  meals?: { items?: Entry[] };
  logistics?: { items?: Entry[] };
  venues?: { items?: Entry[] };
  contacts?: { items?: Entry[] };
};

type Props = {
  initialConditions: ConditionsState;
  onSave: (formData: FormData) => void;
};

function parseCents(input: string) {
  const normalized = input.replace(',', '.').trim();
  if (!normalized) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function formatCents(value?: number | null) {
  if (typeof value !== 'number') return '';
  return String((value / 100).toFixed(2)).replace(/\.00$/, '');
}

function normalizeEntries(items?: Entry[]) {
  return (items ?? []).map((item) => ({
    label: item.label ?? '',
    value: item.value ?? '',
  }));
}

function normalizeFees(options?: FeeOption[]) {
  return (options ?? []).map((opt) => ({
    label: opt.label ?? '',
    amount_cents: typeof opt.amount_cents === 'number' ? opt.amount_cents : null,
  }));
}

function EntryEditor({
  title,
  items,
  onChange,
  emptyLabel,
}: {
  title: string;
  items: Entry[];
  onChange: (next: Entry[]) => void;
  emptyLabel: string;
}) {
  const add = () => onChange([...items, { label: '', value: '' }]);
  const update = (idx: number, key: keyof Entry, value: string) => {
    const next = items.map((item, index) => (index === idx ? { ...item, [key]: value } : item));
    onChange(next);
  };
  const remove = (idx: number) => onChange(items.filter((_, index) => index !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <button className="btn" type="button" onClick={add}>
          Ajouter
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-slate-500">{emptyLabel}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={`${title}-${idx}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Libelle"
                value={item.label}
                onChange={(e) => update(idx, 'label', e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Valeur"
                value={item.value}
                onChange={(e) => update(idx, 'value', e.target.value)}
              />
              <button className="btn" type="button" onClick={() => remove(idx)}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConditionsClient({ initialConditions, onSave }: Props) {
  const [conditions, setConditions] = useState<ConditionsState>(() => ({
    fees: { options: normalizeFees(initialConditions.fees?.options) },
    lodging: { items: normalizeEntries(initialConditions.lodging?.items) },
    meals: { items: normalizeEntries(initialConditions.meals?.items) },
    logistics: { items: normalizeEntries(initialConditions.logistics?.items) },
    venues: { items: normalizeEntries(initialConditions.venues?.items) },
    contacts: { items: normalizeEntries(initialConditions.contacts?.items) },
  }));

  const serialized = useMemo(() => JSON.stringify(conditions), [conditions]);

  return (
    <form action={onSave} className="space-y-6">
      <input type="hidden" name="conditions_json" value={serialized} />

      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Fees</h2>
          <button
            className="btn"
            type="button"
            onClick={() =>
              setConditions((prev) => ({
                ...prev,
                fees: {
                  options: [...(prev.fees?.options ?? []), { label: '', amount_cents: null }],
                },
              }))
            }
          >
            Ajouter une option
          </button>
        </div>
        {conditions.fees?.options?.length ? (
          <div className="space-y-2">
            {conditions.fees.options.map((opt, idx) => (
              <div key={`fee-${idx}`} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Option (ex: Duo, DJ set)"
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...(conditions.fees?.options ?? [])];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setConditions((prev) => ({ ...prev, fees: { options: next } }));
                  }}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="Montant"
                  value={formatCents(opt.amount_cents)}
                  onChange={(e) => {
                    const cents = parseCents(e.target.value);
                    const next = [...(conditions.fees?.options ?? [])];
                    next[idx] = { ...next[idx], amount_cents: cents };
                    setConditions((prev) => ({ ...prev, fees: { options: next } }));
                  }}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const next = (conditions.fees?.options ?? []).filter((_, i) => i !== idx);
                    setConditions((prev) => ({ ...prev, fees: { options: next } }));
                  }}
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Aucune option de fee.</div>
        )}
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <EntryEditor
          title="Lodging"
          items={conditions.lodging?.items ?? []}
          emptyLabel="Aucune information de logement."
          onChange={(items) =>
            setConditions((prev) => ({
              ...prev,
              lodging: { items },
            }))
          }
        />
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <EntryEditor
          title="Meals"
          items={conditions.meals?.items ?? []}
          emptyLabel="Aucune information de repas."
          onChange={(items) =>
            setConditions((prev) => ({
              ...prev,
              meals: { items },
            }))
          }
        />
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <EntryEditor
          title="Logistics"
          items={conditions.logistics?.items ?? []}
          emptyLabel="Aucune logistique renseignee."
          onChange={(items) =>
            setConditions((prev) => ({
              ...prev,
              logistics: { items },
            }))
          }
        />
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <EntryEditor
          title="Venues"
          items={conditions.venues?.items ?? []}
          emptyLabel="Aucun lieu renseigne."
          onChange={(items) =>
            setConditions((prev) => ({
              ...prev,
              venues: { items },
            }))
          }
        />
      </section>

      <section className="rounded-xl border p-4 space-y-3">
        <EntryEditor
          title="Contacts"
          items={conditions.contacts?.items ?? []}
          emptyLabel="Aucun contact renseigne."
          onChange={(items) =>
            setConditions((prev) => ({
              ...prev,
              contacts: { items },
            }))
          }
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit">
          Enregistrer les conditions
        </button>
      </div>
    </form>
  );
}
