-- Fix payouts table to properly handle venue tips
-- The current constraint only allows artist_id, but we need to support venues too

-- Drop the existing foreign key constraint that only references artists
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS idx_payouts_recipient;

-- Since we have multiple entity types (artist, band, venue) with different tables,
-- we can't use a single foreign key constraint. Instead, we'll use a trigger
-- to validate the recipient_id based on recipient_type

-- Create a function to validate recipient exists
CREATE OR REPLACE FUNCTION validate_payout_recipient()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if recipient exists based on type
  IF NEW.recipient_type = 'artist' THEN
    IF NOT EXISTS (SELECT 1 FROM artists WHERE artist_id = NEW.recipient_id) THEN
      RAISE EXCEPTION 'Artist with ID % does not exist', NEW.recipient_id;
    END IF;
  ELSIF NEW.recipient_type = 'band' THEN
    IF NOT EXISTS (SELECT 1 FROM bands WHERE band_id = NEW.recipient_id) THEN
      RAISE EXCEPTION 'Band with ID % does not exist', NEW.recipient_id;
    END IF;
  ELSIF NEW.recipient_type = 'venue' THEN
    IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = NEW.recipient_id) THEN
      RAISE EXCEPTION 'Venue with ID % does not exist', NEW.recipient_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate recipient on insert/update
DROP TRIGGER IF EXISTS validate_payout_recipient_trigger ON payouts;
CREATE TRIGGER validate_payout_recipient_trigger
  BEFORE INSERT OR UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION validate_payout_recipient();

-- Also update the process_tip function to validate venue exists
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

  -- Validate recipient exists based on type
  IF v_recipient_type = 'artist' THEN
    IF NOT EXISTS (SELECT 1 FROM artists WHERE artist_id = v_recipient_id) THEN
      RAISE EXCEPTION 'Artist with ID % does not exist', v_recipient_id;
    END IF;
  ELSIF v_recipient_type = 'band' THEN
    IF NOT EXISTS (SELECT 1 FROM bands WHERE band_id = v_recipient_id) THEN
      RAISE EXCEPTION 'Band with ID % does not exist', v_recipient_id;
    END IF;
  ELSIF v_recipient_type = 'venue' THEN
    IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = v_recipient_id) THEN
      RAISE EXCEPTION 'Venue with ID % does not exist', v_recipient_id;
    END IF;
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

  -- Handle payouts based on recipient type
  IF v_recipient_type = 'band' THEN
    -- Get band members
    SELECT band_members INTO v_band_members
    FROM bands
    WHERE band_id = v_recipient_id;

    -- Calculate per-member payout
    v_member_payout := v_tip_amount / array_length(v_band_members, 1);

    -- Create payout for each band member
    FOREACH v_member_id IN ARRAY v_band_members
    LOOP
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
        payment_status
      ) VALUES (
        v_member_id,
        'artist',
        v_tipper_id,
        'spotter',
        v_member_payout,
        'tip',
        'Band tip split among members',
        v_tip_id,
        'tip',
        v_stripe_intent,
        'completed'
      );
    END LOOP;
  ELSE
    -- Create single payout for artist or venue
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
      payment_status
    ) VALUES (
      v_recipient_id,
      v_recipient_type,
      v_tipper_id,
      'spotter',
      v_tip_amount,
      'tip',
      CASE 
        WHEN v_recipient_type = 'artist' THEN 'Artist tip'
        WHEN v_recipient_type = 'venue' THEN 'Venue tip'
        ELSE 'Tip'
      END,
      v_tip_id,
      'tip',
      v_stripe_intent,
      'completed'
    ) RETURNING payout_id INTO v_payout_id;
  END IF;

  -- Update tip status
  UPDATE tips 
  SET tip_status = 'completed', processed_at = NOW()
  WHERE tip_id = v_tip_id;

  -- Return success
  result := jsonb_build_object(
    'success', true,
    'tip_id', v_tip_id,
    'payout_id', v_payout_id,
    'message', 'Tip processed successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Roll back tip if created
    DELETE FROM tips WHERE tip_id = v_tip_id;
    
    -- Return error
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_payout_recipient() TO authenticated;
GRANT EXECUTE ON FUNCTION process_tip(UUID, UUID, TEXT, DECIMAL, TEXT, TEXT) TO authenticated;

-- Add RLS policies if not exists
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Create policies for payouts (allow users to see their own payouts)
CREATE POLICY "Users can view their own payouts as recipients" ON payouts
  FOR SELECT
  USING (
    recipient_id IN (
      SELECT artist_id FROM artists WHERE spotter_id = auth.uid()
      UNION
      SELECT venue_id FROM venues WHERE spotter_id = auth.uid()
      UNION
      SELECT band_id FROM bands WHERE band_creator = auth.uid()
    )
  );

CREATE POLICY "Users can view payouts they made" ON payouts
  FOR SELECT
  USING (payer_id = auth.uid());

-- Create policies for tips
CREATE POLICY "Users can view tips they sent" ON tips
  FOR SELECT
  USING (tipper_id = auth.uid());

CREATE POLICY "Users can view tips they received" ON tips
  FOR SELECT
  USING (
    recipient_id IN (
      SELECT artist_id FROM artists WHERE spotter_id = auth.uid()
      UNION
      SELECT venue_id FROM venues WHERE spotter_id = auth.uid()
      UNION
      SELECT band_id FROM bands WHERE band_creator = auth.uid()
    )
  );

-- Instructions:
-- Run this migration in your Supabase SQL Editor to fix the venue tipping issue
-- This removes the artist-only foreign key constraint and replaces it with
-- a trigger that validates the recipient exists in the appropriate table