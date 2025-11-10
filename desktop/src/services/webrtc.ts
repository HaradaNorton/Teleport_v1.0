import SimplePeer from 'simple-peer';

interface WebRTCCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onSignal?: (signal: SimplePeer.SignalData) => void;
  onConnectionStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
}

class WebRTCService {
  private peer: SimplePeer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private isInitiator = false;
  private callbacks: WebRTCCallbacks = {};

  async initializeConnection(isVideo: boolean, isInitiator: boolean, callbacks: WebRTCCallbacks) {
    try {
      this.isInitiator = isInitiator;
      this.callbacks = callbacks;

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : false,
      });

      // Notify callback with local stream
      if (callbacks.onLocalStream) {
        callbacks.onLocalStream(this.localStream);
      }

      // Create peer connection
      this.peer = new SimplePeer({
        initiator: isInitiator,
        stream: this.localStream,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      // Handle signals (offer/answer/ice-candidates)
      this.peer.on('signal', (signal: SimplePeer.SignalData) => {
        console.log('WebRTC signal:', signal.type);
        if (callbacks.onSignal) {
          callbacks.onSignal(signal);
        }
      });

      // Handle remote stream
      this.peer.on('stream', (stream: MediaStream) => {
        console.log('Remote stream received');
        if (callbacks.onRemoteStream) {
          callbacks.onRemoteStream(stream);
        }
        if (callbacks.onConnectionStateChange) {
          callbacks.onConnectionStateChange('connected');
        }
      });

      // Handle connection
      this.peer.on('connect', () => {
        console.log('Peer connection established');
        if (callbacks.onConnectionStateChange) {
          callbacks.onConnectionStateChange('connected');
        }
      });

      // Handle close
      this.peer.on('close', () => {
        console.log('Peer connection closed');
        if (callbacks.onConnectionStateChange) {
          callbacks.onConnectionStateChange('disconnected');
        }
      });

      // Handle errors
      this.peer.on('error', (err: Error) => {
        console.error('Peer error:', err);
        if (callbacks.onError) {
          callbacks.onError(err);
        }
        if (callbacks.onConnectionStateChange) {
          callbacks.onConnectionStateChange('failed');
        }
      });

      console.log('WebRTC initialized as', isInitiator ? 'initiator' : 'receiver');
    } catch (error: any) {
      console.error('Failed to initialize WebRTC:', error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
      throw error;
    }
  }

  // Handle incoming signal (offer/answer/ice-candidate)
  handleSignal(signal: SimplePeer.SignalData) {
    if (this.peer) {
      try {
        this.peer.signal(signal);
      } catch (error) {
        console.error('Failed to handle signal:', error);
      }
    } else {
      console.warn('Peer connection not initialized');
    }
  }

  // Toggle mute
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // Return muted state
      }
    }
    return false;
  }

  // Toggle video
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled; // Return disabled state
      }
    }
    return false;
  }

  // Get muted state
  isMuted(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? !audioTrack.enabled : false;
    }
    return false;
  }

  // Get video disabled state
  isVideoDisabled(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      return videoTrack ? !videoTrack.enabled : false;
    }
    return false;
  }

  // Close connection
  close() {
    console.log('Closing WebRTC connection');

    // Stop peer connection
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.callbacks = {};
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Check if connected
  isConnected(): boolean {
    return this.peer !== null && !this.peer.destroyed;
  }
}

export default new WebRTCService();
