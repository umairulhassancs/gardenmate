// Export Service
// Generates CSV exports of ticket data with filtering

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface ExportFilters {
    status?: string;
    priority?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeResponses?: boolean;
}

export interface ExportableTicket {
    id: string;
    subject?: string;
    description?: string;
    customer?: string;
    customerEmail?: string;
    status: string;
    priority?: string;
    type?: string;
    category?: string;
    createdAt: string;
    resolvedAt?: string;
    responses?: any[];
    escalatedToAdmin?: boolean;
    escalationReason?: string;
}

/**
 * Apply filters to a list of tickets
 */
export function applyFilters(tickets: ExportableTicket[], filters: ExportFilters): ExportableTicket[] {
    return tickets.filter(t => {
        if (filters.status && filters.status !== 'all' && t.status !== filters.status) return false;
        if (filters.priority && filters.priority !== 'all' && t.priority !== filters.priority) return false;

        if (filters.dateFrom) {
            const created = new Date(t.createdAt);
            if (created < filters.dateFrom) return false;
        }
        if (filters.dateTo) {
            const created = new Date(t.createdAt);
            if (created > filters.dateTo) return false;
        }

        return true;
    });
}

/**
 * Convert tickets to CSV string
 */
export function ticketsToCSV(tickets: ExportableTicket[], includeResponses = false): string {
    const headers = [
        'ID', 'Subject', 'Description', 'Customer', 'Email',
        'Status', 'Priority', 'Type', 'Category',
        'Created At', 'Resolved At', 'Escalated', 'Escalation Reason',
    ];

    if (includeResponses) {
        headers.push('Response Count', 'Last Response');
    }

    const escape = (val: string | undefined | null): string => {
        if (!val) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = tickets.map(t => {
        const row = [
            escape(t.id),
            escape(t.subject),
            escape(t.description),
            escape(t.customer),
            escape(t.customerEmail),
            escape(t.status),
            escape(t.priority),
            escape(t.type),
            escape(t.category),
            escape(t.createdAt),
            escape(t.resolvedAt),
            escape(t.escalatedToAdmin ? 'Yes' : 'No'),
            escape(t.escalationReason),
        ];

        if (includeResponses && t.responses) {
            row.push(String(t.responses.length));
            const lastResp = t.responses[t.responses.length - 1];
            row.push(escape(lastResp ? `${lastResp.from}: ${lastResp.message}` : ''));
        }

        return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Export tickets as CSV file and trigger share/download
 */
export async function exportTicketsAsCSV(
    tickets: ExportableTicket[],
    filters: ExportFilters = {},
    filename?: string,
): Promise<void> {
    try {
        const filtered = applyFilters(tickets, filters);

        if (filtered.length === 0) {
            Alert.alert('No Data', 'No tickets match the selected filters.');
            return;
        }

        const csv = ticketsToCSV(filtered, filters.includeResponses);
        const name = filename || `tickets_export_${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = `${FileSystem.documentDirectory}${name}`;

        await FileSystem.writeAsStringAsync(fileUri, csv, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export Tickets',
                UTI: 'public.comma-separated-values-text',
            });
        } else {
            Alert.alert('Exported', `CSV file saved to: ${fileUri}`);
        }
    } catch (err) {
        console.error('Export error:', err);
        Alert.alert('Error', 'Failed to export tickets. Please try again.');
    }
}

/**
 * Generate summary statistics for the export
 */
export function generateExportSummary(tickets: ExportableTicket[]): {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    avgResolutionDays: number | null;
} {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalResolutionMs = 0;
    let resolvedCount = 0;

    tickets.forEach(t => {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        if (t.priority) {
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
        }
        if (t.resolvedAt && t.createdAt) {
            const createdMs = new Date(t.createdAt).getTime();
            const resolvedMs = new Date(t.resolvedAt).getTime();
            if (resolvedMs > createdMs) {
                totalResolutionMs += resolvedMs - createdMs;
                resolvedCount++;
            }
        }
    });

    return {
        total: tickets.length,
        byStatus,
        byPriority,
        avgResolutionDays: resolvedCount > 0
            ? Math.round((totalResolutionMs / resolvedCount / 86400000) * 10) / 10
            : null,
    };
}
