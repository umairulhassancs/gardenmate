import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';

import { colors, spacing, borderRadius, fontSize } from '../theme';

interface NotificationType {
  id: string;
  type: 'order' | 'order_update' | 'review' | 'payout' | 'alert' | 'complaint' | 'system' | 'chat' | 'feedback' | 'reminder';
  title: string;
  description: string;
  isRead: boolean;
  createdAt: Date | any;
  relatedId?: string;
}

const notificationConfig: Record<string, { icon: string; color: string }> = {
  order: { icon: 'package', color: '#3b82f6' },
  order_update: { icon: 'truck', color: '#8b5cf6' },
  review: { icon: 'star', color: '#f59e0b' },
  payout: { icon: 'credit-card', color: '#10b981' },
  alert: { icon: 'alert-triangle', color: '#ef4444' },
  complaint: { icon: 'message-circle', color: '#8b5cf6' },
  chat: { icon: 'message-circle', color: '#f97316' },
  feedback: { icon: 'star', color: '#f59e0b' },
  reminder: { icon: 'clock', color: '#10b981' },
  system: { icon: 'bell', color: '#6b7280' },
};

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  /* 🔥 FETCH NOTIFICATIONS */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || 'system',
          title: data.title || 'Notification',
          description: data.description || data.body || data.message || '',
          isRead: data.read || data.isRead || false,
          createdAt: data.time || data.createdAt,
          relatedId: data.relatedId,
          triggerAt: data.triggerAt,
        };
      }) as NotificationType[];

      const now = Date.now();
      const filteredList = list.filter((n: any) => {
        if (n.triggerAt) {
          const triggerTime = n.triggerAt?.toDate ? n.triggerAt.toDate().getTime() : n.triggerAt?.seconds ? n.triggerAt.seconds * 1000 : 0;
          if (triggerTime > now) return false;
        }
        return true;
      });

      filteredList.sort((a, b) => {
        const getTime = (n: any) => {
          const ts = n.createdAt;
          return ts?.toDate ? ts.toDate().getTime() : 0;
        };
        return getTime(b) - getTime(a);
      });

      setNotifications(filteredList);
      setLoading(false);
    });

    return () => unsub();
  }, [currentTime]);

  /* 🔔 IN-APP POPUP */
  useEffect(() => {
    const ExpoNotifications = require('expo-notifications');
    const sub = ExpoNotifications.addNotificationReceivedListener(async (n: any) => {
      // Keep listener active for foreground alerts
    });
    return () => sub.remove();
  }, []);

  /* 🟢 MARK ALL READ */
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) {
      Alert.alert('Info', 'All notifications are already read');
      return;
    }

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { read: true, isRead: true });
      });
      await batch.commit();
      Alert.alert('Success', 'Marked all as read');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  /* 🟡 MARK SINGLE READ & NAVIGATE */
  const handlePress = async (n: NotificationType) => {
    if (!n.isRead) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true, isRead: true });
    }

    if (n.type === 'chat') {
      navigation.navigate('ChatList');
    } else if (n.type === 'complaint' || n.relatedId) {
      if (n.type === 'complaint') {
        navigation.navigate('MyTickets');
      }
    }
  };

  /* ❌ DELETE */
  const deleteNotification = (id: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDoc(doc(db, 'notifications', id));
          },
        },
      ]
    );
  };

  /* ⏰ TIME FORMAT */
  const formatTime = (timestamp: any) => {
    const t = timestamp?.toDate ? timestamp : null;
    if (!t) return 'Just now';
    const d = t.toDate();
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / (86400000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* LIST */}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = notificationConfig[item.type] || notificationConfig.system;
          return (
            <TouchableOpacity
              style={[styles.card, !item.isRead && styles.unreadCard]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              {!item.isRead && <View style={styles.unreadDot} />}

              <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
                <Feather name={config.icon as any} size={20} color={config.color} />
              </View>

              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={[styles.title, !item.isRead && styles.unreadTitle]} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.body} numberOfLines={2}>{item.description}</Text>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteNotification(item.id)}
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  markAll: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.5)',
    alignItems: 'flex-start',
    minHeight: 80,
  },
  unreadCard: {
    backgroundColor: 'rgba(16,185,129,0.02)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#000',
  },
  body: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },
  empty: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    color: '#9ca3af',
    fontSize: 16,
  },
});
