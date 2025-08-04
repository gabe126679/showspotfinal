-- Centralized Payout System
-- Handles all payments to entities (artists, bands, venues) from tips, shows, songs, albums

-- 1. Create centralized payout table
CREATE TABLE IF NOT EXISTS payouts (
  payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL, -- artist_id, band_id, or venue_id
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('artist', 'band', 'venue')),
  payer_id UUID, -- spotter_id or NULL for showspot payments
  payer_type TEXT CHECK (payer_type IN ('spotter', 'showspot')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('tip', 'show_payout', 'song_payment', 'album_payment')),
  payment_description TEXT,
  source_id UUID, -- reference to tip_id, show_id, song_id, album_id
  source_type TEXT CHECK (source_type IN ('tip', 'show', 'song', 'album')),
  stripe_payment_intent TEXT, -- Stripe payment intent ID
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes for performance
  CONSTRAINT idx_payouts_recipient FOREIGN KEY (recipient_id) REFERENCES artists(artist_id) ON DELETE CASCADE,
  CONSTRAINT idx_payouts_payer FOREIGN KEY (payer_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payouts_recipient_id ON payouts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient_type ON payouts(recipient_type);
CREATE INDEX IF NOT EXISTS idx_payouts_payer_id ON payouts(payer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_payment_type ON payouts(payment_type);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

-- 2. Create tips table (references payouts)
CREATE TABLE IF NOT EXISTS tips (
  tip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL, -- artist_id, band_id, or venue_id
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('artist', 'band', 'venue')),
  tip_amount DECIMAL(10,2) NOT NULL CHECK (tip_amount > 0),
  tip_message TEXT,
  stripe_payment_intent TEXT,
  tip_status TEXT DEFAULT 'pending' CHECK (tip_status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for tips
CREATE INDEX IF NOT EXISTS idx_tips_tipper_id ON tips(tipper_id);
CREATE INDEX IF NOT EXISTS idx_tips_recipient_id ON tips(recipient_id);
CREATE INDEX IF NOT EXISTS idx_tips_recipient_type ON tips(recipient_type);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at);

-- 3. Function to process a tip and create payouts
CREATE OR REPLACE FUNCTION process_tip(
  tipper_user_id UUID,
  recipient_entity_id UUID,
  recipient_entity_type TEXT,
  tip_amount_param DECIMAL(10,2),
  tip_message_param TEXT DEFAULT NULL,
  stripe_payment_intent_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tipper_id UUID := tipper_user_id;
  v_recipient_id UUID := recipient_entity_id;
  v_recipient_type TEXT := recipient_entity_type;
  v_tip_amount DECIMAL(10,2) := tip_amount_param;
  v_tip_message TEXT := tip_message_param;
  v_stripe_intent TEXT := stripe_payment_intent_param;
  v_tip_id UUID;
  v_band_members UUID[];
  v_member_payout DECIMAL(10,2);
  v_payout_id UUID;
  v_member_id UUID;
  result JSONB;
BEGIN
  -- Validate recipient type
  IF v_recipient_type NOT IN ('artist', 'band', 'venue') THEN
    RAISE EXCEPTION 'Invalid recipient type: %', v_recipient_type;
  END IF;

  -- Create tip record
  INSERT INTO tips (
    tipper_id,
    recipient_id,
    recipient_type,
    tip_amount,
    tip_message,
    stripe_payment_intent,
    tip_status
  ) VALUES (
    v_tipper_id,
    v_recipient_id,
    v_recipient_type,
    v_tip_amount,
    v_tip_message,
    v_stripe_intent,
    'completed'
  ) RETURNING tip_id INTO v_tip_id;

  -- Handle payout distribution
  IF v_recipient_type = 'band' THEN
    -- Get band members
    SELECT band_members INTO v_band_members
    FROM bands 
    WHERE band_id = v_recipient_id;

    IF v_band_members IS NULL OR array_length(v_band_members, 1) = 0 THEN
      RAISE EXCEPTION 'Band has no members';
    END IF;

    -- Calculate payout per member
    v_member_payout := v_tip_amount / array_length(v_band_members, 1);

    -- Create payout for each band member
    FOREACH v_member_id IN ARRAY v_band_members LOOP
      INSERT INTO payouts (
        recipient_id,
        recipient_type,
        payer_id,
        payer_type,
        amount,
        payment_type,
        payment_description,
        source_id,
        source_type,
        stripe_payment_intent,
        payment_status,
        processed_at
      ) VALUES (
        v_member_id,
        'artist',
        v_tipper_id,
        'spotter',
        v_member_payout,
        'tip',
        COALESCE(v_tip_message, 'Tip from spotter'),
        v_tip_id,
        'tip',
        v_stripe_intent,
        'completed',
        NOW()
      );
    END LOOP;

  ELSE
    -- Direct payout for artist or venue
    INSERT INTO payouts (
      recipient_id,
      recipient_type,
      payer_id,
      payer_type,
      amount,
      payment_type,
      payment_description,
      source_id,
      source_type,
      stripe_payment_intent,
      payment_status,
      processed_at
    ) VALUES (
      v_recipient_id,
      v_recipient_type,
      v_tipper_id,
      'spotter',
      v_tip_amount,
      'tip',
      COALESCE(v_tip_message, 'Tip from spotter'),
      v_tip_id,
      'tip',
      v_stripe_intent,
      'completed',
      NOW()
    ) RETURNING payout_id INTO v_payout_id;
  END IF;

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'tip_id', v_tip_id,
    'message', 'Tip processed successfully'
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;

-- 4. Function to get total payouts for an entity
CREATE OR REPLACE FUNCTION get_entity_total_payouts(
  entity_id UUID,
  entity_type TEXT
)
RETURNS TABLE(
  total_amount DECIMAL(10,2),
  tip_total DECIMAL(10,2),
  show_total DECIMAL(10,2),
  song_total DECIMAL(10,2),
  album_total DECIMAL(10,2),
  payout_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(amount), 0) as total_amount,
    COALESCE(SUM(CASE WHEN payment_type = 'tip' THEN amount ELSE 0 END), 0) as tip_total,
    COALESCE(SUM(CASE WHEN payment_type = 'show_payout' THEN amount ELSE 0 END), 0) as show_total,
    COALESCE(SUM(CASE WHEN payment_type = 'song_payment' THEN amount ELSE 0 END), 0) as song_total,
    COALESCE(SUM(CASE WHEN payment_type = 'album_payment' THEN amount ELSE 0 END), 0) as album_total,
    COUNT(*)::INTEGER as payout_count
  FROM payouts 
  WHERE recipient_id = v_entity_id 
    AND recipient_type = v_entity_type
    AND payment_status = 'completed';
END;
$$;

-- 5. Function to get recent payouts for an entity
CREATE OR REPLACE FUNCTION get_entity_recent_payouts(
  entity_id UUID,
  entity_type TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
  payout_id UUID,
  amount DECIMAL(10,2),
  payment_type TEXT,
  payment_description TEXT,
  payer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
  v_limit INTEGER := limit_count;
BEGIN
  RETURN QUERY
  SELECT 
    p.payout_id,
    p.amount,
    p.payment_type,
    p.payment_description,
    CASE 
      WHEN p.payer_type = 'spotter' THEN COALESCE(sp.spotter_name, 'Anonymous Spotter')
      ELSE 'ShowSpot'
    END as payer_name,
    p.created_at
  FROM payouts p
  LEFT JOIN spotters sp ON p.payer_id = sp.spotter_id
  WHERE p.recipient_id = v_entity_id 
    AND p.recipient_type = v_entity_type
    AND p.payment_status = 'completed'
  ORDER BY p.created_at DESC
  LIMIT v_limit;
END;
$$;

-- 6. Function to get tip statistics for an entity
CREATE OR REPLACE FUNCTION get_entity_tip_stats(
  entity_id UUID,
  entity_type TEXT
)
RETURNS TABLE(
  total_tips_received DECIMAL(10,2),
  tip_count INTEGER,
  average_tip DECIMAL(10,2),
  top_tipper_name TEXT,
  top_tip_amount DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
BEGIN
  RETURN QUERY
  WITH tip_stats AS (
    SELECT 
      SUM(p.amount) as total_amount,
      COUNT(*) as tip_count,
      AVG(p.amount) as avg_amount
    FROM payouts p
    WHERE p.recipient_id = v_entity_id 
      AND p.recipient_type = v_entity_type
      AND p.payment_type = 'tip'
      AND p.payment_status = 'completed'
  ),
  top_tipper AS (
    SELECT 
      COALESCE(sp.spotter_name, 'Anonymous') as tipper_name,
      MAX(p.amount) as max_tip
    FROM payouts p
    LEFT JOIN spotters sp ON p.payer_id = sp.spotter_id
    WHERE p.recipient_id = v_entity_id 
      AND p.recipient_type = v_entity_type
      AND p.payment_type = 'tip'
      AND p.payment_status = 'completed'
    GROUP BY sp.spotter_name
    ORDER BY MAX(p.amount) DESC
    LIMIT 1
  )
  SELECT 
    COALESCE(ts.total_amount, 0) as total_tips_received,
    COALESCE(ts.tip_count, 0)::INTEGER as tip_count,
    COALESCE(ts.avg_amount, 0) as average_tip,
    tt.tipper_name as top_tipper_name,
    COALESCE(tt.max_tip, 0) as top_tip_amount
  FROM tip_stats ts
  FULL OUTER JOIN top_tipper tt ON true;
END;
$$;