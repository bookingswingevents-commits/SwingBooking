export type ProgramType = 'MULTI_DATES' | 'WEEKLY_RESIDENCY';

export type ProgrammingProgram = {
  id: string;
  program_type: ProgramType;
  is_public?: boolean;
  is_open?: boolean;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  conditions_json: Record<string, any>;
};

export type ProgrammingItem = {
  id: string;
  program_id: string;
  item_type: 'DATE' | 'WEEK';
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  metadata_json: Record<string, any>;
};

export type ProgrammingBooking = {
  id: string;
  item_id: string;
  artist_id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  conditions_snapshot_json: Record<string, any>;
  option?: {
    label?: string;
    amount_cents?: number;
  } | null;
};

export type RoadmapEntry = { label: string; value: string };

export type RoadmapScheduleEntry = {
  date: string;
  time?: string;
  place?: string;
  notes?: string;
};

export type RoadmapOutput = {
  schedule: RoadmapScheduleEntry[];
  fees: RoadmapEntry[];
  venues: RoadmapEntry[];
  lodging: RoadmapEntry[];
  meals: RoadmapEntry[];
  logistics: RoadmapEntry[];
  contacts: RoadmapEntry[];
};
