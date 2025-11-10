import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { useChatStore } from './src/store/chatStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { NavigationContainerRef } from '@react-navigation/native';

export default function App() {
  const loadUser = useAuthStore((state) => state.loadUser);
  const { setIncomingCallHandler } = useChatStore();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    loadUser();

    // Setup incoming call handler
    setIncomingCallHandler((callInfo) => {
      console.log('Incoming call received:', callInfo);

      // Show incoming call alert
      Alert.alert(
        'Incoming Call',
        `${callInfo.caller.name || callInfo.caller.phone_number} is calling...`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: async () => {
              // Reject call via API
              try {
                const api = require('./src/services/api').default;
                await api.rejectCall(callInfo.call_id);
              } catch (error) {
                console.error('Failed to reject call:', error);
              }
            },
          },
          {
            text: 'Answer',
            onPress: () => {
              // Navigate to CallScreen
              if (navigationRef.current) {
                (navigationRef.current as any).navigate('Call', {
                  callId: callInfo.call_id,
                  callType: callInfo.type,
                  isIncoming: true,
                  callerInfo: callInfo.caller,
                });
              }
            },
          },
        ],
        { cancelable: false }
      );
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <AppNavigator ref={navigationRef} />
    </GestureHandlerRootView>
  );
}
