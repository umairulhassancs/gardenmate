import React, { useState } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { colors, spacing } from '../theme';
import { logEscalation } from '../services/auditService';

interface Props {
    visible: boolean;
    onClose: () => void;
    ticketId: string;
    collectionName: 'complaints' | 'tickets';
    vendorId: string;
    customerName: string;
}

const ESCALATION_REASONS = [
    { id: 'admin_review', label: 'Needs Admin Review', icon: 'eye', color: '#3b82f6' },
    { id: 'policy', label: 'Policy Question', icon: 'book', color: '#8b5cf6' },
    { id: 'refund', label: 'Refund Request', icon: 'dollar-sign', color: '#10b981' },
    { id: 'threat', label: 'Customer Threatening', icon: 'alert-triangle', color: '#ef4444' },
    { id: 'technical', label: 'Technical Issue', icon: 'tool', color: '#f59e0b' },
    { id: 'fraud', label: 'Suspected Fraud', icon: 'shield', color: '#dc2626' },
    { id: 'other', label: 'Other', icon: 'more-horizontal', color: '#64748b' },
];

export default function EscalationModal({ visible, onClose, ticketId, collectionName, vendorId, customerName }: Props) {
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleEscalate = async () => {
        if (!selectedReason) {
            Alert.alert('Select Reason', 'Please select an escalation reason.');
            return;
        }

        setSubmitting(true);
        try {
            const reason = ESCALATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
            const vendorName = auth.currentUser?.displayName || 'Vendor';

            // Update ticket
            await updateDoc(doc(db, collectionName, ticketId), {
                escalatedToAdmin: true,
                escalationReason: reason,
                escalationNotes: notes.trim(),
                escalatedAt: serverTimestamp(),
                escalatedBy: auth.currentUser?.uid || '',
            });

            // Notify all admins
            await addDoc(collection(db, 'notifications'), {
                type: 'escalation',
                title: '🚨 Ticket Escalated',
                description: `Vendor escalated ticket for "${customerName}": ${reason}`,
                userId: 'admin', // General admin notification
                vendorId,
                relatedId: ticketId,
                isRead: false,
                createdAt: serverTimestamp(),
            });

            // Log audit event
            logEscalation(ticketId, collectionName, reason, notes.trim(), vendorName);

            Alert.alert('Escalated ✅', 'This ticket has been escalated to admin for review.');
            setSelectedReason(null);
            setNotes('');
            onClose();
        } catch (error) {
            console.error('Escalation error:', error);
            Alert.alert('Error', 'Failed to escalate ticket.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ width: '100%', alignItems: 'center' }}
                >
                    <View style={styles.container}>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Feather name="x" size={20} color="#94a3b8" />
                        </TouchableOpacity>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            <View style={styles.headerIcon}>
                                <Feather name="alert-triangle" size={28} color="#f59e0b" />
                            </View>
                            <Text style={styles.title}>Escalate to Admin</Text>
                            <Text style={styles.subtitle}>
                                Select a reason for escalating this ticket to admin review.
                            </Text>

                            {/* Reasons */}
                            <View style={styles.reasonsGrid}>
                                {ESCALATION_REASONS.map((reason) => (
                                    <TouchableOpacity
                                        key={reason.id}
                                        style={[
                                            styles.reasonCard,
                                            selectedReason === reason.id && { borderColor: reason.color, backgroundColor: reason.color + '10' },
                                        ]}
                                        onPress={() => setSelectedReason(reason.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.reasonIcon, { backgroundColor: reason.color + '15' }]}>
                                            <Feather name={reason.icon as any} size={16} color={reason.color} />
                                        </View>
                                        <Text style={[
                                            styles.reasonLabel,
                                            selectedReason === reason.id && { color: reason.color, fontWeight: '700' },
                                        ]}>
                                            {reason.label}
                                        </Text>
                                        {selectedReason === reason.id && (
                                            <View style={[styles.checkmark, { backgroundColor: reason.color }]}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Notes */}
                            <TextInput
                                style={styles.notesInput}
                                placeholder="Additional notes (optional)..."
                                placeholderTextColor="#94a3b8"
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={3}
                                maxLength={500}
                                textAlignVertical="top"
                            />

                            {/* Actions */}
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.escalateBtn, !selectedReason && styles.escalateBtnDisabled]}
                                    onPress={handleEscalate}
                                    disabled={submitting || !selectedReason}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Feather name="arrow-up-circle" size={16} color="#fff" />
                                            <Text style={styles.escalateBtnText}>Escalate</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    container: {
        width: '100%', backgroundColor: '#fff', borderRadius: 20,
        padding: 24, maxHeight: '85%',
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    closeBtn: { position: 'absolute', top: 14, right: 14, padding: 4, zIndex: 10 },
    headerIcon: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: '#fffbeb',
        justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12,
    },
    title: { fontSize: 20, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
    subtitle: {
        fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20,
        marginTop: 6, marginBottom: 20,
    },

    // Reasons grid
    reasonsGrid: { gap: 8, marginBottom: 16 },
    reasonCard: {
        flexDirection: 'row', alignItems: 'center', padding: 12,
        borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    reasonIcon: {
        width: 32, height: 32, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center', marginRight: 10,
    },
    reasonLabel: { fontSize: 14, color: '#334155', flex: 1 },
    checkmark: {
        width: 20, height: 20, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },

    // Notes
    notesInput: {
        minHeight: 70, borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12, padding: 14, fontSize: 14, color: '#334155',
        textAlignVertical: 'top', marginBottom: 20, backgroundColor: '#f8fafc',
    },

    // Actions
    actions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#f1f5f9', alignItems: 'center',
    },
    cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
    escalateBtn: {
        flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    escalateBtnDisabled: { opacity: 0.5 },
    escalateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
