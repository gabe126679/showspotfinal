-- Create the shows table with complex JSONB structure
CREATE TABLE IF NOT EXISTS shows (
    show_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Show members with complex consensus tracking
    show_members JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Structure: array of objects with:
    -- {
    --   "show_member_id": "uuid",
    --   "show_member_type": "artist" | "band" | "venue", 
    --   "show_member_name": "text",
    --   "show_member_position": "headliner" | "opener" | "venue" | "2" | "3" | etc,
    --   "show_member_decision": boolean,
    --   "show_member_consensus": null | [{"member": "uuid", "accepted": boolean}]
    -- }
    
    show_venue UUID NOT NULL, -- venue_id reference
    show_promoter UUID NOT NULL, -- spotter_id who promoted the show
    
    -- Date and time management
    show_preferred_date DATE NOT NULL,
    show_preferred_time TIME NOT NULL,
    show_date DATE, -- Final confirmed date (set when venue accepts)
    show_time TIME, -- Final confirmed time (set when venue accepts)
    
    -- Pricing and revenue
    show_ticket_price TEXT, -- Set by venue when accepting
    venue_percentage TEXT, -- Up to 30%, set by venue
    artist_percentage TEXT, -- Up to 70%, calculated from venue_percentage
    
    -- Artist guarantees (calculated when venue sets pricing)
    artist_guarantee JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{"artist": "artist_id", "guarantee": "amount"}]
    
    -- Ticket management
    show_ticket_purchasers TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of spotter_ids
    
    -- Backline system with voting
    show_backlines JSONB DEFAULT '[]'::jsonb,
    -- Structure: array of objects with:
    -- {
    --   "backline_type": "artist" | "band",
    --   "backline_id": "uuid", 
    --   "backline_name": "text",
    --   "backline_decision": boolean,
    --   "backline_consensus": null | [{"member_id": "uuid", "accepted": boolean}],
    --   "backline_voters": ["spotter_id1", "spotter_id2", ...]
    -- }
    
    -- Pre-show donations
    pre_show_donation JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{"donor": "spotter_id", "amount": "text"}]
    
    -- Show status management
    show_status TEXT NOT NULL DEFAULT 'pending',
    -- Values: 'pending', 'active', 'cancelled', 'completed', 'sold_out'
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key constraints
    FOREIGN KEY (show_venue) REFERENCES venues(venue_id) ON DELETE CASCADE,
    FOREIGN KEY (show_promoter) REFERENCES spotters(spotter_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(show_status);
CREATE INDEX IF NOT EXISTS idx_shows_date ON shows(show_date);
CREATE INDEX IF NOT EXISTS idx_shows_venue ON shows(show_venue);
CREATE INDEX IF NOT EXISTS idx_shows_promoter ON shows(show_promoter);
CREATE INDEX IF NOT EXISTS idx_shows_preferred_date ON shows(show_preferred_date);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_shows_members ON shows USING GIN(show_members);
CREATE INDEX IF NOT EXISTS idx_shows_backlines ON shows USING GIN(show_backlines);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_shows_updated_at ON shows;
CREATE TRIGGER update_shows_updated_at
    BEFORE UPDATE ON shows
    FOR EACH ROW
    EXECUTE FUNCTION update_shows_updated_at();

-- RLS policies for shows table
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all shows
CREATE POLICY "Users can read all shows"
ON shows FOR SELECT
TO authenticated
USING (true);

-- Policy: Only promoters can create shows
CREATE POLICY "Only promoters can create shows"
ON shows FOR INSERT
TO authenticated
WITH CHECK (show_promoter = auth.uid());

-- Policy: Show members and promoters can update shows
CREATE POLICY "Show members and promoters can update shows"
ON shows FOR UPDATE
TO authenticated
USING (
    show_promoter = auth.uid() OR
    EXISTS (
        SELECT 1 FROM jsonb_array_elements(show_members) AS member
        WHERE (member->>'show_member_id')::uuid = auth.uid()
    )
);

-- Policy: Only promoters can delete shows (rare case)
CREATE POLICY "Only promoters can delete shows"
ON shows FOR DELETE
TO authenticated
USING (show_promoter = auth.uid());