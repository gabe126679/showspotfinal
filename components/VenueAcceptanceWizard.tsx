import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';

interface VenueAcceptanceWizardProps {
  route: {
    params: {
      show_id: string;
    };
  };
}

interface ShowData {
  show_id: string;
  show_preferred_date: string;
  show_preferred_time: string;
  show_members: any[];
  show_venue: string;
  show_promoter: string;
  venue_name?: string;
  venue_capacity?: number;
}

const VenueAcceptanceWizard: React.FC<VenueAcceptanceWizardProps> = ({ route }) => {
  console.log('VenueAcceptanceWizard mounted with route:', route);
  
  const { show_id } = route.params || {};
  const navigation = useNavigation();
  const [showData, setShowData] = useState<ShowData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [ticketPrice, setTicketPrice] = useState<number>(15);
  const [venuePercentage, setVenuePercentage] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);
  const totalSteps = 3;

  useEffect(() => {
    if (!show_id) {
      console.error('No show_id provided to VenueAcceptanceWizard');
      Alert.alert('Error', 'No show ID provided', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    if (!showData) { // Only fetch if we don't have data yet
      fetchShowData();
    }
  }, [show_id, showData]);

  const fetchShowData = async () => {
    try {
      console.log('fetchShowData called for show_id:', show_id);
      setLoading(true);

      // Get show data
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('show_id', show_id)
        .single();

      console.log('Show query result:', { show, showError });

      if (showError) {
        console.error('Show fetch error:', showError);
        throw new Error(`Failed to fetch show: ${showError.message}`);
      }

      if (show) {
        // Get venue details for capacity calculation
        console.log('Fetching venue details for venue_id:', show.show_venue);
        const { data: venue, error: venueError } = await supabase
          .from('venues')
          .select('venue_name, venue_max_cap')
          .eq('venue_id', show.show_venue)
          .single();

        console.log('Venue query result:', { venue, venueError });

        if (!venueError && venue) {
          show.venue_name = venue.venue_name;
          show.venue_capacity = venue.venue_max_cap; // Using venue_max_cap from database
        } else if (venueError) {
          console.error('Venue fetch error:', venueError);
        }

        setShowData(show);
      }
    } catch (error: any) {
      console.error('Error fetching show data:', error);
      Alert.alert('Error', 'Failed to load show details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  console.log('Rendering VenueAcceptanceWizard, loading:', loading, 'showData:', showData);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading show details...</Text>
      </View>
    );
  }

  const calculateGuarantee = () => {
    if (!showData?.venue_capacity) return 0;
    const capacity = typeof showData.venue_capacity === 'string' ? parseInt(showData.venue_capacity) : showData.venue_capacity;
    const totalRevenue = capacity * ticketPrice;
    return totalRevenue * (venuePercentage / 100);
  };

  const calculateArtistGuarantee = () => {
    if (!showData?.venue_capacity) return 0;
    const capacity = typeof showData.venue_capacity === 'string' ? parseInt(showData.venue_capacity) : showData.venue_capacity;
    const totalRevenue = capacity * ticketPrice;
    const venueShare = totalRevenue * (venuePercentage / 100);
    const artistPool = totalRevenue - venueShare;
    
    // Count individual artists
    let totalIndividualArtists = 0;
    showData.show_members?.forEach(member => {
      if (member.show_member_type === 'artist') {
        totalIndividualArtists += 1;
      } else if (member.show_member_type === 'band' && member.show_member_consensus) {
        totalIndividualArtists += member.show_member_consensus.length;
      }
    });
    
    console.log(`Artist guarantee calc: capacity=${capacity}, revenue=${totalRevenue}, venue=${venueShare}, artistPool=${artistPool}, artists=${totalIndividualArtists}`);
    return totalIndividualArtists > 0 ? artistPool / totalIndividualArtists : 0;
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!showData) return;
    
    try {
      setSubmitting(true);
      console.log('Submitting venue acceptance...');

      // Check if all members have accepted
      const allMembersAccepted = showData.show_members?.every(member => member.show_member_decision === true) || false;
      console.log('All members accepted:', allMembersAccepted);
      
      // Determine show status: only 'active' if venue AND all members have accepted
      const newStatus = allMembersAccepted ? 'active' : 'pending';
      console.log('Setting show status to:', newStatus);

      // Use the existing calculation function
      const individualArtistGuarantee = calculateArtistGuarantee();
      console.log(`Per-artist guarantee: $${individualArtistGuarantee.toFixed(2)}`);
      
      // Build artist guarantee array for database
      const artistGuaranteeArray: any[] = [];
      showData.show_members?.forEach(member => {
        if (member.show_member_type === 'artist') {
          artistGuaranteeArray.push({
            payee_artist_id: member.show_member_id,
            payee_payout_amount: `$${individualArtistGuarantee.toFixed(2)}`
          });
        } else if (member.show_member_type === 'band' && member.show_member_consensus) {
          member.show_member_consensus.forEach((bandMember: any) => {
            artistGuaranteeArray.push({
              payee_artist_id: bandMember.show_band_member_id,
              payee_payout_amount: `$${individualArtistGuarantee.toFixed(2)}`
            });
          });
        }
      });

      // Update show with venue decision and pricing
      const { error: updateError } = await supabase
        .from('shows')
        .update({
          venue_decision: true,
          show_status: newStatus,
          show_ticket_price: ticketPrice,
          venue_percentage: venuePercentage,
          show_date: showData.show_preferred_date,
          show_time: showData.show_preferred_time,
          artist_guarantee: artistGuaranteeArray
        })
        .eq('show_id', show_id);

      if (updateError) {
        throw new Error(`Failed to update show: ${updateError.message}`);
      }

      // Send notifications to all show members and promoter
      const notifications = [];

      // Notify all show members
      for (const member of showData.show_members || []) {
        if (member.show_member_type === 'artist') {
          notifications.push(
            notificationService.sendNotification(
              member.show_member_id,
              'venue_show_acceptance',
              {
                show_id: show_id,
                venue_name: showData.venue_name,
                artist_guarantee: individualArtistGuarantee,
                show_date: showData.show_preferred_date,
                show_time: showData.show_preferred_time,
                ticket_price: ticketPrice,
                venue_percentage: venuePercentage
              }
            )
          );
        }
      }

      // Notify promoter (without guarantee since promoters don't get paid)
      notifications.push(
        notificationService.sendNotification(
          showData.show_promoter,
          'venue_show_acceptance',
          {
            show_id: show_id,
            venue_name: showData.venue_name,
            // Remove artist_guarantee for promoter
            show_date: showData.show_preferred_date,
            show_time: showData.show_preferred_time,
            ticket_price: ticketPrice,
            venue_percentage: venuePercentage
          }
        )
      );

      // Wait for all notifications to send
      await Promise.all(notifications);

      // Check if show should be activated (in case status logic missed something)
      const activationResult = await notificationService.checkAndActivateShow(show_id);
      
      const finalStatus = activationResult.activated ? 'active' : newStatus;
      const successMessage = finalStatus === 'active' 
        ? `Show is now ACTIVE! All performers and venue have accepted. Your guarantee is $${calculateGuarantee().toFixed(2)} if sold out.`
        : `Venue acceptance recorded! Show will become ACTIVE once all performers accept. Your guarantee is $${calculateGuarantee().toFixed(2)} if sold out.`;

      Alert.alert(
        'Success!',
        successMessage,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error: any) {
      console.error('Error submitting venue acceptance:', error);
      Alert.alert('Error', error.message || 'Failed to confirm show');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Show Details</Text>
            {showData && (
              <>
                <Text style={styles.dataText}>Venue: {showData.venue_name || 'Unknown'}</Text>
                <Text style={styles.dataText}>Date: {showData.show_preferred_date || 'TBD'}</Text>
                <Text style={styles.dataText}>Time: {showData.show_preferred_time || 'TBD'}</Text>
                <Text style={styles.dataText}>Capacity: {showData.venue_capacity || 'Unknown'}</Text>
                <Text style={styles.dataText}>Total Members: {showData.show_members?.length || 0}</Text>
                
                {/* Show member acceptance status */}
                <Text style={styles.sectionTitle}>Member Status:</Text>
                {showData.show_members?.map((member, index) => (
                  <Text key={index} style={styles.dataText}>
                    {member.show_member_name}: {member.show_member_decision ? '✅ Accepted' : '⏳ Pending'}
                  </Text>
                ))}
              </>
            )}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Ticket Price & Revenue Split</Text>
            <Text style={styles.sectionTitle}>Ticket Price: ${ticketPrice}</Text>
            <View style={styles.priceButtons}>
              {[10, 15, 20, 25, 30].map(price => (
                <TouchableOpacity
                  key={price}
                  style={[styles.priceButton, ticketPrice === price && styles.activeButton]}
                  onPress={() => setTicketPrice(price)}
                >
                  <Text style={[styles.buttonText, ticketPrice === price && styles.activeButtonText]}>
                    ${price}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.sectionTitle}>Venue Share: {venuePercentage}%</Text>
            <View style={styles.priceButtons}>
              {[10, 15, 20, 25, 30].map(percentage => (
                <TouchableOpacity
                  key={percentage}
                  style={[styles.priceButton, venuePercentage === percentage && styles.activeButton]}
                  onPress={() => setVenuePercentage(percentage)}
                >
                  <Text style={[styles.buttonText, venuePercentage === percentage && styles.activeButtonText]}>
                    {percentage}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Review & Confirm</Text>
            <Text style={styles.dataText}>Ticket Price: ${ticketPrice}</Text>
            <Text style={styles.dataText}>Venue Share: {venuePercentage}%</Text>
            <Text style={styles.dataText}>Your Guarantee: ${calculateGuarantee().toFixed(2)}</Text>
            <Text style={styles.dataText}>Per Artist Guarantee: ${calculateArtistGuarantee().toFixed(2)}</Text>
            <TouchableOpacity 
              style={[styles.confirmButton, submitting && styles.disabledButton]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Show</Text>
              )}
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Accept Show</Text>
        <Text style={styles.subtitle}>Step {currentStep} of {totalSteps}</Text>
        
        {renderStep()}
        
        <View style={styles.navigationContainer}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.navButton} onPress={handlePrevious}>
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          {currentStep < totalSteps && (
            <TouchableOpacity style={[styles.navButton, styles.nextButton]} onPress={handleNext}>
              <Text style={styles.navButtonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#2a2882',
  },
  container: {
    flex: 1,
    padding: 20,
    minHeight: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    marginTop: 50,
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  stepContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  dataText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  priceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  priceButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    margin: 5,
    minWidth: 50,
  },
  activeButton: {
    backgroundColor: '#ff00ff',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  activeButtonText: {
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#ff00ff',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 30,
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 80,
  },
  nextButton: {
    backgroundColor: '#ff00ff',
  },
  navButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default VenueAcceptanceWizard;