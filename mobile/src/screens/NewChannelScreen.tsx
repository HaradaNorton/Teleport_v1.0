import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'NewChannel'>;
  route: RouteProp<RootStackParamList, 'NewChannel'>;
};

export default function NewChannelScreen({ navigation }: Props) {
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const loadChats = useChatStore((state) => state.loadChats);

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      Alert.alert('Error', 'Please enter channel name');
      return;
    }

    setIsCreating(true);

    try {
      // Create channel (no participants needed initially - just the creator)
      const result = await api.createChat({
        type: 'channel',
        user_ids: [], // Empty for channels - creator is added automatically
        title: channelName.trim(),
      });

      await loadChats();

      Alert.alert(
        'Success',
        'Channel created successfully! You can now share it with others.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Chat', {
                chatId: result.chat_id,
                chatTitle: channelName.trim(),
                chatType: 'channel',
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Create channel error:', error);
      Alert.alert('Error', error?.response?.data?.error || 'Failed to create channel');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📢 What is a Channel?</Text>
          <Text style={styles.infoText}>
            Channels are for broadcasting messages to many subscribers. Only admins can post messages.
          </Text>
        </View>

        {/* Channel Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Channel Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter channel name"
            placeholderTextColor="#999"
            value={channelName}
            onChangeText={setChannelName}
            editable={!isCreating}
            maxLength={100}
          />
        </View>

        {/* Channel Description Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What is this channel about?"
            placeholderTextColor="#999"
            value={channelDescription}
            onChangeText={setChannelDescription}
            editable={!isCreating}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Info Points */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Channel Features:</Text>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>Unlimited subscribers</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>Only admins can post</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>Perfect for announcements and broadcasts</Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, (!channelName.trim() || isCreating) && styles.createButtonDisabled]}
          onPress={handleCreateChannel}
          disabled={!channelName.trim() || isCreating}
        >
          <Text style={styles.createButtonText}>
            {isCreating ? 'Creating Channel...' : 'Create Channel'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#0088cc',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    paddingTop: 15,
    textAlignVertical: 'top',
  },
  featuresContainer: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 25,
  },
  featuresTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  featureBullet: {
    fontSize: 16,
    color: '#0088cc',
    marginRight: 8,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  createButton: {
    backgroundColor: '#0088cc',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
