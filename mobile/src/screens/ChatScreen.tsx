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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import type { Message } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
};

export default function ChatScreen({ navigation, route }: Props) {
  const { chatId, chatTitle, chatType } = route.params;
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { messages, loadMessages, sendMessage, chats } = useChatStore();
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {!isMyMessage && item.sender && (
          <Text style={styles.senderName}>{item.sender.name || 'Unknown'}</Text>
        )}

        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myText : styles.theirText,
            ]}
          >
            {item.content}
          </Text>

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
});
