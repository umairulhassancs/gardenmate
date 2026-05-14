import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../contexts/ChatContext';
import { auth } from '../../services/firebaseConfig';
import { colors } from '../../theme';

export default function VendorChatsScreen({ navigation }: any) {
  const { conversations } = useChat();
  const currentVendorId = auth.currentUser?.uid;

  // Filter conversations to only show those where vendorId matches current authenticated vendor
  const activeChats = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'VendorChatsScreen.tsx:10', message: 'Filtering vendor conversations', data: { currentVendorId, totalConversations: conversations.length, conversations: conversations.map(c => ({ id: c.id, vendorId: c.vendorId, userId: c.userId })) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
    // #endregion

    // Filter: Only show vendor conversations (where vendorId === currentVendorId)
    const filtered = conversations.filter(c => {
      const belongsToVendor = c.vendorId === currentVendorId && c.lastMessage;
      // #region agent log
      if (!belongsToVendor && c.vendorId) {
        fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'VendorChatsScreen.tsx:15', message: 'Filtering out conversation', data: { conversationId: c.id, conversationVendorId: c.vendorId, currentVendorId, matches: c.vendorId === currentVendorId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
      }
      // #endregion
      return belongsToVendor;
    });
    
    // Deduplicate: Remove duplicate conversations by conversationId
    const seenIds = new Set<string>();
    return filtered.filter(c => {
      if (seenIds.has(c.id)) {
        return false; // Duplicate conversation
      }
      seenIds.add(c.id);
      return true;
    });
  }, [conversations, currentVendorId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}><Text style={styles.title}>Customer Messages</Text></View>
      <FlatList
        data={activeChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('VendorChatDetail', { item })}>
            <Image source={{ uri: item.customerAvatar || 'https://via.placeholder.com/50' }} style={styles.avatar} />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.name}>{item.customerName || 'Customer'}</Text>
              <Text style={styles.msg} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unreadCountVendor > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCountVendor}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
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
  badge: { backgroundColor: '#f97316', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10, paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});