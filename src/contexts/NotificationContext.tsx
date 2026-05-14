import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { setupNotificationHandler, registerForPushNotificationsAsync } from '../services/NotificationService';

interface NotificationContextType {
    unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [userRole, setUserRole] = useState<'user' | 'vendor' | 'admin' | null>(null);

    // 1. Setup Expo Notifications
    useEffect(() => {
        setupNotificationHandler();

        registerForPushNotificationsAsync().then(token => {
            setExpoPushToken(token);
        });

        const subscription = Notifications.addNotificationReceivedListener(notification => {
            console.log("🔔 Foreground notification received:", notification.request.content.title);
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
            console.log("🔔 Notification response:", response);
        });

        return () => {
            subscription.remove();
            responseSubscription.remove();
        };
    }, []);

    // 2. Identify Role
    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Fetch role using onSnapshot so it updates real-time
                const userDocUnsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserRole(data.role || 'user');
                    }
                });
                // Cleanup on auth change
                return () => userDocUnsub();
            } else {
                setUserRole(null);
                setUnreadCount(0);
            }
        });
        return () => unsubAuth();
    }, []);

    // Force re-render every 10 seconds to catch triggerAt times passing
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(interval);
    }, []);

    // 3. Listen for Notifications (Updates Badge Count)
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return; // Wait for auth

        // Listen to the 'notifications' collection
        // If admin, listen for 'admin' notifications AND their own uid
        const targetIds = [user.uid];
        if (userRole === 'admin') targetIds.push('admin');

        const q = query(
            collection(db, 'notifications'),
            where('userId', 'in', targetIds)
        );

        const unsubUtils = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Sort client-side (avoids needing a Firestore composite index)
            list.sort((a: any, b: any) => {
                const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : ts?.seconds ? ts.seconds * 1000 : 0;
                return getTime(b.createdAt) - getTime(a.createdAt);
            });

            const unread = list.filter((n: any) => {
                const isUnread = n.isRead === false || !n.isRead;
                if (!isUnread) return false;
                if (n.triggerAt) {
                    const triggerTime = n.triggerAt?.toDate ? n.triggerAt.toDate().getTime() : n.triggerAt?.seconds ? n.triggerAt.seconds * 1000 : 0;
                    if (triggerTime > Date.now()) return false; // Not passed yet
                }
                return true;
            }).length;

            setUnreadCount(unread);
            // Sync app badge
            Notifications.setBadgeCountAsync(unread).catch(console.error);
        });

        return () => unsubUtils();
    }, [userRole, now]); // Re-run when role changes, user logs in, or timer ticks

    return (
        <NotificationContext.Provider value={{ unreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within NotificationProvider');
    return context;
};
