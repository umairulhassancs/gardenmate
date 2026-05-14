import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Modal, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';

// FIREBASE IMPORTS
import { db } from '../../services/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface Plant {
    id: string;
    name: string;
    category: string;
    vendor: string;
    price: number;
    stock: number;
    status: 'active' | 'pending' | 'flagged';
    image: string;
    rating: number;
    sold: number;
}

const categories = ['All', 'Indoor', 'Outdoor', 'Succulents', 'Flowering', 'Herbs'];

export default function AdminPlantsScreen({ navigation }: any) {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'flagged'>('all');
    const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // ✅ FETCH FROM 'products' COLLECTION (Same as Marketplace)
    useEffect(() => {
        const productsRef = collection(db, "products"); // Yahan 'products' kar diya hai

        const unsubscribe = onSnapshot(productsRef, (snapshot) => {
            const fetchedPlants = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Agar image field ka naam different ho to handle karein
                    image: data.image || data.imageUrl || 'https://via.placeholder.com/150',
                    // Default values agar missing hon
                    status: data.status || 'active',
                    vendor: data.vendor || 'Unknown Vendor',
                    rating: data.rating || 0,
                    sold: data.sold || 0
                };
            }) as Plant[];

            setPlants(fetchedPlants);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching products:", error);
            Alert.alert("Error", "Failed to load products.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredPlants = plants.filter(plant => {
        const matchesSearch = (plant.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
            (plant.vendor?.toLowerCase() || '').includes(search.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || plant.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || plant.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const totalPlants = plants.length;
    const pendingCount = plants.filter(p => p.status === 'pending').length;
    const flaggedCount = plants.filter(p => p.status === 'flagged').length;

    // ✅ APPROVE PRODUCT
    const handleApprovePlant = async (plantId: string) => {
        try {
            await updateDoc(doc(db, "products", plantId), { status: 'active' });
            Alert.alert('Success', 'Product approved.');
            setShowDetailModal(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to approve product.');
        }
    };

    // ✅ REMOVE PRODUCT
    const handleRemovePlant = (plantId: string) => {
        Alert.alert(
            'Remove Product',
            'Are you sure you want to remove this product?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                        try {
                            await deleteDoc(doc(db, "products", plantId));
                            setShowDetailModal(false);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete product.');
                        }
                    }
                },
            ]
        );
    };

    // ... Baaki UI code same rahega ...
    // (Agar aapko poora code chahiye to bata dein, lekin sirf upar wala hissa replace karne se chal jayega)

    const openViewDialog = (plant: Plant) => {
        setSelectedPlant(plant);
        setShowDetailModal(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#10b981';
            case 'pending': return '#f59e0b';
            case 'flagged': return '#ef4444';
            default: return colors.textMuted;
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading products...</Text>
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
                <Text style={styles.title}>Products Management</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Stats Badges */}
            <View style={styles.badgeRow}>
                <View style={styles.badge}>
                    <Feather name="box" size={14} color={colors.primary} />
                    <Text style={styles.badgeText}>{totalPlants} Total</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Feather name="clock" size={14} color="#f59e0b" />
                    <Text style={[styles.badgeText, { color: '#f59e0b' }]}>{pendingCount} Pending</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Feather name="flag" size={14} color="#ef4444" />
                    <Text style={[styles.badgeText, { color: '#ef4444' }]}>{flaggedCount} Flagged</Text>
                </View>
            </View>

            <FlatList
                data={filteredPlants}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                numColumns={2}
                columnWrapperStyle={{ gap: spacing.md }}
                ListHeaderComponent={
                    <>
                        {/* Search */}
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={16} color={colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search products..."
                                placeholderTextColor={colors.textMuted}
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>

                        {/* Category Filter */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.categoryChip, categoryFilter === cat && styles.categoryChipActive]}
                                    onPress={() => setCategoryFilter(cat)}
                                >
                                    <Text style={[styles.categoryText, categoryFilter === cat && styles.categoryTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Status Filter */}
                        <View style={styles.filterRow}>
                            {(['all', 'active', 'pending', 'flagged'] as const).map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
                                    onPress={() => setStatusFilter(f)}
                                >
                                    <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.resultCount}>{filteredPlants.length} products found</Text>
                    </>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.plantCard} onPress={() => openViewDialog(item)} activeOpacity={0.9}>
                        <Image source={{ uri: item.image }} style={styles.plantImage} />
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                        <View style={styles.plantInfo}>
                            <Text style={styles.plantName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.plantVendor} numberOfLines={1}>{item.vendor}</Text>
                            <View style={styles.plantMeta}>
                                <Text style={styles.plantPrice}>${item.price}</Text>
                                {item.rating > 0 && (
                                    <View style={styles.ratingRow}>
                                        <Feather name="star" size={10} color="#f59e0b" />
                                        <Text style={styles.ratingText}>{item.rating}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Feather name="box" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No products found</Text>
                    </View>
                }
            />

            {/* Detail Modal (Same as before) */}
            <Modal visible={showDetailModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.detailModalContent}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Product Details</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {selectedPlant && (
                            <ScrollView>
                                <Image source={{ uri: selectedPlant.image }} style={styles.detailImage} />
                                <View style={styles.detailContent}>
                                    <View style={styles.detailTitleRow}>
                                        <Text style={styles.detailPlantName}>{selectedPlant.name}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedPlant.status)}15` }]}>
                                            <Text style={[styles.statusText, { color: getStatusColor(selectedPlant.status) }]}>{selectedPlant.status}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.detailRows}>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Category</Text>
                                            <Text style={styles.detailValue}>{selectedPlant.category}</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Vendor</Text>
                                            <Text style={styles.detailValue}>{selectedPlant.vendor}</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Price</Text>
                                            <Text style={styles.detailValue}>${selectedPlant.price}</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Stock</Text>
                                            <Text style={styles.detailValue}>{selectedPlant.stock} units</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Rating</Text>
                                            <Text style={styles.detailValue}>{selectedPlant.rating > 0 ? `⭐ ${selectedPlant.rating}` : 'No ratings'}</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Sold</Text>
                                            <Text style={styles.detailValue}>{selectedPlant.sold} units</Text>
                                        </View>
                                    </View>
                                    <View style={styles.detailActions}>
                                        {selectedPlant.status === 'pending' && (
                                            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprovePlant(selectedPlant.id)}>
                                                <Feather name="check" size={16} color="#fff" />
                                                <Text style={styles.approveBtnText}>Approve</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemovePlant(selectedPlant.id)}>
                                            <Feather name="trash-2" size={16} color="#ef4444" />
                                            <Text style={styles.removeBtnText}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>
                        )}
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
    badgeRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: 4 },
    badgeText: { fontSize: fontSize.xs, fontWeight: '500', color: colors.primary },
    list: { padding: spacing.lg, paddingTop: 0 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
    searchInput: { flex: 1, height: 44, fontSize: fontSize.base, color: colors.text, marginLeft: spacing.sm },
    categoryScroll: { marginBottom: spacing.md },
    categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: '#fff', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
    categoryTextActive: { color: '#fff' },
    filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', fontWeight: '500' },
    filterTextActive: { color: '#fff' },
    resultCount: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
    plantCard: { flex: 1, backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', maxWidth: '48%' },
    plantImage: { width: '100%', height: 120, backgroundColor: 'rgba(243,244,246,0.5)' },
    statusDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5 },
    plantInfo: { padding: spacing.sm },
    plantName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    plantVendor: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    plantMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
    plantPrice: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.primary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    ratingText: { fontSize: 10, color: colors.textMuted },
    emptyState: { alignItems: 'center', padding: spacing.xl },
    emptyText: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.md },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    detailModalContent: { backgroundColor: '#fff', borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '85%' },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    detailTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    detailImage: { width: '100%', height: 200, backgroundColor: 'rgba(243,244,246,0.5)' },
    detailContent: { padding: spacing.lg },
    detailTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    detailPlantName: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, flex: 1 },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '500', textTransform: 'capitalize' },
    detailRows: { gap: spacing.xs },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    detailLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    detailValue: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    detailActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, gap: 8 },
    approveBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },
    removeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: 'rgba(239,68,68,0.1)', gap: 8 },
    removeBtnText: { fontSize: fontSize.base, fontWeight: '500', color: '#ef4444' },
});