import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'GroupInfo'>;
  route: RouteProp<RootStackParamList, 'GroupInfo'>;
};

interface Member {
  id: string;
  phone_number: string;
  name?: string;
  avatar_url?: string;
  is_online: boolean;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export default function GroupInfoScreen({ navigation, route }: Props) {
  const { chatId, chatTitle } = route.params;
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(chatTitle || '');
  const currentUser = useAuthStore((state) => state.user);

  const currentMember = members.find((m) => m.id === currentUser?.id);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin' || isOwner;

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const response = await api.getChatMembers(chatId);
      setMembers(response.members);
    } catch (error) {
      console.error('Failed to load members:', error);
      Alert.alert('Error', 'Failed to load group members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    try {
      await api.updateChatInfo(chatId, { title: newTitle.trim() });
      setIsEditing(false);
      Alert.alert('Success', 'Group name updated');
      navigation.setParams({ chatTitle: newTitle.trim() });
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to update group name');
    }
  };

  const handleAddMember = () => {
    navigation.navigate('SearchUsers', {
      mode: 'add_to_group',
      chatId,
    } as any);
  };

  const handleRemoveMember = (member: Member) => {
    if (member.role === 'owner') {
      Alert.alert('Error', 'Cannot remove group owner');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Remove ${member.name || member.phone_number} from group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeChatMember(chatId, member.id);
              await loadMembers();
              Alert.alert('Success', 'Member removed');
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = (member: Member) => {
    if (!isOwner) {
      Alert.alert('Error', 'Only group owner can change roles');
      return;
    }

    const newRole = member.role === 'admin' ? 'member' : 'admin';

    Alert.alert(
      'Change Role',
      `Make ${member.name || member.phone_number} ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await api.updateMemberRole(chatId, member.id, newRole);
              await loadMembers();
              Alert.alert('Success', 'Role updated');
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error || 'Failed to update role');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (isOwner) {
      Alert.alert('Error', 'Owner cannot leave group. Transfer ownership first.');
      return;
    }

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.leaveChat(chatId);
              navigation.navigate('ChatList');
              Alert.alert('Success', 'You left the group');
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const isCurrentUser = item.id === currentUser?.id;

    return (
      <View style={styles.memberItem}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : item.phone_number.charAt(0)}
          </Text>
        </View>

        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.name || 'No name'}
            {isCurrentUser && <Text style={styles.youLabel}> (You)</Text>}
          </Text>
          <Text style={styles.memberPhone}>{item.phone_number}</Text>
          <Text style={styles.memberRole}>
            {item.role === 'owner' ? '👑 Owner' : item.role === 'admin' ? '⭐ Admin' : 'Member'}
          </Text>
        </View>

        {isAdmin && !isCurrentUser && (
          <View style={styles.memberActions}>
            {isOwner && item.role !== 'owner' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleChangeRole(item)}
              >
                <Text style={styles.actionButtonText}>
                  {item.role === 'admin' ? 'Demote' : 'Promote'}
                </Text>
              </TouchableOpacity>
            )}
            {item.role !== 'owner' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => handleRemoveMember(item)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Group Info */}
      <View style={styles.groupHeader}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>
            {newTitle.charAt(0).toUpperCase()}
          </Text>
        </View>

        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.titleInput}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setNewTitle(chatTitle || '');
                  setIsEditing(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveTitle}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.titleContainer}>
            <Text style={styles.groupTitle}>{newTitle}</Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.memberCount}>{members.length} members</Text>
      </View>

      {/* Members Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
          {isAdmin && (
            <TouchableOpacity onPress={handleAddMember}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeaveGroup}
        >
          <Text style={styles.leaveButtonText}>Leave Group</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupHeader: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  groupAvatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 5,
  },
  editLink: {
    color: '#0088cc',
    fontSize: 14,
    marginTop: 5,
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#0088cc',
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    minWidth: 200,
    textAlign: 'center',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  section: {
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  addButton: {
    color: '#0088cc',
    fontSize: 16,
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  youLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  memberPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#0088cc',
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 5,
  },
  actionButton: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#ff3b30',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsSection: {
    padding: 20,
  },
  leaveButton: {
    backgroundColor: '#ff3b30',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
