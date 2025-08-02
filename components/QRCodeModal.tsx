import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { TicketWithShow } from '../services/ticketService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  ticket: TicketWithShow | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  visible,
  onClose,
  ticket,
}) => {
  if (!ticket) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    return ` at ${timeString}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#2a2882', '#ff00ff']}
            style={styles.modalGradient}
          >
            <Text style={styles.modalTitle}>Your Ticket</Text>
            
            <View style={styles.ticketInfo}>
              <Text style={styles.showTitle}>
                {ticket.shows.venues?.venue_name || 'Venue TBD'}
              </Text>
              <Text style={styles.showDetails}>
                {formatDate(ticket.shows.show_date)}
                {formatTime(ticket.shows.show_time)}
              </Text>
              <Text style={styles.priceText}>${ticket.ticket_price}</Text>
              <Text style={styles.statusText}>
                Status: {ticket.ticket_status === 'scanned' ? 'Used' : 'Valid'}
              </Text>
            </View>

            <View style={styles.qrContainer}>
              <View style={styles.qrBackground}>
                <QRCode
                  value={ticket.qr_code}
                  size={200}
                  backgroundColor="white"
                  color="black"
                />
              </View>
              <Text style={styles.qrInstructions}>
                Show this QR code at the venue entrance to gain entry
              </Text>
            </View>

            <View style={styles.ticketDetails}>
              <Text style={styles.detailText}>
                Ticket ID: {ticket.ticket_id.slice(0, 8)}...
              </Text>
              <Text style={styles.detailText}>
                Purchased: {new Date(ticket.created_at).toLocaleDateString()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH - 40,
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalGradient: {
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  ticketInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  showTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  showDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff00',
    textAlign: 'center',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrBackground: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
  },
  qrInstructions: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  ticketDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  detailText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 5,
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default QRCodeModal;