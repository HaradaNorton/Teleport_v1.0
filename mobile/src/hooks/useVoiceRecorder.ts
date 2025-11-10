import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

export interface RecordedAudio {
  uri: string;
  duration: number;
}

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async (): Promise<boolean> => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access');
        return false;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
      return false;
    }
  };

  const stopRecording = async (): Promise<RecordedAudio | null> => {
    try {
      if (!recordingRef.current) {
        return null;
      }

      // Stop duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      setIsRecording(false);

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recordingRef.current.getURI();
      const duration = recordingDuration;

      recordingRef.current = null;

      if (!uri) {
        return null;
      }

      return { uri, duration };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      return null;
    }
  };

  const cancelRecording = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
        recordingRef.current = null;
      }

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      setIsRecording(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
