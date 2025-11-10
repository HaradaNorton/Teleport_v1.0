import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';

import PhoneInputScreen from '../screens/PhoneInputScreen';
import CodeVerificationScreen from '../screens/CodeVerificationScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import CallScreen from '../screens/CallScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchUsersScreen from '../screens/SearchUsersScreen';
import NewGroupScreen from '../screens/NewGroupScreen';
import NewChannelScreen from '../screens/NewChannelScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import type { User } from '../types';

export type RootStackParamList = {
  PhoneInput: undefined;
  CodeVerification: { phoneNumber: string };
  ChatList: undefined;
  Chat: { chatId: string; chatTitle?: string; chatType?: string };
  Call: {
    callId: string;
    callType: 'audio' | 'video';
    isIncoming: boolean;
    callerInfo?: {
      id: string;
      name?: string;
      phone_number: string;
      avatar_url?: string;
    };
  };
  Profile: undefined;
  SearchUsers: { mode?: 'new_chat' | 'add_to_group'; chatId?: string } | undefined;
  NewGroup: { selectedUsers?: User[] };
  NewChannel: undefined;
  GroupInfo: { chatId: string; chatTitle?: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null; // TODO: Add loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          <>
            <Stack.Screen
              name="PhoneInput"
              component={PhoneInputScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CodeVerification"
              component={CodeVerificationScreen}
              options={{ title: 'Verification' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{ title: 'Teleport' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params.chatTitle || 'Chat' })}
            />
            <Stack.Screen
              name="Call"
              component={CallScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Profile' }}
            />
            <Stack.Screen
              name="SearchUsers"
              component={SearchUsersScreen}
              options={{ title: 'New Chat' }}
            />
            <Stack.Screen
              name="NewGroup"
              component={NewGroupScreen}
              options={{ title: 'New Group' }}
            />
            <Stack.Screen
              name="NewChannel"
              component={NewChannelScreen}
              options={{ title: 'New Channel' }}
            />
            <Stack.Screen
              name="GroupInfo"
              component={GroupInfoScreen}
              options={{ title: 'Group Info' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
