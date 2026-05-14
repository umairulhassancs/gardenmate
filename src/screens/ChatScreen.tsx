import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useChat } from '../contexts/ChatContext';
import { auth } from '../services/firebaseConfig';
import ChatMessageBubble from '../components/ChatMessageBubble';

export default function ChatScreen({ route, navigation }: any) {
  const { vendor } = route.params;
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const { sendMessage, getMessages, markAsRead } = useChat();
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (vendor?.id && currentUserId) {
      const conversationId = [currentUserId, vendor.id].sort().join('_');
      const unsub = getMessages(currentUserId, vendor.id, (msgs) => {
        // Filter messages: Only show messages where current user is customer OR vendor is sender
        // This prevents showing messages sent by current user when they were acting as vendor
        const filteredMsgs = msgs.filter(msg => {
          // Show message if:
          // 1. Current user sent it as customer (senderId === currentUserId AND senderType === 'customer')
          // 2. Vendor sent it (senderId === vendor.id AND senderType === 'vendor')
          return (msg.senderId === currentUserId && msg.senderType === 'customer') ||
                 (msg.senderId === vendor.id && msg.senderType === 'vendor');
        });
        setMessages(filteredMsgs);
        // Re-mark as read whenever new messages arrive while chat is open
        markAsRead(conversationId, 'customer');
      });
      markAsRead(conversationId, 'customer');
      return () => unsub();
    }
  }, [vendor?.id, currentUserId]);

  const onSend = async () => {
    if (text.trim() && vendor?.id && currentUserId) {
      const m = text.trim(); setText('');
      await sendMessage(currentUserId, vendor.id, m, 'customer', vendor);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerProfile} onPress={() => vendor?.id && navigation.navigate('UserProfileView', { userId: vendor.id, userName: vendor.storeName, userPhoto: vendor.logoUrl || vendor.photoURL, isVendorProfile: true })} activeOpacity={0.7}>
            {vendor?.logoUrl || vendor?.photoURL ? (
              <Image source={{ uri: vendor.logoUrl || vendor.photoURL }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}><Feather name="store" size={20} color="#9ca3af" /></View>
            )}
            <Text style={styles.headerName}>{vendor?.storeName || 'Store'}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          renderItem={({ item }) => {
            const isMyMessage = item.senderId === currentUserId && item.senderType === 'customer';
            return (
              <ChatMessageBubble
                text={item.text}
                isMyMessage={isMyMessage}
                createdAt={item.createdAt}
                read={item.read}
                status={item.status}
              />
            );
          }}
        />
        <View style={styles.inputArea}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Message..." />
          <TouchableOpacity onPress={onSend} style={styles.sendBtn}><Feather name="send" size={20} color="#fff" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  headerName: { marginLeft: 10, fontWeight: 'bold', fontSize: 16 },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 15 },
  sendBtn: { backgroundColor: '#f97316', padding: 10, borderRadius: 20, marginLeft: 10 }
});