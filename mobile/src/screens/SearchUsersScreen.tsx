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
import { RootStackParamList } from '../navigation/AppNavigator';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';
import type { User } from '../types';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SearchUsers'>;
};

export default function SearchUsersScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSelectUser = async (user: User) => {
    try {
      // Создаем личный чат с этим пользователем
      const result = await api.createChat({
        type: 'personal',
        user_ids: [user.id],
      });

      // Обновляем список чатов
      await loadChats();

      // Переходим в созданный чат
      navigation.navigate('Chat', {
        chatId: result.chat_id,
        chatTitle: user.name || user.phone_number,
      });
    } catch (error: any) {
      console.error('Create chat error:', error);
      Alert.alert('Error', error?.response?.data?.error || 'Failed to create chat');
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    return (
      <TouchableOpacity style={styles.userItem} onPress={() => handleSelectUser(item)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : item.phone_number.charAt(0)}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || 'No name'}</Text>
          <Text style={styles.userPhone}>{item.phone_number}</Text>
          {item.bio && <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>}
        </View>

        <View style={styles.statusIndicator}>
          {item.is_online && <View style={styles.onlineDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone number..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0088cc" />
        </View>
      )}

      {!isLoading && searchQuery.length >= 2 && users.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try different search query</Text>
        </View>
      )}

      {!isLoading && searchQuery.length < 2 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Search for users</Text>
          <Text style={styles.emptySubtext}>Enter at least 2 characters</Text>
        </View>
      )}

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  userItem: {
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
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    color: '#999',
  },
  statusIndicator: {
    marginLeft: 10,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4caf50',
  },
});
