import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';

// Firebase Imports
import { db } from '../../services/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'vendor';
    status: 'active' | 'blocked';
    joinedDate: any;
    orders?: number;
}

export default function AdminUsersScreen({ navigation }: any) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'vendor'>('all');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // 1. Fetch Data from Firebase (Live Updates)
    useEffect(() => {
        const q = query(collection(db, "users"), orderBy("name", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || 'No Name',
                    email: data.email || 'No Email',
                    role: data.role || 'user',
                    status: data.status || 'active', // Default to active if missing
                    joinedDate: data.joinedDate,
                    orders: data.orders || 0
                } as User;
            });
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error("Firebase Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Action Handlers
    const handleBlockUser = async (userId: string, currentStatus: string) => {
        try {
            const nextStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
            await updateDoc(doc(db, "users", userId), { status: nextStatus });
            Alert.alert('Success', `User is now ${nextStatus}`);
        } catch (error) {
            Alert.alert('Error', 'Update failed.');
        }
    };

    const handleDeleteUser = async () => {
        if (selectedUser) {
            try {
                await deleteDoc(doc(db, "users", selectedUser.id));
                setShowDeleteModal(false);
                setSelectedUser(null);
            } catch (error) {
                Alert.alert('Error', 'Delete failed.');
            }
        }
    };

    // 3. Filter Logic (Combines Search + Status + Role)
    const filteredUsers = users.filter(user => {
        // EXCLUDE VENDORS:
        // Users with role 'vendor' should only appear in Vendor Management
        if (user.role === 'vendor') return false;

        const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        // Role filter removed as we only show 'user' role now

        return matchesSearch && matchesStatus;
    });

    const activeCount = filteredUsers.filter(u => u.status !== 'blocked').length;
    const blockedCount = filteredUsers.filter(u => u.status === 'blocked').length;

    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US';
    const formatDate = (dateObj: any) => {
        if (!dateObj) return 'N/A';
        return dateObj.toDate ? dateObj.toDate().toLocaleDateString() : new Date(dateObj).toLocaleDateString();
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Manage Users</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Stats Row */}
            <View style={styles.badgeRow}>
                <View style={styles.badge}>
                    <Feather name="user-check" size={14} color="#10b981" />
                    <Text style={styles.badgeText}>{activeCount} Active</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Feather name="user-x" size={14} color="#ef4444" />
                    <Text style={[styles.badgeText, { color: '#ef4444' }]}>{blockedCount} Blocked</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    ListHeaderComponent={
                        <View style={{ marginBottom: spacing.md }}>
                            {/* Search */}
                            <View style={styles.searchContainer}>
                                <Feather name="search" size={16} color={colors.textMuted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search users..."
                                    value={search}
                                    onChangeText={setSearch}
                                />
                            </View>

                            {/* Status Filter */}
                            <Text style={styles.filterLabel}>Status Filter</Text>
                            <View style={styles.filterRow}>
                                {(['all', 'active', 'blocked'] as const).map(f => (
                                    <TouchableOpacity key={f} style={[styles.filterChip, statusFilter === f && styles.filterChipActive]} onPress={() => setStatusFilter(f)}>
                                        <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.userCard}>
                            <View style={styles.userHeader}>
                                <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(item.name)}</Text></View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{item.name}</Text>
                                    <Text style={styles.userEmail}>{item.email}</Text>
                                </View>
                                <View style={[styles.statusBadge, item.status === 'blocked' ? styles.blockedBadge : styles.activeBadge]}>
                                    <Text style={[styles.statusText, { color: item.status === 'blocked' ? '#ef4444' : '#10b981' }]}>{item.status}</Text>
                                </View>
                            </View>

                            <View style={styles.userMeta}>
                                <View style={styles.metaItem}><Feather name="tag" size={12} color={colors.textMuted} /><Text style={styles.metaText}>Consumer</Text></View>
                                <View style={styles.metaItem}><Feather name="calendar" size={12} color={colors.textMuted} /><Text style={styles.metaText}>{formatDate(item.joinedDate)}</Text></View>
                            </View>

                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, item.status === 'blocked' ? styles.unblockBtn : styles.blockBtn]}
                                    onPress={() => handleBlockUser(item.id, item.status)}
                                >
                                    <Feather name={item.status === 'blocked' ? 'user-check' : 'user-x'} size={14} color={item.status === 'blocked' ? '#10b981' : '#f59e0b'} />
                                    <Text style={[styles.actionBtnText, { color: item.status === 'blocked' ? '#10b981' : '#f59e0b' }]}>
                                        {item.status === 'blocked' ? 'Unblock' : 'Block'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteBtn} onPress={() => { setSelectedUser(item); setShowDeleteModal(true); }}>
                                    <Feather name="trash-2" size={14} color="#ef4444" />
                                    <Text style={styles.deleteBtnText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.centered}><Text style={{ color: colors.textMuted }}>No users found.</Text></View>
                    }
                />
            )}

            {/* Modal */}
            <Modal visible={showDeleteModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Feather name="alert-triangle" size={40} color="#ef4444" />
                        <Text style={styles.modalTitle}>Are you sure?</Text>
                        <Text style={styles.modalText}>Do you really want to delete {selectedUser?.name}?</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteUser}><Text style={{ color: '#fff' }}>Delete</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    badgeRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: 6 },
    badgeText: { fontSize: fontSize.sm, fontWeight: '500', color: '#10b981' },
    list: { padding: spacing.lg },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
    searchInput: { flex: 1, height: 44, fontSize: fontSize.base, marginLeft: spacing.sm },
    filterLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 8, fontWeight: 'bold' },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipRoleActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    filterText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    filterTextActive: { color: '#fff' },
    userCard: { backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    userHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: 'bold', color: colors.primary },
    userInfo: { flex: 1, marginLeft: spacing.md },
    userName: { fontWeight: '600', color: colors.text },
    userEmail: { fontSize: 12, color: colors.textMuted },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    activeBadge: { backgroundColor: 'rgba(16,185,129,0.1)' },
    blockedBadge: { backgroundColor: 'rgba(239,68,68,0.1)' },
    statusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    userMeta: { flexDirection: 'row', gap: 16, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6, gap: 4 },
    blockBtn: { backgroundColor: 'rgba(245,158,11,0.1)' },
    unblockBtn: { backgroundColor: 'rgba(16,185,129,0.1)' },
    actionBtnText: { fontSize: 12, fontWeight: '600' },
    deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6, gap: 4 },
    deleteBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
    modalText: { textAlign: 'center', marginVertical: 10, color: colors.textMuted },
    modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
    cancelBtn: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#f0f0f0', borderRadius: 10 },
    confirmDeleteBtn: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#ef4444', borderRadius: 10 },
});