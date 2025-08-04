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
  // Get current user's entity info (spotter, artist, or venue)
  async getCurrentEntity(userId: string): Promise<ServiceResponse<CurrentEntity>> {
    try {
      // First check if user is a spotter
      const { data: spotter } = await supabase
        .from('spotters')
        .select('spotter_id')
        .eq('spotter_id', userId)
        .single();

      if (spotter) {
        return { 
          success: true, 
          data: { id: spotter.spotter_id, type: 'spotter' }
        };
      }

      // Check if user is an artist
      const { data: artist } = await supabase
        .from('artists')
        .select('artist_id')
        .eq('spotter_id', userId)
        .single();

      if (artist) {
        return { 
          success: true, 
          data: { id: artist.artist_id, type: 'artist' }
        };
      }

      // Check if user is a venue
      const { data: venue } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('spotter_id', userId)
        .single();

      if (venue) {
        return { 
          success: true, 
          data: { id: venue.venue_id, type: 'venue' }
        };
      }

      return { 
        success: false, 
        error: 'No entity found for user' 
      };
    } catch (error) {
      console.error('Error getting current entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Send a message
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

      const { data, error } = await supabase
        .rpc('send_message', {
          sender_id_param: senderId,
          sender_type_param: senderType,
          recipient_id_param: recipientId,
          recipient_type_param: recipientType,
          message_content_param: messageContent.trim(),
          message_type_param: messageType
        });

      if (error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }

      return {
        success: true,
        data: { messageId: data }
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
          reader_id: readerId,
          reader_type: readerType,
          sender_id: senderId,
          sender_type: senderType
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
        throw new Error(`Failed to get unread count: ${error.message}`);
      }

      return {
        success: true,
        data: data || 0
      };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Search for entities to message
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

      const { data, error } = await supabase
        .rpc('search_messageable_entities', {
          search_query: searchQuery.trim(),
          searcher_id: searcherId,
          searcher_type: searcherType,
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