import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated,
    Modal, TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { db } from '../services/firebaseConfig';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';

interface BulkActionsBarProps {
    selectedIds: string[];
    collectionName: string; // 'complaints' or 'tickets'
    onClearSelection: () => void;
    onActionComplete: () => void;
}

export default function BulkActionsBar({
    selectedIds, collectionName, onClearSelection, onActionComplete,
}: BulkActionsBarProps) {
    const [loading, setLoading] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [assignTo, setAssignTo] = useState('');
    const [tagValue, setTagValue] = useState('');

    if (selectedIds.length === 0) return null;

    // ── Bulk Close ──
    const handleBulkClose = () => {
        Alert.alert(
            'Close Selected Tickets',
            `Are you sure you want to close ${selectedIds.length} ticket(s)?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close All', style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const batch = writeBatch(db);
                            selectedIds.forEach(id => {
                                const ref = doc(db, collectionName, id);
                                batch.update(ref, {
                                    status: 'closed',
                                    closedAt: serverTimestamp(),
                                    updatedAt: serverTimestamp(),
                                });
                            });
                            await batch.commit();
                            Alert.alert('Success', `${selectedIds.length} ticket(s) closed.`);
                            onClearSelection();
                            onActionComplete();
                        } catch (err) {
                            console.error('Bulk close error:', err);
                            Alert.alert('Error', 'Failed to close tickets. Try again.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ],
        );
    };

    // ── Bulk Assign ──
    const handleBulkAssign = async () => {
        if (!assignTo.trim()) {
            Alert.alert('Error', 'Please enter an assignee name.');
            return;
        }
        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                const ref = doc(db, collectionName, id);
                batch.update(ref, {
                    'assignment.assignedToName': assignTo.trim(),
                    'assignment.assignedAt': serverTimestamp(),
                    status: 'assigned',
                    updatedAt: serverTimestamp(),
                });
            });
            await batch.commit();
            Alert.alert('Success', `${selectedIds.length} ticket(s) assigned to "${assignTo.trim()}".`);
            setShowAssignModal(false);
            setAssignTo('');
            onClearSelection();
            onActionComplete();
        } catch (err) {
            console.error('Bulk assign error:', err);
            Alert.alert('Error', 'Failed to assign tickets. Try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Bulk Tag ──
    const handleBulkTag = async () => {
        if (!tagValue.trim()) {
            Alert.alert('Error', 'Please enter a tag.');
            return;
        }
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const { arrayUnion } = await import('firebase/firestore');
            selectedIds.forEach(id => {
                const ref = doc(db, collectionName, id);
                batch.update(ref, {
                    tags: arrayUnion(tagValue.trim().toLowerCase()),
                    updatedAt: serverTimestamp(),
                });
            });
            await batch.commit();
            Alert.alert('Success', `Tag "${tagValue.trim()}" added to ${selectedIds.length} ticket(s).`);
            setShowTagModal(false);
            setTagValue('');
            onClearSelection();
            onActionComplete();
        } catch (err) {
            console.error('Bulk tag error:', err);
            Alert.alert('Error', 'Failed to add tag. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Bar */}
            <View style={styles.bar}>
                <View style={styles.barLeft}>
                    <TouchableOpacity onPress={onClearSelection} style={styles.clearBtn}>
                        <Feather name="x" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.countText}>{selectedIds.length} selected</Text>
                </View>
                <View style={styles.barActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleBulkClose} disabled={loading}>
                        <Feather name="check-circle" size={18} color="#fff" />
                        <Text style={styles.actionText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAssignModal(true)} disabled={loading}>
                        <Feather name="user-plus" size={18} color="#fff" />
                        <Text style={styles.actionText}>Assign</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowTagModal(true)} disabled={loading}>
                        <Feather name="tag" size={18} color="#fff" />
                        <Text style={styles.actionText}>Tag</Text>
                    </TouchableOpacity>
                </View>
                {loading && <ActivityIndicator size="small" color="#fff" style={styles.barLoader} />}
            </View>

            {/* Assign Modal */}
            <Modal visible={showAssignModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Assign {selectedIds.length} Ticket(s)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter assignee name..."
                            placeholderTextColor="#94a3b8"
                            value={assignTo}
                            onChangeText={setAssignTo}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowAssignModal(false); setAssignTo(''); }}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleBulkAssign} disabled={loading}>
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Assign All</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Tag Modal */}
            <Modal visible={showTagModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Tag {selectedIds.length} Ticket(s)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter tag name..."
                            placeholderTextColor="#94a3b8"
                            value={tagValue}
                            onChangeText={setTagValue}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowTagModal(false); setTagValue(''); }}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleBulkTag} disabled={loading}>
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Add Tag</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    // Floating bar
    bar: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    barLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    clearBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    barActions: {
        flexDirection: 'row',
        gap: 4,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    barLoader: {
        position: 'absolute',
        right: 16,
        top: 12,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 16,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.12)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalCancelBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    modalConfirmBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: colors.primary,
        minWidth: 90,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
