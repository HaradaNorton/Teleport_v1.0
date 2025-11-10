import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import type { ChatResponse } from '../types';

interface ChatSelectorProps {
  visible: boolean;
  chats: ChatResponse[];
  currentChatId: string;
  onSelect: (chatId: string) => void;
  onClose: () => void;
}

export default function ChatSelector({
  visible,
  chats,
  currentChatId,
  onSelect,
  onClose,
}: ChatSelectorProps) {
  // Filter out current chat
  const availableChats = chats.filter((c) => c.chat.id !== currentChatId);

  const renderChat = ({ item }: { item: ChatResponse }) => {
    const chatName = item.chat.title || item.members?.[0]?.name || 'Unknown';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          onSelect(item.chat.id);
          onClose();
        }}
      >
        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>
            {chatName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{chatName}</Text>
          <Text style={styles.chatType}>
            {item.chat.type === 'group' ? '👥 Group' : '💬 Personal'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Forward to...</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {availableChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No other chats available</Text>
          </View>
        ) : (
          <FlatList
            data={availableChats}
            renderItem={renderChat}
            keyExtractor={(item) => item.chat.id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 50, // Safe area
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 24,
    color: '#666',
  },
  listContent: {
    padding: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  chatAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  chatType: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
