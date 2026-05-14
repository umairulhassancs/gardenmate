// Enhanced Ticket API
// Replaces old complaint system with industry-standard ticket management

import {
    collection,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { generateTicketId } from '../utils/ticketIdGenerator';
import { calculateSLA, suggestPriorityForCategory } from '../services/slaService';
import {
    Ticket,
    TicketPriority,
    TicketCategory,
    TicketStatus,
    TicketMessage,
    InternalNote,
    AuditLogEntry,
} from '../types/ticket';

export interface CreateTicketData {
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    vendorId: string;
    vendorName: string;
    vendorStoreName: string; // NEW: Store name for display
    orderId: string;
    category: TicketCategory;
    subcategory?: string;
    priority?: TicketPriority; // Optional, auto-determined if not provided
    subject: string;
    description: string;
    tags?: string[];
    metadata?: {
        appVersion?: string;
        deviceOS?: string;
        deviceModel?: string;
        orderSnapshot?: any;
        source?: 'in-app' | 'email' | 'phone';
    };
}

export const ticketApi = {
    /**
     * Create a new ticket
     * @param data - Ticket creation data
     * @returns Created ticket with ID
     */
    createTicket: async (data: CreateTicketData): Promise<{ success: boolean; ticketId: string; ticketNumber: number }> => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            // Generate unique ticket ID
            const { ticketId, ticketNumber } = await generateTicketId();

            // Determine priority (use provided or suggest based on category)
            const priority = data.priority || suggestPriorityForCategory(data.category);

            // Calculate SLA
            const sla = calculateSLA(priority);

            // Get customer stats (for metadata)
            let customerOrderCount = 0;
            let previousTicketsCount = 0;
            try {
                const ordersQuery = query(collection(db, 'orders'), where('userId', '==', user.uid));
                const ordersSnap = await getDocs(ordersQuery);
                customerOrderCount = ordersSnap.size;

                const ticketsQuery = query(collection(db, 'tickets'), where('customerId', '==', user.uid));
                const ticketsSnap = await getDocs(ticketsQuery);
                previousTicketsCount = ticketsSnap.size;
            } catch (err) {
                console.warn('Could not fetch customer stats:', err);
            }

            // Initial message (the complaint description)
            const initialMessage: TicketMessage = {
                id: `msg_${Date.now()}`,
                from: 'customer',
                senderId: user.uid,
                senderName: data.customerName,
                senderRole: 'customer',
                text: data.description,
                status: 'sent',
                sentAt: new Date(),
                deliveredAt: null,
                readAt: null,
                createdAt: new Date(),
            };

            // Initial audit log entry
            const initialAuditLog: AuditLogEntry = {
                action: 'created',
                performedBy: user.uid,
                performedByName: data.customerName,
                performedByRole: 'customer',
                timestamp: new Date(),
                after: { ticketId, status: 'new', priority },
            };

            // Create ticket document
            const ticketData: Omit<Ticket, 'id'> = {
                ticketId,
                ticketNumber,
                customerId: data.customerId,
                customerName: data.customerName,
                customerEmail: data.customerEmail,
                customerPhone: data.customerPhone,
                vendorId: data.vendorId,
                vendorName: data.vendorName,
                vendorStoreName: data.vendorStoreName, // Store name instead of just "Vendor"
                orderId: data.orderId,
                category: data.category,
                subcategory: data.subcategory || undefined, // Use undefined instead of string to omit from Firestore
                priority,
                tags: data.tags || [],
                status: 'new',
                statusHistory: [
                    {
                        status: 'new',
                        changedBy: user.uid,
                        changedByName: data.customerName,
                        changedByRole: 'customer',
                        changedAt: new Date(),
                    },
                ],
                assignment: {
                    assignedTo: data.vendorId, // Auto-assign to vendor
                    assignedToName: data.vendorName,
                    assignedToRole: 'vendor',
                    assignedAt: new Date(),
                },
                sla,
                subject: data.subject,
                description: data.description,
                messages: [initialMessage],
                internalNotes: [],
                attachments: [],
                metadata: {
                    appVersion: data.metadata?.appVersion || 'Unknown',
                    deviceOS: data.metadata?.deviceOS || 'Unknown',
                    deviceModel: data.metadata?.deviceModel || 'Unknown',
                    orderSnapshot: data.metadata?.orderSnapshot,
                    customerLifetimeValue: 0, // Calculate separately if needed
                    customerOrderCount,
                    previousTicketsCount,
                    source: data.metadata?.source || 'in-app',
                },
                auditLog: [initialAuditLog],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Helper to remove undefined fields recursively
            const removeUndefined = (obj: any): any => {
                if (Array.isArray(obj)) {
                    return obj.map(removeUndefined);
                } else if (obj !== null && typeof obj === 'object') {
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([_, value]) => value !== undefined)
                            .map(([key, value]) => [key, removeUndefined(value)])
                    );
                }
                return obj;
            };

            // Clean ticket data
            const cleanedTicketData = removeUndefined(ticketData);

            // Add to Firestore
            const docRef = await addDoc(collection(db, 'tickets'), {
                ...cleanedTicketData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return { success: true, ticketId, ticketNumber };
        } catch (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }
    },

    /**
     * Get user's tickets
     * @param userId - User ID
     * @returns Array of tickets
     */
    getUserTickets: async (userId: string): Promise<Ticket[]> => {
        try {
            const q = query(
                collection(db, 'tickets'),
                where('customerId', '==', userId),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const tickets: Ticket[] = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(),
                    closedAt: data.closedAt?.toDate?.() || null,
                } as Ticket;
            });

            return tickets;
        } catch (error) {
            console.error('Error getting user tickets:', error);
            throw error;
        }
    },

    /**
     * Get vendor's tickets
     * @param vendorId - Vendor ID
     * @returns Array of tickets
     */
    getVendorTickets: async (vendorId: string): Promise<Ticket[]> => {
        try {
            const q = query(
                collection(db, 'tickets'),
                where('vendorId', '==', vendorId),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const tickets: Ticket[] = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    updatedAt: data.updatedAt?.toDate?.() || new Date(),
                    closedAt: data.closedAt?.toDate?.() || null,
                } as Ticket;
            });

            return tickets;
        } catch (error) {
            console.error('Error getting vendor tickets:', error);
            throw error;
        }
    },

    /**
     * Add message to ticket
     * @param ticketId - Ticket document ID
     * @param message - Message data
     */
    addMessage: async (
        ticketId: string,
        message: Omit<TicketMessage, 'id' | 'createdAt' | 'sentAt'>
    ): Promise<void> => {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);

            const newMessage: TicketMessage = {
                ...message,
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                sentAt: new Date(),
                createdAt: new Date(),
            };

            await updateDoc(ticketRef, {
                messages: arrayUnion(newMessage),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('Error adding message:', error);
            throw error;
        }
    },

    /**
     * Update ticket status
     * @param ticketId - Ticket document ID
     * @param newStatus - New status
     * @param changedBy - User who changed status
     * @param reason - Optional reason for status change
     */
    updateStatus: async (
        ticketId: string,
        newStatus: TicketStatus,
        changedBy: { userId: string; name: string; role: 'customer' | 'vendor' | 'admin' },
        reason?: string
    ): Promise<void> => {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);

            const statusEntry = {
                status: newStatus,
                changedBy: changedBy.userId,
                changedByName: changedBy.name,
                changedByRole: changedBy.role,
                changedAt: new Date(),
                reason,
            };

            const auditEntry: AuditLogEntry = {
                action: 'status_changed',
                performedBy: changedBy.userId,
                performedByName: changedBy.name,
                performedByRole: changedBy.role,
                timestamp: new Date(),
                after: { status: newStatus },
            };

            const updates: any = {
                status: newStatus,
                statusHistory: arrayUnion(statusEntry),
                auditLog: arrayUnion(auditEntry),
                updatedAt: serverTimestamp(),
            };

            if (newStatus === 'closed') {
                updates.closedAt = serverTimestamp();
            }

            await updateDoc(ticketRef, updates);
        } catch (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    },

    /**
     * Add internal note (staff-only)
     * @param ticketId - Ticket document ID
     * @param note - Internal note data
     */
    addInternalNote: async (
        ticketId: string,
        note: Omit<InternalNote, 'id' | 'createdAt'>
    ): Promise<void> => {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);

            const newNote: InternalNote = {
                ...note,
                id: `note_${Date.now()}`,
                createdAt: new Date(),
            };

            await updateDoc(ticketRef, {
                internalNotes: arrayUnion(newNote),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('Error adding internal note:', error);
            throw error;
        }
    },

    /**
     * Add tags to ticket
     * @param ticketId - Ticket document ID
     * @param tags - Tags to add
     */
    addTags: async (ticketId: string, tags: string[]): Promise<void> => {
        try {
            const ticketRef = doc(db, 'tickets', ticketId);

            await updateDoc(ticketRef, {
                tags: arrayUnion(...tags),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('Error adding tags:', error);
            throw error;
        }
    },
};

// Export for backward compatibility with old complaint system
export const feedbackApi = {
    submitComplaint: async (data: any) => {
        // Map old complaint format to new ticket format
        return ticketApi.createTicket({
            customerId: data.userId,
            customerName: data.userName,
            customerEmail: data.userEmail || '',
            vendorId: data.vendorId,
            vendorName: data.vendorName || 'Vendor',
            vendorStoreName: data.vendorStoreName || data.vendorName || 'Vendor Store',
            orderId: data.orderId,
            category: (data.issue as TicketCategory) || 'general',
            subject: data.issue || 'General Complaint',
            description: data.description,
        });
    },
};
