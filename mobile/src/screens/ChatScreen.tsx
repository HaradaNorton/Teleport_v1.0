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
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';
import MessageActions from '../components/MessageActions';
import ChatSelector from '../components/ChatSelector';

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
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const { messages, loadMessages, sendMessage, sendMediaMessage, chats, typingUsers, sendTyping, editMessage, deleteMessage } =
    useChatStore();
  const { user } = useAuthStore();
  const { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording } =
    useVoiceRecorder();

  const chatMessages = messages[chatId] || [];
  const currentChat = chats.find((c) => c.chat.id === chatId);
  const isGroupChat = currentChat?.chat.type === 'group' || chatType === 'group';
  const isChannel = currentChat?.chat.type === 'channel' || chatType === 'channel';
  const chatTypingUsers = typingUsers[chatId] || [];
  const typingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMessages(chatId);

    // Mark messages as read when opening chat
    markChatMessagesAsRead();

    // Fetch channel member role if it's a channel
    if (isChannel) {
      fetchMemberRole();
    }
  }, [chatId]);

  const fetchMemberRole = async () => {
    try {
      const response = await api.getChatMembers(chatId);
      const myMembership = response.members.find((m: any) => m.user_id === user?.id);

      if (myMembership) {
        setMemberRole(myMembership.role || 'member');
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
        setMemberRole(null);
      }
    } catch (error) {
      console.error('Failed to fetch member role:', error);
    }
  };

  const markChatMessagesAsRead = async () => {
    const chatMessages = messages[chatId] || [];
    const unreadMessages = chatMessages.filter(
      (msg) => msg.sender_id !== user?.id && (!msg.read_by || !msg.read_by.includes(user?.id || ''))
    );

    // Mark each unread message
    for (const message of unreadMessages) {
      try {
        await api.markAsRead(message.id);
      } catch (error) {
        console.error('Failed to mark message as read:', error);
      }
    }
  };

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
    const replyToId = replyingTo?.id;
    setMessageText('');
    setReplyingTo(null);

    try {
      await sendMessage(chatId, text, replyToId);
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

  const handleStartRecording = async () => {
    const started = await startRecording();
    if (!started) {
      return;
    }
  };

  const handleStopRecording = async () => {
    const recordedAudio = await stopRecording();
    if (!recordedAudio) {
      return;
    }

    setUploading(true);

    try {
      // Upload audio file
      const uploadResult = await api.uploadMedia({
        uri: recordedAudio.uri,
        type: 'audio/m4a',
        name: `voice_${Date.now()}.m4a`,
      });

      // Send voice message
      await sendMediaMessage(chatId, {
        type: 'voice',
        media_url: uploadResult.media_url,
        file_name: uploadResult.file_name,
        mime_type: uploadResult.mime_type,
        media_size: uploadResult.file_size,
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send voice message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCancelRecording = async () => {
    await cancelRecording();
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);

    // Send typing indicator
    if (text.trim().length > 0) {
      sendTyping(chatId, true);

      // Clear previous timeout
      if (typingRef.current) {
        clearTimeout(typingRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingRef.current = setTimeout(() => {
        sendTyping(chatId, false);
      }, 3000);
    } else {
      sendTyping(chatId, false);
      if (typingRef.current) {
        clearTimeout(typingRef.current);
      }
    }
  };

  // Stop typing when sending message
  useEffect(() => {
    return () => {
      sendTyping(chatId, false);
      if (typingRef.current) {
        clearTimeout(typingRef.current);
      }
    };
  }, [chatId]);

  // Message action handlers
  const handleLongPress = (message: Message) => {
    setSelectedMessage(message);
    setShowMessageActions(true);
  };

  const handleReply = () => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
    }
  };

  const handleForward = () => {
    if (selectedMessage) {
      setForwardingMessage(selectedMessage);
      setShowChatSelector(true);
    }
  };

  const handleForwardToChat = async (targetChatId: string) => {
    if (!forwardingMessage) return;

    try {
      // Forward message to selected chat
      if (forwardingMessage.type === 'text') {
        await sendMessage(targetChatId, forwardingMessage.content || '');
      } else {
        // Forward media message
        await sendMediaMessage(targetChatId, {
          type: forwardingMessage.type as 'image' | 'video' | 'file' | 'voice',
          media_url: forwardingMessage.media_url || '',
          thumbnail_url: forwardingMessage.thumbnail_url,
          file_name: forwardingMessage.file_name || '',
          mime_type: forwardingMessage.mime_type || '',
          media_size: forwardingMessage.media_size || 0,
        });
      }

      Alert.alert('Success', 'Message forwarded successfully');
      setForwardingMessage(null);
    } catch (error) {
      console.error('Failed to forward message:', error);
      Alert.alert('Error', 'Failed to forward message. Please try again.');
    }
  };

  const handleSubscribeToChannel = async () => {
    try {
      await api.subscribeToChannel(chatId);
      setIsSubscribed(true);
      setMemberRole('member');
      Alert.alert('Success', 'You have subscribed to this channel');
      await loadMessages(chatId); // Reload to see if there are any messages
    } catch (error: any) {
      console.error('Failed to subscribe:', error);
      Alert.alert('Error', error?.response?.data?.error || 'Failed to subscribe to channel');
    }
  };

  const handleUnsubscribeFromChannel = async () => {
    Alert.alert(
      'Unsubscribe',
      'Are you sure you want to unsubscribe from this channel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsubscribe',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.unsubscribeFromChannel(chatId);
              setIsSubscribed(false);
              setMemberRole(null);
              Alert.alert('Success', 'You have unsubscribed from this channel');
              navigation.goBack();
            } catch (error: any) {
              console.error('Failed to unsubscribe:', error);
              Alert.alert('Error', error?.response?.data?.error || 'Failed to unsubscribe from channel');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (selectedMessage && selectedMessage.type === 'text') {
      setEditingMessage(selectedMessage);
      setEditText(selectedMessage.content || '');
    }
  };

  const handleDelete = () => {
    if (selectedMessage) {
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMessage(selectedMessage.id);
              } catch (error) {
                console.error('Failed to delete message:', error);
                Alert.alert('Error', 'Failed to delete message. Please try again.');
              }
            },
          },
        ]
      );
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      await editMessage(editingMessage.id, editText.trim());
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      console.error('Failed to edit message:', error);
      Alert.alert('Error', 'Failed to edit message. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const renderMessage = ({ item }: { item: Message}) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <TouchableOpacity
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.theirMessage,
        ]}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
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

          {/* Voice Message */}
          {item.type === 'voice' && item.media_url && (
            <VoiceMessagePlayer
              mediaUrl={item.media_url}
              duration={item.media_duration}
              isMyMessage={isMyMessage}
            />
          )}

          {/* Replied Message */}
          {item.reply_to && (
            <View style={styles.repliedMessage}>
              <View style={[styles.repliedLine, isMyMessage && styles.repliedLineWhite]} />
              <View style={styles.repliedContent}>
                <Text
                  style={[
                    styles.repliedSender,
                    isMyMessage ? styles.repliedSenderMy : styles.repliedSenderTheir,
                  ]}
                >
                  {item.reply_to.sender?.name || 'Unknown'}
                </Text>
                <Text
                  style={[
                    styles.repliedText,
                    isMyMessage ? styles.repliedTextMy : styles.repliedTextTheir,
                  ]}
                  numberOfLines={1}
                >
                  {item.reply_to.type === 'text' && item.reply_to.content
                    ? item.reply_to.content
                    : item.reply_to.type === 'image'
                    ? '📷 Photo'
                    : item.reply_to.type === 'video'
                    ? '🎥 Video'
                    : item.reply_to.type === 'voice'
                    ? '🎤 Voice message'
                    : item.reply_to.type === 'file'
                    ? `📎 ${item.reply_to.file_name || 'File'}`
                    : 'Message'}
                </Text>
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

          <View style={styles.messageFooter}>
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
            {item.edited_at && (
              <Text
                style={[
                  styles.editedLabel,
                  isMyMessage ? styles.myTime : styles.theirTime,
                ]}
              >
                {' (edited)'}
              </Text>
            )}
            {isMyMessage && (
              <Text style={[styles.readStatus, styles.myTime]}>
                {item.read_by && item.read_by.length > 0 ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
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

      {/* Typing Indicator */}
      {chatTypingUsers.length > 0 && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {isGroupChat
              ? `${chatTypingUsers.length} user(s) typing...`
              : 'typing...'}
          </Text>
        </View>
      )}

      {/* Recording UI */}
      {isRecording && (
        <View style={styles.recordingContainer}>
          <TouchableOpacity style={styles.cancelRecordButton} onPress={handleCancelRecording}>
            <Text style={styles.cancelRecordIcon}>✕</Text>
          </TouchableOpacity>

          <View style={styles.recordingInfo}>
            <View style={styles.recordingIndicator} />
            <Text style={styles.recordingTime}>
              {Math.floor(recordingDuration / 60)}:
              {(recordingDuration % 60).toString().padStart(2, '0')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.stopRecordButton}
            onPress={handleStopRecording}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.stopRecordIcon}>⬆️</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Reply Preview */}
      {replyingTo && !isRecording && (
        <View style={styles.replyPreview}>
          <View style={styles.replyContent}>
            <View style={styles.replyLine} />
            <View style={styles.replyInfo}>
              <Text style={styles.replyName}>
                {replyingTo.sender?.name || 'Unknown'}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {replyingTo.type === 'text' && replyingTo.content
                  ? replyingTo.content
                  : replyingTo.type === 'image'
                  ? '📷 Photo'
                  : replyingTo.type === 'video'
                  ? '🎥 Video'
                  : replyingTo.type === 'voice'
                  ? '🎤 Voice message'
                  : replyingTo.type === 'file'
                  ? `📎 ${replyingTo.file_name || 'File'}`
                  : 'Message'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.replyCloseButton}
            onPress={() => setReplyingTo(null)}
          >
            <Text style={styles.replyCloseIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Channel: Not Subscribed */}
      {isChannel && !isSubscribed && !isRecording && (
        <View style={styles.channelInfoContainer}>
          <Text style={styles.channelInfoTitle}>📢 Channel</Text>
          <Text style={styles.channelInfoText}>
            Subscribe to this channel to receive updates
          </Text>
          <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribeToChannel}>
            <Text style={styles.subscribeButtonText}>Subscribe</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Channel: Regular Member (can't post) */}
      {isChannel && isSubscribed && memberRole === 'member' && !isRecording && (
        <View style={styles.channelInfoContainer}>
          <Text style={styles.channelInfoText}>
            📢 Only admins can post in this channel
          </Text>
          <TouchableOpacity
            style={styles.unsubscribeButton}
            onPress={handleUnsubscribeFromChannel}
          >
            <Text style={styles.unsubscribeButtonText}>Unsubscribe</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Normal Input UI (for non-channels or channel admins/owners) */}
      {!isRecording && (!isChannel || (isChannel && (memberRole === 'admin' || memberRole === 'owner'))) && (
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
            onChangeText={handleTextChange}
            multiline
            maxLength={4096}
          />

          {messageText.trim() ? (
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micButton} onPress={handleStartRecording}>
              <Text style={styles.micIcon}>🎤</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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

      {/* Message Actions Modal */}
      {selectedMessage && (
        <MessageActions
          visible={showMessageActions}
          onClose={() => setShowMessageActions(false)}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onForward={handleForward}
          isMyMessage={selectedMessage.sender_id === user?.id}
          messageType={selectedMessage.type}
        />
      )}

      {/* Edit Message Modal */}
      <Modal
        visible={!!editingMessage}
        transparent
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView
          style={styles.editModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Edit Message</Text>

            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Enter your message"
            />

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelEditButton]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editModalButton, styles.saveEditButton]}
                onPress={handleSaveEdit}
                disabled={!editText.trim()}
              >
                <Text style={styles.saveEditText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Selector for Forwarding */}
      <ChatSelector
        visible={showChatSelector}
        chats={chats}
        currentChatId={chatId}
        onSelect={handleForwardToChat}
        onClose={() => setShowChatSelector(false)}
      />
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
  micButton: {
    backgroundColor: '#0088cc',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 24,
  },
  recordingContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelRecordIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
    marginRight: 10,
  },
  recordingTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  stopRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopRecordIcon: {
    fontSize: 24,
  },
  typingContainer: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  readStatus: {
    fontSize: 11,
    marginLeft: 4,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 200,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  editModalActions: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelEditButton: {
    backgroundColor: '#f0f0f0',
  },
  saveEditButton: {
    backgroundColor: '#0088cc',
  },
  cancelEditText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveEditText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  replyPreview: {
    flexDirection: 'row',
    padding: 10,
    paddingBottom: 0,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  replyContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyLine: {
    width: 3,
    height: 40,
    backgroundColor: '#0088cc',
    borderRadius: 1.5,
    marginRight: 10,
  },
  replyInfo: {
    flex: 1,
  },
  replyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0088cc',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: '#666',
  },
  replyCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyCloseIcon: {
    fontSize: 20,
    color: '#999',
  },
  repliedMessage: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  repliedLine: {
    width: 3,
    backgroundColor: '#0088cc',
    borderRadius: 1.5,
    marginRight: 8,
  },
  repliedLineWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  repliedContent: {
    flex: 1,
  },
  repliedSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  repliedSenderMy: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  repliedSenderTheir: {
    color: '#0088cc',
  },
  repliedText: {
    fontSize: 12,
  },
  repliedTextMy: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  repliedTextTheir: {
    color: '#666',
  },
  channelInfoContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  channelInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  channelInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  subscribeButton: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 150,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unsubscribeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  unsubscribeButtonText: {
    color: '#666',
    fontSize: 14,
  },
});
