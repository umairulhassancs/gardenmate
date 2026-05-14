/**
 * Auto-close stale tickets service
 * Automatically closes resolved/rejected tickets that have been inactive for 7+ days
 */

import { db } from './firebaseConfig';
import {
    collection, query, where, getDocs, updateDoc, doc,
    Timestamp, serverTimestamp, writeBatch,
} from 'firebase/firestore';

const STALE_DAYS = 7;

/**
 * Check both collections for resolved/rejected tickets older than STALE_DAYS
 * and auto-close them with an audit trail entry.
 */
export async function autoCloseStaleTickets(): Promise<{ closed: number; errors: number }> {
    let closedCount = 0;
    let errorCount = 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_DAYS);
    const cutoffTimestamp = Timestamp.fromDate(cutoff);

    for (const collName of ['complaints', 'tickets'] as const) {
        try {
            // Query resolved tickets
            const resolvedQuery = query(
                collection(db, collName),
                where('status', '==', 'resolved'),
                where('updatedAt', '<=', cutoffTimestamp),
            );

            // Query rejected tickets
            const rejectedQuery = query(
                collection(db, collName),
                where('status', '==', 'rejected'),
                where('updatedAt', '<=', cutoffTimestamp),
            );

            const [resolvedSnap, rejectedSnap] = await Promise.all([
                getDocs(resolvedQuery),
                getDocs(rejectedQuery),
            ]);

            const allStale = [...resolvedSnap.docs, ...rejectedSnap.docs];

            if (allStale.length === 0) continue;

            // Batch update — max 500 per batch
            const batches: ReturnType<typeof writeBatch>[] = [];
            let currentBatch = writeBatch(db);
            let batchOps = 0;

            for (const docSnap of allStale) {
                if (batchOps >= 499) {
                    batches.push(currentBatch);
                    currentBatch = writeBatch(db);
                    batchOps = 0;
                }

                currentBatch.update(doc(db, collName, docSnap.id), {
                    status: 'closed',
                    closedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    autoClosedReason: `Auto-closed after ${STALE_DAYS} days of inactivity`,
                });
                batchOps++;
                closedCount++;
            }

            batches.push(currentBatch);

            for (const batch of batches) {
                try {
                    await batch.commit();
                } catch (e) {
                    console.error(`Batch commit error in ${collName}:`, e);
                    errorCount++;
                }
            }
        } catch (e) {
            console.error(`Error querying stale tickets in ${collName}:`, e);
            errorCount++;
        }
    }

    if (closedCount > 0) {
        console.log(`[AutoClose] Closed ${closedCount} stale tickets`);
    }

    return { closed: closedCount, errors: errorCount };
}
