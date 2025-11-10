import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface MessageActionsProps {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  isMyMessage: boolean;
  messageType: string;
}

export default function MessageActions({
  visible,
  onClose,
  onEdit,
  onDelete,
  onReply,
  isMyMessage,
  messageType,
}: MessageActionsProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menu}>
          {/* Reply */}
          {onReply && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onReply();
                onClose();
              }}
            >
              <Text style={styles.menuText}>↩️ Reply</Text>
            </TouchableOpacity>
          )}

          {/* Edit - only for text messages from current user */}
          {isMyMessage && messageType === 'text' && onEdit && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onEdit();
                onClose();
              }}
            >
              <Text style={styles.menuText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}

          {/* Delete - only for current user's messages */}
          {isMyMessage && (
            <TouchableOpacity
              style={[styles.menuItem, styles.deleteItem]}
              onPress={() => {
                onDelete();
                onClose();
              }}
            >
              <Text style={[styles.menuText, styles.deleteText]}>🗑 Delete</Text>
            </TouchableOpacity>
          )}

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.menuItem, styles.cancelItem]}
            onPress={onClose}
          >
            <Text style={styles.menuText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deleteItem: {
    backgroundColor: '#fff5f5',
  },
  cancelItem: {
    borderBottomWidth: 0,
    backgroundColor: '#f8f8f8',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  deleteText: {
    color: '#ff3b30',
  },
});
