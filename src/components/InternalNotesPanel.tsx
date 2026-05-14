import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, TextInput,
    FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '../services/firebaseConfig';
import { doc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { colors, spacing } from '../theme';

interface InternalNote {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: 'vendor' | 'admin';
    text: string;
    createdAt: Date | any;
}

interface InternalNotesPanelProps {
    ticketId: string;
    collectionName: 'tickets' | 'complaints';
    notes: InternalNote[];
    userRole: 'vendor' | 'admin';
}

export default function InternalNotesPanel({
    ticketId, collectionName, notes, userRole,
}: InternalNotesPanelProps) {
    const [noteText, setNoteText] = useState('');
    const [sending, setSending] = useState(false);

    const handleAddNote = async () => {
        const text = noteText.trim();
        if (!text || !ticketId) return;
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        setSending(true);
        try {
            const ref = doc(db, collectionName, ticketId);
            const newNote = {
                id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                authorId: userId,
                authorName: userRole === 'admin' ? 'Admin' : 'Vendor',
                authorRole: userRole,
                text,
                createdAt: Timestamp.fromDate(new Date()),
            };
            await updateDoc(ref, {
                internalNotes: arrayUnion(newNote),
                updatedAt: serverTimestamp(),
            });
            setNoteText('');
        } catch (err) {
            console.error('Error adding note:', err);
            Alert.alert('Error', 'Failed to add note');
        } finally {
            setSending(false);
        }
    };

    const formatTime = (date: Date | any) => {
        if (!date) return '';
        const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Feather name="lock" size={14} color="#f59e0b" />
                    <Text style={styles.headerTitle}>Internal Notes</Text>
                </View>
                <Text style={styles.headerBadge}>{notes.length}</Text>
            </View>

            {/* Info */}
            <View style={styles.infoBar}>
                <Feather name="eye-off" size={12} color="#94a3b8" />
                <Text style={styles.infoText}>These notes are only visible to staff — not the customer</Text>
            </View>

            {/* Notes List */}
            {notes.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Feather name="file-text" size={32} color="#e2e8f0" />
                    <Text style={styles.emptyText}>No internal notes yet</Text>
                    <Text style={styles.emptySubtext}>Add private notes about this ticket</Text>
                </View>
            ) : (
                <FlatList
                    data={[...notes].reverse()}
                    keyExtractor={(item) => item.id}
                    style={styles.notesList}
                    renderItem={({ item }) => (
                        <View style={styles.noteCard}>
                            <View style={styles.noteHeader}>
                                <View style={styles.noteAuthorRow}>
                                    <View style={[styles.roleIcon, item.authorRole === 'admin' && styles.roleIconAdmin]}>
                                        <Feather
                                            name={item.authorRole === 'admin' ? 'shield' : 'user'}
                                            size={10}
                                            color={item.authorRole === 'admin' ? '#7c3aed' : '#f97316'}
                                        />
                                    </View>
                                    <Text style={styles.noteAuthor}>{item.authorName}</Text>
                                    <Text style={styles.noteRoleBadge}>{item.authorRole}</Text>
                                </View>
                                <Text style={styles.noteTime}>{formatTime(item.createdAt)}</Text>
                            </View>
                            <Text style={styles.noteText}>{item.text}</Text>
                        </View>
                    )}
                />
            )}

            {/* Add Note Input */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Add internal note..."
                    placeholderTextColor="#94a3b8"
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    maxLength={1000}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!noteText.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={handleAddNote}
                    disabled={!noteText.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Feather name="plus" size={18} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fef3c7',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
    headerBadge: {
        fontSize: 11, fontWeight: '700', color: '#f59e0b',
        backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    },

    infoBar: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 6,
        backgroundColor: '#f1f5f9',
    },
    infoText: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginTop: 10 },
    emptySubtext: { fontSize: 12, color: '#cbd5e1', marginTop: 4 },

    notesList: { flex: 1, padding: 10 },

    noteCard: {
        backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
    },
    noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    noteAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    roleIcon: {
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center',
    },
    roleIconAdmin: { backgroundColor: '#f3e8ff' },
    noteAuthor: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
    noteRoleBadge: {
        fontSize: 9, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase',
        backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
    },
    noteTime: { fontSize: 10, color: '#94a3b8' },
    noteText: { fontSize: 13, color: '#334155', lineHeight: 18 },

    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', padding: 10,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    },
    input: {
        flex: 1, minHeight: 38, maxHeight: 100,
        backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
        paddingHorizontal: 12, paddingVertical: 8,
        fontSize: 13, color: '#1e293b', marginRight: 8,
    },
    sendBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#e2e8f0' },
});
