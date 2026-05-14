import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme';
import { mergeTickets } from '../services/ticketRelationService';
import { auth } from '../services/firebaseConfig';

interface TicketSummary {
    id: string;
    subject: string;
    description: string;
    status: string;
    customer: string;
    responses?: any[];
    messages?: any[];
}

interface MergeTicketsModalProps {
    visible: boolean;
    tickets: TicketSummary[];  // Exactly 2 tickets
    onClose: () => void;
    onMerged: () => void;
}

export default function MergeTicketsModal({ visible, tickets, onClose, onMerged }: MergeTicketsModalProps) {
    const [primaryIndex, setPrimaryIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    if (tickets.length !== 2) return null;

    const handleMerge = () => {
        const primary = tickets[primaryIndex];
        const secondary = tickets[primaryIndex === 0 ? 1 : 0];

        Alert.alert(
            'Confirm Merge',
            `Ticket "${secondary.subject || secondary.id}" will be closed and its messages will be moved to "${primary.subject || primary.id}". This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Merge', style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const user = auth.currentUser;
                            await mergeTickets(
                                primary.id,
                                secondary.id,
                                user?.uid || 'admin',
                                user?.displayName || 'Admin',
                            );
                            Alert.alert('Merged', 'Tickets have been merged successfully.');
                            onMerged();
                            onClose();
                        } catch (err) {
                            console.error('Merge error:', err);
                            Alert.alert('Error', 'Failed to merge tickets. Try again.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ],
        );
    };

    const getMsgCount = (t: TicketSummary) => (t.messages || t.responses || []).length;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Feather name="git-merge" size={20} color="#7c3aed" />
                            <Text style={styles.title}>Merge Tickets</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.instruction}>
                        Select the primary ticket. The other ticket will be closed and its messages merged.
                    </Text>

                    {/* Ticket Cards */}
                    {tickets.map((ticket, idx) => (
                        <TouchableOpacity
                            key={ticket.id}
                            style={[
                                styles.ticketCard,
                                primaryIndex === idx && styles.ticketCardSelected,
                            ]}
                            onPress={() => setPrimaryIndex(idx)}
                        >
                            <View style={styles.ticketRow}>
                                <Feather
                                    name={primaryIndex === idx ? 'check-circle' : 'circle'}
                                    size={20}
                                    color={primaryIndex === idx ? '#7c3aed' : '#94a3b8'}
                                />
                                <View style={styles.ticketInfo}>
                                    <View style={styles.ticketTopRow}>
                                        <Text style={styles.ticketId}>{ticket.id.slice(0, 12)}...</Text>
                                        {primaryIndex === idx && (
                                            <View style={styles.primaryBadge}>
                                                <Text style={styles.primaryText}>PRIMARY</Text>
                                            </View>
                                        )}
                                        {primaryIndex !== idx && (
                                            <View style={styles.secondaryBadge}>
                                                <Text style={styles.secondaryText}>WILL CLOSE</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.ticketSubject} numberOfLines={1}>
                                        {ticket.subject || ticket.description}
                                    </Text>
                                    <View style={styles.ticketMeta}>
                                        <Text style={styles.ticketMetaText}>
                                            <Feather name="user" size={10} /> {ticket.customer}
                                        </Text>
                                        <Text style={styles.ticketMetaText}>
                                            <Feather name="message-circle" size={10} /> {getMsgCount(ticket)} msgs
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.mergeBtn, loading && { opacity: 0.6 }]}
                            onPress={handleMerge}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Feather name="git-merge" size={16} color="#fff" />
                                    <Text style={styles.mergeText}>Merge Tickets</Text>
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
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
    instruction: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
        marginBottom: 16,
    },
    ticketCard: {
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    ticketCardSelected: {
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.04)',
    },
    ticketRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    ticketInfo: { flex: 1 },
    ticketTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    ticketId: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
    },
    primaryBadge: {
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    primaryText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#7c3aed',
    },
    secondaryBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    secondaryText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#ef4444',
    },
    ticketSubject: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 6,
    },
    ticketMeta: {
        flexDirection: 'row',
        gap: 14,
    },
    ticketMetaText: {
        fontSize: 11,
        color: colors.textMuted,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 8,
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
    mergeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#7c3aed',
    },
    mergeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
