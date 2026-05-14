import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    TextInput, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { linkTickets, unlinkTickets, getLinkedTicketIds } from '../services/ticketRelationService';
import { db } from '../services/firebaseConfig';
import { collection, query, limit, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';

interface LinkTicketsModalProps {
    visible: boolean;
    currentTicketId: string;
    onClose: () => void;
    onLinked: () => void;
}

interface TicketPreview {
    id: string;
    subject: string;
    status: string;
    customer: string;
    isLinked: boolean;
}

export default function LinkTicketsModal({ visible, currentTicketId, onClose, onLinked }: LinkTicketsModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<TicketPreview[]>([]);
    const [linkedIds, setLinkedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Load currently linked ticket IDs
    useEffect(() => {
        if (visible && currentTicketId) {
            getLinkedTicketIds(currentTicketId).then(setLinkedIds).catch(console.error);
        }
    }, [visible, currentTicketId]);

    // Search tickets
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(50));
            const snap = await getDocs(q);
            const tickets: TicketPreview[] = [];

            snap.forEach(docSnap => {
                if (docSnap.id === currentTicketId) return; // Exclude self

                const d = docSnap.data();
                const subject = d.issue || d.subject || d.description || '';
                const customer = d.userName || d.customerName || 'Unknown';
                const matchesSearch =
                    docSnap.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    customer.toLowerCase().includes(searchQuery.toLowerCase());

                if (matchesSearch) {
                    tickets.push({
                        id: docSnap.id,
                        subject,
                        status: d.status || 'open',
                        customer,
                        isLinked: linkedIds.includes(docSnap.id),
                    });
                }
            });

            setResults(tickets);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setSearching(false);
        }
    };

    const handleLink = async (ticketId: string) => {
        setLoading(true);
        try {
            await linkTickets(currentTicketId, ticketId);
            setLinkedIds(prev => [...prev, ticketId]);
            setResults(prev => prev.map(t => t.id === ticketId ? { ...t, isLinked: true } : t));
            Alert.alert('Linked', 'Tickets have been linked successfully.');
            onLinked();
        } catch (err) {
            console.error('Link error:', err);
            Alert.alert('Error', 'Failed to link tickets.');
        } finally {
            setLoading(false);
        }
    };

    const handleUnlink = async (ticketId: string) => {
        setLoading(true);
        try {
            await unlinkTickets(currentTicketId, ticketId);
            setLinkedIds(prev => prev.filter(id => id !== ticketId));
            setResults(prev => prev.map(t => t.id === ticketId ? { ...t, isLinked: false } : t));
            Alert.alert('Unlinked', 'Tickets have been unlinked.');
            onLinked();
        } catch (err) {
            console.error('Unlink error:', err);
            Alert.alert('Error', 'Failed to unlink tickets.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return '#ef4444';
            case 'in-progress': return '#f59e0b';
            case 'resolved': return '#10b981';
            case 'closed': return '#6b7280';
            default: return colors.textMuted;
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Feather name="link" size={20} color="#3b82f6" />
                            <Text style={styles.title}>Link Tickets</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Feather name="x" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchRow}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={16} color={colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by ID, subject, or customer..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                        </View>
                        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                            <Feather name="search" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Currently Linked */}
                    {linkedIds.length > 0 && (
                        <View style={styles.linkedSection}>
                            <Text style={styles.linkedLabel}>
                                <Feather name="link" size={12} /> {linkedIds.length} linked ticket(s)
                            </Text>
                        </View>
                    )}

                    {/* Results */}
                    <View style={styles.resultArea}>
                        {searching ? (
                            <View style={styles.centerBox}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.searchingText}>Searching...</Text>
                            </View>
                        ) : results.length > 0 ? (
                            <FlatList
                                data={results}
                                keyExtractor={item => item.id}
                                style={{ maxHeight: 300 }}
                                renderItem={({ item }) => (
                                    <View style={[styles.resultCard, item.isLinked && styles.resultCardLinked]}>
                                        <View style={styles.resultInfo}>
                                            <View style={styles.resultTopRow}>
                                                <Text style={styles.resultId}>{item.id.slice(0, 14)}...</Text>
                                                <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                                            </View>
                                            <Text style={styles.resultSubject} numberOfLines={1}>{item.subject}</Text>
                                            <Text style={styles.resultCustomer}>{item.customer}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.linkBtn, item.isLinked && styles.unlinkBtn]}
                                            onPress={() => item.isLinked ? handleUnlink(item.id) : handleLink(item.id)}
                                            disabled={loading}
                                        >
                                            <Feather
                                                name={item.isLinked ? 'x' : 'link'}
                                                size={14}
                                                color={item.isLinked ? '#ef4444' : '#3b82f6'}
                                            />
                                            <Text style={[styles.linkBtnText, item.isLinked && { color: '#ef4444' }]}>
                                                {item.isLinked ? 'Unlink' : 'Link'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        ) : searchQuery.length > 0 ? (
                            <View style={styles.centerBox}>
                                <Feather name="inbox" size={28} color={colors.textMuted} />
                                <Text style={styles.noResults}>No tickets found</Text>
                            </View>
                        ) : (
                            <View style={styles.centerBox}>
                                <Feather name="search" size={28} color={colors.textMuted} />
                                <Text style={styles.noResults}>Search for tickets to link</Text>
                            </View>
                        )}
                    </View>

                    {/* Close */}
                    <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                        <Text style={styles.doneText}>Done</Text>
                    </TouchableOpacity>
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
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: colors.text,
        padding: 0,
    },
    searchBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkedSection: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.06)',
        borderRadius: 8,
        marginBottom: 12,
    },
    linkedLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6',
    },
    resultArea: {
        minHeight: 100,
    },
    centerBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
    },
    searchingText: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 6,
    },
    noResults: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 8,
    },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 6,
        backgroundColor: '#fff',
    },
    resultCardLinked: {
        backgroundColor: 'rgba(59, 130, 246, 0.04)',
        borderColor: 'rgba(59, 130, 246, 0.15)',
    },
    resultInfo: { flex: 1 },
    resultTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    resultId: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    resultSubject: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    resultCustomer: {
        fontSize: 11,
        color: colors.textMuted,
    },
    linkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    unlinkBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    linkBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6',
    },
    doneBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        marginTop: 12,
    },
    doneText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
});
