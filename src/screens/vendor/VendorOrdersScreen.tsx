import React, { useState, useEffect } from 'react'; // useEffect add kiya
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Modal, Image, Alert, ActivityIndicator, Linking, TextInput, StatusBar } from 'react-native'; // Added Linking, TextInput
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';

// Firebase Imports
import { db, auth } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, deleteDoc, getDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { notifyUser } from '../../services/notifyHelper';

// Date Ranges (Yeh static hi rahengi)
const dateRanges = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'All Time', value: 'all' },
];

export default function VendorOrdersScreen({ navigation, route }: any) {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [dateRange, setDateRange] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // ✅ Rider Assignment States
    const [showRiderModal, setShowRiderModal] = useState(false);
    const [orderToShip, setOrderToShip] = useState<any>(null);
    const [riderName, setRiderName] = useState('');
    const [riderPhone, setRiderPhone] = useState('');
    const [savingRider, setSavingRider] = useState(false);

    // ✅ Cancel Order States
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<any>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancellingOrder, setCancellingOrder] = useState(false);

    const vendorId = auth.currentUser?.uid;

    const statusColors: any = {
        pending: '#f59e0b',
        processing: '#3b82f6',
        shipped: '#8b5cf6',
        delivered: '#10b981',
        cancelled: '#ef4444'
    };

    // --- REAL-TIME DATA FETCHING ---
    useEffect(() => {
        if (!vendorId) {
            console.log("No Vendor ID found in Auth");
            return;
        }

        console.log("Fetching orders for Vendor:", vendorId);

        // 1. Pehle simple query karein bina orderBy ke taake check ho sake data aa raha hai ya nahi
        const q = query(
            collection(db, 'orders'),
            where('vendorId', '==', vendorId)
            // orderBy hata kar check karein agar data nahi aa raha
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log("Snapshot size:", snapshot.size); // Yeh console mein check karein

            const ordersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Frontend par hi sort kar letay hain agar Firebase index ka issue ho
            const sortedOrders = ordersData.sort((a: any, b: any) =>
                (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
            );

            setOrders(sortedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Orders Fetch Error Details:", error.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vendorId]);

    // Handle deep linking / navigation from other screens (e.g. Reviews)
    useEffect(() => {
        if (route.params?.orderId && orders.length > 0) {
            const targetOrder = orders.find(o => o.id === route.params.orderId);
            if (targetOrder) {
                setSelectedOrder(targetOrder);
                // Clear the param so it doesn't reopen if we close and re-render
                navigation.setParams({ orderId: undefined });
            }
        }
    }, [route.params?.orderId, orders]);

    // --- UPDATE STATUS IN FIREBASE + NOTIFY CUSTOMER ---
    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const orderRef = doc(db, 'orders', orderId);

            // ✅ Calculate Commission if status is delivered
            if (newStatus === 'delivered') {
                const order = orders.find(o => o.id === orderId);
                if (order) {
                    const orderTotal = order.total || order.totalAmount || 0;
                    const commissionAmount = orderTotal * 0.10; // 10% commission
                    const netAmount = orderTotal - commissionAmount;

                    await updateDoc(orderRef, {
                        status: newStatus,
                        commissionAmount: commissionAmount,
                        netAmount: netAmount,
                        deliveredAt: serverTimestamp()
                    });

                    // Update Vendor Stats
                    if (vendorId) {
                        const vendorRef = doc(db, 'vendors', vendorId);
                        await updateDoc(vendorRef, {
                            totalSales: increment(orderTotal),
                            totalCommissionDue: increment(commissionAmount)
                        });
                    }
                } else {
                    await updateDoc(orderRef, { status: newStatus });
                }
            } else {
                await updateDoc(orderRef, { status: newStatus });
            }

            // Get order details for notification
            const order = orders.find(o => o.id === orderId);
            if (order && order.userId) {
                // Build item summary for notification
                const itemsList = order.items && order.items.length > 0
                    ? order.items.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')
                    : 'your items';
                const orderTotal = order.total || order.totalAmount || order.totalPrice || 0;
                const totalStr = `Rs. ${Number(orderTotal).toFixed(2)}`;

                const statusMessages: Record<string, { title: string; message: string }> = {
                    'processing': {
                        title: 'Order Confirmed! \u2705',
                        message: `Your order #${orderId.slice(0, 8).toUpperCase()} has been confirmed!\nItems: ${itemsList}\nTotal: ${totalStr}`
                    },
                    'shipped': {
                        title: 'Order Shipped! \uD83D\uDE9A',
                        message: `Great news! Your order #${orderId.slice(0, 8).toUpperCase()} is on its way!\nItems: ${itemsList}\nTotal: ${totalStr}`
                    },
                    'delivered': {
                        title: 'Order Delivered! \uD83D\uDCE6',
                        message: `Your order #${orderId.slice(0, 8).toUpperCase()} has been delivered. Enjoy your plants!\nItems: ${itemsList}\nTotal: ${totalStr}`
                    },
                    'cancelled': {
                        title: 'Order Cancelled \u274C',
                        message: `Your order #${orderId.slice(0, 8).toUpperCase()} has been cancelled.\nItems: ${itemsList}\nTotal: ${totalStr}`
                    }
                };

                const notificationData = statusMessages[newStatus];
                if (notificationData) {
                    await notifyUser(
                        order.userId,
                        notificationData.title,
                        notificationData.message,
                        'order_update',
                        orderId,
                        {
                            status: newStatus,
                            orderId: orderId,
                            body: notificationData.message,
                            message: notificationData.message
                        }
                    );
                }
            }

            Alert.alert('Updated', `Order status is now ${newStatus}`);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Update Status Error:', error);
            Alert.alert('Error', 'Could not update status');
        }
    };

    // ✅ Open Rider Modal for Shipping
    const handleOpenShipModal = (order: any) => {
        setOrderToShip(order);
        setRiderName('');
        setRiderPhone('');
        setShowRiderModal(true);
    };

    // ✅ Ship Order with Rider Info
    const handleShipWithRider = async () => {
        if (!riderName.trim()) {
            Alert.alert('Required', 'Please enter rider name');
            return;
        }
        if (!riderPhone.trim()) {
            Alert.alert('Required', 'Please enter rider phone number');
            return;
        }

        setSavingRider(true);
        try {
            const orderRef = doc(db, 'orders', orderToShip.id);
            await updateDoc(orderRef, {
                status: 'shipped',
                riderInfo: {
                    name: riderName.trim(),
                    phone: riderPhone.trim(),
                    assignedAt: new Date().toISOString(),
                },
                shippedAt: new Date().toISOString(),
            });

            // ✅ Send notification to customer
            if (orderToShip.userId) {
                const itemsList = orderToShip.items && orderToShip.items.length > 0
                    ? orderToShip.items.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')
                    : 'your items';
                const orderTotal = orderToShip.total || orderToShip.totalAmount || 0;
                const totalStr = `Rs. ${Number(orderTotal).toFixed(2)}`;
                const notifTitle = 'Order Shipped! \uD83D\uDE9A';
                const notifBody = `Your order #${orderToShip.id.slice(0, 8).toUpperCase()} is on its way!\nItems: ${itemsList}\nTotal: ${totalStr}`;

                await notifyUser(
                    orderToShip.userId,
                    notifTitle,
                    notifBody,
                    'order_update',
                    orderToShip.id,
                    {
                        status: 'shipped',
                        orderId: orderToShip.id,
                        body: notifBody,
                        message: notifBody
                    }
                );
            }

            Alert.alert('Success', 'Order marked as shipped with rider info!');
            setShowRiderModal(false);
            setSelectedOrder(null);
            setOrderToShip(null);
            setRiderName('');
            setRiderPhone('');
        } catch (error) {
            console.error('Ship Error:', error);
            Alert.alert('Error', 'Could not update order');
        } finally {
            setSavingRider(false);
        }
    };

    // ✅ Open Cancel Modal
    const handleOpenCancelModal = (order: any) => {
        setOrderToCancel(order);
        setCancelReason('');
        setShowCancelModal(true);
    };

    // ✅ Cancel Order with Reason
    const handleCancelOrder = async () => {
        if (!cancelReason.trim()) {
            Alert.alert('Required', 'Please provide a reason for cancellation');
            return;
        }

        setCancellingOrder(true);
        try {
            const orderRef = doc(db, 'orders', orderToCancel.id);
            await updateDoc(orderRef, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelReason: cancelReason.trim(),
                cancelledBy: 'vendor',
            });

            // ✅ Restore stock if order had items
            if (orderToCancel.items && orderToCancel.items.length > 0) {
                for (const item of orderToCancel.items) {
                    const productId = item.id || item.productId;
                    if (productId) {
                        try {
                            const productRef = doc(db, 'products', productId);
                            const { getDoc } = await import('firebase/firestore');
                            const productSnap = await getDoc(productRef);

                            if (productSnap.exists()) {
                                const currentStock = productSnap.data().stock || 0;
                                const currentSold = productSnap.data().sold || 0;
                                const newStock = currentStock + item.quantity;
                                const newSold = Math.max(0, currentSold - item.quantity);

                                // Recalculate status
                                let newStatus = 'active';
                                if (newStock === 0) {
                                    newStatus = 'out-of-stock';
                                } else if (newStock <= 20) {
                                    newStatus = 'low-stock';
                                }

                                await updateDoc(productRef, {
                                    stock: newStock,
                                    sold: newSold,
                                    status: newStatus
                                });
                                console.log(`✅ Stock restored for ${item.name}: ${currentStock} -> ${newStock}`);
                            }
                        } catch (stockError) {
                            console.error(`❌ Failed to restore stock for product ${productId}:`, stockError);
                        }
                    }
                }
            }

            Alert.alert('Cancelled', 'Order has been cancelled successfully');

            // ✅ Send cancellation notification to customer
            if (orderToCancel.userId) {
                const itemsList = orderToCancel.items && orderToCancel.items.length > 0
                    ? orderToCancel.items.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')
                    : 'your items';
                const orderTotal = orderToCancel.total || orderToCancel.totalAmount || 0;
                const totalStr = `Rs. ${Number(orderTotal).toFixed(2)}`;
                const notifTitle = 'Order Cancelled \u274C';
                const notifBody = `Your order #${orderToCancel.id.slice(0, 8).toUpperCase()} has been cancelled.\nReason: ${cancelReason.trim()}\nItems: ${itemsList}\nTotal: ${totalStr}`;

                await notifyUser(
                    orderToCancel.userId,
                    notifTitle,
                    notifBody,
                    'order_update',
                    orderToCancel.id,
                    {
                        status: 'cancelled',
                        orderId: orderToCancel.id,
                        body: notifBody,
                        message: notifBody
                    }
                );
            }

            setShowCancelModal(false);
            setSelectedOrder(null);
            setOrderToCancel(null);
            setCancelReason('');
        } catch (error) {
            console.error('Cancel Error:', error);
            Alert.alert('Error', 'Could not cancel order');
        } finally {
            setCancellingOrder(false);
        }
    };

    // ✅ Delete Order Permanently
    const handleDeleteOrder = (order: any) => {
        Alert.alert(
            'Delete Order',
            `Are you sure you want to permanently delete order #${order.id.slice(0, 8).toUpperCase()}?\n\nThis action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const orderRef = doc(db, 'orders', order.id);
                            await deleteDoc(orderRef);
                            Alert.alert('Deleted', 'Order has been permanently deleted');
                            setSelectedOrder(null); // Close modal if open
                        } catch (error) {
                            console.error('Delete Error:', error);
                            Alert.alert('Error', 'Could not delete order');
                        }
                    }
                }
            ]
        );
    };

    const filteredOrders = filter === 'all'
        ? orders
        : orders.filter(o => o.status === filter);

    const orderStats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const renderOrderDetail = () => (
        <Modal visible={!!selectedOrder} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                        <Feather name="x" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Order Details</Text>
                    <View style={{ width: 24 }} />
                </View>

                {selectedOrder && (
                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.orderHeader}>
                            <View>
                                <Text style={styles.orderId}>#{selectedOrder.id.slice(0, 8).toUpperCase()}</Text>
                                <Text style={styles.orderDate}>{(selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate() : new Date(selectedOrder.createdAt || 0)).toLocaleDateString()}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedOrder.status] + '20' }]}>
                                <Text style={[styles.statusText, { color: statusColors[selectedOrder.status] }]}>
                                    {selectedOrder.status}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Customer Information</Text>
                            <View style={styles.detailCard}>
                                <View style={styles.detailRow}>
                                    <Feather name="user" size={16} color={colors.textMuted} />
                                    <Text style={styles.detailText}>{selectedOrder.customerName}</Text>
                                </View>
                                {/* ✅ Phone Number */}
                                <View style={styles.detailRow}>
                                    <Feather name="phone" size={16} color={colors.textMuted} />
                                    <Text style={[styles.detailText, !selectedOrder.customerPhone && { color: colors.textMuted, fontStyle: 'italic' }]}>
                                        {selectedOrder.customerPhone || 'Not provided'}
                                    </Text>
                                    {selectedOrder.customerPhone ? (
                                        <TouchableOpacity
                                            style={styles.callBtn}
                                            onPress={() => {
                                                Alert.alert(
                                                    'Call Customer',
                                                    `Do you want to call ${selectedOrder.customerPhone}?`,
                                                    [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        {
                                                            text: 'Call',
                                                            onPress: () => {
                                                                Linking.openURL(`tel:${selectedOrder.customerPhone}`);
                                                            }
                                                        }
                                                    ]
                                                );
                                            }}
                                        >
                                            <Feather name="phone-call" size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                {/* ✅ Email */}
                                {selectedOrder.customerEmail ? (
                                    <View style={styles.detailRow}>
                                        <Feather name="mail" size={16} color={colors.textMuted} />
                                        <Text style={styles.detailText}>{selectedOrder.customerEmail}</Text>
                                    </View>
                                ) : null}
                                {/* ✅ Shipping Address */}
                                <View style={styles.detailRow}>
                                    <Feather name="map-pin" size={16} color={colors.textMuted} />
                                    <Text style={styles.detailText}>{selectedOrder.shippingAddress}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ✅ Payment & Order Summary */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Payment & Summary</Text>
                            <View style={styles.detailCard}>
                                <View style={styles.detailRow}>
                                    <Feather name="credit-card" size={16} color={colors.textMuted} />
                                    <Text style={styles.detailText}>
                                        {selectedOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : selectedOrder.paymentMethod}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Subtotal</Text>
                                    <Text style={styles.summaryValue}>Rs. {(selectedOrder.subtotal || selectedOrder.items?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) || 0).toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Shipping</Text>
                                    <Text style={styles.summaryValue}>
                                        {selectedOrder.shipping === 0 ? 'FREE' : `Rs. ${(selectedOrder.shipping || 0).toFixed(2)}`}
                                    </Text>
                                </View>
                                <View style={[styles.summaryRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>Total</Text>
                                    <Text style={styles.totalValue}>Rs. {(selectedOrder.total || selectedOrder.totalAmount || selectedOrder.subtotal || selectedOrder.items?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) || 0).toFixed(2)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Order Items */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Items</Text>
                            <View style={styles.detailCard}>
                                {selectedOrder.items?.map((item: any, index: number) => (
                                    <View key={index} style={[styles.itemRow, index < selectedOrder.items.length - 1 && styles.itemBorder]}>
                                        <Image source={{ uri: item.image || 'https://via.placeholder.com/48' }} style={styles.itemImage} />
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                                        </View>
                                        <Text style={styles.itemPrice}>Rs. {(item.price * item.quantity).toFixed(2)}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* ✅ Rider Information (for shipped/delivered orders) */}
                        {selectedOrder.riderInfo && (
                            <View style={styles.detailSection}>
                                <Text style={styles.sectionTitle}>Rider / Delivery Person</Text>
                                <View style={[styles.detailCard, { backgroundColor: 'rgba(139,92,246,0.05)' }]}>
                                    <View style={styles.detailRow}>
                                        <View style={styles.riderIcon}>
                                            <Feather name="user" size={16} color="#8b5cf6" />
                                        </View>
                                        <Text style={styles.detailText}>{selectedOrder.riderInfo.name}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <View style={styles.riderIcon}>
                                            <Feather name="phone" size={16} color="#8b5cf6" />
                                        </View>
                                        <Text style={styles.detailText}>{selectedOrder.riderInfo.phone}</Text>
                                        <TouchableOpacity
                                            style={[styles.callBtn, { backgroundColor: 'rgba(139,92,246,0.1)' }]}
                                            onPress={() => {
                                                Alert.alert(
                                                    'Call Rider',
                                                    `Do you want to call ${selectedOrder.riderInfo.phone}?`,
                                                    [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        {
                                                            text: 'Call',
                                                            onPress: () => Linking.openURL(`tel:${selectedOrder.riderInfo.phone}`)
                                                        }
                                                    ]
                                                );
                                            }}
                                        >
                                            <Feather name="phone-call" size={14} color="#8b5cf6" />
                                        </TouchableOpacity>
                                    </View>
                                    {selectedOrder.shippedAt && (
                                        <View style={styles.detailRow}>
                                            <View style={styles.riderIcon}>
                                                <Feather name="clock" size={16} color="#8b5cf6" />
                                            </View>
                                            <Text style={[styles.detailText, { color: colors.textMuted }]}>
                                                Shipped: {new Date(selectedOrder.shippedAt).toLocaleString()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        <View style={styles.actionButtons}>
                            {selectedOrder.status === 'pending' && (
                                <>
                                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleUpdateStatus(selectedOrder.id, 'processing')}>
                                        <Feather name="check" size={18} color="#fff" />
                                        <Text style={styles.acceptBtnText}>Accept Order</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleOpenCancelModal(selectedOrder)}>
                                        <Feather name="x" size={18} color="#ef4444" />
                                        <Text style={styles.rejectBtnText}>Reject</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {selectedOrder.status === 'processing' && (
                                <>
                                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleOpenShipModal(selectedOrder)}>
                                        <Feather name="truck" size={18} color="#fff" />
                                        <Text style={styles.acceptBtnText}>Mark as Shipped</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleOpenCancelModal(selectedOrder)}>
                                        <Feather name="x" size={18} color="#ef4444" />
                                        <Text style={styles.rejectBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {selectedOrder.status === 'shipped' && (
                                <>
                                    <TouchableOpacity style={styles.deliveredBtn} onPress={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                                        <Feather name="check-circle" size={18} color="#fff" />
                                        <Text style={styles.acceptBtnText}>Mark Delivered</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleOpenCancelModal(selectedOrder)}>
                                        <Feather name="x" size={18} color="#ef4444" />
                                        <Text style={styles.rejectBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        {/* Delete Order Button - Available for all statuses */}
                        <TouchableOpacity
                            style={styles.deleteOrderBtn}
                            onPress={() => handleDeleteOrder(selectedOrder)}
                        >
                            <Feather name="trash-2" size={18} color="#ef4444" />
                            <Text style={styles.deleteOrderBtnText}>Delete Order</Text>
                        </TouchableOpacity>

                        {/* ✅ Show cancellation info if cancelled */}
                        {selectedOrder.status === 'cancelled' && selectedOrder.cancelReason && (
                            <View style={styles.cancelInfoSection}>
                                <View style={styles.cancelInfoCard}>
                                    <View style={styles.cancelInfoHeader}>
                                        <Feather name="x-circle" size={20} color="#ef4444" />
                                        <Text style={styles.cancelInfoTitle}>Order Cancelled</Text>
                                    </View>
                                    <Text style={styles.cancelReasonLabel}>Reason:</Text>
                                    <Text style={styles.cancelReasonText}>{selectedOrder.cancelReason}</Text>
                                    {selectedOrder.cancelledAt && (
                                        <Text style={styles.cancelTimeText}>
                                            Cancelled on: {new Date(selectedOrder.cancelledAt).toLocaleString()}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                )}
            </SafeAreaView>
        </Modal >
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Orders</Text>
                <TouchableOpacity style={styles.exportBtn}>
                    <Feather name="download" size={18} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Orders List with Header */}
            <FlatList
                data={filteredOrders}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <>
                        {/* Stats Row */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Text style={[styles.statValue, { color: colors.primary }]}>{orderStats.total}</Text>
                                <Text style={styles.statLabel}>Total</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{orderStats.pending}</Text>
                                <Text style={styles.statLabel}>Pending</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Text style={[styles.statValue, { color: '#3b82f6' }]}>{orderStats.processing}</Text>
                                <Text style={styles.statLabel}>Processing</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{orderStats.shipped}</Text>
                                <Text style={styles.statLabel}>Shipped</Text>
                            </View>
                        </ScrollView>

                        {/* Date Range Selector */}
                        <View style={styles.dateRow}>
                            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(!showDatePicker)}>
                                <Feather name="calendar" size={16} color={colors.primary} />
                                <Text style={styles.dateSelectorText}>
                                    {dateRanges.find(d => d.value === dateRange)?.label}
                                </Text>
                                <Feather name="chevron-down" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            <View style={styles.dateDropdown}>
                                {dateRanges.map(range => (
                                    <TouchableOpacity
                                        key={range.value}
                                        style={[styles.dateOption, dateRange === range.value && styles.dateOptionActive]}
                                        onPress={() => { setDateRange(range.value); setShowDatePicker(false); }}
                                    >
                                        <Text style={[styles.dateOptionText, dateRange === range.value && styles.dateOptionTextActive]}>
                                            {range.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Status Filter */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {['all', 'pending', 'processing', 'shipped', 'delivered'].map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.filterChip, filter === f && styles.filterChipActive]}
                                    onPress={() => setFilter(f)}
                                >
                                    <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.orderCard} onPress={() => setSelectedOrder(item)} activeOpacity={0.9}>
                        <View style={styles.cardHeader}>
                            {/* Firebase ID ko short karke dikhane ke liye slice use kiya hai */}
                            <Text style={styles.orderIdCard}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
                                <Text style={[styles.statusText, { color: statusColors[item.status] }]}>{item.status}</Text>
                            </View>
                        </View>

                        <View style={styles.customerRow}>
                            <Feather name="user" size={14} color={colors.textMuted} />
                            <Text style={styles.customerName}>{item.customerName || 'Guest'}</Text>
                        </View>
                        {/* ✅ Show phone number in order card */}
                        {item.customerPhone ? (
                            <View style={styles.customerRow}>
                                <Feather name="phone" size={14} color={colors.textMuted} />
                                <Text style={styles.customerName}>{item.customerPhone}</Text>
                            </View>
                        ) : null}

                        <View style={styles.cardFooter}>
                            <Text style={styles.itemsText}>{item.items?.length || 0} items</Text>
                            <Text style={styles.totalText}>Rs. {(item.total || item.totalAmount || item.totalPrice || item.subtotal || (item.items?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0)) || 0).toFixed(2)}</Text>
                            {/* Date format logic */}
                            <Text style={styles.dateText}>
                                {(item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || 0)).toLocaleDateString()}
                            </Text>
                        </View>

                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.viewBtn} onPress={() => setSelectedOrder(item)}>
                                <Feather name="eye" size={14} color={colors.text} style={{ marginRight: 4 }} />
                                <Text style={styles.viewBtnText}>View Details</Text>
                            </TouchableOpacity>

                            {item.status === 'pending' && (
                                <TouchableOpacity style={styles.processBtn} onPress={() => handleUpdateStatus(item.id, 'processing')}>
                                    <Feather name="check" size={14} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={styles.processBtnText}>Accept</Text>
                                </TouchableOpacity>
                            )}

                            {item.status === 'processing' && (
                                <TouchableOpacity style={styles.shipBtn} onPress={() => handleOpenShipModal(item)}>
                                    <Feather name="truck" size={14} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={styles.processBtnText}>Ship</Text>
                                </TouchableOpacity>
                            )}

                            {/* Delete Button */}
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteOrder(item)}>
                                <Feather name="trash-2" size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Feather name="inbox" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No orders found for this vendor</Text>
                    </View>
                }
            />

            {renderOrderDetail()}

            {/* ✅ Rider Assignment Modal */}
            <Modal visible={showRiderModal} animationType="slide" transparent={true}>
                <View style={styles.riderModalOverlay}>
                    <View style={styles.riderModalContainer}>
                        <View style={styles.riderModalHeader}>
                            <Text style={styles.riderModalTitle}>Assign Rider</Text>
                            <TouchableOpacity onPress={() => setShowRiderModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.riderModalSubtitle}>
                            Enter delivery person details for order #{orderToShip?.id?.slice(0, 8).toUpperCase()}
                        </Text>

                        <View style={styles.riderInputGroup}>
                            <Text style={styles.riderInputLabel}>Rider Name *</Text>
                            <View style={styles.riderInputContainer}>
                                <Feather name="user" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={styles.riderInput}
                                    placeholder="Enter rider name"
                                    placeholderTextColor={colors.textMuted}
                                    value={riderName}
                                    onChangeText={setRiderName}
                                />
                            </View>
                        </View>

                        <View style={styles.riderInputGroup}>
                            <Text style={styles.riderInputLabel}>Rider Phone *</Text>
                            <View style={styles.riderInputContainer}>
                                <Feather name="phone" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={styles.riderInput}
                                    placeholder="Enter phone number"
                                    placeholderTextColor={colors.textMuted}
                                    value={riderPhone}
                                    onChangeText={setRiderPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <View style={styles.riderModalActions}>
                            <TouchableOpacity
                                style={styles.riderCancelBtn}
                                onPress={() => setShowRiderModal(false)}
                            >
                                <Text style={styles.riderCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.riderConfirmBtn, savingRider && { opacity: 0.7 }]}
                                onPress={handleShipWithRider}
                                disabled={savingRider}
                            >
                                {savingRider ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Feather name="truck" size={18} color="#fff" />
                                        <Text style={styles.riderConfirmBtnText}>Ship Order</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ Cancel Order Modal */}
            <Modal visible={showCancelModal} animationType="slide" transparent={true}>
                <View style={styles.riderModalOverlay}>
                    <View style={styles.riderModalContainer}>
                        <View style={styles.riderModalHeader}>
                            <Text style={[styles.riderModalTitle, { color: '#ef4444' }]}>Cancel Order</Text>
                            <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.riderModalSubtitle}>
                            Are you sure you want to cancel order #{orderToCancel?.id?.slice(0, 8).toUpperCase()}?
                        </Text>

                        <View style={styles.cancelWarning}>
                            <Feather name="alert-triangle" size={18} color="#f59e0b" />
                            <Text style={styles.cancelWarningText}>
                                This action cannot be undone. Stock will be restored automatically.
                            </Text>
                        </View>

                        <View style={styles.riderInputGroup}>
                            <Text style={styles.riderInputLabel}>Reason for Cancellation *</Text>
                            <View style={[styles.riderInputContainer, { height: 100, alignItems: 'flex-start', paddingVertical: spacing.sm }]}>
                                <TextInput
                                    style={[styles.riderInput, { height: 80, textAlignVertical: 'top' }]}
                                    placeholder="Enter reason (e.g., Out of stock, Customer request, etc.)"
                                    placeholderTextColor={colors.textMuted}
                                    value={cancelReason}
                                    onChangeText={setCancelReason}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        </View>

                        <View style={styles.riderModalActions}>
                            <TouchableOpacity
                                style={styles.riderCancelBtn}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Text style={styles.riderCancelBtnText}>Go Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.cancelConfirmBtn, cancellingOrder && { opacity: 0.7 }]}
                                onPress={handleCancelOrder}
                                disabled={cancellingOrder}
                            >
                                {cancellingOrder ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Feather name="x-circle" size={18} color="#fff" />
                                        <Text style={styles.riderConfirmBtnText}>Cancel Order</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    exportBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },

    statsRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
    statCard: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, minWidth: 80, height: 60, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    statValue: { fontSize: fontSize.lg, fontWeight: 'bold' },
    statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

    dateRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', gap: spacing.sm },
    dateSelectorText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
    dateDropdown: { marginHorizontal: spacing.lg, backgroundColor: '#fff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },
    dateOption: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    dateOptionActive: { backgroundColor: 'rgba(16,185,129,0.1)' },
    dateOptionText: { fontSize: fontSize.sm, color: colors.text },
    dateOptionTextActive: { color: colors.primary, fontWeight: '600' },

    filterRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', height: 44 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border, height: 36, justifyContent: 'center' },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize', fontWeight: '500' },
    filterTextActive: { color: '#fff', fontWeight: '600' },

    list: { padding: spacing.lg, paddingTop: 0 },
    orderCard: { backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    orderIdCard: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '500', textTransform: 'capitalize' },
    customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    customerName: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: spacing.sm },
    cardFooter: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    itemsText: { fontSize: fontSize.xs, color: colors.textMuted, marginRight: spacing.md },
    totalText: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.primary, flex: 1 },
    dateText: { fontSize: fontSize.xs, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: spacing.sm },
    viewBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(243,244,246,0.8)', padding: spacing.sm, borderRadius: borderRadius.md },
    viewBtnText: { color: colors.text, fontWeight: '500', fontSize: fontSize.sm },
    processBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, padding: spacing.sm, borderRadius: borderRadius.md },
    shipBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#8b5cf6', padding: spacing.sm, borderRadius: borderRadius.md },
    processBtnText: { color: '#fff', fontWeight: '500', fontSize: fontSize.sm },

    // Modal styles
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    modalContent: { flex: 1 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg },
    orderId: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    orderDate: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
    detailSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' },
    detailCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
    detailText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
    callBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center' },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    itemImage: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.border },
    itemInfo: { flex: 1, marginLeft: spacing.md },
    itemName: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    itemQty: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    itemPrice: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
    summaryLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    summaryValue: { fontSize: fontSize.sm, color: colors.text },
    totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
    totalLabel: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    totalValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.primary },
    paymentMethod: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
    paymentText: { fontSize: fontSize.sm, color: colors.textMuted },
    trackingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    trackingNumber: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },
    actionButtons: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.md },
    acceptBtn: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
    acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    rejectBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
    rejectBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: fontSize.base },
    emptyState: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl },
    emptyText: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.md },

    // ✅ Rider Info Styles
    riderIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(139,92,246,0.1)', justifyContent: 'center', alignItems: 'center' },

    // ✅ Rider Modal Styles
    riderModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    riderModalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40 },
    riderModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    riderModalTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    riderModalSubtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.lg },
    riderInputGroup: { marginBottom: spacing.md },
    riderInputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    riderInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, gap: spacing.sm },
    riderInput: { flex: 1, height: 48, fontSize: fontSize.base, color: colors.text },
    riderModalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    riderCancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
    riderCancelBtnText: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    riderConfirmBtn: { flex: 2, flexDirection: 'row', paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    riderConfirmBtnText: { fontSize: fontSize.base, fontWeight: '600', color: '#fff' },

    // ✅ Cancel Modal & Info Styles
    cancelConfirmBtn: { flex: 2, flexDirection: 'row', paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    cancelWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.1)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md, gap: spacing.sm },
    cancelWarningText: { flex: 1, fontSize: fontSize.sm, color: '#92400e' },
    cancelInfoSection: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
    cancelInfoCard: { backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    cancelInfoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
    cancelInfoTitle: { fontSize: fontSize.base, fontWeight: '600', color: '#ef4444' },
    cancelReasonLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
    cancelReasonText: { fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.sm },
    cancelTimeText: { fontSize: fontSize.xs, color: colors.textMuted },

    // ✅ Delivered Button Style
    deliveredBtn: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#10b981', paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },

    // ✅ Delete Button Styles
    deleteBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: borderRadius.md },
    deleteOrderBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)', gap: spacing.sm },
    deleteOrderBtnText: { fontSize: fontSize.base, fontWeight: '600', color: '#ef4444' },
});
