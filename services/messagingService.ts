import { supabase } from '../lib/supabase';

export type EntityType = 'spotter' | 'artist' | 'venue';
export type MessageType = 'text' | 'system' | 'notification';

export interface Message {
  messageId: string;
  senderId: string;
  senderType: EntityType;
  senderName: string;
  senderImage?: string;
  messageContent: string;
  messageType: MessageType;
  isRead: boolean;
  createdAt: string;
  isOwnMessage: boolean;
}

export interface Conversation {
  conversationId: string;
  otherEntityId: string;
  otherEntityType: EntityType;
  otherEntityName: string;
  otherEntityImage?: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadCount: number;
}

export interface SearchableEntity {
  entityId: string;
  entityType: EntityType;
  entityName: string;
  entityImage?: string;
  entityLocation?: string;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CurrentEntity {
  id: string;
  type: EntityType;
}

class MessagingService {
  // Get current user's entity info - ALWAYS returns spotter for viewing messages
  async getCurrentEntity(userId: string): Promise<ServiceResponse<CurrentEntity>> {
    try {
      // According to requirements: all users receive messages as spotters
      const { data: spotter } = await supabase
        .from('spotters')
        .select('id')
        .eq('id', userId)
        .single();

      if (spotter) {
        return { 
          success: true, 
          data: { id: spotter.id, type: 'spotter' }
        };
      }

      return { 
        success: false, 
        error: 'No spotter found for user' 
      };
    } catch (error) {
      console.error('Error getting current entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get all possible sender identities for a user
  async getUserIdentities(userId: string): Promise<ServiceResponse<CurrentEntity[]>> {
    try {
      const identities: CurrentEntity[] = [];

      // Check spotter
      const { data: spotter } = await supabase
        .from('spotters')
        .select('id')
        .eq('id', userId)
        .single();

      if (spotter) {
        identities.push({ id: spotter.id, type: 'spotter' });
      }

      // Check artist
      const { data: artist } = await supabase
        .from('artists')
        .select('artist_id')
        .eq('spotter_id', userId)
        .single();

      if (artist) {
        identities.push({ id: artist.artist_id, type: 'artist' });
      }

      // Check venue
      const { data: venue } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('spotter_id', userId)
        .single();

      if (venue) {
        identities.push({ id: venue.venue_id, type: 'venue' });
      }

      return { 
        success: true, 
        data: identities 
      };
    } catch (error) {
      console.error('Error getting user identities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get conversations for all user's entity types
  async getAllUserConversations(
    userId: string,
    limit: number = 50
  ): Promise<ServiceResponse<{ spotter: Conversation[], artist: Conversation[], venue: Conversation[] }>> {
    try {
      const result = { spotter: [] as Conversation[], artist: [] as Conversation[], venue: [] as Conversation[] };
      
      // Get user identities
      const identitiesResult = await this.getUserIdentities(userId);
      if (!identitiesResult.success || !identitiesResult.data) {
        return { success: false, error: 'Failed to get user identities' };
      }

      // Get conversations for each identity
      for (const identity of identitiesResult.data) {
        const convResult = await this.getEntityConversations(identity.id, identity.type, limit);
        if (convResult.success && convResult.data) {
          result[identity.type] = convResult.data;
        }
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('Error getting all user conversations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Send a message - Always converts to spotter-to-spotter messaging
  async sendMessage(
    senderId: string,
    senderType: EntityType,
    recipientId: string,
    recipientType: EntityType,
    messageContent: string,
    messageType: MessageType = 'text'
  ): Promise<ServiceResponse<{ messageId: string }>> {
    try {
      // Validate message content
      if (!messageContent || messageContent.trim().length === 0) {
        return { success: false, error: 'Message cannot be empty' };
      }

      if (messageContent.length > 5000) {
        return { success: false, error: 'Message is too long (max 5000 characters)' };
      }

      // Convert both sender and recipient to their spotter IDs
      let actualSenderId = senderId;
      let actualRecipientId = recipientId;

      // Get sender spotter ID
      if (senderType === 'artist') {
        const { data: artist } = await supabase
          .from('artists')
          .select('spotter_id')
          .eq('artist_id', senderId)
          .single();
        if (artist) actualSenderId = artist.spotter_id;
      } else if (senderType === 'venue') {
        const { data: venue } = await supabase
          .from('venues')
          .select('spotter_id')
          .eq('venue_id', senderId)
          .single();
        if (venue) actualSenderId = venue.spotter_id;
      }

      // Get recipient spotter ID
      if (recipientType === 'artist') {
        const { data: artist } = await supabase
          .from('artists')
          .select('spotter_id')
          .eq('artist_id', recipientId)
          .single();
        if (artist) actualRecipientId = artist.spotter_id;
      } else if (recipientType === 'venue') {
        const { data: venue } = await supabase
          .from('venues')
          .select('spotter_id')
          .eq('venue_id', recipientId)
          .single();
        if (venue) actualRecipientId = venue.spotter_id;
      }

      // Send message directly to messages table (spotter to spotter)
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: actualSenderId,
          sender_type: 'spotter',
          recipient_id: actualRecipientId,
          recipient_type: 'spotter',
          message_content: messageContent.trim(),
          message_type: messageType,
          // Save original intent for data preservation
          intended_sender_id: senderId,
          intended_sender_type: senderType,
          intended_recipient_id: recipientId,
          intended_recipient_type: recipientType
        })
        .select('message_id')
        .single();

      if (error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }

      return {
        success: true,
        data: { messageId: data.message_id }
      };
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get conversations for an entity
  async getEntityConversations(
    entityId: string,
    entityType: EntityType,
    limit: number = 50
  ): Promise<ServiceResponse<Conversation[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_entity_conversations', {
          entity_id: entityId,
          entity_type: entityType,
          limit_count: limit
        });

      if (error) {
        throw new Error(`Failed to get conversations: ${error.message}`);
      }

      const conversations: Conversation[] = data?.map((conv: any) => ({
        conversationId: conv.conversation_id,
        otherEntityId: conv.other_entity_id,
        otherEntityType: conv.other_entity_type,
        otherEntityName: conv.other_entity_name,
        otherEntityImage: conv.other_entity_image,
        lastMessage: conv.last_message,
        lastMessageAt: conv.last_message_at,
        lastMessageSenderId: conv.last_message_sender_id,
        unreadCount: conv.unread_count || 0
      })) || [];

      return { success: true, data: conversations };
    } catch (error) {
      console.error('Error getting conversations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get messages in a conversation
  async getConversationMessages(
    entity1Id: string,
    entity1Type: EntityType,
    entity2Id: string,
    entity2Type: EntityType,
    limit: number = 100,
    offset: number = 0
  ): Promise<ServiceResponse<Message[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_conversation_messages', {
          entity_1_id: entity1Id,
          entity_1_type: entity1Type,
          entity_2_id: entity2Id,
          entity_2_type: entity2Type,
          limit_count: limit,
          offset_count: offset
        });

      if (error) {
        throw new Error(`Failed to get messages: ${error.message}`);
      }

      const messages: Message[] = data?.map((msg: any) => ({
        messageId: msg.message_id,
        senderId: msg.sender_id,
        senderType: msg.sender_type,
        senderName: msg.sender_name,
        senderImage: msg.sender_image,
        messageContent: msg.message_content,
        messageType: msg.message_type,
        isRead: msg.is_read,
        createdAt: msg.created_at,
        isOwnMessage: msg.is_own_message
      })) || [];

      // Messages come in DESC order from DB, reverse for display
      return { success: true, data: messages.reverse() };
    } catch (error) {
      console.error('Error getting messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }


  // Mark messages as read
  async markMessagesAsRead(
    readerId: string,
    readerType: EntityType,
    senderId: string,
    senderType: EntityType
  ): Promise<ServiceResponse<number>> {
    try {
      const { data, error } = await supabase
        .rpc('mark_messages_as_read', {
          reader_id_param: readerId,
          reader_type_param: readerType,
          sender_id_param: senderId,
          sender_type_param: senderType
        });

      if (error) {
        throw new Error(`Failed to mark messages as read: ${error.message}`);
      }

      return {
        success: true,
        data: data || 0
      };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get unread message count
  async getUnreadMessageCount(
    entityId: string,
    entityType: EntityType
  ): Promise<ServiceResponse<number>> {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_message_count', {
          entity_id: entityId,
          entity_type: entityType
        });

      if (error) {
        // Check if it's a network error and handle gracefully
        if (error.message?.includes('Network request failed') || 
            error.message?.includes('fetch failed')) {
          // Return 0 count silently for network errors (common in dev)
          return {
            success: true,
            data: 0
          };
        }
        throw new Error(`Failed to get unread count: ${error.message}`);
      }

      return {
        success: true,
        data: data || 0
      };
    } catch (error) {
      // Check for network errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('Network request failed') || 
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('TypeError')) {
        // Return 0 count silently for network errors (common in dev)
        return {
          success: true,
          data: 0
        };
      }
      
      // Only log non-network errors
      console.error('Error getting unread count:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Search for entities to message - SPOTTERS ONLY
  async searchMessageableEntities(
    searchQuery: string,
    searcherId: string,
    searcherType: EntityType,
    limit: number = 20
  ): Promise<ServiceResponse<SearchableEntity[]>> {
    try {
      if (!searchQuery || searchQuery.trim().length === 0) {
        return { success: true, data: [] };
      }

      // Only search for spotters regardless of who is searching
      const { data, error } = await supabase
        .rpc('search_messageable_spotters', {
          search_query: searchQuery.trim(),
          searcher_id: searcherId,
          limit_count: limit
        });

      if (error) {
        throw new Error(`Failed to search entities: ${error.message}`);
      }

      const entities: SearchableEntity[] = data?.map((entity: any) => ({
        entityId: entity.entity_id,
        entityType: entity.entity_type,
        entityName: entity.entity_name,
        entityImage: entity.entity_image,
        entityLocation: entity.entity_location
      })) || [];

      return { success: true, data: entities };
    } catch (error) {
      console.error('Error searching entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Format timestamp for display
  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  // Format long messages for preview
  truncateMessage(message: string, maxLength: number = 50): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  // Subscribe to new messages (real-time)
  subscribeToMessages(
    entityId: string,
    entityType: EntityType,
    onNewMessage: (message: any) => void
  ) {
    const subscription = supabase
      .channel(`messages:${entityId}:${entityType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${entityId}`
        },
        (payload) => {
          if (payload.new.recipient_type === entityType) {
            onNewMessage(payload.new);
          }
        }
      )
      .subscribe();

    return subscription;
  }

  // Unsubscribe from messages
  unsubscribeFromMessages(subscription: any) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
}

export const messagingService = new MessagingService();