import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  Platform,
  Vibration,
  Modal,
} from "react-native";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import ShowSpotHeader from "./ShowSpotHeader";
import { ticketService } from "../services/ticketService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// iPhone 16 specific dimensions for gesture positioning - matching profile.tsx exactly
const IPHONE_16_HEIGHT = 852; // iPhone 16 screen height
const ACTUAL_TAB_BAR_HEIGHT = 85; // Bottom tab bar height
const GESTURE_AREA_HEIGHT = 95; // Our gesture area height
const HEADER_HEIGHT = 85;
const FOOTER_HEIGHT = 85;
const HANDLE_HEIGHT = 30;
const TAB_HEIGHT = 80;
const COLLAPSED_HEIGHT = 180;
const COLLAPSED_TRANSLATE_Y = SCREEN_HEIGHT - COLLAPSED_HEIGHT - FOOTER_HEIGHT;
// Optimized height for iPhone 16 - focus on images as primary visual  
const IMAGE_SECTION_HEIGHT = 610; // Matching other profiles exactly

interface TabData {
  id: string;
  title: string;
  expanded: boolean;
  data?: any[];
}

interface ShowMember {
  show_member_id: string;
  show_member_type: 'artist' | 'band';
  show_member_decision: boolean;
  show_member_position?: string;
  show_member_consensus?: any[];
}

interface ShowData {
  show_id: string;
  show_members: ShowMember[];
  show_venue: string;
  show_promoter: string;
  show_backlines: any[];
  show_status: string;
  venue_decision: boolean;
  preferred_date: string;
  preferred_time: string;
  venue_name?: string;
  venue_profile_image?: string;
  venue_location?: string;
  venue_address?: any;
  venue_capacity?: number;
  ticket_price?: number;
  show_description?: string;
  created_at: string;
  artist_guarantee?: Array<{
    payee_artist_id: string;
    payee_payout_amount: string;
  }>;
}

interface PerformerData {
  id: string;
  name: string;
  profile_image?: string;
  type: 'artist' | 'band';
  is_headliner?: boolean;
  position?: string;
}

const SHOW_BILL_TABS: TabData[] = [
  { id: "performers", title: "performers", expanded: false },
  { id: "venue", title: "venue", expanded: false },
  { id: "backlines", title: "backlines", expanded: false },
  { id: "dateTime", title: "date & time", expanded: false },
  { id: "ticketPrice", title: "ticket price", expanded: false },
  { id: "showInfo", title: "show info", expanded: false },
];

interface ShowBillProps {
  route: {
    params: {
      show_id: string;
    };
  };
}

