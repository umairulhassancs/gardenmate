// Message Status Service
// WhatsApp-like message delivery and read receipt tracking

import { db } from './firebaseConfig';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { MessageStatus, TicketMessage } from '../types/ticket';

/**
 * Update message status (sent → delivered → read)
 * @param ticketId - Ticket document ID
 * @param messageId - Message ID to update
 * @param newStatus - New status
 */
export async function updateMessageStatus(
    ticketId: string,
    messageId: string,
    newStatus: MessageStatus
): Promise<void> {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);

        // We need to fetch the ticket, update the specific message, and write back
        // Note: This requires reading the entire messages array
        // For better performance, consider using Cloud Functions

        const { getDoc } = require('firebase/firestore');
        const ticketSnap = await getDoc(ticketRef);

        if (!ticketSnap.exists()) {
            console.error('Ticket not found:', ticketId);
            return;
        }

        const ticketData = ticketSnap.data();
        const messages: any[] = ticketData.messages || [];

        const updatedMessages = messages.map((msg) => {
            if (msg.id === messageId) {
                const now = new Date();
                const updates: any = { status: newStatus };

                if (newStatus === 'delivered' && !msg.deliveredAt) {
                    updates.deliveredAt = now;
                } else if (newStatus === 'read' && !msg.readAt) {
                    updates.readAt = now;
                    updates.deliveredAt = msg.deliveredAt || now;
                }

                return { ...msg, ...updates };
            }
            return msg;
        });

        await updateDoc(ticketRef, { messages: updatedMessages });
    } catch (error) {
        console.error('Error updating message status:', error);
    }
}

/**
 * Mark all messages as delivered for a user viewing the ticket
 * @param ticketId - Ticket ID
 * @param userId - User who is viewing (to mark messages TO them as delivered)
 */
export async function markMessagesAsDelivered(
    ticketId: string,
    userId: string
): Promise<void> {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const { getDoc } = require('firebase/firestore');
        const ticketSnap = await getDoc(ticketRef);

        if (!ticketSnap.exists()) return;

        const ticketData = ticketSnap.data();
        const messages: any[] = ticketData.messages || [];
        const now = new Date();

        const updatedMessages = messages.map((msg) => {
            // Mark as delivered if message is sent TO this user and not yet delivered
            const isToThisUser = msg.senderId !== userId;
            const notYetDelivered = msg.status === 'sent' || msg.status === 'sending';

            if (isToThisUser && notYetDelivered) {
                return {
                    ...msg,
                    status: 'delivered',
                    deliveredAt: msg.deliveredAt || now,
                };
            }
            return msg;
        });

        await updateDoc(ticketRef, { messages: updatedMessages });
    } catch (error) {
        console.error('Error marking messages as delivered:', error);
    }
}

/**
 * Mark all messages as read for a user viewing the ticket
 * @param ticketId - Ticket ID
 * @param userId - User who is viewing (to mark messages TO them as read)
 */
export async function markMessagesAsRead(
    ticketId: string,
    userId: string
): Promise<void> {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const { getDoc } = require('firebase/firestore');
        const ticketSnap = await getDoc(ticketRef);

        if (!ticketSnap.exists()) return;

        const ticketData = ticketSnap.data();
        const messages: any[] = ticketData.messages || [];
        const now = new Date();

        const updatedMessages = messages.map((msg) => {
            // Mark as read if message is sent TO this user
            const isToThisUser = msg.senderId !== userId;
            const notYetRead = msg.status !== 'read';

            if (isToThisUser && notYetRead) {
                return {
                    ...msg,
                    status: 'read',
                    readAt: msg.readAt || now,
                    deliveredAt: msg.deliveredAt || now,
                };
            }
            return msg;
        });

        await updateDoc(ticketRef, { messages: updatedMessages });
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

/**
 * Get message status icon (WhatsApp-like ticks)
 * @param status - Message status
 * @returns Icon name and color
 */
export function getMessageStatusIcon(status: MessageStatus): {
    icon: 'check' | 'check-circle' | 'clock';
    color: string;
    count: 1 | 2; // Single or double tick
} {
    switch (status) {
        case 'sending':
            return { icon: 'clock', color: '#9ca3af', count: 1 };
        case 'sent':
            return { icon: 'check', color: '#9ca3af', count: 1 }; // Single gray tick
        case 'delivered':
            return { icon: 'check-circle', color: '#9ca3af', count: 2 }; // Double gray tick
        case 'read':
            return { icon: 'check-circle', color: '#3b82f6', count: 2 }; // Double blue tick
        default:
            return { icon: 'clock', color: '#9ca3af', count: 1 };
    }
}

/**
 * Get unread message count for a user in a ticket
 * @param messages - Array of messages
 * @param userId - User ID to check unread for
 * @returns Number of unread messages
 */
export function getUnreadCount(messages: TicketMessage[], userId: string): number {
    return messages.filter(
        (msg) => msg.senderId !== userId && msg.status !== 'read'
    ).length;
}
