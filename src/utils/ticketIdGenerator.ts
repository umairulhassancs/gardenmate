// Ticket ID Generator
// Generates sequential, human-readable ticket IDs: GM-TKT-YYMMDD-0001

import { db } from '../services/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';

/**
 * Generate a unique ticket ID in format: GM-TKT-YYMMDD-####
 * Uses Firestore transaction for atomic counter increment
 * 
 * @returns Promise<{ ticketId: string, ticketNumber: number }>
 * @example
 * const { ticketId, ticketNumber } = await generateTicketId();
 * // ticketId: "GM-TKT-260214-0001"
 * // ticketNumber: 1
 */
export async function generateTicketId(): Promise<{ ticketId: string; ticketNumber: number }> {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2); // 26
    const month = String(today.getMonth() + 1).padStart(2, '0'); // 02
    const day = String(today.getDate()).padStart(2, '0'); // 14
    const dateStr = `${year}${month}${day}`; // 260214

    const counterDocRef = doc(db, 'system', 'ticketCounter');

    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterDocRef);

            let currentCount = 0;
            let currentDate = '';

            if (counterDoc.exists()) {
                const data = counterDoc.data();
                currentDate = data.currentDate || '';
                currentCount = data.count || 0;

                // Reset counter if new day
                if (currentDate !== dateStr) {
                    currentCount = 0;
                    currentDate = dateStr;
                }
            } else {
                currentDate = dateStr;
            }

            // Increment counter
            const newCount = currentCount + 1;
            const ticketNumber = newCount;
            const sequentialPart = String(newCount).padStart(4, '0'); // 0001
            const ticketId = `GM-TKT-${dateStr}-${sequentialPart}`;

            // Update counter in transaction
            transaction.set(counterDocRef, {
                count: newCount,
                currentDate: dateStr,
                lastUpdated: new Date(),
            }, { merge: true });

            return { ticketId, ticketNumber };
        });

        return result;
    } catch (error) {
        console.error('Error generating ticket ID:', error);
        // Fallback to timestamp-based ID with random suffix if transaction fails
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const fallbackId = `GM-TKT-${dateStr}-${timestamp.toString().slice(-4)}${randomSuffix}`;
        return { ticketId: fallbackId, ticketNumber: timestamp };
    }
}

/**
 * Parse ticket ID to extract date and sequence
 * @param ticketId - Ticket ID string (e.g., "GM-TKT-260214-0001")
 * @returns Parsed components or null if invalid
 */
export function parseTicketId(ticketId: string): {
    prefix: string;
    date: string;
    sequence: string;
    year: string;
    month: string;
    day: string;
} | null {
    const regex = /^GM-TKT-(\d{2})(\d{2})(\d{2})-(\d{4})$/;
    const match = ticketId.match(regex);

    if (!match) return null;

    return {
        prefix: 'GM-TKT',
        date: match[1] + match[2] + match[3],
        sequence: match[4],
        year: match[1],
        month: match[2],
        day: match[3],
    };
}

/**
 * Validate ticket ID format
 * @param ticketId - Ticket ID string to validate
 * @returns true if valid format
 */
export function isValidTicketId(ticketId: string): boolean {
    return /^GM-TKT-\d{6}-\d{4}$/.test(ticketId);
}

/**
 * Get current ticket count for today
 * @returns Current count and date
 */
export async function getCurrentTicketCount(): Promise<{ count: number; date: string } | null> {
    try {
        const counterDocRef = doc(db, 'system', 'ticketCounter');
        const counterDoc = await getDoc(counterDocRef);

        if (counterDoc.exists()) {
            const data = counterDoc.data();
            return {
                count: data.count || 0,
                date: data.currentDate || '',
            };
        }

        return null;
    } catch (error) {
        console.error('Error getting ticket count:', error);
        return null;
    }
}
