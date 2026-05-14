// User Presence Service
// Real-time online/offline status and typing indicators (WhatsApp-like)

import { db } from './firebaseConfig';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UserPresence } from '../types/ticket';

/**
 * Set user online status
 * @param userId - User ID
 * @param online - Online status
 */
export async function setUserOnline(userId: string, online: boolean): Promise<void> {
    try {
        const presenceRef = doc(db, 'presence', userId);

        await setDoc(
            presenceRef,
            {
                userId,
                online,
                lastSeen: new Date(),
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    } catch (error) {
        console.error('Error setting user online status:', error);
    }
}

/**
 * Update active ticket (user is currently viewing)
 * @param userId - User ID
 * @param ticketId - Ticket ID being viewed
 */
export async function setActiveTicket(userId: string, ticketId: string | null): Promise<void> {
    try {
        const presenceRef = doc(db, 'presence', userId);

        await updateDoc(presenceRef, {
            activeTickets: ticketId ? [ticketId] : [],
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error setting active ticket:', error);
    }
}

/**
 * Update typing status
 * @param userId - User ID
 * @param ticketId - Ticket ID they're typing in (null if stopped typing)
 */
export async function setTypingStatus(
    userId: string,
    ticketId: string | null
): Promise<void> {
    try {
        const presenceRef = doc(db, 'presence', userId);

        await setDoc(
            presenceRef,
            {
                userId,
                typing: {
                    ticketId,
                    startedAt: ticketId ? new Date() : null,
                },
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    } catch (error) {
        console.error('Error setting typing status:', error);
    }
}

/**
 * Subscribe to user presence updates
 * @param userId - User ID to watch
 * @param callback - Callback function with presence data
 * @returns Unsubscribe function
 */
export function subscribeToPresence(
    userId: string,
    callback: (presence: UserPresence | null) => void
): () => void {
    const presenceRef = doc(db, 'presence', userId);

    return onSnapshot(
        presenceRef,
        (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const presence: UserPresence = {
                    userId: data.userId,
                    online: data.online || false,
                    lastSeen: data.lastSeen?.toDate?.() || new Date(),
                    activeTickets: data.activeTickets || [],
                    typing: {
                        ticketId: data.typing?.ticketId || null,
                        startedAt: data.typing?.startedAt?.toDate?.() || null,
                    },
                };
                callback(presence);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error('Error subscribing to presence:', error);
            callback(null);
        }
    );
}

/**
 * Format last seen time for display
 * @param lastSeen - Last seen timestamp
 * @returns Formatted string (e.g., "online", "last seen 5 min ago")
 */
export function formatLastSeen(online: boolean, lastSeen: Date): string {
    if (online) return 'online';

    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'last seen just now';
    if (minutes < 60) return `last seen ${minutes} min ago`;
    if (hours < 24) return `last seen ${hours}h ago`;
    if (days < 7) return `last seen ${days}d ago`;

    return `last seen ${lastSeen.toLocaleDateString()}`;
}

/**
 * Initialize presence system for a user (call on app start)
 * @param userId - User ID
 */
export async function initializePresence(userId: string): Promise<void> {
    try {
        const presenceRef = doc(db, 'presence', userId);

        // Set user online
        await setDoc(
            presenceRef,
            {
                userId,
                online: true,
                lastSeen: new Date(),
                activeTickets: [],
                typing: {
                    ticketId: null,
                    startedAt: null,
                },
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );

        // Set up onDisconnect (requires Firebase Realtime Database or Cloud Function)
        // For now, we'll handle this via app lifecycle events
        // On app background/close, call: setUserOnline(userId, false)
    } catch (error) {
        console.error('Error initializing presence:', error);
    }
}

/**
 * Cleanup presence on app close/background
 * @param userId - User ID
 */
export async function cleanupPresence(userId: string): Promise<void> {
    await setUserOnline(userId, false);
    await setTypingStatus(userId, null);
    await setActiveTicket(userId, null);
}
