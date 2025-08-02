import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface SongPurchase {
  song_purchaser: string; // uuid
  stripe_payment_intent_id?: string; // optional for free songs
  song_price: string;
  song_id: string; // uuid
  song_title: string;
  song_type: 'artist' | 'band';
  song_artist: string; // uuid (artist_id or band_id)
  song_file: string;
  song_image: string;
  purchase_date: string; // ISO timestamp
  purchase_type: 'free' | 'paid';
  artist_name?: string; // for display purposes
  band_name?: string; // for display purposes
}

export interface SongWithPurchaseInfo {
  song_id: string;
  song_title: string;
  song_image: string;
  song_file: string;
  song_price: string;
  song_type: 'artist' | 'band';
  artist_id?: string;
  band_id?: string;
  artist_name?: string;
  band_name?: string;
  song_purchasers: SongPurchase[];
  created_at: string;
}

class SongPurchaseService {
  // Check if user has already purchased a song
  async hasUserPurchasedSong(songId: string, userId: string): Promise<{ success: boolean; hasPurchased?: boolean; error?: string }> {
    try {
      const { data: song, error } = await supabase
        .from('songs')
        .select('song_purchasers')
        .eq('song_id', songId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const purchasers = song.song_purchasers || [];
      const hasPurchased = purchasers.some((purchase: SongPurchase) => 
        purchase.song_purchaser === userId
      );

      return { success: true, hasPurchased };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Add free song to user's library
  async addFreeSong(songData: {
    song_id: string;
    song_title: string;
    song_image: string;
    song_file: string;
    song_type: 'artist' | 'band';
    song_artist: string;
    artist_name?: string;
    band_name?: string;
  }, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Adding free song to library:', songData);

      const purchaseData: SongPurchase = {
        song_purchaser: userId,
        song_price: '0',
        song_id: songData.song_id,
        song_title: songData.song_title,
        song_type: songData.song_type,
        song_artist: songData.song_artist,
        song_file: songData.song_file,
        song_image: songData.song_image,
        purchase_date: new Date().toISOString(),
        purchase_type: 'free',
        artist_name: songData.artist_name,
        band_name: songData.band_name,
      };

      // Add to song_purchasers jsonb array using concatenation
      const { data: currentSong } = await supabase
        .from('songs')
        .select('song_purchasers')
        .eq('song_id', songData.song_id)
        .single();

      const currentPurchasers = currentSong?.song_purchasers || [];
      const updatedPurchasers = [...currentPurchasers, purchaseData];

      const { error: updateError } = await supabase
        .from('songs')
        .update({
          song_purchasers: updatedPurchasers
        })
        .eq('song_id', songData.song_id);

      if (updateError) {
        console.error('Error updating song purchasers:', updateError);
        return { success: false, error: updateError.message };
      }

      // Send notification to artist/band
      await this.sendPurchaseNotification(songData, userId, 'free');

      console.log('Free song added successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Error adding free song:', error);
      return { success: false, error: error.message };
    }
  }

  // Purchase paid song
  async purchasePaidSong(songData: {
    song_id: string;
    song_title: string;
    song_image: string;
    song_file: string;
    song_price: string;
    song_type: 'artist' | 'band';
    song_artist: string;
    artist_name?: string;
    band_name?: string;
  }, userId: string, stripePaymentIntentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Processing paid song purchase:', songData);

      const purchaseData: SongPurchase = {
        song_purchaser: userId,
        stripe_payment_intent_id: stripePaymentIntentId,
        song_price: songData.song_price,
        song_id: songData.song_id,
        song_title: songData.song_title,
        song_type: songData.song_type,
        song_artist: songData.song_artist,
        song_file: songData.song_file,
        song_image: songData.song_image,
        purchase_date: new Date().toISOString(),
        purchase_type: 'paid',
        artist_name: songData.artist_name,
        band_name: songData.band_name,
      };

      // Add to song_purchasers jsonb array using concatenation
      const { data: currentSong } = await supabase
        .from('songs')
        .select('song_purchasers')
        .eq('song_id', songData.song_id)
        .single();

      const currentPurchasers = currentSong?.song_purchasers || [];
      const updatedPurchasers = [...currentPurchasers, purchaseData];

      const { error: updateError } = await supabase
        .from('songs')
        .update({
          song_purchasers: updatedPurchasers
        })
        .eq('song_id', songData.song_id);

      if (updateError) {
        console.error('Error updating song purchasers:', updateError);
        return { success: false, error: updateError.message };
      }

      // Create revenue records
      await this.createRevenueRecords(songData, userId, stripePaymentIntentId);

      // Send notification to artist/band
      await this.sendPurchaseNotification(songData, userId, 'paid');

      console.log('Paid song purchased successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Error purchasing paid song:', error);
      return { success: false, error: error.message };
    }
  }

  // Create revenue records for artists/band members
  private async createRevenueRecords(songData: {
    song_id: string;
    song_title: string;
    song_price: string;
    song_type: 'artist' | 'band';
    song_artist: string;
    artist_name?: string;
    band_name?: string;
  }, purchaserId: string, stripePaymentIntentId: string): Promise<void> {
    try {
      const songPrice = parseFloat(songData.song_price);

      if (songData.song_type === 'artist') {
        // Artist keeps 100% of revenue
        await supabase.from('song_revenues').insert({
          song_id: songData.song_id,
          purchaser_id: purchaserId,
          recipient_id: songData.song_artist,
          recipient_type: 'artist',
          song_price: songPrice,
          revenue_amount: songPrice,
          stripe_payment_intent_id: stripePaymentIntentId,
          purchase_type: 'paid',
          song_title: songData.song_title,
          artist_name: songData.artist_name,
          status: 'pending'
        });
      } else if (songData.song_type === 'band') {
        // Get band members and split revenue evenly
        const { data: band, error: bandError } = await supabase
          .from('bands')
          .select('band_members, band_name')
          .eq('band_id', songData.song_artist)
          .single();

        if (!bandError && band && band.band_members) {
          const memberCount = band.band_members.length;
          const revenuePerMember = songPrice / memberCount;

          // Create revenue record for each band member
          const revenueRecords = band.band_members.map((memberId: string) => ({
            song_id: songData.song_id,
            purchaser_id: purchaserId,
            recipient_id: memberId,
            recipient_type: 'band_member',
            song_price: songPrice,
            revenue_amount: revenuePerMember,
            stripe_payment_intent_id: stripePaymentIntentId,
            purchase_type: 'paid',
            song_title: songData.song_title,
            band_name: band.band_name,
            status: 'pending'
          }));

          await supabase.from('song_revenues').insert(revenueRecords);
        }
      }
    } catch (error) {
      console.error('Error creating revenue records:', error);
    }
  }

  // Send notification to artist/band members
  private async sendPurchaseNotification(songData: {
    song_id: string;
    song_title: string;
    song_type: 'artist' | 'band';
    song_artist: string;
    artist_name?: string;
    band_name?: string;
  }, purchaserId: string, purchaseType: 'free' | 'paid'): Promise<void> {
    try {
      // Get purchaser name
      const { data: purchaser } = await supabase
        .from('spotters')
        .select('full_name')
        .eq('id', purchaserId)
        .single();

      const purchaserName = purchaser?.full_name || 'A spotter';

      if (songData.song_type === 'artist') {
        // Send notification to artist
        await supabase.from('notifications').insert({
          notification_type: 'song_purchased',
          notification_recipient: songData.song_artist,
          notification_sender: purchaserId,
          notification_title: 'Song Purchased!',
          notification_message: `${purchaserName} ${purchaseType === 'free' ? 'added' : 'purchased'} your song "${songData.song_title}"`,
          notification_data: {
            song_id: songData.song_id,
            song_title: songData.song_title,
            purchaser_id: purchaserId,
            purchaser_name: purchaserName,
            purchase_type: purchaseType,
            artist_name: songData.artist_name
          },
          is_read: false,
          action_required: false
        });
      } else if (songData.song_type === 'band') {
        // Send notification to all band members
        const { data: band } = await supabase
          .from('bands')
          .select('band_members')
          .eq('band_id', songData.song_artist)
          .single();

        if (band && band.band_members) {
          const notifications = band.band_members.map((memberId: string) => ({
            notification_type: 'song_purchased',
            notification_recipient: memberId,
            notification_sender: purchaserId,
            notification_title: 'Band Song Purchased!',
            notification_message: `${purchaserName} ${purchaseType === 'free' ? 'added' : 'purchased'} your band's song "${songData.song_title}"`,
            notification_data: {
              song_id: songData.song_id,
              song_title: songData.song_title,
              purchaser_id: purchaserId,
              purchaser_name: purchaserName,
              purchase_type: purchaseType,
              band_name: songData.band_name,
              band_id: songData.song_artist
            },
            is_read: false,
            action_required: false
          }));

          await supabase.from('notifications').insert(notifications);
        }
      }
    } catch (error) {
      console.error('Error sending purchase notification:', error);
    }
  }

  // Get user's purchased songs
  async getUserPurchasedSongs(userId: string): Promise<{ success: boolean; songs?: SongPurchase[]; error?: string }> {
    try {
      const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .not('song_purchasers', 'is', null);

      if (error) {
        return { success: false, error: error.message };
      }

      const purchasedSongs: SongPurchase[] = [];

      songs?.forEach(song => {
        const purchasers = song.song_purchasers || [];
        const userPurchases = purchasers.filter((purchase: SongPurchase) => 
          purchase.song_purchaser === userId
        );
        purchasedSongs.push(...userPurchases);
      });

      return { success: true, songs: purchasedSongs };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Get song purchase statistics
  async getSongPurchaseStats(songId: string): Promise<{ 
    success: boolean; 
    stats?: { totalPurchases: number; freeDownloads: number; paidPurchases: number; totalRevenue: number }; 
    error?: string 
  }> {
    try {
      const { data: song, error } = await supabase
        .from('songs')
        .select('song_purchasers, song_price')
        .eq('song_id', songId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const purchasers = song.song_purchasers || [];
      const totalPurchases = purchasers.length;
      const freeDownloads = purchasers.filter((p: SongPurchase) => p.purchase_type === 'free').length;
      const paidPurchases = purchasers.filter((p: SongPurchase) => p.purchase_type === 'paid').length;
      const totalRevenue = paidPurchases * parseFloat(song.song_price || '0');

      return {
        success: true,
        stats: { totalPurchases, freeDownloads, paidPurchases, totalRevenue }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const songPurchaseService = new SongPurchaseService();