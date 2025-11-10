import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';

// STUN servers for ICE candidate gathering
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type WebRTCCallbacks = {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: string) => void;
};

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks = {};

  /**
   * Initialize WebRTC connection
   */
  async initializeConnection(
    isVideo: boolean,
    callbacks: WebRTCCallbacks
  ): Promise<void> {
    this.callbacks = callbacks;

    try {
      // Get user media (audio/video)
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
      });

      console.log('Local stream obtained:', this.localStream);

      // Notify callback
      if (this.callbacks.onLocalStream) {
        this.callbacks.onLocalStream(this.localStream);
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(configuration);

      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Setup event handlers
      this.setupPeerConnectionHandlers();

      console.log('WebRTC connection initialized');
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      throw error;
    }
  }

  /**
   * Setup peer connection event handlers
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // ICE candidate event
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callbacks.onIceCandidate) {
        console.log('ICE candidate generated:', event.candidate);
        this.callbacks.onIceCandidate(event.candidate);
      }
    };

    // Track event (remote stream)
    this.peerConnection.ontrack = (event) => {
      console.log('Remote track received:', event.streams);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.callbacks.onRemoteStream) {
          this.callbacks.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Connection state change
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Connection state changed:', state);
      if (this.callbacks.onConnectionStateChange && state) {
        this.callbacks.onConnectionStateChange(state);
      }
    };

    // ICE connection state change
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('ICE connection state changed:', state);
    };
  }

  /**
   * Create offer (caller side)
   */
  async createOffer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('Offer created:', offer);

      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      throw error;
    }
  }

  /**
   * Handle received offer (callee side)
   */
  async handleOffer(offer: RTCSessionDescription): Promise<RTCSessionDescription> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      console.log('Remote offer set');

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Answer created:', answer);

      return answer;
    } catch (error) {
      console.error('Failed to handle offer:', error);
      throw error;
    }
  }

  /**
   * Handle received answer (caller side)
   */
  async handleAnswer(answer: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      console.log('Remote answer set');
    } catch (error) {
      console.error('Failed to handle answer:', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      console.warn('Peer connection not initialized, ignoring ICE candidate');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added');
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  /**
   * Toggle microphone mute
   */
  toggleMute(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // Return muted state
    }

    return false;
  }

  /**
   * Toggle camera (for video calls)
   */
  toggleCamera(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // Return camera off state
    }

    return false;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Close connection and cleanup
   */
  close(): void {
    console.log('Closing WebRTC connection');

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.callbacks = {};
  }
}

export default new WebRTCService();
