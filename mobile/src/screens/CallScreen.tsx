import React, { useState, useEffect, useRef } from 'react';
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
import { RTCView, MediaStream } from 'react-native-webrtc';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../services/api';
import webrtc from '../services/webrtc';
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const { user } = useAuthStore();
  const { sendWebRTCSignal, setWebRTCSignalHandler, setCallStatusHandler } = useChatStore();
  const isInitialized = useRef(false);

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

  // Initialize WebRTC
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    initializeWebRTC();

    // Setup WebRTC signal handler
    setWebRTCSignalHandler(handleWebRTCSignal);

    // Setup call status handler
    setCallStatusHandler(handleCallStatus);

    // Cleanup on unmount
    return () => {
      webrtc.close();
    };
  }, []);

  const initializeWebRTC = async () => {
    try {
      const isVideo = callType === 'video';

      // Initialize WebRTC with callbacks
      await webrtc.initializeConnection(isVideo, {
        onLocalStream: (stream) => {
          console.log('Local stream received');
          setLocalStream(stream);
        },
        onRemoteStream: (stream) => {
          console.log('Remote stream received');
          setRemoteStream(stream);
          setCallStatus('connected');
        },
        onIceCandidate: (candidate) => {
          // Send ICE candidate via WebSocket
          sendWebRTCSignal({
            type: 'ice-candidate',
            call_id: callId,
            to_user_id: callerInfo?.id || '',
            candidate: candidate.toJSON ? candidate.toJSON() : candidate,
          });
        },
        onConnectionStateChange: (state) => {
          console.log('Connection state:', state);
          if (state === 'connected') {
            setCallStatus('connected');
          } else if (state === 'failed' || state === 'disconnected') {
            handleEndCall();
          }
        },
      });

      // If this is the caller, create and send offer
      if (!isIncoming) {
        const offer = await webrtc.createOffer();
        sendWebRTCSignal({
          type: 'offer',
          call_id: callId,
          to_user_id: callerInfo?.id || '',
          offer: offer,
        });
      }
    } catch (error: any) {
      console.error('Failed to initialize WebRTC:', error);
      Alert.alert('Error', 'Failed to initialize call: ' + error.message);
      navigation.goBack();
    }
  };

  const handleWebRTCSignal = async (signal: any) => {
    // Only process signals for this call
    if (signal.call_id !== callId) return;

    try {
      switch (signal.type) {
        case 'offer':
          console.log('Received offer');
          // Callee receives offer and creates answer
          const answer = await webrtc.handleOffer(signal.offer);
          sendWebRTCSignal({
            type: 'answer',
            call_id: callId,
            to_user_id: signal.from_user_id,
            answer: answer,
          });
          break;

        case 'answer':
          console.log('Received answer');
          // Caller receives answer
          await webrtc.handleAnswer(signal.answer);
          break;

        case 'ice-candidate':
          console.log('Received ICE candidate');
          if (signal.candidate) {
            await webrtc.addIceCandidate(signal.candidate);
          }
          break;

        default:
          console.log('Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('Failed to handle WebRTC signal:', error);
    }
  };

  const handleCallStatus = (status: any) => {
    // Only process status for this call
    if (status.call_id !== callId) return;

    console.log('Call status update:', status);

    switch (status.status) {
      case 'answered':
        setCallStatus('accepted');
        break;
      case 'rejected':
        Alert.alert('Call Rejected', 'The call was rejected', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
        break;
      case 'ended':
        const duration = status.duration || 0;
        Alert.alert('Call Ended', `Duration: ${formatDuration(duration)}`, [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
        break;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = async () => {
    try {
      await api.answerCall(callId);
      setCallStatus('accepted');
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
    const muted = webrtc.toggleMute();
    setIsMuted(muted);
  };

  const toggleSpeaker = () => {
    // TODO: Implement speaker toggle with react-native-incall-manager
    setIsSpeaker(!isSpeaker);
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
      {/* Video streams for video calls */}
      {callType === 'video' && remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      )}

      {callType === 'video' && localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror={true}
          zOrder={1}
        />
      )}

      {/* Call Info - shown when no video or during setup */}
      {(callType === 'audio' || !remoteStream) && (
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
        </View>
      )}

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
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
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
