-- Create the tickets table for QR code tracking and delivery
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ticket relationships
    show_id UUID NOT NULL REFERENCES shows(show_id) ON DELETE CASCADE,
    purchaser_id UUID NOT NULL REFERENCES spotters(spotter_id) ON DELETE CASCADE,
    
    -- Ticket details
    ticket_price TEXT NOT NULL, -- Price paid for this ticket
    purchase_type TEXT NOT NULL DEFAULT 'active', -- 'pre_sale', 'active', 'donation'
    
    -- QR Code and validation
    qr_code TEXT UNIQUE NOT NULL, -- Generated QR code string
    qr_code_data JSONB NOT NULL, -- JSON data encoded in QR code
    
    -- Ticket status
    ticket_status TEXT NOT NULL DEFAULT 'valid',
    -- Values: 'valid', 'used', 'refunded', 'cancelled'
    
    -- Validation tracking
    scanned_at TIMESTAMPTZ NULL,
    scanned_by UUID NULL REFERENCES spotters(spotter_id), -- Venue staff who scanned
    
    -- Payment tracking
    stripe_payment_intent_id TEXT, -- Stripe payment reference
    payment_status TEXT NOT NULL DEFAULT 'pending',
    -- Values: 'pending', 'completed', 'failed', 'refunded'
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_show_id ON tickets(show_id);
CREATE INDEX IF NOT EXISTS idx_tickets_purchaser_id ON tickets(purchaser_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(ticket_status);
CREATE INDEX IF NOT EXISTS idx_tickets_payment_status ON tickets(payment_status);
CREATE INDEX IF NOT EXISTS idx_tickets_stripe_payment_intent ON tickets(stripe_payment_intent_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_tickets_updated_at();

-- Function to generate unique QR code
CREATE OR REPLACE FUNCTION generate_qr_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'SS-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8)) || 
           '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
END;
$$ language 'plpgsql';

-- Function to generate QR code data JSON
CREATE OR REPLACE FUNCTION generate_qr_data(
    p_ticket_id UUID,
    p_show_id UUID,
    p_purchaser_id UUID
) RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'ticket_id', p_ticket_id,
        'show_id', p_show_id,
        'purchaser_id', p_purchaser_id,
        'issued_at', NOW(),
        'verification_hash', MD5(p_ticket_id::text || p_show_id::text || NOW()::text)
    );
END;
$$ language 'plpgsql';

-- Trigger to auto-generate QR code and data on insert
CREATE OR REPLACE FUNCTION set_ticket_qr_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_code IS NULL THEN
        NEW.qr_code = generate_qr_code();
    END IF;
    
    IF NEW.qr_code_data IS NULL THEN
        NEW.qr_code_data = generate_qr_data(NEW.ticket_id, NEW.show_id, NEW.purchaser_id);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_ticket_qr_code ON tickets;
CREATE TRIGGER set_ticket_qr_code
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_qr_code();

-- RLS policies for tickets table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own tickets
CREATE POLICY "Users can read their own tickets"
ON tickets FOR SELECT
TO authenticated
USING (purchaser_id = auth.uid());

-- Policy: Venue owners can read tickets for their shows
CREATE POLICY "Venue owners can read tickets for their shows"
ON tickets FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shows s
        JOIN venues v ON s.show_venue = v.venue_id
        WHERE s.show_id = tickets.show_id
        AND v.spotter_id = auth.uid()
    )
);

-- Policy: Users can create tickets for themselves
CREATE POLICY "Users can create tickets for themselves"
ON tickets FOR INSERT
TO authenticated
WITH CHECK (purchaser_id = auth.uid());

-- Policy: Venue owners can update ticket status (for scanning)
CREATE POLICY "Venue owners can update ticket status"
ON tickets FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shows s
        JOIN venues v ON s.show_venue = v.venue_id
        WHERE s.show_id = tickets.show_id
        AND v.spotter_id = auth.uid()
    )
);

-- Policy: Ticket owners can update their own tickets (limited fields)
CREATE POLICY "Ticket owners can update their own tickets"
ON tickets FOR UPDATE
TO authenticated
USING (purchaser_id = auth.uid());