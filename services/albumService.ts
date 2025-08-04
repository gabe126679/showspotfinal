import { supabase } from '../lib/supabase';

export interface AlbumSongData {
  song_id: string;
  song_title: string;
  song_file: string;
  song_image: string;
  song_type: 'artist' | 'band';
  song_artist?: string; // artist_id for artist songs
  song_band?: string; // band_id for band songs
  artist_name?: string;
  band_name?: string;
}

export interface Album {
  album_id: string;
  album_title: string;
  album_songs: string[];
  album_song_data: AlbumSongData[];
  album_image: string;
  album_price: string;
  album_type: 'artist' | 'band';
  artist_id: string;
  band_id?: string;
  album_status: 'active' | 'pending' | 'inactive';
  album_consensus: Array<{
    member_id: string;
    member_decision: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export interface AlbumPurchase {
  purchase_id: string;
  album_id: string;
  purchaser_id: string;
  purchase_price: string;
  purchase_date: string;
  purchase_type: 'paid' | 'free';
  album_title: string;
  album_image: string;
  album_type: 'artist' | 'band';
  artist_name?: string;
  band_name?: string;
  album_song_data: AlbumSongData[];
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class AlbumService {
  async createAlbum(params: {
    albumTitle: string;
    albumPrice: string;
    albumType: 'artist' | 'band';
    artistId: string;
    bandId?: string;
    firstSong?: AlbumSongData;
  }): Promise<ServiceResponse<Album>> {
    try {
      const { albumTitle, albumPrice, albumType, artistId, bandId, firstSong } = params;

      // Determine album status based on type
      const albumStatus = albumType === 'artist' ? 'active' : 'pending';
      
      // Initialize consensus array for band albums
      let albumConsensus: Array<{ member_id: string; member_decision: boolean }> = [];
      
      if (albumType === 'band' && bandId) {
        // Get band members to initialize consensus
        const { data: bandData, error: bandError } = await supabase
          .from('bands')
          .select('band_members')
          .eq('band_id', bandId)
          .single();

        if (bandError) {
          throw new Error(`Failed to fetch band data: ${bandError.message}`);
        }

        if (bandData?.band_members) {
          albumConsensus = bandData.band_members.map((memberId: string) => ({
            member_id: memberId,
            member_decision: false
          }));
        }
      }

      const albumData = {
        album_title: albumTitle,
        album_songs: firstSong ? [firstSong.song_id] : [],
        album_song_data: firstSong ? [firstSong] : [],
        album_image: firstSong?.song_image || '',
        album_price: albumPrice,
        album_type: albumType,
        artist_id: artistId,
        band_id: bandId || null,
        album_status: albumStatus,
        album_consensus: albumConsensus
      };

      const { data, error } = await supabase
        .from('albums')
        .insert([albumData])
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error creating album:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async addSongToAlbum(albumId: string, song: AlbumSongData): Promise<ServiceResponse<void>> {
    try {
      // Get current album data
      const { data: currentAlbum, error: fetchError } = await supabase
        .from('albums')
        .select('album_songs, album_song_data, album_image')
        .eq('album_id', albumId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch album: ${fetchError.message}`);
      }

      const currentSongs = currentAlbum.album_songs || [];
      const currentSongData = currentAlbum.album_song_data || [];
      
      // Check if song already exists in album
      if (currentSongs.includes(song.song_id)) {
        throw new Error('Song already exists in album');
      }

      // Add new song
      const updatedSongs = [...currentSongs, song.song_id];
      const updatedSongData = [...currentSongData, song];
      
      // Use first song's image as album image if not set
      const albumImage = currentAlbum.album_image || song.song_image;

      const { error: updateError } = await supabase
        .from('albums')
        .update({
          album_songs: updatedSongs,
          album_song_data: updatedSongData,
          album_image: albumImage
        })
        .eq('album_id', albumId);

      if (updateError) {
        throw new Error(`Failed to update album: ${updateError.message}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding song to album:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async removeSongFromAlbum(albumId: string, songId: string): Promise<ServiceResponse<void>> {
    try {
      // Get current album data
      const { data: currentAlbum, error: fetchError } = await supabase
        .from('albums')
        .select('album_songs, album_song_data')
        .eq('album_id', albumId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch album: ${fetchError.message}`);
      }

      const currentSongs = currentAlbum.album_songs || [];
      const currentSongData = currentAlbum.album_song_data || [];
      
      // Remove song
      const updatedSongs = currentSongs.filter((id: string) => id !== songId);
      const updatedSongData = currentSongData.filter((song: AlbumSongData) => song.song_id !== songId);

      const { error: updateError } = await supabase
        .from('albums')
        .update({
          album_songs: updatedSongs,
          album_song_data: updatedSongData
        })
        .eq('album_id', albumId);

      if (updateError) {
        throw new Error(`Failed to update album: ${updateError.message}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing song from album:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getArtistAlbums(artistId: string): Promise<ServiceResponse<Album[]>> {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('artist_id', artistId)
        .eq('album_type', 'artist')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching artist albums:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getBandAlbums(bandId: string): Promise<ServiceResponse<Album[]>> {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('band_id', bandId)
        .eq('album_type', 'band')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching band albums:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async purchaseAlbum(albumId: string, purchaserId: string): Promise<ServiceResponse<AlbumPurchase>> {
    try {
      // Get album data first
      const { data: album, error: albumError } = await supabase
        .from('albums')
        .select(`
          *,
          artists:artist_id(artist_name),
          bands:band_id(band_name)
        `)
        .eq('album_id', albumId)
        .eq('album_status', 'active')
        .single();

      if (albumError) {
        throw new Error(`Album not found: ${albumError.message}`);
      }

      // Check if already purchased
      const { data: existingPurchase } = await supabase
        .from('album_purchases')
        .select('purchase_id')
        .eq('album_id', albumId)
        .eq('purchaser_id', purchaserId)
        .single();

      if (existingPurchase) {
        throw new Error('Album already purchased');
      }

      // Create purchase record
      const purchaseData = {
        album_id: albumId,
        purchaser_id: purchaserId,
        purchase_price: album.album_price,
        purchase_type: album.album_price === '0' ? 'free' : 'paid'
      };

      const { data: purchase, error: purchaseError } = await supabase
        .from('album_purchases')
        .insert([purchaseData])
        .select(`
          *,
          albums:album_id(
            album_title,
            album_image,
            album_type,
            album_song_data,
            artists:artist_id(artist_name),
            bands:band_id(band_name)
          )
        `)
        .single();

      if (purchaseError) {
        throw new Error(`Purchase failed: ${purchaseError.message}`);
      }

      // Format the response
      const formattedPurchase: AlbumPurchase = {
        purchase_id: purchase.purchase_id,
        album_id: purchase.album_id,
        purchaser_id: purchase.purchaser_id,
        purchase_price: purchase.purchase_price,
        purchase_date: purchase.purchase_date,
        purchase_type: purchase.purchase_type,
        album_title: purchase.albums.album_title,
        album_image: purchase.albums.album_image,
        album_type: purchase.albums.album_type,
        artist_name: purchase.albums.artists?.artist_name,
        band_name: purchase.albums.bands?.band_name,
        album_song_data: purchase.albums.album_song_data || []
      };

      return { success: true, data: formattedPurchase };
    } catch (error) {
      console.error('Error purchasing album:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getUserPurchasedAlbums(userId: string): Promise<ServiceResponse<AlbumPurchase[]>> {
    try {
      const { data, error } = await supabase
        .from('album_purchases')
        .select(`
          *,
          albums:album_id(
            album_title,
            album_image,
            album_type,
            album_song_data,
            artists:artist_id(artist_name),
            bands:band_id(band_name)
          )
        `)
        .eq('purchaser_id', userId)
        .order('purchase_date', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Format the response
      const formattedPurchases: AlbumPurchase[] = (data || []).map(purchase => ({
        purchase_id: purchase.purchase_id,
        album_id: purchase.album_id,
        purchaser_id: purchase.purchaser_id,
        purchase_price: purchase.purchase_price,
        purchase_date: purchase.purchase_date,
        purchase_type: purchase.purchase_type,
        album_title: purchase.albums.album_title,
        album_image: purchase.albums.album_image,
        album_type: purchase.albums.album_type,
        artist_name: purchase.albums.artists?.artist_name,
        band_name: purchase.albums.bands?.band_name,
        album_song_data: purchase.albums.album_song_data || []
      }));

      return { success: true, data: formattedPurchases };
    } catch (error) {
      console.error('Error fetching purchased albums:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async updateAlbumConsensus(
    albumId: string, 
    memberId: string, 
    decision: boolean
  ): Promise<ServiceResponse<Album>> {
    try {
      // Get current album consensus
      const { data: album, error: fetchError } = await supabase
        .from('albums')
        .select('album_consensus')
        .eq('album_id', albumId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch album: ${fetchError.message}`);
      }

      const consensus = album.album_consensus || [];
      
      // Update member's decision
      const updatedConsensus = consensus.map((member: any) => 
        member.member_id === memberId 
          ? { ...member, member_decision: decision }
          : member
      );

      // Check if all members have approved
      const allApproved = updatedConsensus.every((member: any) => member.member_decision === true);
      const newStatus = allApproved ? 'active' : 'pending';

      const { data: updatedAlbum, error: updateError } = await supabase
        .from('albums')
        .update({
          album_consensus: updatedConsensus,
          album_status: newStatus
        })
        .eq('album_id', albumId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update album: ${updateError.message}`);
      }

      return { success: true, data: updatedAlbum };
    } catch (error) {
      console.error('Error updating album consensus:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getPublicAlbums(): Promise<ServiceResponse<Album[]>> {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select(`
          *,
          artists:artist_id(artist_name),
          bands:band_id(band_name)
        `)
        .eq('album_status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching public albums:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const albumService = new AlbumService();