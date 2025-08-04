-- Create playlists table for private spotter playlists
CREATE TABLE playlists (
    playlist_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    spotter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    playlist_name TEXT NOT NULL,
    playlist_songs TEXT[] DEFAULT '{}',
    playlist_song_data JSONB DEFAULT '[]'::jsonb,
    playlist_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_playlists_spotter_id ON playlists(spotter_id);
CREATE INDEX idx_playlists_created_at ON playlists(created_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own playlists
CREATE POLICY "Users can view their own playlists" ON playlists
    FOR SELECT USING (auth.uid() = spotter_id);

-- Policy: Users can only insert their own playlists
CREATE POLICY "Users can create their own playlists" ON playlists
    FOR INSERT WITH CHECK (auth.uid() = spotter_id);

-- Policy: Users can only update their own playlists
CREATE POLICY "Users can update their own playlists" ON playlists
    FOR UPDATE USING (auth.uid() = spotter_id);

-- Policy: Users can only delete their own playlists
CREATE POLICY "Users can delete their own playlists" ON playlists
    FOR DELETE USING (auth.uid() = spotter_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE playlists IS 'Private playlists created by spotters containing their purchased songs';
COMMENT ON COLUMN playlists.playlist_songs IS 'Array of song IDs included in this playlist';
COMMENT ON COLUMN playlists.playlist_song_data IS 'JSONB array containing full song data for efficient querying';
COMMENT ON COLUMN playlists.playlist_image IS 'Playlist cover image URL, defaults to first songs image if not set';