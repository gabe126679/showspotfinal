import { supabase } from '../lib/supabase';

export interface PlaylistSongData {
  song_id: string;
  song_title: string;
  song_file: string;
  song_image?: string;
  song_type: 'artist' | 'band';
  song_artist?: string;
  song_band?: string;
  artist_name?: string;
  band_name?: string;
}

export interface PlaylistData {
  playlist_id?: string;
  spotter_id: string;
  playlist_name: string;
  playlist_songs: string[];
  playlist_song_data: PlaylistSongData[];
  playlist_image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Playlist {
  playlist_id: string;
  spotter_id: string;
  playlist_name: string;
  playlist_songs: string[];
  playlist_song_data: PlaylistSongData[];
  playlist_image?: string;
  created_at: string;
  updated_at: string;
}

class PlaylistService {
  // Create a new playlist
  async createPlaylist(data: {
    spotterId: string;
    playlistName: string;
    firstSong?: PlaylistSongData;
    playlistImage?: string;
  }): Promise<{ success: boolean; error?: string; data?: Playlist }> {
    try {
      console.log('Creating playlist:', data);

      const playlistData: Partial<PlaylistData> = {
        spotter_id: data.spotterId,
        playlist_name: data.playlistName,
        playlist_songs: data.firstSong ? [data.firstSong.song_id] : [],
        playlist_song_data: data.firstSong ? [data.firstSong] : [],
        playlist_image: data.playlistImage || data.firstSong?.song_image,
      };

      const { data: playlist, error } = await supabase
        .from('playlists')
        .insert([playlistData])
        .select()
        .single();

      if (error) {
        console.error('Error creating playlist:', error);
        return { success: false, error: error.message };
      }

      console.log('Playlist created successfully:', playlist);
      return { success: true, data: playlist };
    } catch (error: any) {
      console.error('Unexpected error creating playlist:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all playlists for a user
  async getUserPlaylists(spotterId: string): Promise<{ success: boolean; error?: string; data?: Playlist[] }> {
    try {
      console.log('Fetching playlists for user:', spotterId);

      const { data: playlists, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('spotter_id', spotterId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching playlists:', error);
        return { success: false, error: error.message };
      }

      console.log('Playlists fetched:', playlists?.length || 0);
      return { success: true, data: playlists || [] };
    } catch (error: any) {
      console.error('Unexpected error fetching playlists:', error);
      return { success: false, error: error.message };
    }
  }

  // Add song to existing playlist
  async addSongToPlaylist(
    playlistId: string, 
    songData: PlaylistSongData
  ): Promise<{ success: boolean; error?: string; data?: Playlist }> {
    try {
      console.log('Adding song to playlist:', { playlistId, songId: songData.song_id });

      // First get the current playlist
      const { data: currentPlaylist, error: fetchError } = await supabase
        .from('playlists')
        .select('*')
        .eq('playlist_id', playlistId)
        .single();

      if (fetchError || !currentPlaylist) {
        console.error('Error fetching playlist:', fetchError);
        return { success: false, error: 'Playlist not found' };
      }

      // Check if song is already in playlist
      if (currentPlaylist.playlist_songs.includes(songData.song_id)) {
        return { success: false, error: 'Song already in playlist' };
      }

      // Add the song to the arrays
      const updatedSongs = [...currentPlaylist.playlist_songs, songData.song_id];
      const updatedSongData = [...currentPlaylist.playlist_song_data, songData];

      // Update the playlist
      const { data: updatedPlaylist, error: updateError } = await supabase
        .from('playlists')
        .update({
          playlist_songs: updatedSongs,
          playlist_song_data: updatedSongData,
          // Update playlist image to first song if no image set
          playlist_image: currentPlaylist.playlist_image || songData.song_image,
        })
        .eq('playlist_id', playlistId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating playlist:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('Song added to playlist successfully');
      return { success: true, data: updatedPlaylist };
    } catch (error: any) {
      console.error('Unexpected error adding song to playlist:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove song from playlist
  async removeSongFromPlaylist(
    playlistId: string, 
    songId: string
  ): Promise<{ success: boolean; error?: string; data?: Playlist }> {
    try {
      console.log('Removing song from playlist:', { playlistId, songId });

      // Get current playlist
      const { data: currentPlaylist, error: fetchError } = await supabase
        .from('playlists')
        .select('*')
        .eq('playlist_id', playlistId)
        .single();

      if (fetchError || !currentPlaylist) {
        return { success: false, error: 'Playlist not found' };
      }

      // Remove the song from arrays
      const updatedSongs = currentPlaylist.playlist_songs.filter((id: string) => id !== songId);
      const updatedSongData = currentPlaylist.playlist_song_data.filter(
        (song: PlaylistSongData) => song.song_id !== songId
      );

      // Update playlist image if we removed the song that was the image source
      let playlistImage = currentPlaylist.playlist_image;
      if (updatedSongData.length > 0 && !playlistImage) {
        playlistImage = updatedSongData[0].song_image;
      } else if (updatedSongData.length === 0) {
        playlistImage = null;
      }

      // Update the playlist
      const { data: updatedPlaylist, error: updateError } = await supabase
        .from('playlists')
        .update({
          playlist_songs: updatedSongs,
          playlist_song_data: updatedSongData,
          playlist_image: playlistImage,
        })
        .eq('playlist_id', playlistId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating playlist:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('Song removed from playlist successfully');
      return { success: true, data: updatedPlaylist };
    } catch (error: any) {
      console.error('Unexpected error removing song from playlist:', error);
      return { success: false, error: error.message };
    }
  }

  // Update playlist name or image
  async updatePlaylist(
    playlistId: string,
    updates: { playlist_name?: string; playlist_image?: string }
  ): Promise<{ success: boolean; error?: string; data?: Playlist }> {
    try {
      console.log('Updating playlist:', { playlistId, updates });

      const { data: updatedPlaylist, error } = await supabase
        .from('playlists')
        .update(updates)
        .eq('playlist_id', playlistId)
        .select()
        .single();

      if (error) {
        console.error('Error updating playlist:', error);
        return { success: false, error: error.message };
      }

      console.log('Playlist updated successfully');
      return { success: true, data: updatedPlaylist };
    } catch (error: any) {
      console.error('Unexpected error updating playlist:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete playlist
  async deletePlaylist(playlistId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Deleting playlist:', playlistId);

      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('playlist_id', playlistId);

      if (error) {
        console.error('Error deleting playlist:', error);
        return { success: false, error: error.message };
      }

      console.log('Playlist deleted successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error deleting playlist:', error);
      return { success: false, error: error.message };
    }
  }

  // Get a specific playlist by ID
  async getPlaylist(playlistId: string): Promise<{ success: boolean; error?: string; data?: Playlist }> {
    try {
      console.log('Fetching playlist:', playlistId);

      const { data: playlist, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('playlist_id', playlistId)
        .single();

      if (error) {
        console.error('Error fetching playlist:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: playlist };
    } catch (error: any) {
      console.error('Unexpected error fetching playlist:', error);
      return { success: false, error: error.message };
    }
  }
}

export const playlistService = new PlaylistService();