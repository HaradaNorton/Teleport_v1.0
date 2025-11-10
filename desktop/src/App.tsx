import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import LoginPage from './pages/LoginPage';
import ChatListPage from './pages/ChatListPage';
import ChatPage from './pages/ChatPage';
import CallPage from './pages/CallPage';
import api from './services/api';
import type { IncomingCallInfo, User } from './types';
import './styles/App.css';

type View = 'login' | 'chatList' | 'chat' | 'call';

interface CallState {
  callId: string;
  callType: 'audio' | 'video';
  isIncoming: boolean;
  callerInfo?: User;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('login');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState | null>(null);

  const { user, loadUser } = useAuthStore();
  const { selectChat, setIncomingCallHandler } = useChatStore();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      setCurrentView('chatList');
    } else {
      setCurrentView('login');
    }
  }, [user]);

  // Setup incoming call handler
  useEffect(() => {
    setIncomingCallHandler((callInfo: IncomingCallInfo) => {
      console.log('Incoming call received:', callInfo);

      // Show incoming call dialog
      const answer = window.confirm(
        `Incoming ${callInfo.type} call from ${callInfo.caller.name || callInfo.caller.phone_number}. Answer?`
      );

      if (answer) {
        setCallState({
          callId: callInfo.call_id,
          callType: callInfo.type,
          isIncoming: true,
          callerInfo: callInfo.caller,
        });
        setCurrentView('call');
      } else {
        // Reject call
        api.rejectCall(callInfo.call_id).catch((err) => {
          console.error('Failed to reject call:', err);
        });
      }
    });
  }, []);

  const handleSelectChat = async (chatId: string) => {
    setSelectedChatId(chatId);
    await selectChat(chatId);
    setCurrentView('chat');
  };

  const handleBackToList = () => {
    setCurrentView('chatList');
    setSelectedChatId(null);
  };

  const handleStartCall = async (chatId: string, callType: 'audio' | 'video') => {
    try {
      // Get chat info to find receiver
      const chat = await api.getChat(chatId);
      const receiver = chat.participants?.find((p) => p.id !== user?.id);

      if (!receiver) {
        alert('Cannot find receiver for this call');
        return;
      }

      // Initiate call
      const call = await api.initiateCall({
        receiver_id: receiver.id,
        chat_id: chatId,
        type: callType,
      });

      setCallState({
        callId: call.id,
        callType: callType,
        isIncoming: false,
        callerInfo: receiver,
      });
      setCurrentView('call');
    } catch (error: any) {
      console.error('Failed to start call:', error);
      alert('Failed to start call: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEndCall = () => {
    setCallState(null);
    setCurrentView('chatList');
  };

  return (
    <div className="app">
      {currentView === 'login' && <LoginPage />}

      {currentView === 'chatList' && (
        <ChatListPage
          onSelectChat={handleSelectChat}
          onStartCall={handleStartCall}
        />
      )}

      {currentView === 'chat' && selectedChatId && (
        <ChatPage
          chatId={selectedChatId}
          onBack={handleBackToList}
          onStartCall={(callType) => handleStartCall(selectedChatId, callType)}
        />
      )}

      {currentView === 'call' && callState && (
        <CallPage
          callId={callState.callId}
          callType={callState.callType}
          isIncoming={callState.isIncoming}
          callerInfo={callState.callerInfo}
          onEnd={handleEndCall}
        />
      )}
    </div>
  );
}
