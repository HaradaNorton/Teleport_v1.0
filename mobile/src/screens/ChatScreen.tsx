import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import type { Message } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
};

export default function ChatScreen({ navigation, route }: Props) {
  const { chatId, chatTitle, chatType } = route.params;
  const [messageText, setMessageText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const { messages, loadMessages, sendMessage, sendMediaMessage, chats } = useChatStore();
  const { user } = useAuthStore();

  const chatMessages = messages[chatId] || [];
  const currentChat = chats.find((c) => c.chat.id === chatId);
  const isGroupChat = currentChat?.chat.type === 'group' || chatType === 'group';

  useEffect(() => {
    loadMessages(chatId);
  }, [chatId]);

  React.useLayoutEffect(() => {
    if (isGroupChat) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('GroupInfo', {
                chatId,
                chatTitle,
              })
            }
            style={{ marginRight: 15 }}
          >
            <Text style={{ color: '#0088cc', fontSize: 16 }}>Info</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, isGroupChat, chatId, chatTitle]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    const text = messageText.trim();
    setMessageText('');

    try {
      await sendMessage(chatId, text);
      // Прокрутка к последнему сообщению
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const pickImage = async () => {
    setShowAttachMenu(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: 'image/jpeg',
        name: `image_${Date.now()}.jpg`,
      });
    }
  };

  const takePhoto = async () => {
    setShowAttachMenu(false);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      });
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedMedia({
          uri: asset.uri,
          type: asset.mimeType || 'application/octet-stream',
          name: asset.name,
        });
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  const handleSendMedia = async () => {
    if (!selectedMedia) return;

    setUploading(true);

    try {
      // Upload file to server
      const uploadResult = await api.uploadMedia(selectedMedia);

      // Send message with media
      await sendMediaMessage(chatId, {
        type: uploadResult.media_type as any,
        media_url: uploadResult.media_url,
        thumbnail_url: uploadResult.thumbnail_url,
        file_name: uploadResult.file_name,
        mime_type: uploadResult.mime_type,
        media_size: uploadResult.file_size,
      });

      setSelectedMedia(null);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send media:', error);
      Alert.alert('Error', 'Failed to send media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {!isMyMessage && item.sender && isGroupChat && (
          <Text style={styles.senderName}>{item.sender.name || 'Unknown'}</Text>
        )}

        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {/* Image Message */}
          {item.type === 'image' && item.media_url && (
            <TouchableOpacity activeOpacity={0.9}>
              <Image
                source={{ uri: `http://localhost:8080${item.thumbnail_url || item.media_url}` }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {/* File Message */}
          {item.type === 'file' && item.media_url && (
            <View style={styles.fileContainer}>
              <Text style={styles.fileIcon}>📄</Text>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, isMyMessage && styles.fileNameMy]}>
                  {item.file_name || 'Document'}
                </Text>
                {item.media_size && (
                  <Text style={[styles.fileSize, isMyMessage && styles.fileSizeMy]}>
                    {(item.media_size / 1024).toFixed(1)} KB
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Text content */}
          {item.content && (
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myText : styles.theirText,
              ]}
            >
              {item.content}
            </Text>
          )}

          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myTime : styles.theirTime,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowAttachMenu(true)}
        >
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={4096}
        />

        <TouchableOpacity
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Attach Menu Modal */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachOption} onPress={takePhoto}>
              <Text style={styles.attachOptionIcon}>📷</Text>
              <Text style={styles.attachOptionText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachOption} onPress={pickImage}>
              <Text style={styles.attachOptionIcon}>🖼️</Text>
              <Text style={styles.attachOptionText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachOption} onPress={pickDocument}>
              <Text style={styles.attachOptionIcon}>📄</Text>
              <Text style={styles.attachOptionText}>Document</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Media Preview Modal */}
      <Modal
        visible={!!selectedMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewContent}>
            {selectedMedia?.type.startsWith('image') && (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}

            {selectedMedia && !selectedMedia.type.startsWith('image') && (
              <View style={styles.previewFile}>
                <Text style={styles.previewFileIcon}>📄</Text>
                <Text style={styles.previewFileName}>{selectedMedia.name}</Text>
              </View>
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.previewButton, styles.cancelButton]}
                onPress={() => setSelectedMedia(null)}
                disabled={uploading}
              >
                <Text style={styles.previewButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewButton, styles.sendMediaButton]}
                onPress={handleSendMedia}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.previewButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesList: {
    padding: 15,
  },
  messageContainer: {
    marginBottom: 15,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#0088cc',
  },
  theirBubble: {
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myText: {
    color: '#fff',
  },
  theirText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  theirTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  attachButton: {
    marginRight: 8,
    padding: 8,
  },
  attachIcon: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#0088cc',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  fileIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  fileNameMy: {
    color: '#fff',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fileSizeMy: {
    color: 'rgba(255,255,255,0.8)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachMenu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  attachOptionIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  attachOptionText: {
    fontSize: 16,
    color: '#000',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '90%',
    maxHeight: '80%',
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
  },
  previewFile: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewFileIcon: {
    fontSize: 64,
    marginBottom: 10,
  },
  previewFileName: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  previewButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  sendMediaButton: {
    backgroundColor: '#0088cc',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
