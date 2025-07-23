// Debug script to test artist search functionality
import { supabase } from './lib/supabase';

const testArtistSearch = async () => {
  console.log('🔍 Testing artist database access...');
  
  try {
    // Test 1: Check total count
    const { data, error, count } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true });
    
    console.log('📊 Total artists in database:', count);
    console.log('❌ Count query error:', error);
    
    // Test 2: Try to get first few artists
    const { data: artists, error: artistError } = await supabase
      .from('artists')
      .select('artist_id, artist_name, artist_profile_image')
      .limit(5);
      
    console.log('🎭 Sample artists:', artists);
    console.log('❌ Artists error:', artistError);
    
    // Test 3: Search functionality
    if (artists && artists.length > 0) {
      const searchTerm = artists[0].artist_name.substring(0, 3);
      console.log(`🔍 Testing search for "${searchTerm}"`);
      
      const { data: searchResults, error: searchError } = await supabase
        .from('artists')
        .select('artist_id, artist_name, artist_profile_image')
        .ilike('artist_name', `%${searchTerm}%`)
        .limit(10);
        
      console.log('🔍 Search results:', searchResults);
      console.log('❌ Search error:', searchError);
    }
    
    // Test 4: Check authentication
    const { data: session } = await supabase.auth.getSession();
    console.log('🔐 Current session:', session?.session?.user ? 'Authenticated' : 'Not authenticated');
    
  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
};

testArtistSearch();