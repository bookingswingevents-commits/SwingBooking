-- VHR fields + managed booking + tier on booking_requests
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS travel_covered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS travel_modes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS travel_notes text,
ADD COLUMN IF NOT EXISTS accommodation_provided boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS accommodation_type text,
ADD COLUMN IF NOT EXISTS accommodation_notes text,
ADD COLUMN IF NOT EXISTS meal_provided boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS meal_notes text,
ADD COLUMN IF NOT EXISTS managed_booking boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS managed_booking_price_cents integer DEFAULT 6900,
ADD COLUMN IF NOT EXISTS managed_booking_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS request_tier text DEFAULT 'discovery';

-- Occurrences (multi-dates / multi-lieux)
CREATE TABLE IF NOT EXISTS booking_request_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id),
  date date NOT NULL,
  start_time time,
  duration_minutes integer,
  address_snapshot text,
  audience_estimate integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_request_occurrences_request_id_idx
  ON booking_request_occurrences(request_id);
