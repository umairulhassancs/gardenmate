// SLA (Service Level Agreement) Service
// Calculates response and resolution due dates based on ticket priority

import { TicketPriority, SLATracking, PriorityConfig } from '../types/ticket';

// Priority configurations with SLA timings
export const PRIORITY_CONFIGS: Record<TicketPriority, PriorityConfig> = {
    critical: {
        level: 'critical',
        label: 'Critical',
        color: '#ef4444', // red
        icon: 'alert-octagon',
        firstResponseHours: 1,
        resolutionHours: 4,
        description: 'System down, data loss, critical business impact',
    },
    high: {
        level: 'high',
        label: 'High',
        color: '#f59e0b', // orange
        icon: 'alert-triangle',
        firstResponseHours: 4,
        resolutionHours: 24,
        description: 'Major feature broken, significant impact',
    },
    medium: {
        level: 'medium',
        label: 'Medium',
        color: '#3b82f6', // blue
        icon: 'alert-circle',
        firstResponseHours: 8,
        resolutionHours: 72, // 3 days
        description: 'Workflow impaired, moderate impact',
    },
    low: {
        level: 'low',
        label: 'Low',
        color: '#10b981', // green
        icon: 'info',
        firstResponseHours: 24,
        resolutionHours: 168, // 7 days
        description: 'Minor issue, cosmetic, low impact',
    },
};

/**
 * Calculate SLA due dates based on priority
 * @param priority - Ticket priority level
 * @param createdAt - Ticket creation timestamp
 * @returns SLATracking object with due dates
 */
export function calculateSLA(
    priority: TicketPriority,
    createdAt: Date = new Date()
): SLATracking {
    const config = PRIORITY_CONFIGS[priority];

    const firstResponseDue = new Date(createdAt);
    firstResponseDue.setHours(firstResponseDue.getHours() + config.firstResponseHours);

    const resolutionDue = new Date(createdAt);
    resolutionDue.setHours(resolutionDue.getHours() + config.resolutionHours);

    return {
        priority,
        firstResponseDue,
        resolutionDue,
        firstResponseAt: null,
        resolvedAt: null,
        isOverdue: false,
        breachedSLA: false,
    };
}

/**
 * Update SLA when first response is sent
 * @param sla - Current SLA tracking
 * @param responseTime - Time of first response
 * @returns Updated SLA tracking
 */
export function markFirstResponse(sla: SLATracking, responseTime: Date = new Date()): SLATracking {
    const firstResponseBreached = responseTime > sla.firstResponseDue;

    return {
        ...sla,
        firstResponseAt: responseTime,
        breachedSLA: sla.breachedSLA || firstResponseBreached,
        breachReason: firstResponseBreached
            ? 'First response SLA breach'
            : sla.breachReason,
    };
}

/**
 * Update SLA when ticket is resolved
 * @param sla - Current SLA tracking
 * @param resolutionTime - Time of resolution
 * @returns Updated SLA tracking
 */
export function markResolved(sla: SLATracking, resolutionTime: Date = new Date()): SLATracking {
    const resolutionBreached = resolutionTime > sla.resolutionDue;

    return {
        ...sla,
        resolvedAt: resolutionTime,
        isOverdue: false, // Ticket is resolved, no longer overdue
        breachedSLA: sla.breachedSLA || resolutionBreached,
        breachReason: resolutionBreached
            ? sla.breachReason
                ? `${sla.breachReason}, Resolution SLA breach`
                : 'Resolution SLA breach'
            : sla.breachReason,
    };
}

/**
 * Check if ticket SLA is currently overdue
 * @param sla - SLA tracking
 * @param currentTime - Current time (defaults to now)
 * @returns Updated SLA with overdue status
 */
export function checkOverdue(sla: SLATracking, currentTime: Date = new Date()): SLATracking {
    // If already resolved, not overdue
    if (sla.resolvedAt) {
        return { ...sla, isOverdue: false };
    }

    // Check first response overdue
    const firstResponseOverdue = !sla.firstResponseAt && currentTime > sla.firstResponseDue;

    // Check resolution overdue
    const resolutionOverdue = !sla.resolvedAt && currentTime > sla.resolutionDue;

    const isOverdue = firstResponseOverdue || resolutionOverdue;

    return {
        ...sla,
        isOverdue,
    };
}

/**
 * Get time remaining until SLA breach
 * @param sla - SLA tracking
 * @param currentTime - Current time
 * @returns Object with time remaining in various units
 */
export function getTimeRemaining(sla: SLATracking, currentTime: Date = new Date()): {
    firstResponse: {
        milliseconds: number;
        minutes: number;
        hours: number;
        isBreached: boolean;
    };
    resolution: {
        milliseconds: number;
        minutes: number;
        hours: number;
        days: number;
        isBreached: boolean;
    };
} {
    const firstResponseMs = sla.firstResponseDue.getTime() - currentTime.getTime();
    const resolutionMs = sla.resolutionDue.getTime() - currentTime.getTime();

    return {
        firstResponse: {
            milliseconds: firstResponseMs,
            minutes: Math.floor(firstResponseMs / (1000 * 60)),
            hours: Math.floor(firstResponseMs / (1000 * 60 * 60)),
            isBreached: firstResponseMs < 0,
        },
        resolution: {
            milliseconds: resolutionMs,
            minutes: Math.floor(resolutionMs / (1000 * 60)),
            hours: Math.floor(resolutionMs / (1000 * 60 * 60)),
            days: Math.floor(resolutionMs / (1000 * 60 * 60 * 24)),
            isBreached: resolutionMs < 0,
        },
    };
}

/**
 * Format SLA time remaining for display
 * @param timeRemaining - Time remaining object from getTimeRemaining
 * @param type - 'firstResponse' or 'resolution'
 * @returns Formatted string (e.g., "2h 15m", "3d 4h", "Overdue by 1h")
 */
export function formatTimeRemaining(
    timeRemaining: ReturnType<typeof getTimeRemaining>,
    type: 'firstResponse' | 'resolution'
): string {
    const time = timeRemaining[type];

    if (time.isBreached) {
        const absHours = Math.abs(time.hours);
        const absMinutes = Math.abs(time.minutes) % 60;
        if (absHours > 24) {
            const days = Math.floor(absHours / 24);
            return `Overdue by ${days}d`;
        }
        return absHours > 0
            ? `Overdue by ${absHours}h ${absMinutes}m`
            : `Overdue by ${absMinutes}m`;
    }

    if (type === 'resolution' && time.days > 0) {
        const hours = time.hours % 24;
        return `${time.days}d ${hours}h`;
    }

    const hours = time.hours;
    const minutes = time.minutes % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

/**
 * Determine priority based on category
 * @param category - Ticket category
 * @returns Suggested priority
 */
export function suggestPriorityForCategory(category: string): TicketPriority {
    const categoryPriorityMap: Record<string, TicketPriority> = {
        product_issue: 'high',
        delivery_issue: 'high',
        payment_issue: 'critical',
        account_issue: 'medium',
        technical_issue: 'high',
        refund_request: 'medium',
        missing_parts: 'high',
        wrong_item: 'high',
        damaged_product: 'critical',
        general: 'low',
    };

    return categoryPriorityMap[category] || 'medium';
}
