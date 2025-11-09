import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';
import type { User } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'NewGroup'>;
  route: RouteProp<RootStackParamList, 'NewGroup'>;
};

export default function NewGroupScreen({ navigation, route }: Props) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>(route.params?.selectedUsers || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const loadChats = useChatStore((state) => state.loadChats);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setUsers([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.searchUsers(query.trim());
      setUsers(response.users);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (user: User) => {
    const isSelected = selectedUsers.find((u) => u.id === user.id);

    if (isSelected) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      Alert.alert('Error', 'Please select at least 2 participants');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter group name');
      return;
    }

    setIsCreating(true);

    try {
      const result = await api.createChat({
        type: 'group',
        user_ids: selectedUsers.map((u) => u.id),
        title: groupName.trim(),
      });

      await loadChats();

      navigation.navigate('Chat', {
        chatId: result.chat_id,
        chatTitle: groupName.trim(),
      });
    } catch (error: any) {
      console.error('Create group error:', error);
      Alert.alert('Error', error?.response?.data?.error || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.find((u) => u.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : item.phone_number.charAt(0)}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || 'No name'}</Text>
          <Text style={styles.userPhone}>{item.phone_number}</Text>
        </View>

        <View style={styles.checkbox}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }: { item: User }) => {
    return (
      <TouchableOpacity
        style={styles.selectedChip}
        onPress={() => toggleUserSelection(item)}
      >
        <Text style={styles.selectedChipText}>
          {item.name || item.phone_number}
        </Text>
        <Text style={styles.selectedChipRemove}>×</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Group Name Input */}
      <View style={styles.groupNameContainer}>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Group Name"
          placeholderTextColor="#999"
          value={groupName}
          onChangeText={setGroupName}
          editable={!isCreating}
        />
      </View>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedContainer}>
          <FlatList
            horizontal
            data={selectedUsers}
            renderItem={renderSelectedUser}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedList}
          />
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users to add..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
          editable={!isCreating}
        />
      </View>

      {/* User List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, (isCreating || selectedUsers.length < 2) && styles.createButtonDisabled]}
        onPress={handleCreateGroup}
        disabled={isCreating || selectedUsers.length < 2}
      >
        <Text style={styles.createButtonText}>
          {isCreating ? 'Creating...' : `Create Group (${selectedUsers.length})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  groupNameContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  groupNameInput: {
    height: 45,
    fontSize: 18,
    fontWeight: '600',
  },
  selectedContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
  },
  selectedList: {
    paddingHorizontal: 15,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0088cc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  selectedChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedChipRemove: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 5,
    fontWeight: '300',
  },
  searchContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInput: {
    height: 45,
    backgroundColor: '#f8f8f8',
    borderRadius: 22,
    paddingHorizontal: 20,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 80,
  },
  userItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  userItemSelected: {
    backgroundColor: '#f0f8ff',
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#0088cc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#0088cc',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
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
