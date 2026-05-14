import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView,
    ScrollView, Alert, ActivityIndicator, Platform, Modal, FlatList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { auth, db } from '../services/firebaseConfig';
import { collection, addDoc, getDoc, doc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { ticketApi } from '../api/ticketApi';
import { notifyAdmins } from '../services/notifyHelper';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';
import { TicketCategory, TicketPriority } from '../types/ticket';

// Helper for dynamic styles
const getPriorityChipStyle = (p: string, isActive: boolean) => {
    if (!isActive) return { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' };
    switch (p) {
        case 'critical': return { backgroundColor: '#fee2e2', borderColor: '#ef4444' };
        case 'high': return { backgroundColor: '#ffedd5', borderColor: '#f97316' };
        case 'medium': return { backgroundColor: '#dbeafe', borderColor: '#3b82f6' };
        default: return { backgroundColor: '#f3f4f6', borderColor: '#9ca3af' };
    }
};

export default function CreateTicketScreen({ navigation, route }: any) {
    const initialMode = route.params?.initialMode || 'ticket'; // 'ticket' or 'complaint'

    // Form State
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<TicketCategory | ''>('');
    const [priority, setPriority] = useState<TicketPriority>('medium');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    // UI State
    const [loading, setLoading] = useState(false);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Fetch recent orders for selection
    useEffect(() => {
        const fetchOrders = async () => {
            if (!auth.currentUser) return;
            setLoadingOrders(true);
            try {
                const q = query(
                    collection(db, 'orders'),
                    where('userId', '==', auth.currentUser.uid),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                );
                const snap = await getDocs(q);
                const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setRecentOrders(orders);
            } catch (err) {
                console.error('Error fetching orders:', err);
            } finally {
                setLoadingOrders(false);
            }
        };
        fetchOrders();
    }, []);

    const handleSubmit = async () => {
        if (!subject.trim()) {
            Alert.alert('Required', 'Please enter a subject');
            return;
        }
        if (!category) {
            Alert.alert('Required', 'Please select a category');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Required', 'Please describe your duplicate issue');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'You must be logged in');
            return;
        }

        setLoading(true);

        try {
            // Get user data
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const deviceOS = Platform.OS === 'ios' ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`;

            // Resolve vendor details if order selected
            let vendorIdToUse = '';
            let vendorName = '';
            let vendorStoreName = '';

            if (selectedOrder) {
                vendorIdToUse = selectedOrder.vendorId || '';

                // Try to get vendor name
                if (vendorIdToUse) {
                    try {
                        const vendorSnap = await getDoc(doc(db, 'users', vendorIdToUse));
                        if (vendorSnap.exists()) {
                            const vData = vendorSnap.data();
                            vendorName = vData.name || 'Vendor';
                            vendorStoreName = vData.storeName || vData.businessName || 'Vendor Store';
                        }
                    } catch (e) {
                        console.warn('Could not fetch vendor details', e);
                    }
                }
            }

            // Create Ticket
            const result = await ticketApi.createTicket({
                customerId: user.uid,
                customerName: user.displayName || userData.name || 'Customer',
                customerEmail: user.email || userData.email || '',
                customerPhone: userData.phone || userData.phoneNumber,
                vendorId: vendorIdToUse,
                vendorName: vendorName,
                vendorStoreName: vendorStoreName,
                orderId: selectedOrder?.id || '',
                category: category as TicketCategory,
                subject: subject.trim(),
                description: description.trim(),
                priority: priority,
                tags: [],
                metadata: {
                    appVersion: '2.1.0',
                    deviceOS,
                    deviceModel: 'Mobile',
                    source: 'in-app',
                    orderSnapshot: selectedOrder ? {
                        orderNumber: selectedOrder.orderId || selectedOrder.id,
                        total: selectedOrder.total,
                        status: selectedOrder.status,
                        items: selectedOrder.items
                    } : undefined
                },
            });

            // Notify Vendor if applicable
            if (vendorIdToUse) {
                try {
                    // Add notification logic here specific to vendor...
                    // Similar to CheckoutScreen logic
                    await addDoc(collection(db, 'notifications'), {
                        type: 'ticket',
                        title: 'New Support Ticket 🎫',
                        description: `Ticket #${result.ticketId.split('-').pop()} created by ${user.displayName || 'Customer'}`,
                        vendorId: vendorIdToUse,
                        userId: vendorIdToUse,
                        relatedId: result.ticketId,
                        isRead: false,
                        createdAt: serverTimestamp(),
                    });
                } catch (e) {
                    console.error('Failed to notify vendor', e);
                }
            }

            // Notify Admins
            try {
                await notifyAdmins(
                    'New Ticket Created 🎫',
                    `Ticket #${result.ticketId.split('-').pop()} created by ${user.displayName || 'Customer'}`,
                    result.ticketId,
                    'ticket'
                );
            } catch (e) {
                console.error('Failed to notify admins', e);
            }


            Alert.alert(
                'Success',
                'Ticket created successfully! Support team will contact you shortly.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );

        } catch (error: any) {
            console.error('Create Ticket Error:', error);
            Alert.alert('Error', error.message || 'Failed to create ticket');
        } finally {
            setLoading(false);
        }
    };

    const categoriesList = Object.entries(TICKET_CATEGORIES).map(([key, value]) => ({
        key: key as TicketCategory,
        label: value.label,
        icon: value.icon
    }));

    const renderOrderModal = () => (
        <Modal visible={showOrderModal} animationType="slide" transparent={true} onRequestClose={() => setShowOrderModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select an Order</Text>
                        <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                            <Feather name="x" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {loadingOrders ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                    ) : recentOrders.length === 0 ? (
                        <Text style={styles.emptyText}>No recent orders found</Text>
                    ) : (
                        <FlatList
                            data={recentOrders}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ padding: spacing.md }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.orderItem}
                                    onPress={() => {
                                        setSelectedOrder(item);
                                        setShowOrderModal(false);
                                    }}
                                >
                                    <View style={styles.orderIcon}>
                                        <Feather name="package" size={20} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.orderId}>Order #{item.orderId || item.id.slice(0, 8)}</Text>
                                        <Text style={styles.orderDate}>
                                            {item.createdAt?.toDate?.().toLocaleDateString() || 'Unknown date'}
                                        </Text>
                                        <Text style={styles.orderTotal}>Rs. {item.total}</Text>
                                    </View>
                                    <Feather name="chevron-right" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create New Ticket</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Subject */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Subject *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Brief summary of issue"
                        value={subject}
                        onChangeText={setSubject}
                    />
                </View>

                {/* Category */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Category *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {categoriesList.map((cat) => (
                            <TouchableOpacity
                                key={cat.key}
                                style={[
                                    styles.categoryChip,
                                    category === cat.key && styles.categoryChipActive
                                ]}
                                onPress={() => setCategory(cat.key)}
                            >
                                <Feather
                                    name={cat.icon as any}
                                    size={14}
                                    color={category === cat.key ? '#fff' : colors.textMuted}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[
                                    styles.categoryText,
                                    category === cat.key && styles.categoryTextActive
                                ]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Priority */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Priority</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['low', 'medium', 'high', 'critical'] as TicketPriority[]).map((p) => {
                            const isActive = priority === p;
                            const dynamicStyle = getPriorityChipStyle(p, isActive);

                            return (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.priorityChip,
                                        dynamicStyle
                                    ]}
                                    onPress={() => setPriority(p)}
                                >
                                    <Text style={[
                                        styles.priorityText,
                                        isActive && styles.priorityTextActive
                                    ]}>
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>


                {/* Order Selection */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Related Order (Optional)</Text>
                    {selectedOrder ? (
                        <View style={styles.selectedOrderCard}>
                            <View>
                                <Text style={styles.selectedOrderTitle}>
                                    Order #{selectedOrder.orderId || selectedOrder.id.slice(0, 8)}
                                </Text>
                                <Text style={styles.selectedOrderSubtitle}>
                                    Rs. {selectedOrder.total} • {selectedOrder.items?.length || 0} items
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                                <Feather name="x-circle" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.selectOrderBtn}
                            onPress={() => setShowOrderModal(true)}
                        >
                            <Feather name="package" size={18} color={colors.primary} />
                            <Text style={styles.selectOrderText}>Select an Order</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Description *</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Detailed description of your issue..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Feather name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.submitBtnText}>Submit Ticket</Text>
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>

            {renderOrderModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    content: { padding: spacing.lg },

    formGroup: { marginBottom: spacing.xl },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
    input: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.text
    },
    textArea: { height: 120 },

    categoryChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: 'transparent'
    },
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    categoryTextActive: { color: '#fff' },

    priorityChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0'
    },
    // Dynamic style 'priorityChipActive' removed from here and handled in component

    priorityText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
    priorityTextActive: { color: colors.text, fontWeight: '600' },

    selectOrderBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary,
        borderRadius: borderRadius.md, borderStyle: 'dashed'
    },
    selectOrderText: { color: colors.primary, fontWeight: '600', fontSize: 14 },

    selectedOrderCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: borderRadius.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
    },
    selectedOrderTitle: { fontWeight: '700', fontSize: 14, color: colors.text },
    selectedOrderSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary, paddingVertical: 16, borderRadius: borderRadius.lg,
        marginTop: spacing.md, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
    },
    submitBtnDisabled: { opacity: 0.7 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    emptyText: { textAlign: 'center', padding: 40, color: colors.textMuted },
    orderItem: {
        flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8,
        backgroundColor: '#f8fafc', borderRadius: 12, gap: 12
    },
    orderIcon: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center', alignItems: 'center'
    },
    orderId: { fontWeight: '600', fontSize: 14, color: colors.text },
    orderDate: { fontSize: 12, color: colors.textMuted },
    orderTotal: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 },
});
