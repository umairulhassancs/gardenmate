import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { auth, db } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';

interface Notification {
    id: string;
    type: 'order' | 'review' | 'payout' | 'alert' | 'complaint' | 'chat' | 'feedback' | 'commission' | 'warning';
    title: string;
    description: string;
    isRead: boolean;
    createdAt: Date;
    relatedId?: string; // orderId, reviewId, etc.
}

const notificationConfig: Record<string, { icon: string; color: string }> = {
    order: { icon: 'package', color: '#3b82f6' },
    review: { icon: 'star', color: '#f59e0b' },
    payout: { icon: 'credit-card', color: '#10b981' },
    alert: { icon: 'alert-triangle', color: '#ef4444' },
    complaint: { icon: 'alert-circle', color: '#ef4444' },
    chat: { icon: 'message-circle', color: '#f97316' },
    feedback: { icon: 'star', color: '#f59e0b' },
    commission: { icon: 'percent', color: '#f97316' },
    warning: { icon: 'slash', color: '#ef4444' },
};

export default function VendorNotificationsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const vendorId = auth.currentUser?.uid;

    // Real-time listener for notifications
    useEffect(() => {
        if (!vendorId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Note: Removed orderBy to avoid needing a composite index
            // Sorting is done client-side instead
            const unsubscribe = onSnapshot(
                query(
                    collection(db, 'notifications'),
                    where('recipientId', '==', vendorId)
                ),
                (snapshot) => {
                    const notificationsData: Notification[] = [];
                    let unread = 0;

                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        const notification: Notification = {
                            id: doc.id,
                            type: data.type || 'alert',
                            title: data.title || 'Notification',
                            description: data.description || '',
                            isRead: data.isRead || false,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            relatedId: data.relatedId
                        };
                        notificationsData.push(notification);
                        if (!notification.isRead) unread++;
                    });

                    // Sort client-side by createdAt descending
                    notificationsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

                    setNotifications(notificationsData);
                    setUnreadCount(unread);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error loading notifications:', error);
                    // Don't show alert for index errors, just show empty state
                    setNotifications([]);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (error) {
            console.error('Error setting up notifications listener:', error);
            setLoading(false);
        }
    }, [vendorId]);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            const notifRef = doc(db, 'notifications', notificationId);
            await updateDoc(notifRef, {
                isRead: true,
                readAt: new Date()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) {
            Alert.alert('Info', 'All notifications are already read');
            return;
        }

        Alert.alert(
            'Mark All as Read',
            `Mark ${unreadCount} notification${unreadCount > 1 ? 's' : ''} as read?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        try {
                            const batch = writeBatch(db);
                            const unreadNotifs = notifications.filter(n => !n.isRead);

                            unreadNotifs.forEach(notif => {
                                const notifRef = doc(db, 'notifications', notif.id);
                                batch.update(notifRef, { isRead: true, readAt: new Date() });
                            });

                            await batch.commit();
                            Alert.alert('Success', 'All notifications marked as read');
                        } catch (error) {
                            console.error('Error marking all as read:', error);
                            Alert.alert('Error', 'Failed to mark notifications as read');
                        }
                    }
                }
            ]
        );
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read when pressed
        if (!notification.isRead) {
            await handleMarkAsRead(notification.id);
        }

        // Navigate based on notification type
        switch (notification.type) {
            case 'order':
                navigation.navigate('VendorOrders');
                break;
            case 'review':
                navigation.navigate('VendorReviews');
                break;
            case 'payout':
                navigation.navigate('VendorPayouts');
                break;
            case 'complaint':
                navigation.navigate('VendorComplaints');
                break;
            case 'chat':
                navigation.navigate('VendorChats');
                break;
            case 'alert':
                if (notification.description.includes('stock')) {
                    navigation.navigate('Inventory');
                }
                break;
            case 'commission':
                navigation.navigate('VendorCommission');
                break;
            case 'warning':
                Alert.alert(
                    'Account Notice',
                    notification.description,
                    [{ text: 'OK' }]
                );
                break;
        }
    };

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

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Notifications</Text>
                    <View style={{ width: 80 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                <TouchableOpacity onPress={handleMarkAllAsRead}>
                    <Text style={styles.markAll}>Mark all read</Text>
                </TouchableOpacity>
            </View>

            {unreadCount > 0 && (
                <View style={styles.unreadBanner}>
                    <Feather name="bell" size={16} color={colors.primary} />
                    <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
                </View>
            )}

            <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="bell-off" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const config = notificationConfig[item.type] || notificationConfig.alert;
                    return (
                        <TouchableOpacity
                            style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
                            onPress={() => handleNotificationPress(item)}
                        >
                            {!item.isRead && <View style={styles.unreadDot} />}
                            <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
                                <Feather name={config.icon as any} size={20} color={config.color} />
                            </View>
                            <View style={styles.content}>
                                <View style={styles.contentHeader}>
                                    <Text style={[styles.notificationTitle, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
                                </View>
                                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
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
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    markAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500' },
    unreadBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
    unreadText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },
    list: { padding: 16 },
    notificationCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', position: 'relative', alignItems: 'flex-start', minHeight: 80 },
    unreadCard: { backgroundColor: 'rgba(16,185,129,0.02)', borderLeftWidth: 3, borderLeftColor: colors.primary },
    deleteBtn: { padding: 4, marginLeft: 4 },
    unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    content: { flex: 1, marginRight: 8 },
    contentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    notificationTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
    unreadTitle: { fontWeight: '700', color: '#000' },
    time: { fontSize: 12, color: '#9ca3af' },
    desc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    loadingText: { marginTop: spacing.md, color: colors.textMuted },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl * 2, marginTop: spacing.xl * 2 },
    emptyText: { marginTop: spacing.md, color: colors.textMuted, fontSize: fontSize.base },
});
