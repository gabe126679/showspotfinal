// Script to create missing backlines functions in Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables (you'll need to set these)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key needed for DDL operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/fix_backlines_functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing backlines functions SQL...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('sql', { query: sqlContent });
    
    if (error) {
      console.error('Error executing SQL:', error);
      return;
    }
    
    console.log('✅ Backlines functions created successfully!');
    console.log('The following functions are now available:');
    console.log('- get_show_backlines(show_id, user_id)');
    console.log('- add_backline_application(show_id, backline_artist, backline_artist_type)');
    console.log('- vote_for_backline(show_id, backline_artist, voter_id)');
    console.log('- update_backline_consensus(show_id, backline_artist, band_member_id, decision)');
    console.log('- user_has_voted_backline(show_id, backline_artist, user_id)');
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

// Alternative approach - create functions individually using RPC
async function createFunctionsWithRPC() {
  console.log('Creating backlines functions using RPC...');
  
  // Test if the function exists
  try {
    const { data, error } = await supabase.rpc('get_show_backlines', {
      show_id: '00000000-0000-0000-0000-000000000000',
      user_id: null
    });
    
    if (!error) {
      console.log('✅ get_show_backlines function already exists and is working!');
      return;
    }
    
    if (error.message.includes('Could not find the function')) {
      console.log('❌ Function not found, need to create it manually in Supabase dashboard');
      console.log('Please run the SQL from database/fix_backlines_functions.sql in your Supabase SQL editor');
      return;
    }
    
    console.log('Function exists but returned error (this may be normal for test data):', error.message);
    
  } catch (testError) {
    console.error('Error testing function:', testError);
  }
}

// Run the script
createFunctionsWithRPC();