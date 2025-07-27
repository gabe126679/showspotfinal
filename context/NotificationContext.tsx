import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import NotificationToast from '../components/NotificationToast';

interface NotificationToastData {
  id: string;
  title: string;
  message: string;
  type?: 'default' | 'success' | 'warning' | 'error';
}

interface NotificationContextType {
  showToast: (notification: NotificationToastData) => void;
  showNotificationPage: boolean;
  setShowNotificationPage: (show: boolean) => void;
  unreadCount: number;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [toastQueue, setToastQueue] = useState<NotificationToastData[]>([]);
  const [showNotificationPage, setShowNotificationPage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUnreadCount();
      setupRealtimeSubscription();
    }
  }, [currentUser]);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!currentUser) return;
    
    try {
      const result = await notificationService.getUnreadCount(currentUser.id);
      if (result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!currentUser) return;

    const channel = notificationService.subscribeToNotifications(
      currentUser.id,
      (payload) => {
        console.log('New notification received:', payload);
        
        // Update unread count
        fetchUnreadCount();
        
        // Show toast notification
        if (payload.new) {
          const toastData: NotificationToastData = {
            id: payload.new.notification_id,
            title: payload.new.notification_title,
            message: payload.new.notification_message,
            type: 'default',
          };
          
          showToast(toastData);
        }
      }
    );

    return () => {
      notificationService.unsubscribeFromNotifications(channel);
    };
  };

  const showToast = (notification: NotificationToastData) => {
    setToastQueue(prev => [...prev, notification]);
  };

  const handleNotificationPress = (notification: NotificationToastData) => {
    // Navigate to notification details or mark as read
    console.log('Notification pressed:', notification);
    setShowNotificationPage(true);
  };

  const handleNotificationDismiss = (notificationId: string) => {
    setToastQueue(prev => prev.filter(n => n.id !== notificationId));
  };

  const refreshNotifications = () => {
    fetchUnreadCount();
  };

  const contextValue: NotificationContextType = {
    showToast,
    showNotificationPage,
    setShowNotificationPage,
    unreadCount,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationToast
        notifications={toastQueue}
        onNotificationPress={handleNotificationPress}
        onNotificationDismiss={handleNotificationDismiss}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};