import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { showVotingService, VoteResult } from '../services/showVotingService';

interface ShowVoteButtonProps {
  showId: string;
  onVoteUpdate?: (voteResult: VoteResult) => void;
  style?: any;
  buttonStyle?: any;
  textStyle?: any;
  countStyle?: any;
}

const ShowVoteButton: React.FC<ShowVoteButtonProps> = ({
  showId,
  onVoteUpdate,
  style,
  buttonStyle,
  textStyle,
  countStyle,
}) => {
  const [voteInfo, setVoteInfo] = useState<VoteResult>({ hasVoted: false, voteCount: 0 });
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadVoteInfo();
  }, [showId]);

  const loadVoteInfo = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (!user) {
        setVoteInfo({ hasVoted: false, voteCount: 0 });
        return;
      }

      const result = await showVotingService.getVoteInfo(showId, user.id);
      
      if (result.success && result.data) {
        setVoteInfo(result.data);
        onVoteUpdate?.(result.data);
      } else {
        console.error('Error loading vote info:', result.error);
        setVoteInfo({ hasVoted: false, voteCount: 0 });
      }
    } catch (error) {
      console.error('Error loading vote info:', error);
      setVoteInfo({ hasVoted: false, voteCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'You must be logged in to vote for shows');
      return;
    }

    if (voteInfo.hasVoted) {
      Alert.alert('Already Voted', 'You have already voted for this show');
      return;
    }

    try {
      setVoting(true);
      
      const result = await showVotingService.voteForShow(showId, currentUser.id);
      
      if (result.success && result.data) {
        if (result.data.voteAdded) {
          setVoteInfo(result.data);
          onVoteUpdate?.(result.data);
          Alert.alert('Vote Submitted', 'Thank you for voting for this show!');
        } else {
          Alert.alert('Already Voted', 'You have already voted for this show');
        }
      } else {
        Alert.alert('Vote Failed', result.error || 'Something went wrong while voting');
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Something went wrong while voting');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#ff00ff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.voteButton,
          voteInfo.hasVoted && styles.votedButton,
          voting && styles.votingButton,
          buttonStyle
        ]}
        onPress={handleVote}
        disabled={voteInfo.hasVoted || voting || !currentUser}
      >
        {voting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={[
            styles.voteButtonText,
            voteInfo.hasVoted && styles.votedButtonText,
            textStyle
          ]}>
            {voteInfo.hasVoted ? '✓ Voted' : '👍 Vote'}
          </Text>
        )}
      </TouchableOpacity>
      
      <Text style={[styles.voteCount, countStyle]}>
        {voteInfo.voteCount} vote{voteInfo.voteCount !== 1 ? 's' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  votedButton: {
    backgroundColor: '#28a745',
  },
  votingButton: {
    opacity: 0.7,
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  votedButtonText: {
    color: '#fff',
  },
  voteCount: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
});

export default ShowVoteButton;