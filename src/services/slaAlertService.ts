// SLA Alert Service
// Detects approaching SLA breaches, generates alerts, and auto-escalates

import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { SLATracking, TicketPriority } from '../types/ticket';
import { checkOverdue, getTimeRemaining, formatTimeRemaining } from './slaService';

export interface SLAAlert {
    ticketId: string;
    ticketSubject: string;
    customer: string;
    priority: string;
    level: 'warning' | 'critical' | 'breached';
    type: 'response' | 'resolution';
    message: string;
    remainingMs: number;
}

/**
 * Check all open tickets for SLA breach/warning status
 */
export async function checkAllSLABreaches(): Promise<SLAAlert[]> {
    const alerts: SLAAlert[] = [];
    const now = new Date();

    try {
        // Get all non-resolved/closed tickets from BOTH collections
        const statusFilter = ['open', 'in-progress', 'in_progress', 'assigned'];
        const collectionsToCheck = ['complaints', 'tickets'];
        let allDocs: { id: string; data: any }[] = [];

        for (const col of collectionsToCheck) {
            const q = query(
                collection(db, col),
                where('status', 'in', statusFilter),
            );
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                allDocs.push({ id: docSnap.id, data: docSnap.data() });
            });
        }

        allDocs.forEach(({ id: docId, data }) => {
            const sla = data.sla as SLATracking | undefined;

            if (!sla) return; // No SLA configured

            const subject = data.issue || data.subject || 'Ticket';
            const customer = data.userName || data.customerName || 'Unknown';
            const priority = data.priority || 'medium';

            // Check first response SLA
            if (sla.firstResponseDue && !sla.firstResponseAt) {
                const dueDate = sla.firstResponseDue.toDate ? sla.firstResponseDue.toDate() : new Date(sla.firstResponseDue);
                const remaining = dueDate.getTime() - now.getTime();

                if (remaining <= 0) {
                    alerts.push({
                        ticketId: docId,
                        ticketSubject: subject,
                        customer,
                        priority,
                        level: 'breached',
                        type: 'response',
                        message: `Response SLA breached by ${formatTime(Math.abs(remaining))}`,
                        remainingMs: remaining,
                    });
                } else if (remaining <= 30 * 60 * 1000) { // 30 min
                    alerts.push({
                        ticketId: docId,
                        ticketSubject: subject,
                        customer,
                        priority,
                        level: 'critical',
                        type: 'response',
                        message: `Response due in ${formatTime(remaining)}`,
                        remainingMs: remaining,
                    });
                } else if (remaining <= 2 * 60 * 60 * 1000) { // 2 hours
                    alerts.push({
                        ticketId: docId,
                        ticketSubject: subject,
                        customer,
                        priority,
                        level: 'warning',
                        type: 'response',
                        message: `Response due in ${formatTime(remaining)}`,
                        remainingMs: remaining,
                    });
                }
            }

            // Check resolution SLA
            if (sla.resolutionDue && !sla.resolvedAt) {
                const dueDate = sla.resolutionDue.toDate ? sla.resolutionDue.toDate() : new Date(sla.resolutionDue);
                const remaining = dueDate.getTime() - now.getTime();

                if (remaining <= 0) {
                    alerts.push({
                        ticketId: docId,
                        ticketSubject: subject,
                        customer,
                        priority,
                        level: 'breached',
                        type: 'resolution',
                        message: `Resolution SLA breached by ${formatTime(Math.abs(remaining))}`,
                        remainingMs: remaining,
                    });
                } else if (remaining <= 2 * 60 * 60 * 1000) { // 2 hours
                    alerts.push({
                        ticketId: docId,
                        ticketSubject: subject,
                        customer,
                        priority,
                        level: 'critical',
                        type: 'resolution',
                        message: `Resolution due in ${formatTime(remaining)}`,
                        remainingMs: remaining,
                    });
                } else if (remaining <= 8 * 60 * 60 * 1000) { // 8 hours
                    alerts.push({
                        ticketId: docId,
                        ticketSubject: subject,
                        customer,
                        priority,
                        level: 'warning',
                        type: 'resolution',
                        message: `Resolution due in ${formatTime(remaining)}`,
                        remainingMs: remaining,
                    });
                }
            }
        });

        // Sort: breached first, then critical, then warning
        const levelOrder = { breached: 0, critical: 1, warning: 2 };
        alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || a.remainingMs - b.remainingMs);

    } catch (err) {
        console.error('SLA check error:', err);
    }

    return alerts;
}

/**
 * Auto-escalate breached tickets
 */
export async function autoEscalateBreached(): Promise<number> {
    let escalatedCount = 0;

    try {
        const alerts = await checkAllSLABreaches();
        const breached = alerts.filter(a => a.level === 'breached');

        for (const alert of breached) {
            try {
                await updateDoc(doc(db, 'complaints', alert.ticketId), {
                    escalatedToAdmin: true,
                    escalationReason: `Auto-escalated: ${alert.message}`,
                    priority: 'high', // Auto-upgrade priority
                    updatedAt: serverTimestamp(),
                });
                escalatedCount++;
            } catch (err) {
                console.error(`Failed to escalate ${alert.ticketId}:`, err);
            }
        }
    } catch (err) {
        console.error('Auto-escalation error:', err);
    }

    return escalatedCount;
}

/**
 * Get SLA status badge info for a ticket
 */
export function getSLAStatusBadge(sla: any): {
    label: string;
    color: string;
    bgColor: string;
    icon: string;
} | null {
    if (!sla) return null;

    const now = new Date();

    // Check resolution SLA first (more important)
    if (sla.resolutionDue && !sla.resolvedAt) {
        const dueDate = sla.resolutionDue.toDate ? sla.resolutionDue.toDate() : new Date(sla.resolutionDue);
        const remaining = dueDate.getTime() - now.getTime();

        if (remaining <= 0) {
            return {
                label: `SLA Breached (${formatTime(Math.abs(remaining))} ago)`,
                color: '#ef4444',
                bgColor: 'rgba(239,68,68,0.1)',
                icon: 'alert-octagon',
            };
        } else if (remaining <= 2 * 60 * 60 * 1000) {
            return {
                label: `SLA Due in ${formatTime(remaining)}`,
                color: '#f59e0b',
                bgColor: 'rgba(245,158,11,0.1)',
                icon: 'clock',
            };
        }
    }

    // Check first response SLA
    if (sla.firstResponseDue && !sla.firstResponseAt) {
        const dueDate = sla.firstResponseDue.toDate ? sla.firstResponseDue.toDate() : new Date(sla.firstResponseDue);
        const remaining = dueDate.getTime() - now.getTime();

        if (remaining <= 0) {
            return {
                label: `Response Overdue`,
                color: '#ef4444',
                bgColor: 'rgba(239,68,68,0.1)',
                icon: 'alert-circle',
            };
        } else if (remaining <= 30 * 60 * 1000) {
            return {
                label: `Response Due in ${formatTime(remaining)}`,
                color: '#f59e0b',
                bgColor: 'rgba(245,158,11,0.1)',
                icon: 'clock',
            };
        }
    }

    // SLA is within normal range
    return {
        label: 'Within SLA',
        color: '#10b981',
        bgColor: 'rgba(16,185,129,0.1)',
        icon: 'check-circle',
    };
}

// ── Helpers ──

function formatTime(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours < 24) return `${hours}h ${minutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
}
