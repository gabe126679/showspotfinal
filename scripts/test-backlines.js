// Test script to check backlines functions
// Run with: node scripts/test-backlines.js

const { createClient } = require('@supabase/supabase-js');

// Note: This uses the same config as your app
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Using hardcoded values - please update with your Supabase credentials if needed');
  console.log('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBacklinesFunctions() {
  console.log('🔍 Testing backlines functions...');
  
  try {
    // Test the get_show_backlines function
    const { data, error } = await supabase.rpc('get_show_backlines', {
      show_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      user_id: null
    });
    
    if (!error || error.message.includes('no rows')) {
      console.log('✅ get_show_backlines function is working!');
      console.log('Response:', data);
    } else if (error.message.includes('Could not find the function')) {
      console.log('❌ get_show_backlines function is missing!');
      console.log('');
      console.log('🔧 To fix this:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the contents of database/fix_backlines_functions.sql');
      console.log('');
      console.log('Or copy and paste this into your Supabase SQL editor:');
      console.log('----------------------------------------');
      const fs = require('fs');
      const path = require('path');
      try {
        const sqlPath = path.join(__dirname, '../database/fix_backlines_functions.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log(sqlContent);
      } catch (fileError) {
        console.log('Could not read SQL file:', fileError.message);
      }
      console.log('----------------------------------------');
    } else {
      console.log('⚠️  Function exists but returned an error:', error.message);
    }
    
  } catch (testError) {
    console.error('❌ Test failed:', testError);
  }
}

testBacklinesFunctions();