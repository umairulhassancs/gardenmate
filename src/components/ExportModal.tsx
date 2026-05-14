import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    Switch, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { exportTicketsAsCSV, applyFilters, generateExportSummary, ExportableTicket, ExportFilters } from '../services/exportService';

interface ExportModalProps {
    visible: boolean;
    tickets: ExportableTicket[];
    onClose: () => void;
}

export default function ExportModal({ visible, tickets, onClose }: ExportModalProps) {
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [includeResponses, setIncludeResponses] = useState(false);
    const [loading, setLoading] = useState(false);

    const filters: ExportFilters = useMemo(() => ({
        status: statusFilter,
        priority: priorityFilter,
        includeResponses,
    }), [statusFilter, priorityFilter, includeResponses]);

    const preview = useMemo(() => {
        const filtered = applyFilters(tickets, filters);
        return generateExportSummary(filtered);
    }, [tickets, filters]);

    const handleExport = async () => {
        setLoading(true);
        try {
            await exportTicketsAsCSV(tickets, filters);
        } catch (err) {
            console.error('Export error:', err);
        } finally {
            setLoading(false);
        }
    };

    const statuses = ['all', 'open', 'in-progress', 'resolved', 'closed'];
    const priorities = ['all', 'high', 'medium', 'low'];

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Feather name="download" size={20} color={colors.primary} />
                            <Text style={styles.title}>Export Tickets</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                        {/* Status Filter */}
                        <Text style={styles.filterLabel}>Status Filter</Text>
                        <View style={styles.chipRow}>
                            {statuses.map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.chip, statusFilter === s && styles.chipActive]}
                                    onPress={() => setStatusFilter(s)}
                                >
                                    <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                                        {s === 'all' ? 'All' : s.replace('-', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Priority Filter */}
                        <Text style={styles.filterLabel}>Priority Filter</Text>
                        <View style={styles.chipRow}>
                            {priorities.map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.chip, priorityFilter === p && styles.chipActive]}
                                    onPress={() => setPriorityFilter(p)}
                                >
                                    <Text style={[styles.chipText, priorityFilter === p && styles.chipTextActive]}>
                                        {p === 'all' ? 'All' : p}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Include Responses Toggle */}
                        <View style={styles.toggleRow}>
                            <View>
                                <Text style={styles.toggleLabel}>Include Responses</Text>
                                <Text style={styles.toggleSub}>Adds response columns to CSV</Text>
                            </View>
                            <Switch
                                value={includeResponses}
                                onValueChange={setIncludeResponses}
                                trackColor={{ false: '#e2e8f0', true: 'rgba(16,185,129,0.3)' }}
                                thumbColor={includeResponses ? '#10b981' : '#94a3b8'}
                            />
                        </View>

                        {/* Preview Summary */}
                        <View style={styles.previewBox}>
                            <Text style={styles.previewTitle}>Export Preview</Text>
                            <View style={styles.previewRow}>
                                <Text style={styles.previewLabel}>Total Tickets</Text>
                                <Text style={styles.previewValue}>{preview.total}</Text>
                            </View>
                            {Object.entries(preview.byStatus).map(([status, count]) => (
                                <View key={status} style={styles.previewRow}>
                                    <Text style={styles.previewLabel}>{status.replace('-', ' ')}</Text>
                                    <Text style={styles.previewValue}>{count}</Text>
                                </View>
                            ))}
                            {preview.avgResolutionDays !== null && (
                                <View style={styles.previewRow}>
                                    <Text style={styles.previewLabel}>Avg Resolution</Text>
                                    <Text style={styles.previewValue}>{preview.avgResolutionDays} days</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.exportBtn, loading && { opacity: 0.6 }]}
                            onPress={handleExport}
                            disabled={loading || preview.total === 0}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Feather name="download" size={16} color="#fff" />
                                    <Text style={styles.exportText}>Export CSV</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
    },
    body: {
        marginBottom: 12,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 16,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
        textTransform: 'capitalize',
    },
    chipTextActive: {
        color: '#fff',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 16,
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    toggleSub: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    previewBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    previewTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 10,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    previewLabel: {
        fontSize: 12,
        color: colors.textMuted,
        textTransform: 'capitalize',
    },
    previewValue: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    cancelBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: colors.primary,
    },
    exportText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
