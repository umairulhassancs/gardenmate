import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { db, auth } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';

interface AdminNotification {
    id: string;
    type: 'complaint' | 'commission' | 'vendor_blocked' | 'vendor_unblocked' | 'payment' | 'ticket' | 'warning' | 'alert';
    title: string;
    description: string;
    isRead: boolean;
    createdAt: Date;
    relatedId?: string;
    vendorId?: string;
    vendorName?: string;
}

const notificationConfig: Record<string, { icon: string; color: string }> = {
    complaint: { icon: 'alert-circle', color: '#ef4444' },
    commission: { icon: 'percent', color: '#f97316' },
    vendor_blocked: { icon: 'slash', color: '#ef4444' },
    vendor_unblocked: { icon: 'unlock', color: '#10b981' },
    payment: { icon: 'credit-card', color: '#10b981' },
    ticket: { icon: 'message-square', color: '#3b82f6' },
    warning: { icon: 'alert-triangle', color: '#f59e0b' },
    alert: { icon: 'bell', color: '#6366f1' },
};

export default function AdminNotificationsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    // Real-time listener for admin notifications
    useEffect(() => {
        try {
            setLoading(true);
            const unsubscribe = onSnapshot(
                query(
                    collection(db, 'notifications'),
                    where('userId', '==', 'admin')
                ),
                (snapshot) => {
                    const notificationsData: AdminNotification[] = [];
                    let unread = 0;

                    snapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        const notification: AdminNotification = {
                            id: docSnap.id,
                            type: data.type || 'alert',
                            title: data.title || 'Notification',
                            description: data.description || '',
                            isRead: data.isRead || false,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            relatedId: data.relatedId,
                            vendorId: data.vendorId,
                            vendorName: data.vendorName,
                        };
                        notificationsData.push(notification);
                        if (!notification.isRead) unread++;
                    });

                    // Sort client-side
                    notificationsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

                    setNotifications(notificationsData);
                    setUnreadCount(unread);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error loading admin notifications:', error);
                    setNotifications([]);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (error) {
            console.error('Error setting up admin notifications listener:', error);
            setLoading(false);
        }
    }, []);

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

    const handleNotificationPress = async (notification: AdminNotification) => {
        if (!notification.isRead) {
            await handleMarkAsRead(notification.id);
        }

        switch (notification.type) {
            case 'complaint':
            case 'ticket':
                navigation.navigate('AdminComplaints');
                break;
            case 'commission':
            case 'payment':
                navigation.navigate('AdminCommissions');
                break;
            case 'vendor_blocked':
            case 'vendor_unblocked':
            case 'warning':
                navigation.navigate('AdminVendors');
                break;
            default:
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
                <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Notifications</Text>
                    <View style={{ width: 24 }} />
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
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.titleRow}>
                    <Feather name="bell" size={22} color="#f97316" />
                    <Text style={styles.title}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.headerBadge}>
                            <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity onPress={handleMarkAllAsRead}>
                    <Text style={styles.markAll}>Mark all read</Text>
                </TouchableOpacity>
            </View>

            {unreadCount > 0 && (
                <View style={styles.unreadBanner}>
                    <Feather name="bell" size={16} color="#f97316" />
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
                        <Text style={styles.emptyTitle}>No notifications yet</Text>
                        <Text style={styles.emptySubtitle}>You'll receive notifications for complaints, commission payments, and vendor activities here.</Text>
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
                                {item.vendorName && (
                                    <View style={styles.vendorTag}>
                                        <Feather name="shopping-bag" size={10} color="#f97316" />
                                        <Text style={styles.vendorTagText}>{item.vendorName}</Text>
                                    </View>
                                )}
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, marginLeft: spacing.md },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    headerBadge: { backgroundColor: '#f97316', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
    headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    markAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500' },
    unreadBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
    unreadText: { fontSize: fontSize.sm, color: '#f97316', fontWeight: '500' },
    list: { padding: 16 },
    notificationCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', position: 'relative', alignItems: 'flex-start', minHeight: 80 },
    unreadCard: { backgroundColor: 'rgba(249,115,22,0.03)', borderLeftWidth: 3, borderLeftColor: '#f97316' },
    deleteBtn: { padding: 4, marginLeft: 4 },
    unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' },
    iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    content: { flex: 1, marginRight: 8 },
    contentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    notificationTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
    unreadTitle: { fontWeight: '700', color: '#000' },
    time: { fontSize: 12, color: '#9ca3af' },
    desc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
    vendorTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(249,115,22,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
    vendorTagText: { fontSize: 11, color: '#f97316', fontWeight: '500' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    loadingText: { marginTop: spacing.md, color: colors.textMuted },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl * 2, marginTop: spacing.xl * 2 },
    emptyTitle: { marginTop: spacing.md, color: colors.text, fontSize: fontSize.lg, fontWeight: 'bold' },
    emptySubtitle: { marginTop: spacing.sm, color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
});
