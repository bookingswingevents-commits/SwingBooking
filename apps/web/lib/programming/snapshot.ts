import type { ProgrammingProgram, ProgrammingItem } from './types';

type ApplicationSnapshot = {
  id: string;
  option_json?: Record<string, any> | null;
};

type ArtistSnapshot = {
  id: string;
  stage_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type SnapshotInput = {
  program: ProgrammingProgram;
  item: ProgrammingItem;
  application: ApplicationSnapshot;
  artist: ArtistSnapshot;
};

export type ProgrammingSnapshot = {
  program: { id: string; conditions: Record<string, any> };
  item: { id: string; metadata: Record<string, any>; start_date: string; end_date: string };
  application: { id: string; option_json: Record<string, any> };
  artist: ArtistSnapshot;
};

export function createSnapshot({ program, item, application, artist }: SnapshotInput): ProgrammingSnapshot {
  return {
    program: {
      id: program.id,
      conditions: program.conditions_json ?? {},
    },
    item: {
      id: item.id,
      metadata: item.meta_json ?? {},
      start_date: item.start_date,
      end_date: item.end_date,
    },
    application: {
      id: application.id,
      option_json: application.option_json ?? {},
    },
    artist: {
      id: artist.id,
      stage_name: artist.stage_name ?? null,
      email: artist.email ?? null,
      phone: artist.phone ?? null,
    },
  };
}
