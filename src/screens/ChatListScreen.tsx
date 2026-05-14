import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, SafeAreaView } from 'react-native';
import { useChat } from '../contexts/ChatContext';
import { auth } from '../services/firebaseConfig';

export default function ChatListScreen({ navigation }: any) {
  const { conversations } = useChat();
  const currentUserId = auth.currentUser?.uid;
  
  // Filter: Only show customer conversations (where currentUserId is the userId, not vendorId)
  // This prevents showing vendor conversations when user is viewing customer side
  const filtered = conversations.filter(c => {
    // Show conversation if:
    // 1. It has a lastMessage
    // 2. Current user is the customer (userId === currentUserId), not the vendor
    return c.lastMessage && c.userId === currentUserId;
  });
  
  // Deduplicate: Remove duplicate conversations by conversationId (in case same conversation appears twice)
  const seenIds = new Set<string>();
  const list = filtered.filter(c => {
    if (seenIds.has(c.id)) {
      return false; // Duplicate conversation
    }
    seenIds.add(c.id);
    return true;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}><Text style={styles.title}>My Chats</Text></View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const vendor = item.vendor ? { ...item.vendor, id: item.vendorId || item.vendor.id } : { id: item.vendorId, storeName: 'Store', logoUrl: 'https://via.placeholder.com/50' };
          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate('Chat', { vendor })}
            >
              <Image source={{ uri: vendor?.logoUrl || 'https://via.placeholder.com/50' }} style={styles.avatar} />
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.name}>{vendor?.storeName || 'Store'}</Text>
                <Text style={styles.msg} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              {item.unreadCountUser > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCountUser}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  item: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#f9f9f9', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  name: { fontWeight: 'bold' },
  msg: { color: 'gray', marginTop: 4 },
  badge: { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10, paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});