import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    SafeAreaView, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Image as RNImage
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';

// Firebase
import { db } from '../../services/firebaseConfig';
import {
    collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, writeBatch, getDoc
} from 'firebase/firestore';

interface Vendor {
    id: string;
    uid: string;
    storeName: string;
    ownerName: string;
    email: string;
    status: 'approved' | 'pending' | 'blocked' | 'active';
    plantsCount: number;
    rating: number;
    joinedDate: any;
    totalSales: string | number;
    requestId?: string;
    // New fields
    cnic?: string;
    nurseryAddress?: string;
    nurseryPhotos?: string[];
    registrationDocs?: string[];
}

export default function AdminVendorsScreen({ navigation }: any) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'blocked'>('all');
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        let currentUsers: any[] = [];
        let currentRequests: any[] = [];

        const syncData = () => {
            const vendorsMap = new Map<string, Vendor>();

            currentUsers.forEach(user => {
                const uid = user.id;
                vendorsMap.set(uid, {
                    id: uid,
                    uid: uid,
                    storeName: user.storeName || user.name || 'Unnamed Store',
                    ownerName: user.ownerName || user.displayName || user.name || 'No Owner',
                    status: user.status || 'approved',
                    email: user.email || '',
                    plantsCount: user.plantsCount || 0,
                    rating: user.rating || 0,
                    totalSales: user.totalSales || 0,
                    joinedDate: user.createdAt || user.joinedDate || null,
                    requestId: undefined,
                    cnic: user.cnic,
                    nurseryAddress: user.nurseryAddress,
                    nurseryPhotos: user.nurseryPhotos,
                    registrationDocs: user.registrationDocs
                });
            });

            currentRequests.forEach(request => {
                const uid = request.userId || request.uid;
                if (!uid) return;

                if (vendorsMap.has(uid)) {
                    const existing = vendorsMap.get(uid)!;
                    existing.requestId = request.id;
                    // Start of Selection
                    existing.cnic = request.cnic;
                    existing.nurseryAddress = request.nurseryAddress;
                    existing.nurseryPhotos = request.nurseryPhotos;
                    existing.registrationDocs = request.registrationDocs;

                    if (request.status === 'pending') {
                        existing.status = 'pending';
                    }
                } else {
                    vendorsMap.set(uid, {
                        id: uid,
                        uid: uid,
                        storeName: request.storeName || 'Unnamed Store',
                        ownerName: request.userName || request.ownerName || 'No Owner',
                        status: request.status || 'pending',
                        email: request.userEmail || request.businessEmail || '',
                        plantsCount: 0,
                        rating: 0,
                        totalSales: 0,
                        joinedDate: request.requestedAt || null,
                        requestId: request.id,
                        cnic: request.cnic,
                        nurseryAddress: request.nurseryAddress,
                        nurseryPhotos: request.nurseryPhotos,
                        registrationDocs: request.registrationDocs
                    });
                }
            });

            const finalArray = Array.from(vendorsMap.values())
                .sort((a, b) => a.storeName.localeCompare(b.storeName));

            setVendors(finalArray);
            setLoading(false);
        };


        // Listen to users with vendor role
        const qUsers = query(collection(db, "users"), where("role", "==", "vendor"));
        const unsubUsers = onSnapshot(qUsers, snapshot => {
            currentUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('✅ Users loaded:', currentUsers.length);
            syncData();
        }, err => {
            console.error('❌ Users error:', err);
            setLoading(false);
        });

        // Listen to vendor requests
        const qRequests = collection(db, "vendorRequests");
        const unsubRequests = onSnapshot(qRequests, snapshot => {
            currentRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('✅ Requests loaded:', currentRequests.length);
            syncData();
        }, err => {
            console.error('❌ Requests error:', err);
            setLoading(false);
        });

        return () => {
            unsubUsers();
            unsubRequests();
        };
    }, []);

    /* ===================== ACTIONS ===================== */

    const handleApproveVendor = async (vendor: Vendor) => {
        try {
            console.log('🔍 Approving vendor:', vendor.uid);

            const batch = writeBatch(db);

            // 1. Update or create user document with vendor role
            const userRef = doc(db, "users", vendor.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                // Update existing user
                batch.update(userRef, {
                    role: 'vendor',
                    status: 'approved',
                    approvedAt: new Date(),
                    cnic: vendor.cnic || '',
                    nurseryAddress: vendor.nurseryAddress || '',
                    nurseryPhotos: vendor.nurseryPhotos || [],
                    registrationDocs: vendor.registrationDocs || []
                });
            } else {
                // Create new user from request data (shouldn't happen but just in case)
                batch.set(userRef, {
                    id: vendor.uid,
                    name: vendor.ownerName,
                    storeName: vendor.storeName,
                    email: vendor.email,
                    role: 'vendor',
                    status: 'approved',
                    plantsCount: 0,
                    rating: 0,
                    totalSales: 0,
                    createdAt: new Date(),
                    approvedAt: new Date(),
                    cnic: vendor.cnic || '',
                    nurseryAddress: vendor.nurseryAddress || '',
                    nurseryPhotos: vendor.nurseryPhotos || [],
                    registrationDocs: vendor.registrationDocs || []
                });
            }

            // 3. Create 'vendors' document for Commission/Store details (CRITICAL FIX)
            const vendorRef = doc(db, "vendors", vendor.uid);
            batch.set(vendorRef, {
                vendorId: vendor.uid,
                vendorName: vendor.ownerName,
                storeName: vendor.storeName,
                email: vendor.email,
                phone: '',
                status: 'active',
                cnic: vendor.cnic || '',
                nurseryAddress: vendor.nurseryAddress || '',
                nurseryPhotos: vendor.nurseryPhotos || [],
                registrationDocs: vendor.registrationDocs || [],
                registeredAt: new Date().toISOString(),
                totalSales: 0,
                totalCommissionDue: 0,
                currentMonthSales: 0,
                currentMonthCommission: 0
            }, { merge: true });

            // 2. Update vendor request if exists
            if (vendor.requestId) {
                const requestRef = doc(db, "vendorRequests", vendor.requestId);
                const requestDoc = await getDoc(requestRef);

                if (requestDoc.exists()) {
                    batch.update(requestRef, {
                        status: 'approved',
                        reviewedAt: new Date()
                    });
                }
            }

            await batch.commit();
            console.log('✅ Vendor approved:', vendor.storeName);
            Alert.alert("Success! 🎉", `${vendor.storeName} has been approved!`);
        } catch (err: any) {
            console.error('❌ Approve Error:', err);
            Alert.alert("Error", err.message || "Approval failed.");
        }
    };

    const handleBlockVendor = async (uid: string, currentStatus: string, requestId?: string) => {
        try {
            const newStatus = currentStatus === 'blocked' ? 'approved' : 'blocked';
            console.log(`🔄 ${newStatus === 'blocked' ? 'Blocking' : 'Unblocking'} vendor:`, uid);

            const batch = writeBatch(db);

            // 1. Update user status
            const userRef = doc(db, "users", uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                batch.update(userRef, {
                    status: newStatus,
                    blockedAt: newStatus === 'blocked' ? new Date() : null
                });
            }

            // 2. Update request if exists
            if (requestId) {
                const requestRef = doc(db, "vendorRequests", requestId);
                const requestDoc = await getDoc(requestRef);

                if (requestDoc.exists()) {
                    batch.update(requestRef, { status: newStatus });
                }
            }

            await batch.commit();
            console.log('✅ Status updated successfully');
        } catch (err: any) {
            console.error("❌ Block Error:", err);
            Alert.alert('Error', err.message || 'Failed to update status.');
        }
    };

    const handleDeleteVendor = async () => {
        if (!selectedVendor) return;

        try {
            console.log('🗑️ Deleting vendor:', selectedVendor.uid);

            const batch = writeBatch(db);

            // 1. Delete vendor request if exists
            if (selectedVendor.requestId) {
                const requestRef = doc(db, "vendorRequests", selectedVendor.requestId);
                const requestDoc = await getDoc(requestRef);

                if (requestDoc.exists()) {
                    batch.delete(requestRef);
                    console.log('🗑️ Deleted vendor request:', selectedVendor.requestId);
                }
            }

            // 2. Delete user document
            const userRef = doc(db, "users", selectedVendor.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                batch.delete(userRef);
                console.log('🗑️ Deleted user document:', selectedVendor.uid);
            }

            await batch.commit();

            setShowDeleteModal(false);
            setSelectedVendor(null);
            console.log('✅ Vendor deleted successfully');
            Alert.alert('Success', 'Vendor deleted successfully.');
        } catch (err: any) {
            console.error("❌ Delete Error:", err);
            Alert.alert('Error', err.message || 'Delete failed.');
        }
    };

    /* ===================== FILTER & SEARCH ===================== */
    const filteredVendors = vendors.filter(vendor => {
        const matchesSearch =
            vendor.storeName.toLowerCase().includes(search.toLowerCase()) ||
            vendor.ownerName.toLowerCase().includes(search.toLowerCase()) ||
            vendor.email.toLowerCase().includes(search.toLowerCase());

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'approved' && (vendor.status === 'approved' || vendor.status === 'active')) ||
            vendor.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const approvedCount = vendors.filter(v => v.status === 'approved' || v.status === 'active').length;
    const pendingCount = vendors.filter(v => v.status === 'pending').length;
    const blockedCount = vendors.filter(v => v.status === 'blocked').length;

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'approved':
            case 'active': return '#10b981';
            case 'pending': return '#f59e0b';
            case 'blocked': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getInitials = (name: string) =>
        name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'VN';

    const formatDate = (dateObj: any) => {
        if (!dateObj) return 'N/A';
        if (dateObj.toDate) return dateObj.toDate().toLocaleDateString();
        if (dateObj instanceof Date) return dateObj.toLocaleDateString();
        return 'N/A';
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={{ marginTop: 10 }}>Loading vendors...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Vendors Management</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Stats Badges */}
            <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Feather name="check-circle" size={14} color="#10b981" />
                    <Text style={[styles.badgeText, { color: '#10b981' }]}>{approvedCount} Active</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Feather name="clock" size={14} color="#f59e0b" />
                    <Text style={[styles.badgeText, { color: '#f59e0b' }]}>{pendingCount} Pending</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Feather name="x-circle" size={14} color="#ef4444" />
                    <Text style={[styles.badgeText, { color: '#ef4444' }]}>{blockedCount} Blocked</Text>
                </View>
            </View>

            <FlatList
                data={filteredVendors}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <>
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={16} color="#9ca3af" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by store, owner or email..."
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>

                        <View style={styles.filterRow}>
                            {(['all', 'approved', 'pending', 'blocked'] as const).map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
                                    onPress={() => setStatusFilter(f)}
                                >
                                    <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
                                        {f === 'approved' ? 'ACTIVE' : f.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.resultCount}>{filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found</Text>
                    </>
                }
                renderItem={({ item }) => (
                    <View style={styles.vendorCard}>
                        <View style={styles.vendorHeader}>
                            <View style={[styles.avatar, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                <Text style={[styles.avatarText, { color: getStatusColor(item.status) }]}>
                                    {getInitials(item.storeName)}
                                </Text>
                            </View>
                            <View style={styles.vendorInfo}>
                                <Text style={styles.storeName}>{item.storeName}</Text>
                                <Text style={styles.ownerName}>{item.ownerName}</Text>
                                {item.status === 'pending' && (
                                    <View style={styles.pendingTag}>
                                        <Feather name="alert-circle" size={12} color="#f59e0b" />
                                        <Text style={styles.pendingTagText}>Registration Review</Text>
                                    </View>
                                )}
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                    {item.status === 'approved' || item.status === 'active' ? 'Approved' : item.status}
                                </Text>
                            </View>
                        </View>

                        {/* CONDITIONAL CONTENT: PENDING vs ACTIVE */}
                        {item.status === 'pending' ? (
                            <View style={styles.pendingSection}>
                                <Text style={styles.sectionTitle}>Registration Details</Text>
                                <View style={styles.detailRowCompact}>
                                    <Text style={styles.detailLabelCompact}>CNIC:</Text>
                                    <Text style={styles.detailValueCompact}>{item.cnic || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailRowCompact}>
                                    <Text style={styles.detailLabelCompact}>Address:</Text>
                                    <Text style={styles.detailValueCompact}>{item.nurseryAddress || 'N/A'}</Text>
                                </View>
                                <View style={styles.docsRow}>
                                    <Text style={styles.detailLabelCompact}>Docs:</Text>
                                    <Text style={styles.detailValueCompact}>
                                        {item.registrationDocs?.length || 0} Registration, {item.nurseryPhotos?.length || 0} Photos
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.vendorStats}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{item.plantsCount}</Text>
                                    <Text style={styles.statLabel}>Plants</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <View style={styles.ratingRow}>
                                        <Feather name="star" size={12} color="#f59e0b" />
                                        <Text style={styles.statValue}>{item.rating}</Text>
                                    </View>
                                    <Text style={styles.statLabel}>Rating</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>${item.totalSales}</Text>
                                    <Text style={styles.statLabel}>Sales</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.viewBtn}
                                onPress={() => {
                                    setSelectedVendor(item);
                                    setShowDetailModal(true);
                                }}
                            >
                                <Feather name="eye" size={14} color={colors.primary} />
                                <Text style={styles.viewBtnText}>View Details</Text>
                            </TouchableOpacity>

                            {item.status === 'pending' ? (
                                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveVendor(item)}>
                                    <Feather name="check" size={14} color="#10b981" />
                                    <Text style={styles.approveBtnText}>Approve Vendor</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.blockBtn, item.status === 'blocked' && styles.unblockBtn]}
                                    onPress={() => handleBlockVendor(item.uid, item.status, item.requestId)}
                                >
                                    <Feather
                                        name={item.status === 'blocked' ? 'check-circle' : 'x-circle'}
                                        size={14}
                                        color={item.status === 'blocked' ? '#10b981' : '#f59e0b'}
                                    />
                                    <Text style={[styles.blockBtnText, { color: item.status === 'blocked' ? '#10b981' : '#f59e0b' }]}>
                                        {item.status === 'blocked' ? 'Unblock' : 'Block'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => {
                                    setSelectedVendor(item);
                                    setShowDeleteModal(true);
                                }}
                            >
                                <Feather name="trash-2" size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Feather name="users" size={48} color="#9ca3af" />
                        <Text style={styles.emptyText}>No vendors found</Text>
                    </View>
                }
            />

            {/* Detail Modal */}
            <Modal visible={showDetailModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.detailModalContent}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Vendor Profile</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {selectedVendor && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detailAvatarSection}>
                                    <View style={[styles.detailAvatar, { backgroundColor: getStatusColor(selectedVendor.status) + '15' }]}>
                                        <Text style={[styles.detailAvatarText, { color: getStatusColor(selectedVendor.status) }]}>
                                            {getInitials(selectedVendor.storeName)}
                                        </Text>
                                    </View>
                                    <Text style={styles.detailStoreName}>{selectedVendor.storeName}</Text>
                                    <Text style={styles.detailEmail}>{selectedVendor.email}</Text>
                                    <View style={[styles.statusBadge, { marginTop: 8, backgroundColor: getStatusColor(selectedVendor.status) + '20' }]}>
                                        <Text style={{ color: getStatusColor(selectedVendor.status), fontWeight: 'bold', fontSize: 12 }}>
                                            {selectedVendor.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.sectionHeader}>
                                    <Feather name="user" size={16} color={colors.primary} />
                                    <Text style={styles.sectionTitleText}>Owner Details</Text>
                                </View>
                                <View style={styles.detailRows}>
                                    <DetailItem label="Owner Name" value={selectedVendor.ownerName || 'N/A'} />
                                    <DetailItem label="CNIC" value={selectedVendor.cnic || 'N/A'} />
                                    <DetailItem label="Address" value={selectedVendor.nurseryAddress || 'N/A'} />
                                    <DetailItem label="Joined" value={formatDate(selectedVendor.joinedDate)} />
                                </View>

                                {selectedVendor.status !== 'pending' && (
                                    <>
                                        <View style={styles.sectionHeader}>
                                            <Feather name="bar-chart-2" size={16} color={colors.primary} />
                                            <Text style={styles.sectionTitleText}>Performance</Text>
                                        </View>
                                        <View style={styles.detailRows}>
                                            <DetailItem label="Total Products" value={selectedVendor.plantsCount.toString()} />
                                            <DetailItem label="Total Revenue" value={`$${selectedVendor.totalSales}`} />
                                            <DetailItem label="Rating" value={`${selectedVendor.rating} ⭐`} />
                                        </View>
                                    </>
                                )}

                                <View style={styles.sectionHeader}>
                                    <Feather name="image" size={16} color={colors.primary} />
                                    <Text style={styles.sectionTitleText}>Documents & Photos</Text>
                                </View>
                                <View style={styles.detailRows}>
                                    <Text style={styles.detailLabel}>Nursery Photos ({selectedVendor.nurseryPhotos?.length || 0})</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                        {selectedVendor.nurseryPhotos?.map((uri, index) => (
                                            <TouchableOpacity key={index} onPress={() => Alert.alert("Photo", "Full screen view to be implemented")}>
                                                <RNImage source={{ uri }} style={styles.imagePreview} resizeMode="cover" />
                                            </TouchableOpacity>
                                        ))}
                                        {(!selectedVendor.nurseryPhotos || selectedVendor.nurseryPhotos.length === 0) && (
                                            <Text style={styles.noDataText}>No photos uploaded</Text>
                                        )}
                                    </ScrollView>

                                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Registration Docs ({selectedVendor.registrationDocs?.length || 0})</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                        {selectedVendor.registrationDocs?.map((uri, index) => (
                                            <TouchableOpacity key={index} onPress={() => Alert.alert("Document", "Full screen view to be implemented")}>
                                                <RNImage source={{ uri }} style={styles.imagePreview} resizeMode="cover" />
                                            </TouchableOpacity>
                                        ))}
                                        {(!selectedVendor.registrationDocs || selectedVendor.registrationDocs.length === 0) && (
                                            <Text style={styles.noDataText}>No documents uploaded</Text>
                                        )}
                                    </ScrollView>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Delete Modal */}
            <Modal visible={showDeleteModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.deleteModalContent}>
                        <Feather name="alert-triangle" size={40} color="#ef4444" />
                        <Text style={styles.modalTitle}>Delete Vendor?</Text>
                        <Text style={styles.modalText}>
                            Permanently remove {selectedVendor?.storeName}? This action cannot be undone.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteVendor}>
                                <Text style={styles.confirmDeleteBtnText}>Delete Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const DetailItem = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', backgroundColor: '#fff' },
    title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    badgeRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 10 },
    badgeText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    list: { padding: 16 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb' },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' },
    filterRow: { flexDirection: 'row', marginBottom: 10 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8 },
    filterChipActive: { backgroundColor: '#10b981' },
    filterText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
    filterTextActive: { color: '#fff' },
    resultCount: { fontSize: 12, color: '#9ca3af', marginBottom: 10 },
    vendorCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    vendorHeader: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: 'bold', fontSize: 16 },
    vendorInfo: { flex: 1, marginLeft: 12 },
    storeName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    ownerName: { fontSize: 13, color: '#6b7280' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '700' },
    vendorStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center' },
    actions: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
    viewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
    viewBtnText: { color: '#10b981', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    approveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flex: 1, justifyContent: 'center' },
    approveBtnText: { color: '#10b981', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    blockBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flex: 1, justifyContent: 'center' },
    blockBtnText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    unblockBtn: { backgroundColor: '#f0fdf4' },
    deleteBtn: { padding: 8, marginLeft: 8 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: '#6b7280', marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    detailModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    detailTitle: { fontSize: 20, fontWeight: 'bold' },
    detailAvatarSection: { alignItems: 'center', marginBottom: 24 },
    detailAvatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    detailAvatarText: { fontSize: 24, fontWeight: 'bold' },
    detailStoreName: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
    detailEmail: { fontSize: 14, color: '#6b7280', marginTop: 4 },
    detailRows: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, marginBottom: 16 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    detailLabel: { color: '#6b7280', fontSize: 14 },
    detailValue: { fontWeight: '600', color: '#111827', fontSize: 14 },
    deleteModalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '90%', alignSelf: 'center', alignItems: 'center', marginBottom: '50%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16 },
    modalText: { textAlign: 'center', color: '#6b7280', marginTop: 8, marginBottom: 24 },
    modalActions: { flexDirection: 'row', width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { fontWeight: '600', color: '#6b7280' },
    confirmDeleteBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    confirmDeleteBtnText: { color: '#fff', fontWeight: 'bold' },

    // NEW STYLES
    pendingTag: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    pendingTagText: { fontSize: 12, color: '#f59e0b', marginLeft: 4 },
    pendingSection: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginTop: 12, borderColor: '#fcd34d', borderWidth: 1 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#b45309', marginBottom: 8 },
    detailRowCompact: { flexDirection: 'row', marginBottom: 4 },
    detailLabelCompact: { fontSize: 12, color: '#92400e', width: 60, fontWeight: '600' },
    detailValueCompact: { fontSize: 12, color: '#451a03', flex: 1 },
    docsRow: { flexDirection: 'row', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(245,158,11,0.3)' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 12 },
    sectionTitleText: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginLeft: 8 },
    imageScroll: { flexDirection: 'row', marginVertical: 8 },
    imagePreview: { width: 80, height: 80, backgroundColor: '#f3f4f6', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#e5e7eb' },
    noDataText: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
});