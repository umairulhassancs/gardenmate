// Ticket Relation Service
// Handles merging duplicate tickets and linking related tickets

import { db } from './firebaseConfig';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, serverTimestamp, writeBatch } from 'firebase/firestore';

/**
 * Merge two tickets: moves secondary's messages into primary, closes secondary
 */
export async function mergeTickets(
    primaryId: string,
    secondaryId: string,
    performedBy: string,
    performedByName: string,
    collectionName: 'complaints' | 'tickets' = 'complaints',
): Promise<void> {
    const primaryRef = doc(db, collectionName, primaryId);
    const secondaryRef = doc(db, collectionName, secondaryId);

    const [primarySnap, secondarySnap] = await Promise.all([
        getDoc(primaryRef),
        getDoc(secondaryRef),
    ]);

    if (!primarySnap.exists() || !secondarySnap.exists()) {
        throw new Error('One or both tickets not found');
    }

    const primaryData = primarySnap.data();
    const secondaryData = secondarySnap.data();

    // Combine messages
    const primaryMessages = primaryData.messages || primaryData.responses || [];
    const secondaryMessages = (secondaryData.messages || secondaryData.responses || []).map((m: any) => ({
        ...m,
        text: m.text || m.message,
        mergedFrom: secondaryId,
    }));

    const mergedMessages = [...primaryMessages, ...secondaryMessages]
        .sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() ?? new Date(a.createdAt || a.date || 0);
            const bTime = b.createdAt?.toDate?.() ?? new Date(b.createdAt || b.date || 0);
            return aTime.getTime() - bTime.getTime();
        });

    const batch = writeBatch(db);

    // Update primary: add merged messages and mark as linked
    batch.update(primaryRef, {
        messages: mergedMessages.length > 0 ? mergedMessages : undefined,
        responses: mergedMessages.length > 0 ? mergedMessages : undefined,
        relatedTickets: arrayUnion(secondaryId),
        updatedAt: serverTimestamp(),
    });

    // Close secondary: mark as merged
    batch.update(secondaryRef, {
        status: 'closed',
        parentTicketId: primaryId,
        relatedTickets: arrayUnion(primaryId),
        mergedInto: primaryId,
        mergedAt: serverTimestamp(),
        mergedBy: performedBy,
        mergedByName: performedByName,
        updatedAt: serverTimestamp(),
        closedAt: serverTimestamp(),
    });

    await batch.commit();
}

/**
 * Link two tickets together (bidirectional)
 */
export async function linkTickets(ticketId1: string, ticketId2: string, collectionName: 'complaints' | 'tickets' = 'complaints'): Promise<void> {
    const batch = writeBatch(db);

    batch.update(doc(db, collectionName, ticketId1), {
        relatedTickets: arrayUnion(ticketId2),
        updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, collectionName, ticketId2), {
        relatedTickets: arrayUnion(ticketId1),
        updatedAt: serverTimestamp(),
    });

    await batch.commit();
}

/**
 * Unlink two tickets (bidirectional)
 */
export async function unlinkTickets(ticketId1: string, ticketId2: string, collectionName: 'complaints' | 'tickets' = 'complaints'): Promise<void> {
    const batch = writeBatch(db);

    batch.update(doc(db, collectionName, ticketId1), {
        relatedTickets: arrayRemove(ticketId2),
        updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, collectionName, ticketId2), {
        relatedTickets: arrayRemove(ticketId1),
        updatedAt: serverTimestamp(),
    });

    await batch.commit();
}

/**
 * Get linked ticket IDs for a given ticket
 */
export async function getLinkedTicketIds(ticketId: string, collectionName: 'complaints' | 'tickets' = 'complaints'): Promise<string[]> {
    const snap = await getDoc(doc(db, collectionName, ticketId));
    if (!snap.exists()) return [];
    return snap.data()?.relatedTickets || [];
}
