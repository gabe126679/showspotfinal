import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface TicketData {
  ticket_id?: string;
  show_id: string;
  purchaser_id: string;
  ticket_price: string;
  purchase_type?: string;
  qr_code: string;
  qr_code_data: any;
  ticket_status?: string;
  stripe_payment_intent_id?: string;
  payment_status?: string;
}

export interface Ticket {
  ticket_id: string;
  show_id: string;
  purchaser_id: string;
  ticket_price: string;
  purchase_type: string;
  qr_code: string;
  qr_code_data: any;
  ticket_status: string;
  scanned_at?: string;
  scanned_by?: string;
  stripe_payment_intent_id?: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export interface TicketWithShow extends Ticket {
  shows: {
    show_id: string;
    venue_name?: string;
    show_date?: string;
    show_time?: string;
    show_status: string;
    venues?: {
      venue_name: string;
      venue_profile_image?: string;
    };
  };
}

class TicketService {
  // Create a new ticket after successful payment
  async createTicket(ticketData: TicketData): Promise<{ success: boolean; error?: string; data?: Ticket }> {
    try {
      console.log('Creating ticket:', ticketData);

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert([{
          show_id: ticketData.show_id,
          purchaser_id: ticketData.purchaser_id,
          ticket_price: ticketData.ticket_price,
          purchase_type: ticketData.purchase_type || 'spotter show',
          qr_code: ticketData.qr_code,
          qr_code_data: ticketData.qr_code_data,
          ticket_status: ticketData.ticket_status || 'purchased',
          stripe_payment_intent_id: ticketData.stripe_payment_intent_id,
          payment_status: ticketData.payment_status || 'active',
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket:', error);
        return { success: false, error: error.message };
      }

      console.log('Ticket created successfully:', ticket);
      return { success: true, data: ticket };
    } catch (error: any) {
      console.error('Unexpected error creating ticket:', error);
      return { success: false, error: error.message };
    }
  }

  // Add purchaser to show's ticket_purchasers array
  async addPurchaserToShow(showId: string, purchaserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Adding purchaser to show:', { showId, purchaserId });

      // First get the current show data
      const { data: show, error: fetchError } = await supabase
        .from('shows')
        .select('show_ticket_purchasers, venues:show_venue(venue_max_cap)')
        .eq('show_id', showId)
        .single();

      if (fetchError) {
        console.error('Error fetching show:', fetchError);
        return { success: false, error: fetchError.message };
      }

      // Add purchaser to array (avoid duplicates)
      const currentPurchasers = show.show_ticket_purchasers || [];
      if (!currentPurchasers.includes(purchaserId)) {
        currentPurchasers.push(purchaserId);
      }

      // Check if show should be marked as sold out
      const venueCapacity = show.venues?.venue_max_cap || 0;
      const shouldMarkSoldOut = currentPurchasers.length >= venueCapacity;
      
      // Update show with new purchaser and potentially sold out status
      const updateData: any = {
        show_ticket_purchasers: currentPurchasers
      };

      if (shouldMarkSoldOut) {
        updateData.show_status = 'sold out';
        console.log('Show is now sold out!');
      }

      console.log('Updating show with data:', updateData);
      const { error: updateError } = await supabase
        .from('shows')
        .update(updateData)
        .eq('show_id', showId);
      
      console.log('Update result - error:', updateError);

      if (updateError) {
        console.error('Error updating show:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('Successfully added purchaser to show');
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error adding purchaser to show:', error);
      return { success: false, error: error.message };
    }
  }

  // Get tickets for a specific user (for their profile)
  async getUserTickets(userId: string): Promise<{ success: boolean; error?: string; data?: TicketWithShow[] }> {
    try {
      console.log('Fetching tickets for user:', userId);

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
          *,
          shows:show_id (
            show_id,
            show_date,
            show_time,
            show_status,
            venues:show_venue (
              venue_name,
              venue_profile_image
            )
          )
        `)
        .eq('purchaser_id', userId)
        .eq('payment_status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user tickets:', error);
        return { success: false, error: error.message };
      }

      console.log('User tickets fetched:', tickets?.length || 0);
      return { success: true, data: tickets || [] };
    } catch (error: any) {
      console.error('Unexpected error fetching user tickets:', error);
      return { success: false, error: error.message };
    }
  }

  // Get ticket sales info for a show (for venue/show bill)
  async getShowTicketInfo(showId: string): Promise<{ success: boolean; error?: string; data?: { ticketsSold: number; capacity: number; isSoldOut: boolean } }> {
    try {
      console.log('Fetching ticket info for show:', showId);

      const { data: show, error } = await supabase
        .from('shows')
        .select(`
          show_ticket_purchasers,
          show_status,
          venues:show_venue (
            venue_max_cap
          )
        `)
        .eq('show_id', showId)
        .single();

      if (error) {
        console.error('Error fetching show ticket info:', error);
        return { success: false, error: error.message };
      }

      const ticketsSold = show.show_ticket_purchasers?.length || 0;
      const capacity = show.venues?.venue_max_cap || 0;
      const isSoldOut = show.show_status === 'sold out';

      console.log('Show ticket info:', { ticketsSold, capacity, isSoldOut });
      return { 
        success: true, 
        data: { ticketsSold, capacity, isSoldOut }
      };
    } catch (error: any) {
      console.error('Unexpected error fetching show ticket info:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate QR code data for a ticket
  generateQRCodeData(ticket: Ticket): any {
    return {
      ticket_id: ticket.ticket_id,
      show_id: ticket.show_id,
      purchaser_id: ticket.purchaser_id,
      ticket_price: ticket.ticket_price,
      created_at: ticket.created_at,
      // Add verification hash to prevent forgery
      verification_hash: this.generateVerificationHash(ticket)
    };
  }

  // Generate verification hash for QR code security
  private generateVerificationHash(ticket: Ticket): string {
    // Simple hash based on ticket data - in production you'd use a proper cryptographic hash
    const dataString = `${ticket.ticket_id}-${ticket.show_id}-${ticket.purchaser_id}-${ticket.created_at}`;
    return btoa(dataString).slice(0, 16);
  }

  // Validate QR code data (for scanning)
  validateQRCode(qrData: any, ticket: Ticket): boolean {
    try {
      const expectedHash = this.generateVerificationHash(ticket);
      return qrData.verification_hash === expectedHash &&
             qrData.ticket_id === ticket.ticket_id &&
             qrData.show_id === ticket.show_id;
    } catch (error) {
      console.error('Error validating QR code:', error);
      return false;
    }
  }

  // Mark ticket as scanned
  async scanTicket(ticketId: string, scannedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Scanning ticket:', { ticketId, scannedBy });

      const { error } = await supabase
        .from('tickets')
        .update({
          scanned_at: new Date().toISOString(),
          scanned_by: scannedBy,
          ticket_status: 'scanned'
        })
        .eq('ticket_id', ticketId);

      if (error) {
        console.error('Error scanning ticket:', error);
        return { success: false, error: error.message };
      }

      console.log('Ticket scanned successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error scanning ticket:', error);
      return { success: false, error: error.message };
    }
  }
}

export const ticketService = new TicketService();