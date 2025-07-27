import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import NotificationsPage from './NotificationsPage';
import NotificationToast from './NotificationToast';

interface NotificationToastData {
  id: string;
  title: string;
  message: string;
  type?: 'default' | 'success' | 'warning' | 'error';
}

interface NotificationManagerProps {
  showNotificationPage: boolean;
  onCloseNotificationPage: () => void;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({
  showNotificationPage,
  onCloseNotificationPage,
}) => {
  const [toastQueue, setToastQueue] = useState<NotificationToastData[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const showToast = useCallback((notification: any) => {
    const toastData: NotificationToastData = {
      id: notification.notification_id,
      title: notification.notification_title,
      message: notification.notification_message,
      type: 'default',
    };
    
    console.log('🍞 Manually adding toast to queue:', toastData);
    setToastQueue(prev => [...prev, toastData]);
    
    // Auto-remove after display time to prevent re-renders
    setTimeout(() => {
      setToastQueue(prev => prev.filter(n => n.id !== notification.notification_id));
    }, 5000); // 5 seconds total (4s display + 1s buffer)
  }, []);

  useEffect(() => {
    if (currentUser) {
      // Set up manual toast trigger function that other components can call
      (global as any).showNotificationToast = showToast;
    }
  }, [currentUser, showToast]);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('👤 NotificationManager got current user:', session.user.id);
        setCurrentUser(session.user);
      }
    } catch (error) {
      console.error('Error getting current user in NotificationManager:', error);
    }
  };


  const handleNotificationPress = (notification: NotificationToastData) => {
    console.log('Toast notification pressed:', notification);
    // You can navigate to notification details or mark as read here
    setToastQueue(prev => prev.filter(n => n.id !== notification.id));
  };

  const handleNotificationDismiss = (notificationId: string) => {
    setToastQueue(prev => prev.filter(n => n.id !== notificationId));
  };

  return (
    <>
      {/* Toast Notifications */}
      <NotificationToast
        notifications={toastQueue}
        onNotificationPress={handleNotificationPress}
        onNotificationDismiss={handleNotificationDismiss}
      />
      
      {/* Full Screen Notifications Page */}
      <Modal
        visible={showNotificationPage}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <NotificationsPage onClose={onCloseNotificationPage} />
      </Modal>
    </>
  );
};

export default NotificationManager;