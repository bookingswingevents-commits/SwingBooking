import type { ProgrammingItem, ProgrammingProgram } from './types';

type Actor = {
  role?: 'admin' | 'artist' | 'client' | string | null;
  artistId?: string | null;
};

type ApplicationRow = {
  item_id: string;
  artist_id: string;
};

type BookingRow = {
  item_id: string;
  artist_id: string;
};

export function canAdminAccess(actor: Actor | null | undefined) {
  return actor?.role === 'admin';
}

export function canArtistReadProgram(actor: Actor | null | undefined, program: ProgrammingProgram) {
  if (canAdminAccess(actor)) return true;
  if (actor?.role !== 'artist') return false;
  return program.is_public === true && program.is_open === true;
}

export function canArtistReadItem(
  actor: Actor | null | undefined,
  program: ProgrammingProgram,
  item: ProgrammingItem,
  applications: ApplicationRow[] = [],
  bookings: BookingRow[] = []
) {
  if (canAdminAccess(actor)) return true;
  if (actor?.role !== 'artist' || !actor.artistId) return false;

  const isOpen = program.is_public === true && program.is_open === true && item.status === 'OPEN';
  const isOwner =
    applications.some((app) => app.item_id === item.id && app.artist_id === actor.artistId) ||
    bookings.some((bk) => bk.item_id === item.id && bk.artist_id === actor.artistId);

  return isOpen || isOwner;
}

export function canArtistApply(
  actor: Actor | null | undefined,
  program: ProgrammingProgram,
  item: ProgrammingItem
) {
  if (canAdminAccess(actor)) return true;
  if (actor?.role !== 'artist' || !actor.artistId) return false;
  return program.is_public === true && program.is_open === true && item.status === 'OPEN';
}

export function canArtistReadBooking(actor: Actor | null | undefined, booking: BookingRow) {
  if (canAdminAccess(actor)) return true;
  if (actor?.role !== 'artist' || !actor.artistId) return false;
  return booking.artist_id === actor.artistId;
}
