// Audit Trail Service
// Tracks all changes to tickets for accountability and transparency

import { db } from './firebaseConfig';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth } from './firebaseConfig';

export type AuditEventType =
    | 'status_change'
    | 'escalation'
    | 'reply'
    | 'note_added'
    | 'priority_change'
    | 'category_change'
    | 'assignment'
    | 'csat_submitted'
    | 'attachment_added'
    | 'created';

export interface AuditEvent {
    type: AuditEventType;
    description: string;
    performedBy: string;       // userId
    performedByName: string;   // display name
    performedByRole: 'user' | 'vendor' | 'admin';
    timestamp: Date;
    metadata?: Record<string, any>; // extra data (old/new status, rating, etc.)
}

/**
 * Log an audit event to a ticket's auditTrail array
 */
export async function logAuditEvent(
    ticketId: string,
    collectionName: 'complaints' | 'tickets',
    event: Omit<AuditEvent, 'timestamp'>
): Promise<void> {
    try {
        const ref = doc(db, collectionName, ticketId);
        await updateDoc(ref, {
            auditTrail: arrayUnion({
                ...event,
                timestamp: new Date(),
            }),
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Audit trail error:', error);
        // Don't throw — audit logging should never break the main flow
    }
}

/**
 * Helper: log a status change event
 */
export function logStatusChange(
    ticketId: string,
    collectionName: 'complaints' | 'tickets',
    oldStatus: string,
    newStatus: string,
    performerName: string,
    performerRole: 'user' | 'vendor' | 'admin'
) {
    return logAuditEvent(ticketId, collectionName, {
        type: 'status_change',
        description: `Status changed from ${oldStatus} to ${newStatus}`,
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: performerName,
        performedByRole: performerRole,
        metadata: { oldStatus, newStatus },
    });
}

/**
 * Helper: log an escalation event
 */
export function logEscalation(
    ticketId: string,
    collectionName: 'complaints' | 'tickets',
    reason: string,
    notes: string,
    performerName: string
) {
    return logAuditEvent(ticketId, collectionName, {
        type: 'escalation',
        description: `Escalated to admin: ${reason}`,
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: performerName,
        performedByRole: 'vendor',
        metadata: { reason, notes },
    });
}

/**
 * Helper: log a reply event
 */
export function logReply(
    ticketId: string,
    collectionName: 'complaints' | 'tickets',
    performerName: string,
    performerRole: 'user' | 'vendor' | 'admin'
) {
    return logAuditEvent(ticketId, collectionName, {
        type: 'reply',
        description: `${performerRole === 'user' ? 'Customer' : performerRole === 'vendor' ? 'Vendor' : 'Admin'} sent a message`,
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: performerName,
        performedByRole: performerRole,
    });
}

/**
 * Helper: log a CSAT submission
 */
export function logCSATSubmission(
    ticketId: string,
    collectionName: 'complaints' | 'tickets',
    rating: number,
    performerName: string
) {
    return logAuditEvent(ticketId, collectionName, {
        type: 'csat_submitted',
        description: `Customer rated ${rating}/5 stars`,
        performedBy: auth.currentUser?.uid || 'unknown',
        performedByName: performerName,
        performedByRole: 'user',
        metadata: { rating },
    });
}
