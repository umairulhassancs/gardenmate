import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import type { AuditEventType } from '../services/auditService';

interface AuditEntry {
    type: AuditEventType;
    description: string;
    performedBy: string;
    performedByName: string;
    performedByRole: 'user' | 'vendor' | 'admin';
    timestamp: Date | any;
    metadata?: Record<string, any>;
}

interface Props {
    auditTrail: AuditEntry[];
}

const EVENT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
    status_change: { icon: 'refresh-cw', color: '#3b82f6', bg: '#eff6ff' },
    escalation: { icon: 'alert-triangle', color: '#f59e0b', bg: '#fffbeb' },
    reply: { icon: 'message-circle', color: '#10b981', bg: '#ecfdf5' },
    note_added: { icon: 'file-text', color: '#8b5cf6', bg: '#f5f3ff' },
    priority_change: { icon: 'flag', color: '#ef4444', bg: '#fef2f2' },
    category_change: { icon: 'tag', color: '#6366f1', bg: '#eef2ff' },
    assignment: { icon: 'user-check', color: '#0ea5e9', bg: '#f0f9ff' },
    csat_submitted: { icon: 'star', color: '#f59e0b', bg: '#fffbeb' },
    attachment_added: { icon: 'paperclip', color: '#64748b', bg: '#f8fafc' },
    created: { icon: 'plus-circle', color: '#10b981', bg: '#ecfdf5' },
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    user: { label: 'Customer', color: '#3b82f6' },
    vendor: { label: 'Vendor', color: '#10b981' },
    admin: { label: 'Admin', color: '#f59e0b' },
};

function formatTimestamp(ts: any): string {
    const date = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts));
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditTrailPanel({ auditTrail }: Props) {
    const sortedTrail = [...auditTrail].sort((a, b) => {
        const aTime = a.timestamp?.toDate?.()?.getTime?.() ?? new Date(a.timestamp).getTime();
        const bTime = b.timestamp?.toDate?.()?.getTime?.() ?? new Date(b.timestamp).getTime();
        return bTime - aTime; // newest first
    });

    if (sortedTrail.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Feather name="clock" size={40} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No Activity Yet</Text>
                <Text style={styles.emptyText}>Changes to this ticket will appear here</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <Feather name="clock" size={16} color="#64748b" />
                <Text style={styles.headerText}>Activity Log ({sortedTrail.length})</Text>
            </View>

            {sortedTrail.map((entry, index) => {
                const config = EVENT_CONFIG[entry.type] || EVENT_CONFIG.reply;
                const roleInfo = ROLE_LABELS[entry.performedByRole] || ROLE_LABELS.user;
                const isLast = index === sortedTrail.length - 1;

                return (
                    <View key={index} style={styles.entryRow}>
                        {/* Timeline line */}
                        <View style={styles.timelineCol}>
                            <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                                <Feather name={config.icon as any} size={14} color={config.color} />
                            </View>
                            {!isLast && <View style={styles.timelineLine} />}
                        </View>

                        {/* Content */}
                        <View style={[styles.entryContent, isLast && { paddingBottom: 0 }]}>
                            <Text style={styles.entryDescription}>{entry.description}</Text>
                            <View style={styles.entryMeta}>
                                <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '15' }]}>
                                    <Text style={[styles.roleBadgeText, { color: roleInfo.color }]}>
                                        {roleInfo.label}
                                    </Text>
                                </View>
                                <Text style={styles.entryName}>{entry.performedByName}</Text>
                                <Text style={styles.entryTime}>{formatTimestamp(entry.timestamp)}</Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: spacing.md, paddingBottom: 40 },
    headerRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginBottom: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    headerText: { fontSize: 15, fontWeight: '700', color: '#334155' },

    // Empty
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },

    // Timeline
    entryRow: { flexDirection: 'row' },
    timelineCol: { width: 36, alignItems: 'center' },
    iconCircle: {
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
    },
    timelineLine: {
        width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 4,
    },

    // Entry content
    entryContent: { flex: 1, marginLeft: 10, paddingBottom: 20 },
    entryDescription: { fontSize: 13, fontWeight: '600', color: '#1e293b', lineHeight: 18 },
    entryMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    roleBadgeText: { fontSize: 10, fontWeight: '700' },
    entryName: { fontSize: 11, color: '#64748b' },
    entryTime: { fontSize: 11, color: '#94a3b8' },
});
