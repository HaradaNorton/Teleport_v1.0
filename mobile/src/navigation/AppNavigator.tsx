import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';

import PhoneInputScreen from '../screens/PhoneInputScreen';
import CodeVerificationScreen from '../screens/CodeVerificationScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type RootStackParamList = {
  PhoneInput: undefined;
  CodeVerification: { phoneNumber: string };
  ChatList: undefined;
  Chat: { chatId: string; chatTitle?: string };
  Profile: undefined;
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
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Profile' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
