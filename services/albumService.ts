import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';

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
            member_decision: memberId === artistId // Set true for the uploader
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

      // Send notifications for band albums
      if (albumType === 'band' && bandId && data) {
        try {
          // Get current user info
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const uploaderName = await notificationService.getUserFullName(user.id);
            
            // Get band name
            const { data: bandData } = await supabase
              .from('bands')
              .select('band_name')
              .eq('band_id', bandId)
              .single();

            const bandName = bandData?.band_name || 'Band';

            // Send consensus notifications to all band members
            const notificationResult = await notificationService.createBandAlbumConsensusNotification(
              user.id,
              uploaderName,
              bandId,
              bandName,
              data.album_id,
              albumTitle,
              data
            );

            if (!notificationResult.success) {
              console.warn('Failed to send some album consensus notifications:', notificationResult.error);
            }
          }
        } catch (notificationError) {
          console.error('Error sending album consensus notifications:', notificationError);
          // Don't fail the album creation if notifications fail
        }
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
        .select('*')
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

      // Get artist or band name
      let artistName: string | undefined;
      let bandName: string | undefined;

      if (album.album_type === 'artist' && album.artist_id) {
        const { data: artist } = await supabase
          .from('artists')
          .select('artist_name')
          .eq('artist_id', album.artist_id)
          .single();
        artistName = artist?.artist_name;
      } else if (album.album_type === 'band' && album.band_id) {
        const { data: band } = await supabase
          .from('bands')
          .select('band_name')
          .eq('band_id', album.band_id)
          .single();
        bandName = band?.band_name;
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
        .select('*')
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
        album_title: album.album_title,
        album_image: album.album_image,
        album_type: album.album_type,
        artist_name: artistName,
        band_name: bandName,
        album_song_data: album.album_song_data || []
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
      // First, get the album purchases
      const { data: purchases, error: purchasesError } = await supabase
        .from('album_purchases')
        .select('*')
        .eq('purchaser_id', userId)
        .order('purchase_date', { ascending: false });

      if (purchasesError) {
        throw new Error(`Database error: ${purchasesError.message}`);
      }

      if (!purchases || purchases.length === 0) {
        return { success: true, data: [] };
      }

      // Get album details separately
      const albumIds = purchases.map(p => p.album_id);
      const { data: albums, error: albumsError } = await supabase
        .from('albums')
        .select('*')
        .in('album_id', albumIds);

      if (albumsError) {
        throw new Error(`Database error: ${albumsError.message}`);
      }

      // Get artist and band names separately
      const artistIds = albums?.filter(a => a.artist_id && a.album_type === 'artist').map(a => a.artist_id) || [];
      const bandIds = albums?.filter(a => a.band_id && a.album_type === 'band').map(a => a.band_id) || [];

      let artists: any[] = [];
      let bands: any[] = [];

      if (artistIds.length > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('artist_id, artist_name')
          .in('artist_id', artistIds);
        artists = artistsData || [];
      }

      if (bandIds.length > 0) {
        const { data: bandsData } = await supabase
          .from('bands')
          .select('band_id, band_name')
          .in('band_id', bandIds);
        bands = bandsData || [];
      }

      // Format the response by combining the data
      const formattedPurchases: AlbumPurchase[] = purchases.map(purchase => {
        const album = albums?.find(a => a.album_id === purchase.album_id);
        if (!album) {
          return {
            purchase_id: purchase.purchase_id,
            album_id: purchase.album_id,
            purchaser_id: purchase.purchaser_id,
            purchase_price: purchase.purchase_price,
            purchase_date: purchase.purchase_date,
            purchase_type: purchase.purchase_type,
            album_title: 'Unknown Album',
            album_image: '',
            album_type: 'artist',
            album_song_data: []
          };
        }

        const artist = album.album_type === 'artist' ? artists.find(a => a.artist_id === album.artist_id) : null;
        const band = album.album_type === 'band' ? bands.find(b => b.band_id === album.band_id) : null;

        return {
          purchase_id: purchase.purchase_id,
          album_id: purchase.album_id,
          purchaser_id: purchase.purchaser_id,
          purchase_price: purchase.purchase_price,
          purchase_date: purchase.purchase_date,
          purchase_type: purchase.purchase_type,
          album_title: album.album_title,
          album_image: album.album_image,
          album_type: album.album_type,
          artist_name: artist?.artist_name,
          band_name: band?.band_name,
          album_song_data: album.album_song_data || []
        };
      });

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

      // Send notifications based on consensus change
      if (updatedAlbum.album_type === 'band') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const memberName = await notificationService.getUserFullName(user.id);
            
            // Get album and band details for notifications
            const { data: bandData } = await supabase
              .from('bands')
              .select('band_name')
              .eq('band_id', updatedAlbum.band_id)
              .single();

            const bandName = bandData?.band_name || 'Band';

            if (!decision) {
              // Album was rejected - notify the original uploader
              // Find who uploaded the album (first person to approve, or get from album creation audit)
              // For now, we'll send a general rejection notification
              const hasRejection = updatedConsensus.some((member: any) => member.member_decision === false);
              if (hasRejection) {
                // Note: In a full implementation, you'd want to track who originally created the album
                // For now, this will be handled at the UI level when rejecting
                console.log('Album rejected - rejection notifications handled at UI level');
              }
            } else if (allApproved) {
              // All members approved - album is now active
              await notificationService.createBandAlbumApprovedNotifications(
                updatedAlbum.album_id,
                updatedAlbum.album_title,
                updatedAlbum.band_id,
                bandName
              );
            }
          }
        } catch (notificationError) {
          console.error('Error sending album consensus notifications:', notificationError);
          // Don't fail the update if notifications fail
        }
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
      const { data: albums, error } = await supabase
        .from('albums')
        .select('*')
        .eq('album_status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!albums || albums.length === 0) {
        return { success: true, data: [] };
      }

      // Get artist and band names separately
      const artistIds = albums.filter(a => a.artist_id && a.album_type === 'artist').map(a => a.artist_id);
      const bandIds = albums.filter(a => a.band_id && a.album_type === 'band').map(a => a.band_id);

      let artists: any[] = [];
      let bands: any[] = [];

      if (artistIds.length > 0) {
        const { data: artistsData } = await supabase
          .from('artists')
          .select('artist_id, artist_name')
          .in('artist_id', artistIds);
        artists = artistsData || [];
      }

      if (bandIds.length > 0) {
        const { data: bandsData } = await supabase
          .from('bands')
          .select('band_id, band_name')
          .in('band_id', bandIds);
        bands = bandsData || [];
      }

      // Add names to albums
      const albumsWithNames = albums.map(album => {
        const artist = album.album_type === 'artist' ? artists.find(a => a.artist_id === album.artist_id) : null;
        const band = album.album_type === 'band' ? bands.find(b => b.band_id === album.band_id) : null;
        
        return {
          ...album,
          artist_name: artist?.artist_name,
          band_name: band?.band_name
        };
      });

      return { success: true, data: albumsWithNames };
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