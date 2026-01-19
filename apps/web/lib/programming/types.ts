export type ProgramType = 'MULTI_DATES' | 'WEEKLY_RESIDENCY';

export const PROGRAM_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type ProgramStatus = (typeof PROGRAM_STATUS)[keyof typeof PROGRAM_STATUS];

export const ITEM_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS];

export type ProgrammingProgram = {
  id: string;
  title: string | null;
  program_type: string;
  conditions_json: any;
  is_public?: boolean;
  is_open?: boolean;
  status?: ProgramStatus;
};

export type ProgrammingItem = {
  id: string;
  program_id: string;
  item_type: 'DATE' | 'WEEK';
  start_date: string;
  end_date: string;
  status: ItemStatus;
  meta_json: Record<string, any>;
};

export type ProgrammingBooking = {
  id: string;
  item_id: string;
  artist_id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  conditions_snapshot_json: Record<string, any>;
  option_json?: Record<string, any>;
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
  access: RoadmapEntry[];
  logistics: RoadmapEntry[];
  contacts: RoadmapEntry[];
};
