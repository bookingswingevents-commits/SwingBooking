'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseBrowser';
import { fmtDateFR } from '@/lib/date';
import { labelForStatus, labelForError } from '@/lib/i18n';
import { DayPicker } from 'react-day-picker';
import RoadmapPreview from '@/components/RoadmapPreview';
import type { ConditionsJson, RoadmapEntry, RoadmapOverrides, RoadmapScheduleEntry } from '@/lib/roadmap';
import { buildRoadmapData } from '@/lib/roadmap';

type ProgramType = 'MULTI_DATES' | 'WEEKLY_RESIDENCY';

type ResidencyRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  mode?: 'RANGE' | 'DATES' | null;
  terms_mode?: 'SIMPLE_FEE' | 'INCLUDED' | 'WEEKLY' | 'RESIDENCY_WEEKLY' | null;
  fee_amount_cents?: number | null;
  fee_currency?: string | null;
  fee_is_net?: boolean | null;
  is_public: boolean;
  is_open: boolean;
  lodging_included: boolean;
  meals_included: boolean;
  companion_included: boolean;
  program_type?: ProgramType | null;
  conditions_json?: ConditionsJson | null;
  roadmap_overrides_json?: RoadmapOverrides | null;
  event_address_line1?: string | null;
  event_address_line2?: string | null;
  event_address_zip?: string | null;
  event_address_city?: string | null;
  event_address_country?: string | null;
  clients?:
    | {
        name: string;
        default_event_address_line1?: string | null;
        default_event_address_line2?: string | null;
        default_event_zip?: string | null;
        default_event_city?: string | null;
        default_event_country?: string | null;
      }
    | {
        name: string;
        default_event_address_line1?: string | null;
        default_event_address_line2?: string | null;
        default_event_zip?: string | null;
        default_event_city?: string | null;
        default_event_country?: string | null;
      }[]
    | null;
};

type WeekApplication = {
  id: string;
  artist_id: string;
  status: 'APPLIED' | 'WITHDRAWN' | 'REJECTED';
  created_at: string;
  artists?: { stage_name: string | null } | { stage_name: string | null }[] | null;
};

type WeekBooking = {
  id: string;
  artist_id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  artists?: { stage_name: string | null } | { stage_name: string | null }[] | null;
};

type ResidencyWeek = {
  id: string;
  start_date_sun: string;
  end_date_sun: string;
  type: 'CALM' | 'BUSY';
  performances_count: number;
  fee_cents: number;
  status: 'OPEN' | 'CONFIRMED' | 'CANCELLED';
  confirmed_booking_id: string | null;
  week_type?: 'calm' | 'strong' | null;
  week_applications?: WeekApplication[] | WeekApplication | null;
  week_bookings?: WeekBooking[] | WeekBooking | null;
};

type ResidencyOccurrence = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

type ResidencyApplication = {
  id: string;
  date: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
  artists?: {
    id: string;
    stage_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    instagram_url: string | null;
    website_url: string | null;
  } | null | {
    id: string;
    stage_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    instagram_url: string | null;
    website_url: string | null;
  }[];
};

type InvitationRow = {
  id: string;
  token: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  target_filter: any;
};

type ArtistOption = {
  id: string;
  stage_name: string | null;
  full_name?: string | null;
  email?: string | null;
};

type BookingRequestMini = {
  id: string;
  event_date: string | null;
  status: string | null;
};

type RequestArtistRow = {
  request_id: string;
  status: string | null;
  artists?: { stage_name: string | null } | { stage_name: string | null }[] | null;
};

type DateStatusSummary = {
  status: 'CONFIRMED' | 'PENDING' | 'DECLINED' | 'EMPTY';
  confirmedArtists: string[];
  invitedCount: number;
  declinedCount: number;
  invitedArtists: { name: string; status: string }[];
};

type RemunerationOption = { label: string; amount_cents?: number };

type ConditionsErrors = { remuneration?: string };

type RoadmapSelection =
  | { kind: 'week'; week: ResidencyWeek }
  | { kind: 'date'; date: string }
  | null;

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const toArray = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

function buildAddress(
  line1?: string | null,
  line2?: string | null,
  zip?: string | null,
  city?: string | null,
  country?: string | null
) {
  const parts = [
    line1?.trim(),
    line2?.trim(),
    [zip?.trim(), city?.trim()].filter(Boolean).join(' '),
    country?.trim(),
  ].filter(Boolean);
  return parts.join(', ');
}

