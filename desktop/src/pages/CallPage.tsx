import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';
import webrtc from '../services/webrtc';
import type { User } from '../types';
import '../styles/CallPage.css';

interface Props {
  callId: string;
  callType: 'audio' | 'video';
  isIncoming: boolean;
  callerInfo?: User;
  onEnd: () => void;
}

export default function CallPage({ callId, callType, isIncoming, callerInfo, onEnd }: Props) {
  const [callStatus, setCallStatus] = useState<string>(isIncoming ? 'ringing' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const isInitialized = useRef(false);

  const { user } = useAuthStore();
  const { sendWebRTCSignal, setWebRTCSignalHandler, setCallStatusHandler } = useChatStore();

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
      await webrtc.initializeConnection(isVideo, !isIncoming, {
        onLocalStream: (stream) => {
          console.log('Local stream received');
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        },
        onRemoteStream: (stream) => {
          console.log('Remote stream received');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
          setCallStatus('connected');
        },
        onSignal: (signal) => {
          // Send signal via WebSocket
          sendWebRTCSignal({
            type: signal.type || 'signal',
            call_id: callId,
            to_user_id: callerInfo?.id || '',
            offer: signal.type === 'offer' ? signal : undefined,
            answer: signal.type === 'answer' ? signal : undefined,
            candidate: signal.type === 'candidate' ? signal.candidate : undefined,
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
        onError: (error) => {
          console.error('WebRTC error:', error);
          alert('Call error: ' + error.message);
          onEnd();
        },
      });
    } catch (error: any) {
      console.error('Failed to initialize WebRTC:', error);
      alert('Failed to initialize call: ' + error.message);
      onEnd();
    }
  };

  const handleWebRTCSignal = (signal: any) => {
    // Only process signals for this call
    if (signal.call_id !== callId) return;

    try {
      // Handle incoming signal
      webrtc.handleSignal(signal.offer || signal.answer || signal.candidate || signal);
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
        alert('Call was rejected');
        onEnd();
        break;
      case 'ended':
        const duration = status.duration || 0;
        alert(`Call ended. Duration: ${formatDuration(duration)}`);
        onEnd();
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
      alert('Failed to answer call');
    }
  };

  const handleReject = async () => {
    try {
      await api.rejectCall(callId);
      onEnd();
    } catch (error: any) {
      console.error('Failed to reject call:', error);
      onEnd();
    }
  };

  const handleEndCall = async () => {
    try {
      const result = await api.endCall(callId);
      alert(`Call ended. Duration: ${formatDuration(result.duration)}`);
    } catch (error: any) {
      console.error('Failed to end call:', error);
    } finally {
      onEnd();
    }
  };

  const toggleMute = () => {
    const muted = webrtc.toggleMute();
    setIsMuted(muted);
  };

  const toggleVideo = () => {
    const disabled = webrtc.toggleVideo();
    setIsVideoDisabled(disabled);
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
    <div className="call-page">
      {/* Video streams */}
      {callType === 'video' && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
        </>
      )}

      {/* Call Info - shown when no video or during setup */}
      {(callType === 'audio' || callStatus !== 'connected') && (
        <div className="call-info">
          <div className="call-avatar">
            {callerInfo?.name?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || '?'}
          </div>

          <div className="call-name">
            {callerInfo?.name || callerInfo?.phone_number || user?.name || 'Unknown'}
          </div>

          <div className="call-status-text">{getStatusText()}</div>

          <div className="call-type-badge">
            {callType === 'video' ? '📹 Video Call' : '🎤 Audio Call'}
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="call-controls">
        {isIncoming && (callStatus === 'ringing' || callStatus === 'calling') ? (
          // Incoming call controls
          <div className="incoming-controls">
            <button className="call-btn call-btn-reject" onClick={handleReject}>
              ✕
            </button>
            <button className="call-btn call-btn-accept" onClick={handleAnswer}>
              📞
            </button>
          </div>
        ) : (
          // Active call controls
          <>
            <div className="call-secondary-controls">
              <button
                className={`call-control-btn ${isMuted ? 'active' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <span className="control-icon">{isMuted ? '🔇' : '🔊'}</span>
                <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {callType === 'video' && (
                <button
                  className={`call-control-btn ${isVideoDisabled ? 'active' : ''}`}
                  onClick={toggleVideo}
                  title={isVideoDisabled ? 'Enable Video' : 'Disable Video'}
                >
                  <span className="control-icon">{isVideoDisabled ? '📹🚫' : '📹'}</span>
                  <span className="control-label">
                    {isVideoDisabled ? 'Enable' : 'Disable'}
                  </span>
                </button>
              )}
            </div>

            <button className="call-btn call-btn-end" onClick={handleEndCall}>
              📵
            </button>
          </>
        )}
      </div>
    </div>
  );
}