const ShowBill: React.FC<ShowBillProps> = ({ route }) => {
  const { show_id } = route.params;
  const navigation = useNavigation();
  const router = useRouter();

  // Show data states
  const [showData, setShowData] = useState<ShowData | null>(null);
  const [performers, setPerformers] = useState<PerformerData[]>([]);
  const [venueData, setVenueData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isPromoter, setIsPromoter] = useState(false);
  const [isPerformer, setIsPerformer] = useState(false);
  const [isVenueOwner, setIsVenueOwner] = useState(false);
  const [userGuarantee, setUserGuarantee] = useState<{
    soldOut: number;
    seventyFive: number;
    fifty: number;
    twentyFive: number;
    type: 'artist' | 'venue';
  } | null>(null);
  
  // Common states - matching profile.tsx exactly
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  // Full-screen image modal - matching profile.tsx exactly
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Handle image press for full-screen view
  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setShowImageModal(true);
  };

  // Tabs state
  const [tabs, setTabs] = useState<TabData[]>(SHOW_BILL_TABS);
  
  // Ticket sales data
  const [ticketSalesInfo, setTicketSalesInfo] = useState<{
    ticketsSold: number;
    capacity: number;
    isSoldOut: boolean;
  } | null>(null);

  // Animation refs - matching bandPublicProfile.tsx exactly
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe up gesture - matching bandPublicProfile.tsx exactly
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        if (Platform.OS === 'ios') {
          Vibration.vibrate(10);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (!expanded && gestureState.dy < 0) {
          // Only allow upward movement when collapsed
          const currentValue = expanded ? 0 : COLLAPSED_TRANSLATE_Y;
          const newValue = currentValue + gestureState.dy;
          const constrainedValue = Math.max(0, Math.min(COLLAPSED_TRANSLATE_Y, newValue));
          panelTranslateY.setValue(constrainedValue);
          
          // Update opacity based on panel position
          const progress = Math.abs(gestureState.dy) / COLLAPSED_TRANSLATE_Y;
          const opacityValue = 1 - progress;
          nameOpacity.setValue(Math.max(0, Math.min(1, opacityValue)));
        } else if (expanded && gestureState.dy > 0) {
          // Allow downward movement when expanded
          const newValue = gestureState.dy;
          const constrainedValue = Math.max(0, Math.min(COLLAPSED_TRANSLATE_Y, newValue));
          panelTranslateY.setValue(constrainedValue);
          
          // Update opacity based on panel position
          const progress = gestureState.dy / COLLAPSED_TRANSLATE_Y;
          const opacityValue = progress;
          nameOpacity.setValue(Math.max(0, Math.min(1, opacityValue)));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 100;
        const shouldExpand = !expanded && (gestureState.dy < -SWIPE_THRESHOLD || gestureState.vy < -0.5);
        const shouldCollapse = expanded && (gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5);

        if (shouldExpand) {
          expandPanel();
        } else if (shouldCollapse) {
          collapsePanel();
        } else {
          const targetValue = expanded ? 0 : COLLAPSED_TRANSLATE_Y;
          const targetOpacity = expanded ? 0 : 1;
          
          Animated.parallel([
            Animated.spring(panelTranslateY, {
              toValue: targetValue,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
            Animated.timing(nameOpacity, {
              toValue: targetOpacity,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const expandPanel = useCallback(() => {
    setExpanded(true);
    
    Animated.parallel([
      Animated.spring(panelTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 7,
        overshootClamping: false,
      }),
      Animated.timing(handleOpacity, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelTranslateY, handleOpacity, nameOpacity]);

  const collapsePanel = useCallback(() => {
    setExpanded(false);
    
    // Collapse all tabs when panel closes
    setTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, expanded: false }))
    );
    
    Animated.parallel([
      Animated.spring(panelTranslateY, {
        toValue: COLLAPSED_TRANSLATE_Y,
        useNativeDriver: true,
        tension: 110,
        friction: 8,
        overshootClamping: false,
      }),
      Animated.timing(handleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelTranslateY, handleOpacity, nameOpacity]);

  // Gesture handler for panel header swipe down - matching bandPublicProfile.tsx exactly
  const handlePanelGesture = useCallback((event: any) => {
    const { nativeEvent } = event;
    
    if (nativeEvent.state === State.END) {
      const { translationY, velocityY } = nativeEvent;
      
      // Only allow swipe down when panel is expanded
      if (expanded && (translationY > 50 || velocityY > 300)) {
        collapsePanel();
      }
    }
  }, [expanded, collapsePanel]);

  const toggleTab = useCallback((tabId: string) => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    }
    
    setTabs(prevTabs => 
      prevTabs.map(tab => ({
        ...tab,
        expanded: tab.id === tabId ? !tab.expanded : false
      }))
    );
  }, []);

  // Fetch show data
  const fetchShowData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      
      if (session?.user) {
        setCurrentUser(session.user);
      }

      // Get show data
      console.log('Querying show with ID:', show_id);
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('show_id', show_id)
        .single();

      if (showError) {
        throw new Error(`Failed to fetch show: ${showError.message}`);
      }

      if (show) {
        console.log('Show data fetched:', show.show_id);
        console.log('Date/time data:', { 
          preferred_date: show.preferred_date, 
          preferred_time: show.preferred_time,
          show_preferred_date: show.show_preferred_date,
          show_preferred_time: show.show_preferred_time 
        });
        
        // Get venue details
        const { data: venue, error: venueError } = await supabase
          .from('venues')
          .select('*')
          .eq('venue_id', show.show_venue)
          .single();

        console.log('Venue query result:', venue ? 'Success' : 'Failed');
        if (venueError) console.log('Venue error:', venueError.message);

        if (!venueError && venue) {
          console.log('Venue data found:', venue.venue_name);
          setVenueData(venue);
        } else {
          console.log('No venue data found for venue_id:', show.show_venue);
          setVenueData(null);
        }

        // Store the show data with all fields - ensure we preserve original data
        const showWithAllData = {
          ...show,
          // Map database column names to expected field names
          preferred_date: show.show_preferred_date || show.preferred_date || null,
          preferred_time: show.show_preferred_time || show.preferred_time || null,
          ticket_price: show.show_ticket_price || show.ticket_price || null,
          // Add venue data if available, but don't overwrite if already exists
          venue_name: venue?.venue_name || show.venue_name || null,
          venue_profile_image: venue?.venue_profile_image || show.venue_profile_image || null,
          venue_address: venue?.venue_address || show.venue_address || null,
          venue_capacity: venue?.venue_capacity || show.venue_capacity || null
        };

        console.log('Final show data configured with date/time:', {
          preferred_date: showWithAllData.preferred_date,
          preferred_time: showWithAllData.preferred_time
        });
        setShowData(showWithAllData);

        // Fetch ticket sales info if show is active
        if (showWithAllData.show_status === 'active') {
          try {
            console.log('Fetching ticket sales info for active show:', show_id);
            const ticketInfo = await ticketService.getShowTicketInfo(show_id);
            if (ticketInfo.success && ticketInfo.data) {
              console.log('Ticket sales info fetched:', ticketInfo.data);
              setTicketSalesInfo(ticketInfo.data);
            } else {
              console.log('Failed to fetch ticket sales info:', ticketInfo.error);
            }
          } catch (error) {
            console.error('Error fetching ticket sales info:', error);
          }
        }

        // Check if current user is promoter, performer, or venue owner and calculate guarantees
        if (session?.user) {
          setIsPromoter(show.show_promoter === session.user.id);
          
          // Check if user is a performer (artist or band member)
          const userArtists = await supabase
            .from('artists')
            .select('artist_id')
            .eq('spotter_id', session.user.id);

          const userArtistIds = userArtists.data?.map(a => a.artist_id) || [];
          
          // Check if user is directly in show_members or part of a band in show_members
          const isDirectPerformer = show.show_members.some((member: ShowMember) => {
            if (member.show_member_type === 'artist') {
              return userArtistIds.includes(member.show_member_id);
            } else if (member.show_member_type === 'band') {
              // Check if user is in this band's consensus
              return member.show_member_consensus?.some((consensus: any) => 
                userArtistIds.includes(consensus.show_band_member_id)
              );
            }
            return false;
          });
          
          setIsPerformer(isDirectPerformer);

          // Check if user owns the venue
          if (show.show_venue) {
            const { data: userVenue } = await supabase
              .from('venues')
              .select('venue_id')
              .eq('spotter_id', session.user.id)
              .eq('venue_id', show.show_venue);
            
            const isVenueOwnerCheck = userVenue && userVenue.length > 0;
            setIsVenueOwner(isVenueOwnerCheck);

            // Calculate guarantees if show has financial data
            if ((isDirectPerformer || isVenueOwnerCheck) && 
                show.show_ticket_price && 
                show.venue_percentage !== null &&
                venue?.venue_capacity) {
              
              const ticketPrice = show.show_ticket_price;
              const venuePercentage = show.venue_percentage || 0;
              const capacity = venue.venue_capacity;
              const maxRevenue = capacity * ticketPrice;
              
              if (isVenueOwnerCheck) {
                // Venue guarantee calculation
                const venueRevenue = maxRevenue * (venuePercentage / 100);
                setUserGuarantee({
                  soldOut: venueRevenue,
                  seventyFive: venueRevenue * 0.75,
                  fifty: venueRevenue * 0.50,
                  twentyFive: venueRevenue * 0.25,
                  type: 'venue'
                });
              } else if (isDirectPerformer) {
                // Artist guarantee calculation - use database artist_guarantee array
                let artistGuarantee = 0;
                
                if (show.artist_guarantee && Array.isArray(show.artist_guarantee)) {
                  // Find user's guarantee in the artist_guarantee array
                  const userGuaranteeEntry = show.artist_guarantee.find((entry: any) =>
                    userArtistIds.includes(entry.payee_artist_id)
                  );
                  
                  if (userGuaranteeEntry && userGuaranteeEntry.payee_payout_amount) {
                    // Parse the guarantee amount (remove $ and convert to number)
                    const amountStr = userGuaranteeEntry.payee_payout_amount.replace('$', '');
                    artistGuarantee = parseFloat(amountStr) || 0;
                  }
                } else {
                  // Fallback to old calculation if artist_guarantee array doesn't exist
                  const totalArtists = countTotalArtists(show.show_members);
                  const artistsRevenue = maxRevenue * ((100 - venuePercentage) / 100);
                  artistGuarantee = totalArtists > 0 ? artistsRevenue / totalArtists : 0;
                }
                
                console.log('Artist guarantee found:', artistGuarantee);
                
                setUserGuarantee({
                  soldOut: artistGuarantee,
                  seventyFive: artistGuarantee * 0.75,
                  fifty: artistGuarantee * 0.50,
                  twentyFive: artistGuarantee * 0.25,
                  type: 'artist'
                });
              }
            }
          }
        }

        // Get performer details
        const performerPromises = show.show_members.map(async (member: ShowMember, index: number) => {
          if (member.show_member_type === 'artist') {
            const { data: artist } = await supabase
              .from('artists')
              .select('artist_id, artist_name, artist_profile_image')
              .eq('artist_id', member.show_member_id)
              .single();
            
            return artist ? {
              id: artist.artist_id,
              name: artist.artist_name,
              profile_image: artist.artist_profile_image,
              type: 'artist' as const,
              is_headliner: member.show_member_position === 'headliner',
              position: member.show_member_position || `performer ${index + 1}`
            } : null;
          } else if (member.show_member_type === 'band') {
            const { data: band } = await supabase
              .from('bands')
              .select('band_id, band_name, band_profile_picture')
              .eq('band_id', member.show_member_id)
              .single();
            
            return band ? {
              id: band.band_id,
              name: band.band_name,
              profile_image: band.band_profile_picture,
              type: 'band' as const,
              is_headliner: member.show_member_position === 'headliner',
              position: member.show_member_position || `performer ${index + 1}`
            } : null;
          }
          return null;
        });

        const performerData = await Promise.all(performerPromises);
        const validPerformers = performerData.filter(Boolean) as PerformerData[];
        
        // Sort performers to put headliner first
        validPerformers.sort((a, b) => {
          if (a.is_headliner) return -1;
          if (b.is_headliner) return 1;
          return 0;
        });
        
        setPerformers(validPerformers);
      }

      // Fade in animation - matching bandPublicProfile.tsx
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
    } catch (err: any) {
      console.error('Error fetching show data:', err);
      setError(err.message || 'Failed to load show bill');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShowData();
  }, [show_id]);

  // Helper function to count total individual artists (including band members)
  const countTotalArtists = (showMembers: ShowMember[]): number => {
    let count = 0;
    showMembers.forEach(member => {
      if (member.show_member_type === 'artist') {
        count += 1;
      } else if (member.show_member_type === 'band' && member.show_member_consensus) {
        count += member.show_member_consensus.length;
      }
    });
    return count;
  };

  // Get current show data for display - images from performers + venue
  const getCurrentShowData = () => {
    if (!showData || performers.length === 0) return { name: "Show Bill", images: [] };
    
    // Combine performer images (headliner first) + venue image at the end
    const performerImages = performers
      .sort((a, b) => (b.is_headliner ? 1 : 0) - (a.is_headliner ? 1 : 0))
      .map(p => p.profile_image)
      .filter(Boolean);
    
    // Use venueData first, then fallback to showData venue fields
    const currentVenueName = venueData?.venue_name || showData.venue_name;
    const currentVenueImage = venueData?.venue_profile_image || showData.venue_profile_image;
    
    const allImages = currentVenueImage ? [...performerImages, currentVenueImage] : performerImages;
    
    const headliner = performers.find(p => p.is_headliner);
    const showName = headliner && currentVenueName ? 
      `${headliner.name} @ ${currentVenueName}` : 
      "Show Bill";
    
    console.log('getCurrentShowData called with:', {
      headliner: headliner?.name,
      currentVenueName,
      final_showName: showName
    });
    
    return {
      name: showName,
      images: allImages,
    };
  };

  // Render tab content - matching bandPublicProfile.tsx exactly
  const renderTabContent = (tabId?: string) => {
    switch (tabId) {
      case 'performers':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.performersContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {performers.length > 0 ? (
                performers.map((performer, index) => (
                  <TouchableOpacity 
                    key={performer.id} 
                    style={styles.performerItem}
                    onPress={() => {
                      // Navigate to performer profile
                      if (performer.type === 'artist') {
                        navigation.navigate('ArtistPublicProfile' as never, { artist_id: performer.id } as never);
                      } else {
                        navigation.navigate('BandPublicProfile' as never, { band_id: performer.id } as never);
                      }
                    }}
                  >
                    <Image
                      source={{ 
                        uri: performer.profile_image || 'https://via.placeholder.com/50' 
                      }}
                      style={styles.performerImage}
                    />
                    <View style={styles.performerInfo}>
                      <Text style={styles.performerName}>{performer.name}</Text>
                      <Text style={styles.performerType}>
                        {performer.is_headliner ? 'Headliner' : performer.type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDataText}>No performers listed</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'venue':
        // Use venueData state first, then fallback to showData
        const currentVenueData = venueData || {
          venue_name: showData?.venue_name,
          venue_profile_image: showData?.venue_profile_image,
          venue_location: showData?.venue_location,
          venue_address: showData?.venue_address,
          venue_capacity: showData?.venue_capacity
        };
        
        console.log('Rendering venue tab with currentVenueData:', currentVenueData);
        console.log('venueData state:', venueData);
        console.log('showData venue fields:', {
          venue_name: showData?.venue_name,
          venue_profile_image: showData?.venue_profile_image,
          show_venue: showData?.show_venue
        });
        
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity 
              style={styles.venueItem}
              onPress={() => {
                if (showData?.show_venue) {
                  navigation.navigate('VenuePublicProfile' as never, { venue_id: showData.show_venue } as never);
                }
              }}
            >
              <Image
                source={{ 
                  uri: currentVenueData?.venue_profile_image || 'https://via.placeholder.com/80' 
                }}
                style={styles.venueImage}
              />
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{currentVenueData?.venue_name || 'Venue TBD'}</Text>
                {currentVenueData?.venue_location && (
                  <Text style={styles.venueLocation}>{currentVenueData.venue_location}</Text>
                )}
                {currentVenueData?.venue_address && (
                  <Text style={styles.venueAddress}>
                    {typeof currentVenueData.venue_address === 'object' 
                      ? currentVenueData.venue_address.address 
                      : currentVenueData.venue_address}
                  </Text>
                )}
                {currentVenueData?.venue_capacity && (
                  <Text style={styles.venueCapacity}>Capacity: {currentVenueData.venue_capacity}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'backlines':
        return (
          <View style={styles.tabContent}>
            {showData?.show_backlines && showData.show_backlines.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {showData.show_backlines.map((backline: any, index: number) => (
                  <View key={index} style={styles.backlineItem}>
                    <Text style={styles.backlineName}>{backline.name || 'Backline Item'}</Text>
                    <Text style={styles.backlineDescription}>{backline.description || 'No description'}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noDataText}>No backlines listed</Text>
            )}
          </View>
        );

      case 'dateTime':
        console.log('Rendering dateTime tab with showData:', {
          preferred_date: showData?.preferred_date,
          preferred_time: showData?.preferred_time,
          type_of_date: typeof showData?.preferred_date,
          type_of_time: typeof showData?.preferred_time
        });
        return (
          <View style={styles.tabContent}>
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeItem}>
                <Text style={styles.dateTimeLabel}>Preferred Date:</Text>
                <Text style={styles.dateTimeValue}>
                  {showData?.preferred_date ? 
                    new Date(showData.preferred_date).toLocaleDateString() : 
                    'TBD'
                  }
                </Text>
              </View>
              <View style={styles.dateTimeItem}>
                <Text style={styles.dateTimeLabel}>Preferred Time:</Text>
                <Text style={styles.dateTimeValue}>{showData?.preferred_time || 'TBD'}</Text>
              </View>
              <View style={styles.dateTimeItem}>
                <Text style={styles.dateTimeLabel}>Status:</Text>
                <Text style={[
                  styles.dateTimeValue,
                  { color: showData?.venue_decision ? '#28a745' : '#ffc107' }
                ]}>
                  {showData?.venue_decision ? 'Confirmed by Venue' : 'Pending Venue Approval'}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'ticketPrice':
        return (
          <View style={styles.tabContent}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Ticket Price:</Text>
              <Text style={styles.priceValue}>
                {showData?.ticket_price ? `$${showData.ticket_price}` : 'TBD'}
              </Text>
              {!showData?.ticket_price && (
                <Text style={styles.priceNote}>
                  Price will be set when venue confirms the show
                </Text>
              )}
              
              {/* Ticket Sales Information */}
              {showData?.show_status === 'active' && ticketSalesInfo && (
                <View style={styles.salesInfoContainer}>
                  <View style={styles.salesInfoRow}>
                    <Text style={styles.salesInfoLabel}>Tickets Sold:</Text>
                    <Text style={[
                      styles.salesInfoValue,
                      { color: ticketSalesInfo.isSoldOut ? '#dc3545' : '#28a745' }
                    ]}>
                      {ticketSalesInfo.ticketsSold} / {ticketSalesInfo.capacity}
                    </Text>
                  </View>
                  
                  {ticketSalesInfo.capacity > 0 && (
                    <View style={styles.salesProgressContainer}>
                      <View style={styles.salesProgressBar}>
                        <View 
                          style={[
                            styles.salesProgressFill,
                            { 
                              width: `${Math.min(100, (ticketSalesInfo.ticketsSold / ticketSalesInfo.capacity) * 100)}%`,
                              backgroundColor: ticketSalesInfo.isSoldOut ? '#dc3545' : '#28a745'
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.salesPercentageText}>
                        {Math.round((ticketSalesInfo.ticketsSold / ticketSalesInfo.capacity) * 100)}% sold
                      </Text>
                    </View>
                  )}
                  
                  {ticketSalesInfo.isSoldOut && (
                    <Text style={styles.soldOutText}>SOLD OUT</Text>
                  )}
                </View>
              )}
              
              {showData?.show_status === 'pending' && showData?.ticket_price && (
                <Text style={styles.priceNote}>
                  Tickets will be available when show becomes active
                </Text>
              )}
            </View>
          </View>
        );

      case 'showInfo':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.infoText}>
              Show Status: {showData?.show_status || 'Unknown'}
            </Text>
            {showData?.show_description && (
              <Text style={styles.infoText}>
                Description: {showData.show_description}
              </Text>
            )}
            <Text style={styles.infoText}>
              Promoted: {showData?.created_at ? 
                new Date(showData.created_at).toLocaleDateString() : 
                'Unknown'
              }
            </Text>
            <Text style={styles.infoText}>
              Performers: {performers.length}
            </Text>
            <Text style={styles.infoText}>
              Venue Decision: {showData?.venue_decision ? 'Approved' : 'Pending'}
            </Text>
            
            {/* Ticket Sales Information */}
            {showData?.show_status === 'active' && ticketSalesInfo && venueData && (
              <>
                <Text style={styles.infoText}>
                  Venue Capacity: {ticketSalesInfo.capacity}
                </Text>
                <Text style={styles.infoText}>
                  Tickets Sold: {ticketSalesInfo.ticketsSold}
                </Text>
                <Text style={[
                  styles.infoText,
                  { 
                    color: ticketSalesInfo.isSoldOut ? '#dc3545' : '#28a745',
                    fontWeight: 'bold'
                  }
                ]}>
                  Status: {ticketSalesInfo.isSoldOut ? 'SOLD OUT' : `${ticketSalesInfo.capacity - ticketSalesInfo.ticketsSold} tickets remaining`}
                </Text>
                {ticketSalesInfo.capacity > 0 && (
                  <Text style={styles.infoText}>
                    Sales Progress: {Math.round((ticketSalesInfo.ticketsSold / ticketSalesInfo.capacity) * 100)}% sold
                  </Text>
                )}
              </>
            )}
            
            {showData?.show_status === 'pending' && showData?.ticket_price && (
              <Text style={styles.infoText}>
                Ticket Sales: Will begin when show becomes active
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoonText}>
              {SHOW_BILL_TABS.find(tab => tab.id === tabId)?.title} - Coming Soon
            </Text>
          </View>
        );
    }
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationPress={() => {
            console.log('Notification pressed');
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading show bill...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationPress={() => {
            console.log('Notification pressed');
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchShowData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = getCurrentShowData();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationPress={() => {
            console.log('Notification pressed');
          }}
        />
      </View>

      {/* Main content area with fixed height */}
      <View style={styles.mainContent} {...panResponder.panHandlers}>
        
        {/* Image section with fixed height */}
        <View style={styles.imageSection}>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            style={styles.imageScrollView}
          >
            {currentData.images.length > 0 ? (
              currentData.images.map((imageUri, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.imageContainer}
                  onPress={() => handleImagePress(imageUri)}
                >
                  <Image source={{ uri: imageUri }} style={styles.profileImage} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.imageContainer}>
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>No Images</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Name and Rating Overlay - matching bandPublicProfile.tsx exactly */}
        <Animated.View 
          style={[styles.nameRatingOverlay, { opacity: nameOpacity }]} 
          pointerEvents="none"
        >
          {/* Name on bottom left */}
          <View style={styles.nameContainer}>
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.4)"]}
              style={styles.nameBackground}
            >
              <Text style={styles.profileNameText} numberOfLines={1}>
                {currentData.name}
              </Text>
            </LinearGradient>
          </View>
          
          {/* Show status on bottom right */}
          <View style={styles.ratingContainer}>
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.4)"]}
              style={styles.ratingBackground}
            >
              <Text style={styles.ratingText}>
                {showData?.show_status?.toUpperCase() || 'PENDING'}
              </Text>
              <Text style={styles.reviewText}>
                {showData?.venue_decision ? 'Venue Confirmed' : 'Pending Venue'}
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Sliding panel - matching bandPublicProfile.tsx exactly */}
        <Animated.View
          style={[
            styles.scrollablePanel,
            {
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          {/* Name header inside panel with swipe down gesture */}
          <PanGestureHandler onHandlerStateChange={handlePanelGesture}>
            <LinearGradient
              colors={["#2a2882", "#ff00ff"]}
              style={styles.panelHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.nameTextInside} numberOfLines={1}>
                {currentData.name}
              </Text>
              {/* Add subtle visual indicator for swipe down */}
              {expanded && (
                <Text style={styles.swipeDownIndicator}>▼</Text>
              )}
            </LinearGradient>
          </PanGestureHandler>

          {/* Scrollable tabs */}
          <ScrollView
            style={styles.tabsContainer}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {tabs.map((tab) => (
              <View key={tab.id} style={styles.tabSection}>
                <TouchableOpacity
                  style={styles.tabHeader}
                  onPress={() => toggleTab(tab.id)}
                >
                  <Text style={styles.tabTitle}>{tab.title}</Text>
                  <Text style={[styles.tabIcon, { transform: [{ rotate: tab.expanded ? '180deg' : '0deg' }] }]}>
                    ▼
                  </Text>
                </TouchableOpacity>
                
                {tab.expanded && (
                  <View style={styles.tabContentExpanded}>
                    {renderTabContent(tab.id)}
                  </View>
                )}
              </View>
            ))}

            {/* User Guarantee Display */}
            {userGuarantee && (isPerformer || isVenueOwner) && (
              <View style={styles.guaranteeSection}>
                <LinearGradient
                  colors={["#ff00ff", "#2a2882"]}
                  style={styles.guaranteeGradient}
                >
                  <Text style={styles.guaranteeTitle}>
                    Your {userGuarantee.type === 'venue' ? 'Venue' : 'Artist'} Guarantee
                  </Text>
                  
                  <View style={styles.guaranteeGrid}>
                    <View style={styles.guaranteeItem}>
                      <Text style={styles.guaranteeLabel}>Sold Out</Text>
                      <Text style={styles.guaranteeAmount}>${userGuarantee.soldOut.toFixed(2)}</Text>
                    </View>
                    
                    <View style={styles.guaranteeItem}>
                      <Text style={styles.guaranteeLabel}>75% Sold</Text>
                      <Text style={styles.guaranteeAmount}>${userGuarantee.seventyFive.toFixed(2)}</Text>
                    </View>
                    
                    <View style={styles.guaranteeItem}>
                      <Text style={styles.guaranteeLabel}>50% Sold</Text>
                      <Text style={styles.guaranteeAmount}>${userGuarantee.fifty.toFixed(2)}</Text>
                    </View>
                    
                    <View style={styles.guaranteeItem}>
                      <Text style={styles.guaranteeLabel}>25% Sold</Text>
                      <Text style={styles.guaranteeAmount}>${userGuarantee.twentyFive.toFixed(2)}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.guaranteeNote}>
                    {showData?.venue_decision 
                      ? 'Estimates based on confirmed show details'
                      : 'Estimates - subject to change until venue confirms'
                    }
                  </Text>
                </LinearGradient>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>

      {/* Full-screen image modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalBackground}
            onPress={() => setShowImageModal(false)}
          >
            <Image 
              source={{ uri: selectedImage || '' }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2882',
    paddingTop: Platform.OS === 'ios' ? 44 : 0, // Status bar height
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT + (Platform.OS === 'ios' ? 44 : 0),
    zIndex: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  imageSection: {
    height: IMAGE_SECTION_HEIGHT,
    position: 'relative',
    marginTop: 105,
  },
  imageScrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
  },
  nameRatingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: IMAGE_SECTION_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  nameContainer: {
    flex: 1,
    marginRight: 15,
  },
  nameBackground: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profileNameText: {
    fontSize: 20,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  ratingBackground: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 2,
  },
  reviewText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Amiko-Regular',
  },
  scrollablePanel: {
    position: "absolute",
    top: COLLAPSED_HEIGHT - 50,
    left: 0,
    right: 0,
    bottom: FOOTER_HEIGHT - 170,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 10,
  },
  panelHeader: {
    paddingVertical: 32.5,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'relative',
  },
  nameTextInside: {
    fontSize: 24,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  swipeDownIndicator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "bold",
    position: "absolute",
    left: 20,
  },
  tabsContainer: {
    flex: 1,
  },
  tabSection: {
    marginBottom: 8,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  tabTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 14,
    color: '#666',
  },
  tabContentExpanded: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
    padding: 15,
  },
  tabContent: {
    flex: 1,
  },
  // Performers tab styles
  performersContainer: {
    maxHeight: 300,
  },
  performerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  performerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  performerType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  // Venue tab styles
  venueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  venueImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  venueLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  venueAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  venueCapacity: {
    fontSize: 14,
    color: '#666',
  },
  // Backlines tab styles
  backlineItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backlineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  backlineDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  // Date & Time tab styles
  dateTimeContainer: {
    gap: 15,
  },
  dateTimeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTimeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dateTimeValue: {
    fontSize: 16,
    color: '#666',
  },
  // Ticket Price tab styles
  priceContainer: {
    alignItems: 'center',
    gap: 10,
  },
  priceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff00ff',
  },
  priceNote: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Sales info styles
  salesInfoContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  salesInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  salesInfoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  salesInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  salesProgressContainer: {
    gap: 8,
  },
  salesProgressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  salesProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  salesPercentageText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  soldOutText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderRadius: 5,
  },
  // Show Info tab styles
  infoText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
  },
  noDataText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  comingSoonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  // Guarantee display styles
  guaranteeSection: {
    marginHorizontal: 10,
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 15,
    overflow: 'hidden',
  },
  guaranteeGradient: {
    padding: 20,
  },
  guaranteeTitle: {
    fontSize: 18,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  guaranteeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  guaranteeItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  guaranteeLabel: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    marginBottom: 5,
  },
  guaranteeAmount: {
    fontSize: 18,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
    fontWeight: 'bold',
  },
  guaranteeNote: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Full-screen image modal
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});

export default ShowBill;