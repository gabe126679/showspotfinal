import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import ShowSpotHeader from './ShowSpotHeader';
import { messagingService, Conversation, Message, SearchableEntity, EntityType } from '../services/messagingService';

const MessagesPage: React.FC = () => {
  const navigation = useNavigation();
  
  // Current user entity state
  const [currentEntity, setCurrentEntity] = useState<{ id: string; type: EntityType } | null>(null);
  
  // View states
  const [viewMode, setViewMode] = useState<'conversations' | 'chat'>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<{
    entityId: string;
    entityType: EntityType;
    entityName: string;
    entityImage?: string;
  } | null>(null);
  
  // Data states
  const [allConversations, setAllConversations] = useState<{ spotter: Conversation[], artist: Conversation[], venue: Conversation[] }>({ spotter: [], artist: [], venue: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<SearchableEntity[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  
  // Refs
  const messagesListRef = useRef<FlatList>(null);
  const messageSubscription = useRef<any>(null);

  useEffect(() => {
    loadCurrentEntity();
    
    return () => {
      if (messageSubscription.current) {
        messagingService.unsubscribeFromMessages(messageSubscription.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentEntity) {
      loadAllConversations();
      loadUnreadCount();
      subscribeToNewMessages();
    }
  }, [currentEntity]);

  useEffect(() => {
    if (viewMode === 'chat' && selectedConversation && currentEntity) {
      loadMessages();
      markAsRead();
    }
  }, [viewMode, selectedConversation]);

  const loadCurrentEntity = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        navigation.goBack();
        return;
      }

      const result = await messagingService.getCurrentEntity(sessionData.session.user.id);
      if (result.success && result.data) {
        setCurrentEntity(result.data);
      } else {
        console.error('Failed to get current entity:', result.error);
      }
    } catch (error) {
      console.error('Error loading current entity:', error);
    }
  };


  const loadAllConversations = async () => {
    if (!currentEntity) return;
    
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return;
      
      const result = await messagingService.getAllUserConversations(sessionData.session.user.id);
      
      if (result.success && result.data) {
        setAllConversations(result.data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMessages = async () => {
    if (!currentEntity || !selectedConversation) return;
    
    try {
      const result = await messagingService.getConversationMessages(
        currentEntity.id,
        currentEntity.type,
        selectedConversation.entityId,
        selectedConversation.entityType
      );
      
      if (result.success && result.data) {
        setMessages(result.data);
        // Scroll to bottom after loading messages
        setTimeout(() => {
          messagesListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadUnreadCount = async () => {
    if (!currentEntity) return;
    
    try {
      const result = await messagingService.getUnreadMessageCount(
        currentEntity.id,
        currentEntity.type
      );
      
      if (result.success && result.data !== undefined) {
        setUnreadCount(result.data);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const markAsRead = async () => {
    if (!currentEntity || !selectedConversation) return;
    
    try {
      await messagingService.markMessagesAsRead(
        currentEntity.id,
        currentEntity.type,
        selectedConversation.entityId,
        selectedConversation.entityType
      );
      
      // Update local unread count
      loadUnreadCount();
      
      // Update conversation list for all tabs
      setAllConversations(prevConversations => {
        const updated = { ...prevConversations };
        // Update the conversation in the appropriate entity type array
        for (const entityType of ['spotter', 'artist', 'venue'] as EntityType[]) {
          updated[entityType] = updated[entityType].map(conv =>
            conv.otherEntityId === selectedConversation.entityId
              ? { ...conv, unreadCount: 0 }
              : conv
          );
        }
        return updated;
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const subscribeToNewMessages = () => {
    if (!currentEntity) return;
    
    messageSubscription.current = messagingService.subscribeToMessages(
      currentEntity.id,
      currentEntity.type,
      (newMessage) => {
        // Update conversations list
        loadAllConversations();
        
        // If in chat with sender, add message to chat
        if (
          viewMode === 'chat' &&
          selectedConversation &&
          newMessage.sender_id === selectedConversation.entityId
        ) {
          const formattedMessage: Message = {
            messageId: newMessage.message_id,
            senderId: newMessage.sender_id,
            senderType: newMessage.sender_type,
            senderName: selectedConversation.entityName,
            senderImage: selectedConversation.entityImage,
            messageContent: newMessage.message_content,
            messageType: newMessage.message_type,
            isRead: false,
            createdAt: newMessage.created_at,
            isOwnMessage: false
          };
          
          setMessages(prev => [...prev, formattedMessage]);
          markAsRead();
        } else {
          // Update unread count
          loadUnreadCount();
        }
      }
    );
  };

  const sendMessage = async () => {
    if (!currentEntity || !selectedConversation || !messageText.trim() || sendingMessage) {
      return;
    }
    
    try {
      setSendingMessage(true);
      const result = await messagingService.sendMessage(
        currentEntity.id,
        currentEntity.type,
        selectedConversation.entityId,
        selectedConversation.entityType,
        messageText.trim()
      );
      
      if (result.success) {
        setMessageText('');
        
        // Add message to local state immediately
        const newMessage: Message = {
          messageId: result.data!.messageId,
          senderId: currentEntity.id,
          senderType: 'spotter',
          senderName: 'You',
          messageContent: messageText.trim(),
          messageType: 'text',
          isRead: true,
          createdAt: new Date().toISOString(),
          isOwnMessage: true
        };
        
        setMessages(prev => [...prev, newMessage]);
        messagesListRef.current?.scrollToEnd({ animated: true });
        
        // Update conversations
        loadAllConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const searchEntities = async (query: string) => {
    if (!currentEntity) return;
    
    setSearchQuery(query);
    
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    
    try {
      const result = await messagingService.searchMessageableEntities(
        query,
        currentEntity.id,
        currentEntity.type
      );
      
      if (result.success && result.data) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('Error searching entities:', error);
    }
  };

  const startNewConversation = async (entity: SearchableEntity) => {
    try {
      // Convert artist/venue to their spotter equivalent
      let spotterId = entity.entityId;
      let spotterName = entity.entityName;
      let spotterImage = entity.entityImage;

      if (entity.entityType === 'artist') {
        const { data: artist } = await supabase
          .from('artists')
          .select('spotter_id, spotters!inner(full_name, spotter_profile_picture)')
          .eq('artist_id', entity.entityId)
          .single();
        
        if (artist && artist.spotters) {
          spotterId = artist.spotter_id;
          spotterName = artist.spotters.full_name;
          spotterImage = artist.spotters.spotter_profile_picture;
        }
      } else if (entity.entityType === 'venue') {
        const { data: venue } = await supabase
          .from('venues')
          .select('spotter_id, spotters!inner(full_name, spotter_profile_picture)')
          .eq('venue_id', entity.entityId)
          .single();
        
        if (venue && venue.spotters) {
          spotterId = venue.spotter_id;
          spotterName = venue.spotters.full_name;
          spotterImage = venue.spotters.spotter_profile_picture;
        }
      }

      setSelectedConversation({
        entityId: spotterId,
        entityType: 'spotter',
        entityName: spotterName,
        entityImage: spotterImage
      });
      setShowSearchModal(false);
      setSearchQuery('');
      setSearchResults([]);
      setMessages([]);
      setViewMode('chat');
    } catch (error) {
      console.error('Error starting new conversation:', error);
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => {
        setSelectedConversation({
          entityId: item.otherEntityId,
          entityType: item.otherEntityType,
          entityName: item.otherEntityName,
          entityImage: item.otherEntityImage
        });
        setViewMode('chat');
      }}
    >
      <Image
        source={{ uri: item.otherEntityImage || 'https://via.placeholder.com/50' }}
        style={styles.conversationImage}
      />
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.otherEntityName}</Text>
          <Text style={styles.conversationTime}>
            {messagingService.formatMessageTime(item.lastMessageAt)}
          </Text>
        </View>
        <Text 
          style={[
            styles.conversationLastMessage,
            item.unreadCount > 0 && styles.unreadMessage
          ]} 
          numberOfLines={1}
        >
          {item.lastMessageSenderId === currentEntity?.id ? 'You: ' : ''}
          {messagingService.truncateMessage(item.lastMessage)}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {!item.isOwnMessage && (
        <Image
          source={{ uri: item.senderImage || 'https://via.placeholder.com/30' }}
          style={styles.messageAvatar}
        />
      )}
      <View style={[
        styles.messageBubble,
        item.isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
      ]}>
        <Text style={[
          styles.messageText,
          item.isOwnMessage ? styles.ownMessageText : styles.otherMessageText
        ]}>
          {item.messageContent}
        </Text>
        <Text style={styles.messageTime}>
          {messagingService.formatMessageTime(item.createdAt)}
        </Text>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: SearchableEntity }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => startNewConversation(item)}
    >
      <Image
        source={{ uri: item.entityImage || 'https://via.placeholder.com/50' }}
        style={styles.searchResultImage}
      />
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName}>{item.entityName}</Text>
        <Text style={styles.searchResultType}>
          {item.entityType.charAt(0).toUpperCase() + item.entityType.slice(1)}
          {item.entityLocation ? ` • ${item.entityLocation}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          title="Messages"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      <LinearGradient
        colors={["#2a2882", "#ff00ff"]}
        style={StyleSheet.absoluteFillObject}
      />
      
      {viewMode === 'conversations' ? (
        <>
          <ShowSpotHeader
            showBackButton={true}
            onBackPress={() => navigation.goBack()}
            title="Messages"
            rightButton={{
              icon: '+',
              onPress: () => setShowSearchModal(true)
            }}
          />
          
          
          <View style={styles.conversationsList}>
            {allConversations.spotter.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No conversations yet</Text>
                <TouchableOpacity
                  style={styles.newConversationButton}
                  onPress={() => setShowSearchModal(true)}
                >
                  <Text style={styles.newConversationButtonText}>
                    Start New Conversation
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={allConversations.spotter}
                renderItem={renderConversationItem}
                keyExtractor={(item) => item.conversationId}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      loadAllConversations();
                    }}
                    tintColor="#fff"
                  />
                }
              />
            )}
          </View>
          
          {/* Floating New Conversation Button */}
          <TouchableOpacity
            style={styles.floatingNewConversationButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Text style={styles.floatingButtonIcon}>+</Text>
            <Text style={styles.floatingButtonText}>New Chat</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ShowSpotHeader
            showBackButton={true}
            onBackPress={() => setViewMode('conversations')}
            title={selectedConversation?.entityName || 'Chat'}
          />
          
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
          >
            <FlatList
              ref={messagesListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.messageId}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => messagesListRef.current?.scrollToEnd()}
            />
            
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                multiline
                maxLength={5000}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!messageText.trim() || sendingMessage) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!messageText.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
      
      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.searchModalContainer}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>New Conversation</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <Text style={styles.searchCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={searchEntities}
              placeholder="Search by name..."
              placeholderTextColor="#999"
              autoFocus
            />
            
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => `${item.entityId}-${item.entityType}`}
              style={styles.searchResultsList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationsList: {
    flex: 1,
    backgroundColor: '#fff',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: '#ff00ff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  newConversationButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  newConversationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContent: {
    padding: 15,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownMessageBubble: {
    backgroundColor: '#ff00ff',
  },
  otherMessageBubble: {
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 5,
    opacity: 0.7,
  },
  messageInputContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#ff00ff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchCloseButton: {
    fontSize: 24,
    color: '#999',
  },
  searchInput: {
    margin: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultType: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff00ff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#ff00ff',
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: 5,
    right: 20,
    backgroundColor: '#ff00ff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  senderIdentityContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  senderIdentityLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  senderIdentityButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  senderIdentityButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectedSenderIdentity: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  senderIdentityButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedSenderIdentityText: {
    color: '#fff',
  },
  floatingNewConversationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#ff00ff',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingButtonIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MessagesPage;