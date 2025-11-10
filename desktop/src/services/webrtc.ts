interface WebRTCCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onSignal?: (signal: RTCSessionDescriptionInit | RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private isInitiator = false;
  private callbacks: WebRTCCallbacks = {};
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isNegotiating = false;

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

      console.log('Local stream acquired');

      // Notify callback with local stream
      if (callbacks.onLocalStream) {
        callbacks.onLocalStream(this.localStream);
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });

      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      console.log('Local tracks added to peer connection');

      // Setup event handlers
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate generated:', event.candidate.type);
          if (callbacks.onSignal) {
            callbacks.onSignal({
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            });
          }
        }
      };

      this.peerConnection.ontrack = (event) => {
        console.log('Remote track received:', event.track.kind);
        if (callbacks.onRemoteStream && event.streams[0]) {
          callbacks.onRemoteStream(event.streams[0]);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection!.connectionState;
        console.log('Connection state changed:', state);

        if (callbacks.onConnectionStateChange) {
          callbacks.onConnectionStateChange(state);
        }

        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.error('Connection state error:', state);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection!.iceConnectionState;
        console.log('ICE connection state:', state);
      };

      this.peerConnection.onnegotiationneeded = async () => {
        // Только инициатор создает offer при необходимости
        if (this.isInitiator && !this.isNegotiating) {
          await this.createAndSendOffer();
        }
      };

      console.log('WebRTC initialized as', isInitiator ? 'initiator' : 'receiver');

      // If initiator, create offer
      if (isInitiator) {
        await this.createAndSendOffer();
      }
    } catch (error: any) {
      console.error('Failed to initialize WebRTC:', error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
      throw error;
    }
  }

  private async createAndSendOffer() {
    if (!this.peerConnection || this.isNegotiating) return;

    try {
      this.isNegotiating = true;
      console.log('Creating offer...');

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('Local description set (offer)');

      if (this.callbacks.onSignal && offer) {
        this.callbacks.onSignal(offer);
      }
    } catch (error) {
      console.error('Failed to create offer:', error);
      this.isNegotiating = false;
    }
  }

  // Handle incoming offer
  async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return;
    }

    try {
      console.log('Handling offer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote description set (offer)');

      // Process any pending ICE candidates
      await this.processPendingCandidates();

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Local description set (answer)');

      if (this.callbacks.onSignal && answer) {
        this.callbacks.onSignal(answer);
      }

      this.isNegotiating = false;
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.isNegotiating = false;
    }
  }

  // Handle incoming answer
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return;
    }

    try {
      console.log('Handling answer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set (answer)');

      // Process any pending ICE candidates
      await this.processPendingCandidates();

      this.isNegotiating = false;
    } catch (error) {
      console.error('Failed to handle answer:', error);
      this.isNegotiating = false;
    }
  }

  // Handle incoming ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return;
    }

    try {
      // If remote description is not set yet, queue the candidate
      if (!this.peerConnection.remoteDescription) {
        console.log('Queuing ICE candidate (remote description not set yet)');
        this.pendingCandidates.push(candidate);
        return;
      }

      console.log('Adding ICE candidate');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  // Process pending ICE candidates
  private async processPendingCandidates() {
    if (this.pendingCandidates.length > 0 && this.peerConnection?.remoteDescription) {
      console.log(\`Processing \${this.pendingCandidates.length} pending ICE candidates\`);

      for (const candidate of this.pendingCandidates) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Failed to add pending ICE candidate:', error);
        }
      }

      this.pendingCandidates = [];
    }
  }

  // Handle incoming signal (unified method)
  async handleSignal(signal: any) {
    if (!signal) {
      console.error('Invalid signal received');
      return;
    }

    // Check if it's an SDP offer or answer
    if (signal.type === 'offer') {
      await this.handleOffer(signal);
    } else if (signal.type === 'answer') {
      await this.handleAnswer(signal);
    } else if (signal.candidate) {
      // It's an ICE candidate
      await this.addIceCandidate(signal);
    } else {
      console.warn('Unknown signal type:', signal);
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
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.callbacks = {};
    this.pendingCandidates = [];
    this.isNegotiating = false;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Check if connected
  isConnected(): boolean {
    return this.peerConnection !== null && this.peerConnection.connectionState === 'connected';
  }
}

export default new WebRTCService();
