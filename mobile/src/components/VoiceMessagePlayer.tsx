import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';

interface Props {
  mediaUrl: string;
  duration?: number;
  isMyMessage: boolean;
}

export default function VoiceMessagePlayer({ mediaUrl, duration, isMyMessage }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        // Load and play audio
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `http://localhost:8080${mediaUrl}` },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis / 1000);
      setTotalDuration(status.durationMillis ? status.durationMillis / 1000 : totalDuration);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setCurrentPosition(0);
      }
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playButton, isMyMessage && styles.playButtonMy]}
        onPress={togglePlayback}
      >
        <Text style={[styles.playIcon, isMyMessage && styles.playIconMy]}>
          {isPlaying ? '⏸' : '▶️'}
        </Text>
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: Math.random() * 20 + 10,
                  opacity: isPlaying && i < (currentPosition / totalDuration) * 20 ? 1 : 0.3,
                },
                isMyMessage
                  ? { backgroundColor: '#fff' }
                  : { backgroundColor: '#0088cc' },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.duration, isMyMessage && styles.durationMy]}>
          {isPlaying ? formatTime(currentPosition) : formatTime(totalDuration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minWidth: 200,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playButtonMy: {
    backgroundColor: '#fff',
  },
  playIcon: {
    fontSize: 16,
  },
  playIconMy: {
    fontSize: 16,
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    gap: 2,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
  duration: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  durationMy: {
    color: 'rgba(255,255,255,0.8)',
  },
});
