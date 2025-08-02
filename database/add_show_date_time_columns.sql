-- Add preferred_date and preferred_time columns to shows table
ALTER TABLE shows 
ADD COLUMN IF NOT EXISTS preferred_date DATE,
ADD COLUMN IF NOT EXISTS preferred_time TIME;

-- Add ticket_price column while we're at it (for the show bill)
ALTER TABLE shows 
ADD COLUMN IF NOT EXISTS ticket_price DECIMAL(10,2);

-- Add show_description column
ALTER TABLE shows 
ADD COLUMN IF NOT EXISTS show_description TEXT;

-- Update any existing rows to have a default date (optional)
-- UPDATE shows SET preferred_date = CURRENT_DATE WHERE preferred_date IS NULL;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shows' 
AND column_name IN ('preferred_date', 'preferred_time', 'ticket_price', 'show_description')
ORDER BY column_name;