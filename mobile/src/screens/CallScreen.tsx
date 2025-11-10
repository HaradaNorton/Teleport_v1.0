import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Call'>;
  route: RouteProp<RootStackParamList, 'Call'>;
};

export default function CallScreen({ navigation, route }: Props) {
  const { callId, callType, isIncoming, callerInfo } = route.params;
  const [callStatus, setCallStatus] = useState<string>(isIncoming ? 'ringing' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const { user } = useAuthStore();

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (callStatus === 'accepted' || callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // Listen for WebSocket call events
  useEffect(() => {
    // TODO: Listen to WebSocket events for call status updates
    // This will be implemented when WebRTC is integrated
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = async () => {
    try {
      await api.answerCall(callId);
      setCallStatus('accepted');

      // TODO: Initialize WebRTC connection and start audio stream
      Alert.alert('Note', 'WebRTC integration requires Expo bare workflow or custom development client');
    } catch (error: any) {
      console.error('Failed to answer call:', error);
      Alert.alert('Error', 'Failed to answer call');
    }
  };

  const handleReject = async () => {
    try {
      await api.rejectCall(callId);
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to reject call:', error);
      Alert.alert('Error', 'Failed to reject call');
    }
  };

  const handleEndCall = async () => {
    try {
      const result = await api.endCall(callId);
      Alert.alert('Call Ended', `Duration: ${formatDuration(result.duration)}`, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Failed to end call:', error);
      navigation.goBack();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // TODO: Implement actual mute functionality with WebRTC
  };

  const toggleSpeaker = () => {
    setIsSpeaker(!isSpeaker);
    // TODO: Implement actual speaker toggle with audio routing
  };

  const getStatusText = (): string => {
    switch (callStatus) {
      case 'ringing':
        return isIncoming ? 'Incoming call...' : 'Calling...';
      case 'calling':
        return 'Calling...';
      case 'accepted':
      case 'connected':
        return formatDuration(callDuration);
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Call Info */}
      <View style={styles.callInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {callerInfo?.name ? callerInfo.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <Text style={styles.callerName}>
          {callerInfo?.name || callerInfo?.phone_number || 'Unknown'}
        </Text>

        <Text style={styles.callStatus}>{getStatusText()}</Text>

        <View style={styles.callTypeBadge}>
          <Text style={styles.callTypeText}>
            {callType === 'video' ? '📹 Video Call' : '🎤 Audio Call'}
          </Text>
        </View>

        {(callStatus === 'accepted' || callStatus === 'connected') && (
          <Text style={styles.callNote}>
            Note: WebRTC requires bare workflow
          </Text>
        )}
      </View>

      {/* Call Controls */}
      <View style={styles.controls}>
        {isIncoming && (callStatus === 'ringing' || callStatus === 'calling') ? (
          // Incoming call controls
          <View style={styles.incomingControls}>
            <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
              <Text style={styles.controlIcon}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.answerButton} onPress={handleAnswer}>
              <Text style={styles.controlIcon}>📞</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Active call controls
          <>
            <View style={styles.secondaryControls}>
              <TouchableOpacity
                style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                onPress={toggleMute}
              >
                <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🔊'}</Text>
                <Text style={styles.controlLabel}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
                onPress={toggleSpeaker}
              >
                <Text style={styles.controlIcon}>{isSpeaker ? '📢' : '🔈'}</Text>
                <Text style={styles.controlLabel}>
                  {isSpeaker ? 'Speaker' : 'Earpiece'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
              <Text style={styles.endCallIcon}>📵</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  callInfo: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarText: {
    color: '#fff',
    fontSize: 50,
    fontWeight: '600',
  },
  callerName: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 20,
  },
  callTypeBadge: {
    backgroundColor: 'rgba(0, 136, 204, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15,
  },
  callTypeText: {
    color: '#0088cc',
    fontSize: 14,
    fontWeight: '600',
  },
  callNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  controls: {
    paddingHorizontal: 30,
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#34c759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },
  controlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#0088cc',
  },
  controlIcon: {
    fontSize: 32,
    color: '#fff',
  },
  controlLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  endCallIcon: {
    fontSize: 32,
    color: '#fff',
  },
});