function toISODate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  const year = normalized.getFullYear();
  const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
  const day = `${normalized.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseCents(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return undefined;
  return Math.round(num * 100);
}

function formatCentsInput(value?: number | null) {
  if (typeof value !== 'number') return '';
  return String((value / 100).toFixed(2)).replace(/\.00$/, '');
}

function mapWeekType(value?: string | null) {
  if (value === 'strong') return 'PEAK' as const;
  if (value === 'calm') return 'CALM' as const;
  return null;
}

function buildLegacyConditions(
  residency: ResidencyRow,
  weeks: ResidencyWeek[],
  resolvedAddress?: string | null
): ConditionsJson {
  const calm = weeks.find((w) => w.type === 'CALM' || w.week_type === 'calm');
  const peak = weeks.find((w) => w.type === 'BUSY' || w.week_type === 'strong');

  const conditions: ConditionsJson = {
    remuneration: residency.mode === 'DATES'
      ? {
          mode: 'PER_DATE',
          currency: residency.fee_currency ?? 'EUR',
          is_net: residency.fee_is_net ?? true,
          per_date: residency.fee_amount_cents
            ? { amount_cents: residency.fee_amount_cents, artist_choice: false, options: [] }
            : { artist_choice: false, options: [] },
        }
      : {
          mode: 'PER_WEEK',
          currency: residency.fee_currency ?? 'EUR',
          is_net: residency.fee_is_net ?? true,
          per_week: {
            calm: calm
              ? { fee_cents: calm.fee_cents, performances_count: calm.performances_count }
              : { fee_cents: 15000, performances_count: 2 },
            peak: peak
              ? { fee_cents: peak.fee_cents, performances_count: peak.performances_count }
              : { fee_cents: 30000, performances_count: 4 },
          },
        },
    lodging: {
      included: residency.lodging_included,
      companion_included: residency.companion_included,
      details: '',
    },
    meals: {
      included: residency.meals_included,
      details: '',
    },
    defraiement: { details: '' },
    locations: resolvedAddress
      ? { items: [{ label: 'Adresse', value: resolvedAddress }] }
      : { items: [] },
    contacts: { items: [] },
    access: { items: [] },
    logistics: { items: [] },
    planning: { items: [] },
    notes: '',
  };
  return conditions;
}

function mergeConditions(base: ConditionsJson, override: ConditionsJson): ConditionsJson {
  return {
    ...base,
    ...override,
    remuneration: {
      ...base.remuneration,
      ...override.remuneration,
      per_date: {
        ...base.remuneration?.per_date,
        ...override.remuneration?.per_date,
        options: override.remuneration?.per_date?.options ?? base.remuneration?.per_date?.options ?? [],
      },
      per_week: {
        ...base.remuneration?.per_week,
        ...override.remuneration?.per_week,
        calm: {
          ...base.remuneration?.per_week?.calm,
          ...override.remuneration?.per_week?.calm,
        },
        peak: {
          ...base.remuneration?.per_week?.peak,
          ...override.remuneration?.per_week?.peak,
        },
      },
    },
    lodging: { ...base.lodging, ...override.lodging },
    meals: { ...base.meals, ...override.meals },
    defraiement: { ...base.defraiement, ...override.defraiement },
    locations: { ...base.locations, ...override.locations },
    contacts: { ...base.contacts, ...override.contacts },
    access: { ...base.access, ...override.access },
    logistics: { ...base.logistics, ...override.logistics },
    planning: { ...base.planning, ...override.planning },
    notes: override.notes ?? base.notes,
  };
}

export default function AdminResidencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: residencyId } = React.use(params);
  const router = useRouter();
  const [residency, setResidency] = useState<ResidencyRow | null>(null);
  const [weeks, setWeeks] = useState<ResidencyWeek[]>([]);
  const [occurrences, setOccurrences] = useState<ResidencyOccurrence[]>([]);
  const [residencyApplications, setResidencyApplications] = useState<ResidencyApplication[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<Record<string, boolean>>({});
  const [searchArtist, setSearchArtist] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [origin, setOrigin] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editIsOpen, setEditIsOpen] = useState(true);
  const [editProgramType, setEditProgramType] = useState<ProgramType>('WEEKLY_RESIDENCY');
  const [conditionsDraft, setConditionsDraft] = useState<ConditionsJson>({});
  const [roadmapOverrides, setRoadmapOverrides] = useState<RoadmapOverrides>({});
  const [conditionsErrors, setConditionsErrors] = useState<ConditionsErrors>({});
  const [dateStatusMap, setDateStatusMap] = useState<Record<string, DateStatusSummary>>({});
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [addDatesOpen, setAddDatesOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [addDatesError, setAddDatesError] = useState<string | null>(null);
  const [addDatesSuccess, setAddDatesSuccess] = useState<string | null>(null);
  const [addDatesLoading, setAddDatesLoading] = useState(false);
  const [roadmapSelection, setRoadmapSelection] = useState<RoadmapSelection>(null);
  const [activeTab, setActiveTab] = useState<'agenda' | 'conditions' | 'roadmap' | 'settings'>('agenda');

  const existingDates = useMemo(
    () => occurrences.map((occ) => occ.date).filter(Boolean).sort(),
    [occurrences]
  );

  async function loadData() {
    if (!residencyId) {
      setError('Id de programmation manquant.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (prof?.role !== 'admin') {
        setError('Acces refuse (admin requis).');
        setLoading(false);
        return;
      }

      const resRes = await supabase
        .from('residencies')
        .select(
          'id, name, start_date, end_date, mode, terms_mode, fee_amount_cents, fee_currency, fee_is_net, is_public, is_open, lodging_included, meals_included, companion_included, program_type, conditions_json, roadmap_overrides_json, event_address_line1, event_address_line2, event_address_zip, event_address_city, event_address_country, clients(name, default_event_address_line1, default_event_address_line2, default_event_zip, default_event_city, default_event_country)'
        )
        .eq('id', residencyId)
        .maybeSingle();
      if (resRes.error) throw resRes.error;
      const resRow = resRes.data as ResidencyRow;

      const invRes = await supabase
        .from('residency_invitations')
        .select('id, token, status, sent_at, created_at, target_filter')
        .eq('residency_id', residencyId)
        .order('created_at', { ascending: false });
      if (invRes.error) throw invRes.error;

      const appsRes = await supabase
        .from('residency_applications')
        .select('id, date, status, artists(id, stage_name, contact_phone, contact_email, instagram_url, website_url)')
        .eq('residency_id', residencyId)
        .order('date', { ascending: true });
      if (appsRes.error) throw appsRes.error;

      let datesInRes: string[] | null = null;
      let weekRows: ResidencyWeek[] = [];
      let occRows: ResidencyOccurrence[] = [];

      if (resRow?.mode === 'DATES') {
        const occRes = await supabase
          .from('residency_occurrences')
          .select('id, date, start_time, end_time, notes')
          .eq('residency_id', residencyId)
          .order('date', { ascending: true });
        if (occRes.error) throw occRes.error;
        occRows = (occRes.data as ResidencyOccurrence[]) ?? [];
        setOccurrences(occRows);
        datesInRes = occRows.map((o) => o.date);
        setWeeks([]);
      } else {
        const weeksRes = await supabase
          .from('residency_weeks')
          .select(
            'id, start_date_sun, end_date_sun, type, week_type, performances_count, fee_cents, status, confirmed_booking_id, week_applications(id, artist_id, status, created_at, artists(stage_name)), week_bookings(id, artist_id, status, artists(stage_name))'
          )
          .eq('residency_id', residencyId)
          .order('start_date_sun', { ascending: true });
        if (weeksRes.error) throw weeksRes.error;
        weekRows = ((weeksRes.data as ResidencyWeek[]) ?? []).filter((w) => w.status !== 'CANCELLED');
        setWeeks(weekRows);
        setOccurrences([]);
        const weekDates = weekRows.flatMap((w) => {
          const dates: string[] = [];
          const start = new Date(`${w.start_date_sun}T12:00:00`);
          const end = new Date(`${w.end_date_sun}T12:00:00`);
          let cursor = start;
          while (cursor <= end) {
            dates.push(toISODate(cursor));
            const next = new Date(cursor);
            next.setDate(next.getDate() + 1);
            cursor = next;
          }
          return dates;
        });
        datesInRes = weekDates;
      }

      setResidency(resRow);
      setEditName(resRow.name);
      setEditIsPublic(!!resRow.is_public);
      setEditIsOpen(!!resRow.is_open);
      setEditProgramType(
        (resRow.program_type as ProgramType | null) ??
          (resRow.mode === 'DATES' ? 'MULTI_DATES' : 'WEEKLY_RESIDENCY')
      );
      setInvitations((invRes.data as InvitationRow[]) ?? []);
      setResidencyApplications((appsRes.data as ResidencyApplication[]) ?? []);

      const clientRow = Array.isArray(resRow.clients) ? resRow.clients[0] : (resRow.clients as any);
      const resolvedLine2 = resRow.event_address_line2 ?? clientRow?.default_event_address_line2 ?? null;
      const resolvedAddress = buildAddress(
        resRow.event_address_line1 ?? clientRow?.default_event_address_line1 ?? null,
        resolvedLine2,
        resRow.event_address_zip ?? clientRow?.default_event_zip ?? null,
        resRow.event_address_city ?? clientRow?.default_event_city ?? null,
        resRow.event_address_country ?? clientRow?.default_event_country ?? null
      );

      const legacyConditions = buildLegacyConditions(resRow, weekRows, resolvedAddress);
      const existingConditions = (resRow.conditions_json ?? {}) as ConditionsJson;
      setConditionsDraft(mergeConditions(legacyConditions, existingConditions));
      setRoadmapOverrides((resRow.roadmap_overrides_json ?? {}) as RoadmapOverrides);

      setAddressLine1(resRow.event_address_line1 ?? '');
      setAddressLine2(resRow.event_address_line2 ?? '');
      setAddressZip(resRow.event_address_zip ?? '');
      setAddressCity(resRow.event_address_city ?? '');
      setAddressCountry(resRow.event_address_country ?? '');

      if (datesInRes && datesInRes.length > 0) {
        await loadDateStatuses(datesInRes);
      } else {
        setDateStatusMap({});
      }

      if (resRow.mode === 'DATES') {
        const firstDate = occRows[0]?.date ?? null;
        setRoadmapSelection(firstDate ? { kind: 'date', date: firstDate } : null);
      } else {
        const firstWeek = weekRows[0] ?? null;
        setRoadmapSelection(firstWeek ? { kind: 'week', week: firstWeek } : null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  async function loadArtists() {
    try {
      const res = await fetch('/api/admin/artists', { credentials: 'include' });
      const json = await res.json();
      if (!json.ok) return;
      setArtists(json.data ?? []);
    } catch {
      /* ignore */
    }
  }

  async function updateResidencyApplicationStatus(
    appId: string,
    status: 'CONFIRMED' | 'DECLINED'
  ) {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      const res = await fetch(`/api/admin/residency-applications/${appId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(labelForError(json.error) || 'Mise a jour impossible');
      }
      setResidencyApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status } : app))
      );
      setSuccess(status === 'CONFIRMED' ? 'Candidature confirmée.' : 'Candidature refusée.');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function loadDateStatuses(dates: string[]) {
    const uniqueDates = Array.from(new Set(dates.filter(Boolean)));
    if (uniqueDates.length === 0) {
      setDateStatusMap({});
      return;
    }
    try {
      const [occRes, reqRes] = await Promise.all([
        supabase
          .from('booking_request_occurrences')
          .select('request_id, date')
          .in('date', uniqueDates),
        supabase
          .from('booking_requests')
          .select('id, event_date, status')
          .in('event_date', uniqueDates),
      ]);

      const occRows = (occRes.data ?? []) as { request_id: string; date: string }[];
      const reqRows = (reqRes.data ?? []) as BookingRequestMini[];

      const ids = new Set<string>();
      const byDate: Record<string, string[]> = {};
      uniqueDates.forEach((d) => {
        byDate[d] = [];
      });

      occRows.forEach((row) => {
        if (!byDate[row.date]) byDate[row.date] = [];
        byDate[row.date].push(row.request_id);
        ids.add(row.request_id);
      });

      reqRows.forEach((row) => {
        if (!row.event_date) return;
        if (!byDate[row.event_date]) byDate[row.event_date] = [];
        byDate[row.event_date].push(row.id);
        ids.add(row.id);
      });

      const requestIds = Array.from(ids);
      if (requestIds.length === 0) {
        setDateStatusMap(
          uniqueDates.reduce<Record<string, DateStatusSummary>>((acc, date) => {
            acc[date] = {
              status: 'EMPTY',
              confirmedArtists: [],
              invitedCount: 0,
              declinedCount: 0,
              invitedArtists: [],
            };
            return acc;
          }, {})
        );
        return;
      }

      const { data: inviteRows } = await supabase
        .from('request_artists')
        .select('request_id, status, artists(stage_name)')
        .in('request_id', requestIds);

      const inviteList = (inviteRows ?? []) as RequestArtistRow[];
      const invitesByRequest: Record<string, RequestArtistRow[]> = {};
      inviteList.forEach((row) => {
        if (!invitesByRequest[row.request_id]) invitesByRequest[row.request_id] = [];
        invitesByRequest[row.request_id].push({
          ...row,
          artists: Array.isArray(row.artists) ? row.artists[0] ?? null : row.artists,
        });
      });

      const confirmedStatuses = new Set([
        'confirmed',
        'accepted',
        'booked',
        'validated',
        'client_approved',
      ]);

      const map: Record<string, DateStatusSummary> = {};
      uniqueDates.forEach((date) => {
        const reqIds = Array.from(new Set(byDate[date] ?? []));
        if (reqIds.length === 0) {
          map[date] = {
            status: 'EMPTY',
            confirmedArtists: [],
            invitedCount: 0,
            declinedCount: 0,
            invitedArtists: [],
          };
          return;
        }

        const invites = reqIds.flatMap((id) => invitesByRequest[id] ?? []);
        const invitedArtists = invites.map((inv) => ({
          name:
            (Array.isArray(inv.artists) ? inv.artists[0]?.stage_name : inv.artists?.stage_name) ||
            'Artiste',
          status: inv.status ?? 'invited',
        }));
        const invitedCount = invites.length;
        const declinedCount = invites.filter((inv) =>
          ['declined', 'expired'].includes(String(inv.status ?? '').toLowerCase())
        ).length;
        const confirmedArtists = invites
          .filter((inv) => String(inv.status ?? '').toLowerCase() === 'accepted')
          .map((inv) =>
            (Array.isArray(inv.artists) ? inv.artists[0]?.stage_name : inv.artists?.stage_name) ||
            'Artiste'
          );

        const anyConfirmed = reqIds.some((id) =>
          confirmedStatuses.has(String(reqRows.find((r) => r.id === id)?.status ?? '').toLowerCase())
        );
        const anyPending = invites.some((inv) =>
          ['invited', 'pending'].includes(String(inv.status ?? '').toLowerCase())
        );
        const anyDeclined = declinedCount > 0;

        let status: DateStatusSummary['status'] = 'EMPTY';
        if (anyConfirmed) {
          status = 'CONFIRMED';
        } else if (invitedCount === 0) {
          status = 'EMPTY';
        } else if (!anyPending && anyDeclined) {
          status = 'DECLINED';
        } else {
          status = 'PENDING';
        }

        map[date] = {
          status,
          confirmedArtists: Array.from(new Set(confirmedArtists)),
          invitedCount,
          declinedCount,
          invitedArtists,
        };
      });

      setDateStatusMap(map);
    } catch (e: any) {
      setDateStatusMap({});
    }
  }

  async function updateWeekType(week: ResidencyWeek, type: 'CALM' | 'BUSY') {
    try {
      setActionLoading(true);
      const payload =
        type === week.type
          ? { type, performances_count: week.performances_count, fee_cents: week.fee_cents }
          : type === 'BUSY'
          ? { type, performances_count: 4, fee_cents: 30000, week_type: 'strong' }
          : { type, performances_count: 2, fee_cents: 15000, week_type: 'calm' };
      const { error: upErr } = await supabase
        .from('residency_weeks')
        .update(payload)
        .eq('id', week.id);
      if (upErr) throw upErr;
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmWeek(weekId: string, artistId: string) {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residencies/confirm-week', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_id: weekId, artist_id: artistId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Confirmation impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la confirmation');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveSettings() {
    if (!residency) return;
    if (!editName.trim()) {
      setError('Nom requis.');
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/residencies/${residency.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          is_public: editIsPublic,
          is_open: editIsOpen,
          program_type: editProgramType,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Mise a jour impossible');
      setSuccess('Parametres enregistres.');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveConditions() {
    if (!residency) return;
    try {
      setActionLoading(true);
      setError(null);
      setConditionsErrors({});

      const draft = conditionsDraft;
      const remuneration = draft.remuneration ?? {};
      const perDate = remuneration.per_date ?? { artist_choice: false, options: [] };
      const perWeek = remuneration.per_week ?? {};

      if (editProgramType === 'MULTI_DATES') {
        if (perDate.artist_choice) {
          const options = (perDate.options ?? []).filter((opt) => opt.label?.trim());
          if (options.length === 0) {
            setConditionsErrors({ remuneration: 'Ajoutez au moins une option de cachet.' });
            setActionLoading(false);
            return;
          }
        } else if (!perDate.amount_cents || perDate.amount_cents <= 0) {
          setConditionsErrors({ remuneration: 'Montant par date requis.' });
          setActionLoading(false);
          return;
        }
      } else {
        const calm = perWeek.calm;
        const peak = perWeek.peak;
        if (!calm?.fee_cents && !peak?.fee_cents) {
          setConditionsErrors({ remuneration: 'Renseignez au moins une semaine.' });
          setActionLoading(false);
          return;
        }
      }

      const legacyUpdate: Record<string, any> = {
        terms_mode: editProgramType === 'MULTI_DATES' ? 'SIMPLE_FEE' : 'RESIDENCY_WEEKLY',
      };
      if (typeof draft.lodging?.included === 'boolean') {
        legacyUpdate.lodging_included = draft.lodging.included;
      }
      if (typeof draft.meals?.included === 'boolean') {
        legacyUpdate.meals_included = draft.meals.included;
      }
      if (typeof draft.lodging?.companion_included === 'boolean') {
        legacyUpdate.companion_included = draft.lodging.companion_included;
      }
      if (editProgramType === 'MULTI_DATES' && draft.remuneration?.per_date?.amount_cents) {
        legacyUpdate.fee_amount_cents = draft.remuneration.per_date.amount_cents;
        legacyUpdate.fee_currency = draft.remuneration.currency ?? 'EUR';
        legacyUpdate.fee_is_net = draft.remuneration.is_net ?? true;
      }

      const res = await fetch(`/api/admin/residencies/${residency.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_type: editProgramType,
          conditions_json: draft,
          ...legacyUpdate,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Mise a jour impossible');
      setSuccess('Conditions mises a jour.');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveRoadmapOverrides() {
    if (!residency) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/residencies/${residency.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap_overrides_json: roadmapOverrides }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Mise a jour impossible');
      setSuccess('Feuille de route mise a jour.');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  }

  async function addDates() {
    if (!residency) return;
    try {
      setAddDatesLoading(true);
      setAddDatesError(null);
      setAddDatesSuccess(null);

      const toAdd = selectedDates
        .map((d) => toISODate(d))
        .filter((d) => !existingDates.includes(d));
      if (toAdd.length === 0) {
        setAddDatesError('Aucune nouvelle date a ajouter.');
        setAddDatesLoading(false);
        return;
      }

      const res = await fetch('/api/admin/residency-occurrences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residency_id: residency.id, dates: toAdd }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Ajout impossible');
      setSelectedDates([]);
      setAddDatesSuccess('Dates ajoutees.');
      await loadData();
    } catch (e: any) {
      setAddDatesError(e?.message ?? 'Erreur lors de l\'ajout');
    } finally {
      setAddDatesLoading(false);
    }
  }

  async function deleteOccurrence(occurrenceId: string) {
    if (!residency) return;
    if (!window.confirm('Supprimer cette date ?')) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residency-occurrences', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: occurrenceId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Suppression impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveAddress() {
    if (!residency) return;
    try {
      setActionLoading(true);
      const { error: upErr } = await supabase
        .from('residencies')
        .update({
          event_address_line1: addressLine1.trim() || null,
          event_address_line2: addressLine2.trim() || null,
          event_address_zip: addressZip.trim() || null,
          event_address_city: addressCity.trim() || null,
          event_address_country: addressCountry.trim() || null,
        })
        .eq('id', residency.id);
      if (upErr) throw upErr;
      setShowAddressModal(false);
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de l\'enregistrement');
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteResidency() {
    if (!residency) return;
    if (!window.confirm('Supprimer cette residence et ses semaines ?')) return;
    try {
      setActionLoading(true);
      const { error: delErr } = await supabase
        .from('residencies')
        .delete()
        .eq('id', residency.id);
      if (delErr) throw delErr;
      router.push('/admin/programmations');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelConfirmation(weekId: string) {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residencies/cancel-week', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_id: weekId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Annulation impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de l\'annulation');
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelWeekSlot(weekId: string) {
    if (!window.confirm('Supprimer ce créneau ?')) return;
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/residencies/cancel-slot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_id: weekId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Suppression impossible');
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  }

  async function sendInvitations() {
    if (!residency) return;
    try {
      setActionLoading(true);
      const artistIds = Object.keys(selectedArtists).filter((id) => selectedArtists[id]);
      if (artistIds.length === 0) {
        setError('Veuillez selectionner un artiste.');
        setActionLoading(false);
        return;
      }
      const res = await fetch('/api/admin/residencies/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residency_id: residency.id, artist_ids: artistIds }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Envoi impossible');
      setSelectedArtists({});
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setActionLoading(false);
    }
  }

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address);
    setCopyMessage('Adresse copiée.');
    window.setTimeout(() => setCopyMessage(''), 2000);
  }

  useEffect(() => {
    loadData();
    loadArtists();
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const filteredArtists = useMemo(() => {
    const query = searchArtist.trim().toLowerCase();
    if (!query) return artists;
    return artists.filter((a) =>
      [a.stage_name, a.full_name, a.email].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )
    );
  }, [artists, searchArtist]);

  if (loading) return <div className="text-slate-500">Chargement…</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Agenda programmation</h1>
        <p className="text-red-600">{labelForError(error)}</p>
        <Link href="/admin/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  if (!residency) {
    return (
      <div className="space-y-3">
        <p className="text-slate-500">Programmation introuvable.</p>
        <Link href="/admin/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
      </div>
    );
  }

  const clientName = Array.isArray(residency.clients)
    ? residency.clients[0]?.name
    : (residency.clients as any)?.name;
  const occurrenceCount = occurrences.length;
  const clientRow = Array.isArray(residency.clients)
    ? residency.clients[0]
    : (residency.clients as any);
  const usesResidencyAddress = !!residency.event_address_line1;
  const resolvedLine2 = residency.event_address_line2 ?? clientRow?.default_event_address_line2 ?? null;
  const resolvedAddress = buildAddress(
    residency.event_address_line1 ?? clientRow?.default_event_address_line1 ?? null,
    resolvedLine2,
    residency.event_address_zip ?? clientRow?.default_event_zip ?? null,
    residency.event_address_city ?? clientRow?.default_event_city ?? null,
    residency.event_address_country ?? clientRow?.default_event_country ?? null
  );
  const mapLink = resolvedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
    : null;

  const tabs = [
    { id: 'agenda', label: 'Agenda' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'roadmap', label: 'Feuille de route' },
    { id: 'settings', label: 'Parametres' },
  ] as const;

  const currentRoadmapData = useMemo(() => {
    if (!residency) return null;
    if (!roadmapSelection) return null;
    const contextLabel =
      roadmapSelection.kind === 'week'
        ? `${fmtDateFR(roadmapSelection.week.start_date_sun)} → ${fmtDateFR(roadmapSelection.week.end_date_sun)}`
        : fmtDateFR(roadmapSelection.date);
    return buildRoadmapData({
      residencyName: residency.name,
      contextLabel,
      programType: editProgramType,
      weekType: roadmapSelection.kind === 'week' ? mapWeekType(roadmapSelection.week.week_type) : null,
      conditions: conditionsDraft,
      overrides: roadmapOverrides,
    });
  }, [residency, roadmapSelection, conditionsDraft, roadmapOverrides, editProgramType]);

  const roadmapPdfHref = useMemo(() => {
    if (!residency || !roadmapSelection) return '';
    if (roadmapSelection.kind === 'week') {
      return `/api/admin/roadmap/pdf?residency_id=${encodeURIComponent(
        residency.id
      )}&week_id=${encodeURIComponent(roadmapSelection.week.id)}`;
    }
    return `/api/admin/roadmap/pdf?residency_id=${encodeURIComponent(
      residency.id
    )}&date=${encodeURIComponent(roadmapSelection.date)}`;
  }, [residency, roadmapSelection]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="space-y-2">
        <Link href="/admin/programmations" className="text-sm underline text-[var(--brand)]">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold">{residency.name}</h1>
        <div className="text-sm text-slate-500">
          {clientName || 'Client'} •{' '}
          {residency.mode === 'DATES'
            ? `${occurrenceCount} dates (du ${fmtDateFR(residency.start_date)} au ${fmtDateFR(residency.end_date)})`
            : `${fmtDateFR(residency.start_date)} → ${fmtDateFR(residency.end_date)}`}
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? 'btn btn-primary'
                : 'btn border border-slate-200 bg-white'
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {success ? (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
          {success}
        </div>
      ) : null}

      {activeTab === 'agenda' ? (
        <div className="space-y-6">
          <section className="rounded-xl border p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <h2 className="font-semibold">Lieu de la prestation</h2>
                {resolvedAddress ? (
                  <div className="text-sm text-slate-700 space-y-1">
                    <div>{residency.event_address_line1 ?? clientRow?.default_event_address_line1}</div>
                    {resolvedLine2 ? <div>{resolvedLine2}</div> : null}
                    <div>
                      {(residency.event_address_zip ?? clientRow?.default_event_address_zip) || ''}{' '}
                      {(residency.event_address_city ?? clientRow?.default_event_address_city) || ''}
                    </div>
                    {residency.event_address_country || clientRow?.default_event_address_country ? (
                      <div>{residency.event_address_country ?? clientRow?.default_event_address_country}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Adresse non renseignée.</div>
                )}
                {resolvedAddress ? (
                  <span className="inline-flex text-xs px-2 py-1 rounded-full border text-slate-600 w-fit">
                    {usesResidencyAddress ? 'Adresse programmation' : 'Adresse par defaut'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {mapLink ? (
                <a href={mapLink} target="_blank" className="btn btn-primary" rel="noreferrer">
                  Ouvrir dans Google Maps
                </a>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowAddressModal(true)}>
                  Ajouter une adresse
                </button>
              )}
              {resolvedAddress ? (
                <button className="btn" onClick={() => copyAddress(resolvedAddress)}>
                  Copier l’adresse
                </button>
              ) : null}
              {copyMessage ? <span className="text-xs text-slate-500">{copyMessage}</span> : null}
            </div>
          </section>

          {residency.mode !== 'DATES' ? (
            <section className="rounded-xl border p-4 space-y-4">
              <h2 className="font-semibold">Inviter des artistes</h2>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Rechercher un artiste"
                  value={searchArtist}
                  onChange={(e) => setSearchArtist(e.target.value)}
                />
                <button className="btn btn-primary" onClick={sendInvitations} disabled={actionLoading}>
                  Envoyer les demandes
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {filteredArtists.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!selectedArtists[a.id]}
                      onChange={(e) =>
                        setSelectedArtists((prev) => ({ ...prev, [a.id]: e.target.checked }))
                      }
                    />
                    <span>
                      {a.stage_name || a.full_name || 'Artiste'} {a.email ? `• ${a.email}` : ''}
                    </span>
                  </label>
                ))}
              </div>
              {invitations.length > 0 ? (
                <div className="text-sm text-slate-500">
                  {invitations.length} invitation{invitations.length > 1 ? 's' : ''} envoyee
                  {invitations.length > 1 ? 's' : ''}.
                </div>
              ) : null}
            </section>
          ) : null}

          {residency.mode !== 'DATES' ? (
            <section className="rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold">Invitations</h2>
              {invitations.length === 0 ? (
                <div className="text-sm text-slate-500">Aucune invitation pour le moment.</div>
              ) : (
                invitations.map((inv) => {
                  const tf = inv.target_filter || {};
                  const name = tf.artist_name || tf.artist_email || 'Artiste';
                  const link = origin ? `${origin}/availability/${inv.token}` : `/availability/${inv.token}`;
                  return (
                    <div key={inv.id} className="flex flex-col gap-2 border rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-slate-500">{inv.status}</div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {inv.sent_at ? `Envoyee: ${fmtDateFR(inv.sent_at)}` : 'Envoyee: —'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-xs bg-slate-50 border rounded px-2 py-1">{link}</code>
                        <button
                          className="btn"
                          onClick={() => navigator.clipboard.writeText(link)}
                        >
                          Copier le lien
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          ) : null}

          {residency.mode === 'DATES' ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Dates</h2>
                <button
                  className="btn"
                  onClick={() => {
                    setAddDatesOpen((v) => !v);
                    setAddDatesError(null);
                    setAddDatesSuccess(null);
                  }}
                >
                  Ajouter des dates
                </button>
              </div>
              {addDatesSuccess ? (
                <div className="text-sm text-emerald-600">{addDatesSuccess}</div>
              ) : null}
              {addDatesOpen ? (
                <div className="rounded-xl border p-4 space-y-3">
                  <DayPicker
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => {
                      setSelectedDates(dates ?? []);
                      setAddDatesError(null);
                      setAddDatesSuccess(null);
                    }}
                  />
                  <div className="text-sm text-slate-500">
                    {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} sélectionnée
                    {selectedDates.length > 1 ? 's' : ''}.
                  </div>
                  {addDatesError ? (
                    <div className="text-sm text-rose-600">{addDatesError}</div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn"
                      onClick={() => {
                        setAddDatesOpen(false);
                        setSelectedDates([]);
                        setAddDatesError(null);
                        setAddDatesSuccess(null);
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={addDatesLoading || selectedDates.length === 0}
                      onClick={addDates}
                    >
                      {addDatesLoading ? 'Ajout en cours…' : 'Ajouter'}
                    </button>
                  </div>
                </div>
              ) : null}
              {occurrences.length === 0 ? (
                <div className="text-sm text-slate-500">Aucune date enregistree.</div>
              ) : (
                <div className="rounded-xl border divide-y">
                  {occurrences.map((occ) => {
                    const summary = dateStatusMap[occ.date];
                    const status = summary?.status ?? 'EMPTY';
                    const badgeClass =
                      status === 'CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700'
                        : status === 'DECLINED'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600';
                    return (
                      <div key={occ.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{fmtDateFR(occ.date)}</div>
                            <span className={`text-xs px-2 py-1 rounded-full ${badgeClass}`}>
                              {status === 'DECLINED'
                                ? 'Tous refusés'
                                : status === 'EMPTY'
                                ? 'Aucun artiste'
                                : labelForStatus(status)}
                            </span>
                          </div>
                          {summary && status === 'CONFIRMED' && summary.confirmedArtists.length > 0 ? (
                            <div className="text-xs text-slate-600">
                              Artiste(s) confirmé(s): {summary.confirmedArtists.join(', ')}
                            </div>
                          ) : null}
                          {summary && status === 'PENDING' ? (
                            <div className="text-xs text-slate-600">
                              Invitations envoyées: {summary.invitedCount}
                              {summary.invitedArtists.length > 0
                                ? ` • ${summary.invitedArtists
                                    .map((a) => `${a.name} (${a.status})`)
                                    .join(', ')}`
                                : ''}
                            </div>
                          ) : null}
                          {summary && status === 'DECLINED' ? (
                            <div className="text-xs text-slate-600">
                              Refusés: {summary.declinedCount}
                            </div>
                          ) : null}
                          {status === 'EMPTY' || (status === 'PENDING' && (summary?.invitedCount ?? 0) === 0) ? (
                            <Link
                              href={`/admin/requests/new?residency_id=${encodeURIComponent(residency.id)}&event_date=${encodeURIComponent(occ.date)}`}
                              className="btn btn-primary"
                            >
                              Inviter un artiste
                            </Link>
                          ) : null}
                          {occ.notes ? (
                            <div className="text-xs text-slate-500">{occ.notes}</div>
                          ) : null}
                          <div className="pt-2 space-y-2">
                            <div className="text-xs font-semibold text-slate-700">
                              Candidatures ({residencyApplications.filter((a) => a.date === occ.date).length})
                            </div>
                            {residencyApplications.filter((a) => a.date === occ.date).length === 0 ? (
                              <div className="text-xs text-slate-500">Aucune candidature.</div>
                            ) : (
                              residencyApplications
                                .filter((a) => a.date === occ.date)
                                .sort((a, b) => {
                                  const aName = Array.isArray(a.artists)
                                    ? a.artists[0]?.stage_name ?? ''
                                    : a.artists?.stage_name ?? '';
                                  const bName = Array.isArray(b.artists)
                                    ? b.artists[0]?.stage_name ?? ''
                                    : b.artists?.stage_name ?? '';
                                  return aName.localeCompare(bName, 'fr');
                                })
                                .map((app) => {
                                  const artist = Array.isArray(app.artists)
                                    ? app.artists[0]
                                    : app.artists;
                                  const statusLabel = labelForStatus(app.status);
                                  const badge =
                                    app.status === 'CONFIRMED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : app.status === 'PENDING'
                                      ? 'bg-amber-100 text-amber-700'
                                      : app.status === 'DECLINED'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-slate-100 text-slate-600';
                                  return (
                                    <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border rounded-lg p-2">
                                      <div className="space-y-1">
                                        <div className="font-medium">
                                          {artist?.stage_name || 'Artiste'}
                                        </div>
                                        <div className="text-slate-500">
                                          {artist?.contact_email ? `Email: ${artist.contact_email}` : null}
                                          {artist?.contact_phone ? ` • Tel: ${artist.contact_phone}` : null}
                                        </div>
                                        <div className="text-slate-500">
                                          {artist?.instagram_url ? `Instagram: ${artist.instagram_url}` : null}
                                          {artist?.website_url ? ` • Site: ${artist.website_url}` : null}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded-full ${badge}`}>
                                          {statusLabel}
                                        </span>
                                        {app.status === 'PENDING' ? (
                                          <>
                                            <button
                                              className="btn btn-primary"
                                              disabled={actionLoading}
                                              onClick={() => updateResidencyApplicationStatus(app.id, 'CONFIRMED')}
                                            >
                                              Confirmer
                                            </button>
                                            <button
                                              className="btn"
                                              disabled={actionLoading}
                                              onClick={() => updateResidencyApplicationStatus(app.id, 'DECLINED')}
                                            >
                                              Refuser
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                        <button
                          className="btn"
                          onClick={() => deleteOccurrence(occ.id)}
                          disabled={actionLoading}
                        >
                          Supprimer
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-4">
              <h2 className="font-semibold">Semaines</h2>
              {weeks.map((w) => {
                const applications = toArray(w.week_applications) as WeekApplication[];
                const bookings = toArray(w.week_bookings) as WeekBooking[];
                const confirmedBooking = bookings.find((b) => b.status === 'CONFIRMED');
                const summary = (() => {
                  const dates: string[] = [];
                  const start = new Date(`${w.start_date_sun}T12:00:00`);
                  const end = new Date(`${w.end_date_sun}T12:00:00`);
                  let cursor = start;
                  while (cursor <= end) {
                    dates.push(toISODate(cursor));
                    const next = new Date(cursor);
                    next.setDate(next.getDate() + 1);
                    cursor = next;
                  }
                  const summaries = dates.map((d) => dateStatusMap[d]).filter(Boolean) as DateStatusSummary[];
                  if (summaries.length === 0) {
                    return {
                      status: 'EMPTY',
                      confirmedArtists: [],
                      invitedCount: 0,
                      declinedCount: 0,
                      invitedArtists: [],
                    } as DateStatusSummary;
                  }

                  let anyConfirmed = false;
                  let anyPending = false;
                  let anyDeclined = false;
                  let invitedCount = 0;
                  let declinedCount = 0;
                  const confirmedArtists: string[] = [];
                  const invitedArtists: { name: string; status: string }[] = [];

                  summaries.forEach((s) => {
                    if (s.status === 'CONFIRMED') anyConfirmed = true;
                    if (s.status === 'PENDING') anyPending = true;
                    if (s.status === 'DECLINED') anyDeclined = true;
                    invitedCount += s.invitedCount;
                    declinedCount += s.declinedCount;
                    invitedArtists.push(...s.invitedArtists);
                    confirmedArtists.push(...s.confirmedArtists);
                  });

                  const uniqueConfirmed = Array.from(new Set(confirmedArtists));
                  let status: DateStatusSummary['status'] = 'EMPTY';
                  if (anyConfirmed) {
                    status = 'CONFIRMED';
                  } else if (invitedCount === 0) {
                    status = 'EMPTY';
                  } else if (!anyPending && anyDeclined) {
                    status = 'DECLINED';
                  } else {
                    status = 'PENDING';
                  }

                  return {
                    status,
                    confirmedArtists: uniqueConfirmed,
                    invitedCount,
                    declinedCount,
                    invitedArtists,
                  } as DateStatusSummary;
                })();
                const badgeClass =
                  summary.status === 'CONFIRMED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : summary.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-700'
                    : summary.status === 'DECLINED'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-600';
                return (
                  <div key={w.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {fmtDateFR(w.start_date_sun)} → {fmtDateFR(w.end_date_sun)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {w.type === 'BUSY' ? 'Semaine forte' : 'Semaine calme'} •{' '}
                          {w.performances_count} prestations • {formatMoney(w.fee_cents)} net
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${badgeClass}`}>
                          {summary.status === 'DECLINED'
                            ? 'Tous refusés'
                            : summary.status === 'EMPTY'
                            ? 'Aucun artiste'
                            : labelForStatus(summary.status)}
                        </span>
                        <select
                          className="border rounded-lg px-2 py-1 text-sm"
                          value={w.type}
                          disabled={w.status === 'CONFIRMED' || actionLoading}
                          onChange={(e) => updateWeekType(w, e.target.value as 'CALM' | 'BUSY')}
                        >
                          <option value="CALM">CALME</option>
                          <option value="BUSY">FORTE</option>
                        </select>
                      </div>
                    </div>

                    {summary.status === 'CONFIRMED' && summary.confirmedArtists.length > 0 ? (
                      <div className="text-xs text-slate-600">
                        Artiste(s) confirmé(s): {summary.confirmedArtists.join(', ')}
                      </div>
                    ) : null}
                    {summary.status === 'PENDING' ? (
                      <div className="text-xs text-slate-600">
                        Invitations envoyées: {summary.invitedCount}
                        {summary.invitedArtists.length > 0
                          ? ` • ${summary.invitedArtists
                              .map((a) => `${a.name} (${a.status})`)
                              .join(', ')}`
                          : ''}
                      </div>
                    ) : null}
                    {summary.status === 'DECLINED' ? (
                      <div className="text-xs text-slate-600">
                        Tous refusés • Invitations: {summary.invitedCount}
                      </div>
                    ) : null}
                    {summary.status === 'EMPTY' ? (
                      <div>
                        <Link
                          href={`/admin/requests/new?residency_id=${encodeURIComponent(residency.id)}&week_start=${encodeURIComponent(w.start_date_sun)}&week_end=${encodeURIComponent(w.end_date_sun)}`}
                          className="btn btn-primary"
                        >
                          Inviter un artiste
                        </Link>
                      </div>
                    ) : null}

                    {confirmedBooking ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                        Confirme avec{' '}
                        {Array.isArray(confirmedBooking.artists)
                          ? confirmedBooking.artists[0]?.stage_name
                          : confirmedBooking.artists?.stage_name || 'Artiste'}
                        .
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Candidats</div>
                      {applications.length === 0 ? (
                        <div className="text-sm text-slate-500">Aucune candidature.</div>
                      ) : (
                        applications.map((a) => {
                          const artistName = Array.isArray(a.artists)
                            ? a.artists[0]?.stage_name
                            : a.artists?.stage_name;
                          return (
                            <div key={a.id} className="flex items-center justify-between text-sm">
                              <span>
                                {artistName || 'Artiste'} • {a.status}
                              </span>
                              {w.status === 'OPEN' && a.status === 'APPLIED' ? (
                                <button
                                  className="btn btn-primary"
                                  onClick={() => confirmWeek(w.id, a.artist_id)}
                                  disabled={actionLoading}
                                >
                                  Confirmer
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {w.status === 'CONFIRMED' ? (
                      <button
                        className="btn"
                        onClick={() => cancelConfirmation(w.id)}
                        disabled={actionLoading}
                      >
                        Annuler la confirmation
                      </button>
                    ) : null}
                    {w.status !== 'CONFIRMED' ? (
                      <button
                        className="btn"
                        onClick={() => cancelWeekSlot(w.id)}
                        disabled={actionLoading}
                      >
                        Supprimer le créneau
                      </button>
                    ) : (
                      <button className="btn" disabled>
                        Supprimer le créneau
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      ) : null}

      {activeTab === 'conditions' ? (
        <div className="space-y-6">
          <section className="rounded-xl border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Remuneration</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Programme: {editProgramType === 'MULTI_DATES' ? 'DPF' : 'L2A'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={conditionsDraft.remuneration?.is_net ?? true}
                  onChange={(e) =>
                    setConditionsDraft((prev) => ({
                      ...prev,
                      remuneration: {
                        ...(prev.remuneration ?? {}),
                        is_net: e.target.checked,
                      },
                    }))
                  }
                />
                Cachet net
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Devise</span>
                <select
                  className="border rounded-lg px-2 py-1 text-sm"
                  value={conditionsDraft.remuneration?.currency ?? 'EUR'}
                  onChange={(e) =>
                    setConditionsDraft((prev) => ({
                      ...prev,
                      remuneration: {
                        ...(prev.remuneration ?? {}),
                        currency: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            {editProgramType === 'MULTI_DATES' ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={conditionsDraft.remuneration?.per_date?.artist_choice ?? false}
                    onChange={(e) =>
                      setConditionsDraft((prev) => ({
                        ...prev,
                        remuneration: {
                          ...(prev.remuneration ?? {}),
                          mode: 'PER_DATE',
                          per_date: {
                            ...(prev.remuneration?.per_date ?? { options: [] }),
                            artist_choice: e.target.checked,
                          },
                        },
                      }))
                    }
                  />
                  Choix artiste (plusieurs options de cachet)
                </label>

                {conditionsDraft.remuneration?.per_date?.artist_choice ? (
                  <div className="space-y-3">
                    {(conditionsDraft.remuneration?.per_date?.options ?? []).length === 0 ? (
                      <div className="text-xs text-slate-500">Aucune option definie.</div>
                    ) : null}
                    {(conditionsDraft.remuneration?.per_date?.options ?? []).map((opt, idx) => (
                      <div key={`option-${idx}`} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
                        <input
                          className="border rounded-lg px-3 py-2 text-sm"
                          placeholder="Option (ex: Duo, DJ set)"
                          value={opt.label}
                          onChange={(e) => {
                            const next = [...(conditionsDraft.remuneration?.per_date?.options ?? [])];
                            next[idx] = { ...next[idx], label: e.target.value } as RemunerationOption;
                            setConditionsDraft((prev) => ({
                              ...prev,
                              remuneration: {
                                ...(prev.remuneration ?? {}),
                                mode: 'PER_DATE',
                                per_date: {
                                  ...(prev.remuneration?.per_date ?? {}),
                                  options: next,
                                },
                              },
                            }));
                          }}
                        />
                        <input
                          className="border rounded-lg px-3 py-2 text-sm"
                          placeholder="Montant"
                          value={formatCentsInput(opt.amount_cents)}
                          onChange={(e) => {
                            const cents = parseCents(e.target.value);
                            const next = [...(conditionsDraft.remuneration?.per_date?.options ?? [])];
                            next[idx] = { ...next[idx], amount_cents: cents } as RemunerationOption;
                            setConditionsDraft((prev) => ({
                              ...prev,
                              remuneration: {
                                ...(prev.remuneration ?? {}),
                                mode: 'PER_DATE',
                                per_date: {
                                  ...(prev.remuneration?.per_date ?? {}),
                                  options: next,
                                },
                              },
                            }));
                          }}
                        />
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            const next = (conditionsDraft.remuneration?.per_date?.options ?? []).filter(
                              (_, i) => i !== idx
                            );
                            setConditionsDraft((prev) => ({
                              ...prev,
                              remuneration: {
                                ...(prev.remuneration ?? {}),
                                mode: 'PER_DATE',
                                per_date: {
                                  ...(prev.remuneration?.per_date ?? {}),
                                  options: next,
                                },
                              },
                            }));
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const next = [...(conditionsDraft.remuneration?.per_date?.options ?? [])];
                        next.push({ label: '', amount_cents: undefined });
                        setConditionsDraft((prev) => ({
                          ...prev,
                          remuneration: {
                            ...(prev.remuneration ?? {}),
                            mode: 'PER_DATE',
                            per_date: {
                              ...(prev.remuneration?.per_date ?? {}),
                              options: next,
                            },
                          },
                        }));
                      }}
                    >
                      Ajouter une option
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-[200px_auto] items-center">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="Montant par date"
                      value={formatCentsInput(conditionsDraft.remuneration?.per_date?.amount_cents)}
                      onChange={(e) => {
                        const cents = parseCents(e.target.value);
                        setConditionsDraft((prev) => ({
                          ...prev,
                          remuneration: {
                            ...(prev.remuneration ?? {}),
                            mode: 'PER_DATE',
                            per_date: {
                              ...(prev.remuneration?.per_date ?? {}),
                              amount_cents: cents,
                              artist_choice: false,
                              options: [],
                            },
                          },
                        }));
                      }}
                    />
                    <span className="text-xs text-slate-500">
                      Cachet propose pour chaque date.
                    </span>
                  </div>
                )}
                {conditionsErrors.remuneration ? (
                  <div className="text-xs text-rose-600">{conditionsErrors.remuneration}</div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-medium">Semaine calme</div>
                  <input
                    className="border rounded-lg px-3 py-2 text-sm"
                    placeholder="Nb prestations"
                    value={conditionsDraft.remuneration?.per_week?.calm?.performances_count ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const value = raw ? Number(raw) : undefined;
                      setConditionsDraft((prev) => ({
                        ...prev,
                        remuneration: {
                          ...(prev.remuneration ?? {}),
                          mode: 'PER_WEEK',
                          per_week: {
                            ...(prev.remuneration?.per_week ?? {}),
                            calm: {
                              ...(prev.remuneration?.per_week?.calm ?? {}),
                              performances_count: Number.isFinite(value ?? NaN) ? value : undefined,
                            },
                          },
                        },
                      }));
                    }}
                  />
                  <input
                    className="border rounded-lg px-3 py-2 text-sm"
                    placeholder="Cachet"
                    value={formatCentsInput(conditionsDraft.remuneration?.per_week?.calm?.fee_cents)}
                    onChange={(e) => {
                      const cents = parseCents(e.target.value);
                      setConditionsDraft((prev) => ({
                        ...prev,
                        remuneration: {
                          ...(prev.remuneration ?? {}),
                          mode: 'PER_WEEK',
                          per_week: {
                            ...(prev.remuneration?.per_week ?? {}),
                            calm: {
                              ...(prev.remuneration?.per_week?.calm ?? {}),
                              fee_cents: cents,
                            },
                          },
                        },
                      }));
                    }}
                  />
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-medium">Semaine forte</div>
                  <input
                    className="border rounded-lg px-3 py-2 text-sm"
                    placeholder="Nb prestations"
                    value={conditionsDraft.remuneration?.per_week?.peak?.performances_count ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const value = raw ? Number(raw) : undefined;
                      setConditionsDraft((prev) => ({
                        ...prev,
                        remuneration: {
                          ...(prev.remuneration ?? {}),
                          mode: 'PER_WEEK',
                          per_week: {
                            ...(prev.remuneration?.per_week ?? {}),
                            peak: {
                              ...(prev.remuneration?.per_week?.peak ?? {}),
                              performances_count: Number.isFinite(value ?? NaN) ? value : undefined,
                            },
                          },
                        },
                      }));
                    }}
                  />
                  <input
                    className="border rounded-lg px-3 py-2 text-sm"
                    placeholder="Cachet"
                    value={formatCentsInput(conditionsDraft.remuneration?.per_week?.peak?.fee_cents)}
                    onChange={(e) => {
                      const cents = parseCents(e.target.value);
                      setConditionsDraft((prev) => ({
                        ...prev,
                        remuneration: {
                          ...(prev.remuneration ?? {}),
                          mode: 'PER_WEEK',
                          per_week: {
                            ...(prev.remuneration?.per_week ?? {}),
                            peak: {
                              ...(prev.remuneration?.per_week?.peak ?? {}),
                              fee_cents: cents,
                            },
                          },
                        },
                      }));
                    }}
                  />
                </div>
                {conditionsErrors.remuneration ? (
                  <div className="text-xs text-rose-600 md:col-span-2">{conditionsErrors.remuneration}</div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Logement</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={conditionsDraft.lodging?.included ?? false}
                  onChange={(e) =>
                    setConditionsDraft((prev) => ({
                      ...prev,
                      lodging: { ...(prev.lodging ?? {}), included: e.target.checked },
                    }))
                  }
                />
                Logement inclus
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={conditionsDraft.lodging?.companion_included ?? false}
                  onChange={(e) =>
                    setConditionsDraft((prev) => ({
                      ...prev,
                      lodging: { ...(prev.lodging ?? {}), companion_included: e.target.checked },
                    }))
                  }
                />
                Accompagnant inclus
              </label>
            </div>
            <textarea
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Details logement"
              value={conditionsDraft.lodging?.details ?? ''}
              onChange={(e) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  lodging: { ...(prev.lodging ?? {}), details: e.target.value },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Repas</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conditionsDraft.meals?.included ?? false}
                onChange={(e) =>
                  setConditionsDraft((prev) => ({
                    ...prev,
                    meals: { ...(prev.meals ?? {}), included: e.target.checked },
                  }))
                }
              />
              Repas inclus
            </label>
            <textarea
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Details repas"
              value={conditionsDraft.meals?.details ?? ''}
              onChange={(e) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  meals: { ...(prev.meals ?? {}), details: e.target.value },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Defraiement</h2>
            <textarea
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Transports, per diem, remboursement..."
              value={conditionsDraft.defraiement?.details ?? ''}
              onChange={(e) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  defraiement: { details: e.target.value },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <EntryListEditor
              title="Lieux"
              items={conditionsDraft.locations?.items ?? []}
              emptyLabel="Aucun lieu renseigne."
              onChange={(items) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  locations: { items },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <EntryListEditor
              title="Contacts"
              items={conditionsDraft.contacts?.items ?? []}
              emptyLabel="Aucun contact renseigne."
              onChange={(items) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  contacts: { items },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <EntryListEditor
              title="Acces"
              items={conditionsDraft.access?.items ?? []}
              emptyLabel="Aucun acces renseigne."
              onChange={(items) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  access: { items },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <EntryListEditor
              title="Logistique"
              items={conditionsDraft.logistics?.items ?? []}
              emptyLabel="Aucune logistique renseignee."
              onChange={(items) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  logistics: { items },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <ScheduleEditor
              items={conditionsDraft.planning?.items ?? []}
              onChange={(items) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  planning: { items },
                }))
              }
            />
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Notes generales</h2>
            <textarea
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Notes visibles sur la feuille de route"
              value={conditionsDraft.notes ?? ''}
              onChange={(e) =>
                setConditionsDraft((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
            />
          </section>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={saveConditions} disabled={actionLoading}>
              Enregistrer les conditions
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'roadmap' ? (
        <div className="space-y-6">
          <section className="rounded-xl border p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Preview artiste</h2>
                <p className="text-sm text-slate-600">
                  Generee automatiquement depuis les conditions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {roadmapPdfHref ? (
                  <a className="btn btn-primary" href={roadmapPdfHref} target="_blank" rel="noreferrer">
                    Exporter PDF
                  </a>
                ) : null}
              </div>
            </div>

            {residency.mode === 'DATES' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <select
                  className="border rounded-lg px-3 py-2 w-full"
                  value={roadmapSelection?.kind === 'date' ? roadmapSelection.date : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRoadmapSelection(value ? { kind: 'date', date: value } : null);
                  }}
                >
                  <option value="">Selectionner une date</option>
                  {occurrences.map((occ) => (
                    <option key={occ.id} value={occ.date}>
                      {fmtDateFR(occ.date)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Semaine</label>
                <select
                  className="border rounded-lg px-3 py-2 w-full"
                  value={roadmapSelection?.kind === 'week' ? roadmapSelection.week.id : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const week = weeks.find((w) => w.id === value) ?? null;
                    setRoadmapSelection(week ? { kind: 'week', week } : null);
                  }}
                >
                  <option value="">Selectionner une semaine</option>
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {fmtDateFR(w.start_date_sun)} → {fmtDateFR(w.end_date_sun)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentRoadmapData ? <RoadmapPreview data={currentRoadmapData} /> : null}
          </section>

          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Notes admin (override)</h2>
            <textarea
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Notes prioritaires pour l'artiste"
              value={roadmapOverrides.notes ?? ''}
              onChange={(e) =>
                setRoadmapOverrides((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
            />
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={saveRoadmapOverrides} disabled={actionLoading}>
                Enregistrer les notes
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <div className="space-y-6">
          <section className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Parametres de la residence</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="border rounded-lg px-3 py-2"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="flex flex-wrap gap-4 text-sm items-center">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                  />
                  Publier la programmation
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editIsOpen}
                    onChange={(e) => setEditIsOpen(e.target.checked)}
                  />
                  Ouvrir aux candidatures
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type de programmation</label>
              <select
                className="border rounded-lg px-3 py-2 w-full"
                value={editProgramType}
                onChange={(e) => setEditProgramType(e.target.value as ProgramType)}
              >
                <option value="WEEKLY_RESIDENCY">Residences hebdo (L2A)</option>
                <option value="MULTI_DATES">Multi dates (DPF)</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={saveSettings} disabled={actionLoading}>
                Enregistrer
              </button>
              <button className="btn" onClick={deleteResidency} disabled={actionLoading}>
                Supprimer la residence
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showAddressModal ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ajouter une adresse</h3>
              <button className="text-sm underline" onClick={() => setShowAddressModal(false)}>
                Fermer
              </button>
            </div>
            <div className="grid gap-3">
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Adresse ligne 1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Adresse ligne 2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Code postal"
                  value={addressZip}
                  onChange={(e) => setAddressZip(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Ville"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                />
              </div>
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="Pays"
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setShowAddressModal(false)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={saveAddress} disabled={actionLoading}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EntryListEditor({
  title,
  items,
  onChange,
  emptyLabel,
}: {
  title: string;
  items: RoadmapEntry[];
  onChange: (items: RoadmapEntry[]) => void;
  emptyLabel: string;
}) {
  const update = (idx: number, key: 'label' | 'value', value: string) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(next);
  };
  const add = () => onChange([...items, { label: '', value: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

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
          {items.map((it, idx) => (
            <div key={`${title}-${idx}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Libelle"
                value={it.label}
                onChange={(e) => update(idx, 'label', e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Valeur"
                value={it.value}
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

function ScheduleEditor({
  items,
  onChange,
}: {
  items: RoadmapScheduleEntry[];
  onChange: (items: RoadmapScheduleEntry[]) => void;
}) {
  const update = (idx: number, key: keyof RoadmapScheduleEntry, value: string) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(next);
  };
  const add = () => onChange([...items, { day: '', time: '', place: '', notes: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Planning</div>
        <button className="btn" type="button" onClick={add}>
          Ajouter une date
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-slate-500">Aucun créneau.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={`schedule-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Jour"
                value={it.day}
                onChange={(e) => update(idx, 'day', e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Horaire"
                value={it.time}
                onChange={(e) => update(idx, 'time', e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Lieu / notes"
                value={it.place}
                onChange={(e) => update(idx, 'place', e.target.value)}
              />
              <button className="btn" type="button" onClick={() => remove(idx)}>
                Supprimer
              </button>
              <input
                className="border rounded-lg px-3 py-2 text-sm md:col-span-4"
                placeholder="Notes"
                value={it.notes ?? ''}
                onChange={(e) => update(idx, 'notes', e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
