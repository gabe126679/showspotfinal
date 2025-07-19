import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://myqrzbdxvfqhcrsiintm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cXJ6YmR4dmZxaGNyc2lpbnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzODgzODYsImV4cCI6MjA2NDk2NDM4Nn0.fj8JhgtX1ICRT4hGAQ3dvsFw9codTiBWW1CErc-REVM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);