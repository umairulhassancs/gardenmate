import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface Order {
    id: string;
    orderNumber?: string;
    status: OrderStatus;
    createdAt: any;
    total: number;
    items: any[];
    customerName: string;
    shippingAddress: string;
    estimatedDelivery?: string;
    vendorId?: string;
    vendorName?: string;
    orderFeedback?: boolean;
    review?: { rating: number; title: string; text: string; date: string };
    riderInfo?: { name: string; phone: string; assignedAt?: string };
    shippedAt?: string;
    cancelReason?: string;
    cancelledAt?: string;
    cancelledBy?: string;
}

const statusConfig: Record<OrderStatus, { color: string; bgColor: string; label: string; icon: string }> = {
    pending: { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: 'Pending', icon: 'clock' },
    processing: { color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', label: 'Processing', icon: 'package' },
    shipped: { color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)', label: 'Shipped', icon: 'truck' },
    delivered: { color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', label: 'Delivered', icon: 'check-circle' },
    cancelled: { color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: 'Cancelled', icon: 'x-circle' },
};

export default function OrderHistoryScreen({ navigation }: any) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ Real-time Orders Fetch from Firebase
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        const ordersQuery = query(
            collection(db, 'orders'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    orderNumber: `#${doc.id.slice(-8).toUpperCase()}`,
                    status: data.status || 'pending',
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
                    total: data.total || 0,
                    items: data.items || [],
                    customerName: data.customerName || 'Guest',
                    shippingAddress: data.shippingAddress || '',
                    estimatedDelivery: data.estimatedDelivery || 'Within 3-5 days',
                    vendorId: data.vendorId,
                    vendorName: data.vendorName,
                    orderFeedback: data.orderFeedback === true,
                    review: data.review || null,
                    riderInfo: data.riderInfo || null,
                    shippedAt: data.shippedAt || null,
                    cancelReason: data.cancelReason || null,
                    cancelledAt: data.cancelledAt || null,
                    cancelledBy: data.cancelledBy || null,
                } as Order;
            }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            console.log('📦 Orders fetched:', fetchedOrders.length);
            setOrders(fetchedOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const isShippedOrDelivered = (order: Order) => order.status === 'shipped' || order.status === 'delivered';

    // Rate order (Feedback): only when delivered, one per order (orderFeedback blocks re-rate)
    const canRateOrder = (order: Order) => order.status === 'delivered' && !order.orderFeedback;
    // Complaint: available once shipped/delivered
    const canComplaint = (order: Order) => isShippedOrDelivered(order);

    // Loading State
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Order History</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading orders...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Order History</Text>
                <View style={{ width: 24 }} />
            </View>

            {orders.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIcon}>
                        <Feather name="shopping-bag" size={48} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No orders yet</Text>
                    <Text style={styles.emptyText}>When you make a purchase, your orders will appear here.</Text>
                    <TouchableOpacity
                        style={styles.shopButton}
                        onPress={() => navigation.navigate('MainTabs', { screen: 'Shop' })}
                    >
                        <Text style={styles.shopButtonText}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                    {orders.map((order, index) => {
                        const status = statusConfig[order.status] || statusConfig['pending'];

                        // ✅ Yeh key kabhi duplicate nahi hogi
                        const orderKey = `order-card-${order.id || 'no-id'}-${index}`;

                        return (
                            <View key={orderKey} style={styles.orderCard}>
                                <View style={styles.orderHeader}>
                                    <View>
                                        {/* Order Number fallback agar null ho */}
                                        <Text style={styles.orderNumber}>{order.orderNumber || `Order #${index + 1}`}</Text>
                                        <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                                        <Feather name={status.icon as any} size={12} color={status.color} />
                                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                </View>

                                {/* Order Items Preview */}
                                <View style={styles.itemsPreview}>
                                    {order.items.slice(0, 3).map((item, idx) => {
                                        // ✅ Sabse behtar key: Order ID + Item ID + Index ka combination
                                        const uniqueId = item.id || item.productId || `fallback-${idx}`;
                                        const itemKey = `preview-${order.id}-${uniqueId}-${idx}`;

                                        return (
                                            <Image
                                                key={itemKey}
                                                source={{ uri: item.image || 'https://via.placeholder.com/150' }}
                                                style={styles.itemImage}
                                            />
                                        );
                                    })}
                                    {order.items.length > 3 && (
                                        <View style={styles.moreItems}>
                                            <Text style={styles.moreItemsText}>+{order.items.length - 3}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Order Summary Items */}
                                <View style={styles.orderSummary}>
                                    <Text style={styles.summaryLabel}>Items:</Text>
                                    {order.items.map((item, idx) => {
                                        // ✅ Same stable logic for summary items
                                        const uniqueId = item.id || item.productId || `fallback-${idx}`;
                                        const summaryKey = `summary-${order.id}-${uniqueId}-${idx}`;

                                        return (
                                            <Text key={summaryKey} style={styles.summaryItem}>
                                                {item.quantity}x {item.name}
                                            </Text>
                                        );
                                    })}
                                </View>
                                <View style={styles.orderFooter}>
                                    <View>
                                        <Text style={styles.itemsCount}>
                                            {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
                                        </Text>
                                        <Text style={styles.orderTotal}>Rs. {order.total.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.orderActions}>
                                        {canRateOrder(order) && (
                                            <TouchableOpacity
                                                style={styles.reviewBtn}
                                                onPress={() => {
                                                    // #region agent log
                                                    fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            location: 'src/screens/OrderHistoryScreen.tsx:canRateOrder',
                                                            message: 'Navigating to Feedback screen in feedback mode',
                                                            data: {
                                                                orderId: order.id,
                                                                status: order.status,
                                                                initialMode: 'feedback',
                                                            },
                                                            runId: 'pre-fix',
                                                            hypothesisId: 'H1',
                                                            timestamp: Date.now(),
                                                        }),
                                                    }).catch(() => {});
                                                    // #endregion agent log
                                                    navigation.navigate('Feedback', {
                                                        orderId: order.id,
                                                        vendorId: order.vendorId,
                                                        vendorName: order.vendorName,
                                                        initialMode: 'feedback',
                                                    });
                                                }}
                                            >
                                                <Feather name="star" size={14} color={colors.primary} />
                                                <Text style={styles.reviewBtnText}>Rate Order</Text>
                                            </TouchableOpacity>
                                        )}
                                        {order.orderFeedback && (
                                            <View style={styles.reviewedBadge}>
                                                <Feather name="check" size={12} color="#10b981" />
                                                <Text style={styles.reviewedText}>Rated</Text>
                                            </View>
                                        )}
                                        {canComplaint(order) && (
                                            <TouchableOpacity
                                                style={styles.reportBtn}
                                                onPress={() => {
                                                    // #region agent log
                                                    fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            location: 'src/screens/OrderHistoryScreen.tsx:canComplaint',
                                                            message: 'Navigating to Feedback screen in complaint mode',
                                                            data: {
                                                                orderId: order.id,
                                                                status: order.status,
                                                                initialMode: 'complaint',
                                                            },
                                                            runId: 'pre-fix',
                                                            hypothesisId: 'H1',
                                                            timestamp: Date.now(),
                                                        }),
                                                    }).catch(() => {});
                                                    // #endregion agent log
                                                    navigation.navigate('Feedback', {
                                                        orderId: order.id,
                                                        vendorId: order.vendorId,
                                                        vendorName: order.vendorName,
                                                        initialMode: 'complaint',
                                                    });
                                                }}
                                            >
                                                <Feather name="message-circle" size={14} color={colors.primary} />
                                                <Text style={styles.reportBtnText}>Complaint</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {order.status === 'shipped' && (
                                    <View style={styles.deliveryInfo}>
                                        <Feather name="truck" size={14} color="#8b5cf6" />
                                        <Text style={styles.deliveryText}>
                                            Estimated delivery: {order.estimatedDelivery}
                                        </Text>
                                    </View>
                                )}



                                {order.status === 'cancelled' && order.cancelReason && (
                                    <View style={styles.cancelInfoCard}>
                                        <View style={styles.cancelInfoHeader}>
                                            <Feather name="x-circle" size={18} color="#ef4444" />
                                            <Text style={styles.cancelInfoTitle}>Order Cancelled</Text>
                                        </View>
                                        <Text style={styles.cancelReasonLabel}>Reason:</Text>
                                        <Text style={styles.cancelReasonText}>{order.cancelReason}</Text>
                                        {order.cancelledAt && (
                                            <Text style={styles.cancelTimeText}>
                                                Cancelled on: {new Date(order.cancelledAt).toLocaleString()}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
    emptyTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    shopButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
    shopButtonText: { color: '#fff', fontWeight: 'bold' },
    listContent: { padding: spacing.lg, paddingBottom: 100 },
    orderCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    orderNumber: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    orderDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, gap: 4 },
    statusText: { fontSize: fontSize.xs, fontWeight: '600' },
    itemsPreview: { flexDirection: 'row', marginBottom: spacing.md },
    itemImage: { width: 50, height: 50, borderRadius: borderRadius.md, marginRight: -spacing.sm, borderWidth: 2, borderColor: '#fff' },
    moreItems: { width: 50, height: 50, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.8)', justifyContent: 'center', alignItems: 'center' },
    moreItemsText: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.textMuted },
    orderSummary: { marginBottom: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(229,231,235,0.3)' },
    summaryLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
    summaryItem: { fontSize: fontSize.xs, color: colors.text, marginLeft: 8, marginTop: 2 },
    orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(229,231,235,0.5)' },
    itemsCount: { fontSize: fontSize.xs, color: colors.textMuted },
    orderTotal: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    reviewBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: 'rgba(16,185,129,0.1)', gap: 4 },
    reviewBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    reportBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: 'rgba(239,68,68,0.1)', gap: 4 },
    reportBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: '#ef4444' },
    reviewedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: 'rgba(16,185,129,0.1)', gap: 4 },
    reviewedText: { fontSize: fontSize.xs, fontWeight: '600', color: '#10b981' },
    deliveryInfo: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(229,231,235,0.5)', gap: spacing.sm },
    deliveryText: { fontSize: fontSize.sm, color: '#8b5cf6' },
    riderInfoCard: { marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(139,92,246,0.05)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' },
    riderInfoHeader: { flexDirection: 'row', alignItems: 'center' },
    riderIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.15)', justifyContent: 'center', alignItems: 'center' },
    riderDetails: { flex: 1, marginLeft: spacing.sm },
    riderLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    riderName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    callRiderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8b5cf6', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, gap: 4 },
    callRiderText: { fontSize: fontSize.xs, fontWeight: '600', color: '#fff' },
    riderPhoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginLeft: 44, gap: 4 },
    riderPhone: { fontSize: fontSize.xs, color: colors.textMuted },
    cancelInfoCard: { marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    cancelInfoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
    cancelInfoTitle: { fontSize: fontSize.sm, fontWeight: '600', color: '#ef4444' },
    cancelReasonLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
    cancelReasonText: { fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.xs },
    cancelTimeText: { fontSize: fontSize.xs, color: colors.textMuted },
});