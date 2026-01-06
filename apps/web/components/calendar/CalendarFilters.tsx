'use client';

import React from 'react';

export type CalendarFiltersState = {
  search: string;
  status: string;
  formation: string;
  venue?: string;
};

type Props = {
  filters: CalendarFiltersState;
  onChange: (next: CalendarFiltersState) => void;
  venueOptions?: { value: string; label: string }[];
  formations?: string[];
};

export function CalendarFilters({ filters, onChange, venueOptions, formations }: Props) {
  const update = (patch: Partial<CalendarFiltersState>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap gap-3 items-end border rounded-xl p-3 bg-white">
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Recherche</label>
        <input
          className="border rounded-lg p-2 text-sm"
          placeholder="Titre, lieu…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Statut</label>
        <select
          className="border rounded-lg p-2 text-sm"
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="">Tous</option>
          <option value="confirmed">Confirmés</option>
          <option value="proposal_sent">En attente client</option>
          <option value="pending">Brouillon</option>
          <option value="cancelled">Annulés</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Formation</label>
        <select
          className="border rounded-lg p-2 text-sm"
          value={filters.formation}
          onChange={(e) => update({ formation: e.target.value })}
        >
          <option value="">Toutes</option>
          {(formations ?? ['solo', 'duo', 'trio', 'quartet', 'dj']).map((f) => (
            <option key={f} value={f}>
              {String(f).toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      {venueOptions && venueOptions.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs text-slate-600">Établissement</label>
          <select
            className="border rounded-lg p-2 text-sm"
            value={filters.venue || ''}
            onChange={(e) => update({ venue: e.target.value })}
          >
            <option value="">Tous</option>
            {venueOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="button"
        className="text-xs underline text-[var(--brand)]"
        onClick={() =>
          onChange({
            search: '',
            status: '',
            formation: '',
            venue: '',
          })
        }
      >
        Réinitialiser
      </button>
    </div>
  );
}
