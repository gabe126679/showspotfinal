-- Add venue_decision column to shows table
ALTER TABLE shows
ADD COLUMN venue_decision BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN shows.venue_decision IS 'Tracks whether the venue has accepted the show invitation. Changes to true only after venue sets date, time, and pricing details.';

-- Create index for performance when filtering by venue decision
CREATE INDEX IF NOT EXISTS idx_shows_venue_decision ON shows(venue_decision);