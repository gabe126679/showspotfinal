-- Debug query to check actual table schemas
-- Run these queries to verify column names

-- Check shows table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shows' 
ORDER BY ordinal_position;

-- Check bands table columns  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bands' 
ORDER BY ordinal_position;

-- Check ratings tables columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ratings' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'individual_ratings' 
ORDER BY ordinal_position;