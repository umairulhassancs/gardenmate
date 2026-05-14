import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../services/firebaseConfig';
import ChatMessageBubble from '../../components/ChatMessageBubble';

export default function VendorChatDetailScreen({ route, navigation }: any) {
  const { item } = route.params;
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const { sendMessage, getMessages, getMessagesByConversationId, markAsRead } = useChat();
  const flatListRef = useRef<FlatList>(null);

  // Use authenticated vendor ID instead of item.vendorId to ensure security
  const myVendorId = auth.currentUser?.uid;
  const customerId = item?.userId || item?.customerId;
  const conversationId = item?.id; // Use the conversation document ID directly

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'VendorChatDetailScreen.tsx:20', message: 'VendorChatDetailScreen useEffect', data: { myVendorId, itemVendorId: item?.vendorId, customerId, conversationId, matches: item?.vendorId === myVendorId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
    // #endregion

    // Verify that the conversation belongs to the current vendor before loading messages
    if (myVendorId && conversationId && item?.vendorId === myVendorId) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'VendorChatDetailScreen.tsx:26', message: 'Fetching messages using conversation ID directly', data: { conversationId, myVendorId, customerId, itemVendorId: item?.vendorId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
      // #endregion

      markAsRead(conversationId, 'vendor');
      // Use getMessagesByConversationId to fetch messages using the stored conversation ID
      const unsub = getMessagesByConversationId(conversationId, (msgs) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'VendorChatDetailScreen.tsx:31', message: 'Messages received callback', data: { messageCount: msgs.length, conversationId, firstMsgSenderId: msgs[0]?.senderId || null, myVendorId, allSenderIds: msgs.map(m => m.senderId) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
        // #endregion
        // Filter messages: Only show messages where current vendor is vendor OR customer is sender
        // This prevents showing messages sent by current vendor when they were acting as customer
        const filteredMsgs = msgs.filter(msg => {
          // Show message if:
          // 1. Current vendor sent it as vendor (senderId === myVendorId AND senderType === 'vendor')
          // 2. Customer sent it (senderId === customerId AND senderType === 'customer')
          return (msg.senderId === myVendorId && msg.senderType === 'vendor') ||
                 (msg.senderId === customerId && msg.senderType === 'customer');
        });
        setMessages(filteredMsgs);
      });
      return () => unsub();
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'VendorChatDetailScreen.tsx:37', message: 'Security check failed - conversation does not belong to vendor', data: { myVendorId, itemVendorId: item?.vendorId, customerId, conversationId, matches: item?.vendorId === myVendorId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
      // #endregion
      setMessages([]);
    }
  }, [item, myVendorId, conversationId]);

  const onSend = async () => {
    if (text.trim() && myVendorId && customerId && item?.vendorId === myVendorId) {
      const m = text.trim(); setText('');
      await sendMessage(myVendorId, customerId, m, 'vendor', item.vendor);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="light-content" backgroundColor={auth.currentUser ? '#f97316' : '#fff'} />
      <KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} /></TouchableOpacity>
          {item.customerAvatar && (
            <Image
              source={{ uri: item.customerAvatar }}
              style={styles.headerAvatar}
            />
          )}
          <Text style={{ marginLeft: 10, fontWeight: 'bold' }}>{item.customerName || 'Customer'}</Text>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          renderItem={({ item: m }) => {
            const isMyMessage = m.senderId === myVendorId && m.senderType === 'vendor';
            return (
              <ChatMessageBubble
                text={m.text}
                isMyMessage={isMyMessage}
                createdAt={m.createdAt}
                read={m.read}
                status={m.status}
              />
            );
          }}
        />
        <View style={styles.inputArea}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Reply..." />
          <TouchableOpacity onPress={onSend} style={styles.sendBtn}><Feather name="send" size={20} color="#fff" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 10 },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 15 },
  sendBtn: { backgroundColor: '#f97316', padding: 10, borderRadius: 20, marginLeft: 10 }
});
