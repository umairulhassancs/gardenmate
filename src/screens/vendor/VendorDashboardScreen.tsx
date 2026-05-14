import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Fixed Warning
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { useChat } from '../../contexts/ChatContext';
import { useCommission } from '../../contexts/CommissionContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useFocusEffect } from '@react-navigation/native'; // Yeh import zaroor karein
import { doc, getDoc } from 'firebase/firestore';

// Firebase imports - Path ko check karlein (agar src/firebase.ts hai toh yehi chalega)
import { db, auth } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
// Stats, orders, alerts are all fetched dynamically from Firebase inside the component

// notifications will be built dynamically from recentOrders

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
}

export default function VendorDashboardScreen({ navigation }: any) {
    const { getTotalUnreadCount } = useChat();
    const { currentVendor } = useCommission();
    const unreadMessages = getTotalUnreadCount('vendor');

    // --- Dynamic States ---
    const [stats, setStats] = useState([
        { label: 'Total Sales', value: '$0', icon: 'dollar-sign', color: '#10b981' },
        { label: 'Active Orders', value: '0', icon: 'package', color: '#3b82f6' },
        { label: 'Products', value: '0', icon: 'box', color: '#8b5cf6' },
        { label: 'Rating', value: '0.0', icon: 'star', color: '#f59e0b' },
    ]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [todayOrdersCount, setTodayOrdersCount] = useState(0);
    const [monthlyRevenue, setMonthlyRevenue] = useState(0);
    const [vendorData, setVendorData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<any[]>([]);

    const { unreadCount: unreadNotifCount } = useNotification();

    const statusColors: any = {
        pending: '#f59e0b',
        processing: '#3b82f6',
        shipped: '#8b5cf6',
        delivered: '#10b981'
    };
    const vendorId = auth.currentUser?.uid;

    useEffect(() => {
        if (!vendorId) {
            setLoading(false);
            return;
        }

        // --- 1. ORDERS FETCHING LOGIC ---
        const qOrders = query(
            collection(db, 'orders'),
            where('vendorId', '==', vendorId),
            orderBy('createdAt', 'desc')
        );

        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            console.log("Orders found:", snapshot.size);

            const ordersList = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Safety check for date
                    createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
                };
            });

            // Recent 4 orders for display
            setRecentOrders(ordersList.slice(0, 4));

            // Build recent activity notifications from orders
            const orderNotifs = ordersList.slice(0, 5).map((order: any) => {
                const timeAgo = getTimeAgo(order.createdAtDate);
                return {
                    type: 'order',
                    message: `${order.status === 'pending' ? 'New order' : order.status === 'delivered' ? 'Order delivered to' : 'Order ' + order.status + ' for'} ${order.customerName || 'a customer'} - $${order.total}`,
                    time: timeAgo,
                    icon: 'shopping-bag',
                    date: order.createdAtDate,
                };
            });
            setNotifications(prev => {
                const reviewNotifs = prev.filter(n => n.type === 'review');
                const combined = [...orderNotifs, ...reviewNotifs];
                combined.sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
                return combined.slice(0, 6);
            });

            let totalSales = 0;
            let activeCount = 0;
            let revenueToday = 0;
            let ordersToday = 0;
            let revenueThisMonth = 0;
            const now = new Date();
            const todayStr = now.toDateString();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            ordersList.forEach((order: any) => {
                const amount = Number(order.total) || 0;
                totalSales += amount;

                // Active orders are those not delivered or cancelled
                if (order.status !== 'delivered' && order.status !== 'cancelled') {
                    activeCount++;
                }

                // Today's Revenue & Count
                if (order.createdAtDate.toDateString() === todayStr) {
                    revenueToday += amount;
                    ordersToday++;
                }

                // This Month's Revenue
                if (order.createdAtDate.getMonth() === currentMonth && order.createdAtDate.getFullYear() === currentYear) {
                    revenueThisMonth += amount;
                }
            });

            setTodayRevenue(revenueToday);
            setTodayOrdersCount(ordersToday);
            setMonthlyRevenue(revenueThisMonth);
            setStats(prev => {
                const updated = [...prev];
                updated[0].value = `$${totalSales.toLocaleString()}`;
                updated[1].value = activeCount.toString();
                return updated;
            });
            setLoading(false);
        }, (error) => {
            console.error("Dashboard Orders Error:", error);
            setLoading(false);
        });

        // --- 2. PRODUCTS FETCHING LOGIC ---
        const qProducts = query(
            collection(db, 'products'),
            where('vendorId', '==', vendorId)
        );

        const unsubProducts = onSnapshot(qProducts, (snapshot) => {
            const products = snapshot.docs.map(doc => doc.data());
            setLowStockAlerts(products.filter((p: any) => p.stock <= 5));
            setStats(prev => {
                const updated = [...prev];
                updated[2].value = products.length.toString();
                return updated;
            });
        });

        // --- 3. REVIEWS FETCHING LOGIC ---
        const qReviews = query(
            collection(db, 'reviews'),
            where('vendorId', '==', vendorId)
        );

        const unsubReviews = onSnapshot(qReviews, (snapshot) => {
            const reviewNotifs = snapshot.docs
                .map(d => {
                    const data = d.data();
                    const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.date || Date.now());
                    return {
                        type: 'review',
                        message: `${data.customerName || 'A customer'} left a ${data.rating || 5}-star review`,
                        time: getTimeAgo(date),
                        icon: 'star',
                        date,
                    };
                })
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 3);

            setNotifications(prev => {
                const orderNotifs = prev.filter(n => n.type === 'order');
                const combined = [...orderNotifs, ...reviewNotifs];
                combined.sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
                return combined.slice(0, 6);
            });

            // Update rating stat
            if (snapshot.size > 0) {
                const totalRating = snapshot.docs.reduce((sum, d) => sum + (d.data().rating || 0), 0);
                const avgRating = (totalRating / snapshot.size).toFixed(1);
                setStats(prev => {
                    const updated = [...prev];
                    updated[3].value = avgRating;
                    return updated;
                });
            }
        });

        // --- 4. NOTIFICATIONS (Complaints/Alerts) FETCHING LOGIC ---
        const qNotifs = query(
            collection(db, 'notifications'),
            where('vendorId', '==', vendorId),
            limit(10) // Limit to recent
        );

        const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
            const fetchedNotifs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    type: data.type,
                    message: data.title || data.description,
                    time: getTimeAgo(data.createdAt?.toDate ? data.createdAt.toDate() : new Date()),
                    icon: data.type === 'complaint' ? 'alert-circle' : data.type === 'commission' ? 'dollar-sign' : 'bell',
                    date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    originalId: doc.id
                };
            }).filter(n => n.type === 'complaint' || n.type === 'alert' || n.type === 'commission'); // Only pull complaints/alerts/commission to avoid duplication if orders are already handled

            setNotifications(prev => {
                // Filter out previous manual orders/reviews to re-merge (or keep them?)
                // The previous logic for orders/reviews replaces the state partly or appends?
                // Actually, the previous listeners (orders/reviews) use setNotifications(prev => ...)
                // This is tricky because they might overwrite each other if not careful.
                // Better approach: Let's use a shared state for 'activity' parts and merge them in a useEffect? 
                // OR, just append here carefully.
                // But since we can't easily sync 3 listeners into one state without race conditions or overwrites,
                // I will modify this to just use a local ref or simpler merger if possible. 
                // However, simpler: The previous listeners do `setNotifications(prev => ...)` filtering by type.

                const otherTypes = prev.filter(n => n.type === 'order' || n.type === 'review');
                const combined = [...otherTypes, ...fetchedNotifs];
                combined.sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0));
                return combined.slice(0, 8);
            });
        });

        return () => {
            unsubOrders();
            unsubProducts();
            unsubReviews();
            unsubNotifs();
        };
    }, [vendorId]);

    useFocusEffect(
        useCallback(() => {
            const fetchDashboardData = async () => {
                const uid = auth.currentUser?.uid;
                if (uid) {
                    const docSnap = await getDoc(doc(db, 'vendors', uid));
                    if (docSnap.exists()) {
                        setVendorData(docSnap.data());
                    }
                }
            };
            fetchDashboardData();
        }, [])
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <LinearGradient colors={['rgba(249,115,22,0.1)', 'transparent']} style={styles.headerBg}>
                    <View style={styles.header}>
                        <View style={styles.storeInfo}>
                            <View style={{
                                width: 55,
                                height: 55,
                                borderRadius: 27.5,
                                backgroundColor: 'rgba(249,115,22,0.1)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: '#eee'
                            }}>
                                {/* 1. Added Optional Chaining vendorData?.logoUrl */}
                                {vendorData && vendorData.logoUrl ? (
                                    <Image
                                        source={{ uri: vendorData.logoUrl }}
                                        style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                                    />
                                ) : (
                                    /* 2. Jab data loading mein ho ya logo na ho toh ye dikhega */
                                    <Feather name="shopping-bag" size={24} color="#f97316" />
                                )}
                            </View>
                            <View>
                                {/* Static naam ki jagah dynamic store name */}
                                <Text style={styles.storeName}>
                                    {vendorData?.storeName || 'Loading...'}</Text>
                                <View style={styles.verifiedRow}>
                                    <Feather name="check-circle" size={12} color={colors.primary} />
                                    <Text style={styles.verifiedText}>Verified Seller</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('VendorChats')}>
                                <Feather name="message-circle" size={20} color={colors.text} />
                                {unreadMessages > 0 && (
                                    <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{unreadMessages}</Text></View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('VendorNotifications')}>
                                <Feather name="bell" size={20} color={colors.text} />
                                {unreadNotifCount > 0 && (
                                    <View style={styles.notifBadge}>
                                        <Text style={styles.notifBadgeText}>{unreadNotifCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('VendorStoreProfile')}>
                                <Feather name="settings" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {/* Revenue Card - Dynamic */}
                <View style={styles.revenueCard}>
                    <LinearGradient colors={['#10b981', '#059669']} style={styles.revenueGradient}>
                        <View style={styles.revenueHeader}>
                            <Text style={styles.revenueLabel}>Today's Revenue</Text>
                            <Feather name="trending-up" size={20} color="rgba(255,255,255,0.8)" />
                        </View>

                        {/* Aaj ki total earning */}
                        <Text style={styles.revenueValue}>${todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>

                        <Text style={styles.revenueChange}>Real-time tracking enabled</Text>

                        <View style={styles.revenueStats}>
                            <View style={styles.revenueStat}>
                                <Text style={styles.revenueStatValue}>
                                    {todayOrdersCount}
                                </Text>
                                <Text style={styles.revenueStatLabel}>Orders Today</Text>
                            </View>

                            <View style={styles.revenueDivider} />

                            <View style={styles.revenueStat}>
                                <Text style={styles.revenueStatValue}>
                                    ${todayOrdersCount > 0
                                        ? (todayRevenue / todayOrdersCount).toFixed(2)
                                        : '0.00'}
                                </Text>
                                <Text style={styles.revenueStatLabel}>Avg Order</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>


                {/* Commission Card - Updated with Real Logic */}
                {currentVendor && (
                    <TouchableOpacity
                        style={styles.commissionCard}
                        onPress={() => navigation.navigate('VendorCommission')}
                    >
                        <View style={styles.commissionHeader}>
                            <View style={styles.commissionTitleRow}>
                                <View style={styles.commissionIcon}>
                                    <Feather name="percent" size={16} color="#f97316" />
                                </View>
                                <Text style={styles.commissionTitle}>Monthly Commission (10%)</Text>
                            </View>
                            <Feather name="chevron-right" size={20} color={colors.textMuted} />
                        </View>

                        <View style={styles.commissionContent}>
                            <View style={styles.commissionStat}>
                                <Text style={styles.commissionLabel}>This Month's Sales</Text>
                                <Text style={styles.commissionValue}>
                                    ${monthlyRevenue.toLocaleString()}
                                </Text>
                            </View>

                            <View style={styles.commissionStatDivider} />

                            <View style={styles.commissionStat}>
                                <Text style={styles.commissionLabel}>Commission Due</Text>
                                <Text style={[styles.commissionValue, { color: '#f97316' }]}>
                                    ${(monthlyRevenue * 0.10).toFixed(2)}
                                </Text>
                            </View>
                        </View>

                        {/* Alerts tabhi dikhen jab payments array exist kare aur khali na ho */}
                        {currentVendor.payments?.length > 0 && currentVendor.payments.some((p: any) => p.status === 'overdue') && (
                            <View style={styles.overdueAlert}>
                                <Feather name="alert-circle" size={14} color="#ef4444" />
                                <Text style={styles.overdueText}>You have overdue payments</Text>
                            </View>
                        )}

                        {currentVendor.payments?.length > 0 && currentVendor.payments.some((p: any) => p.status === 'pending') && !currentVendor.payments.some((p: any) => p.status === 'overdue') && (
                            <View style={styles.pendingAlert}>
                                <Feather name="clock" size={14} color="#f59e0b" />
                                <Text style={styles.pendingText}>Payment pending for last month</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {/* Stats Grid - Dynamic without Dummy Data */}
                <View style={styles.statsGrid}>
                    {stats.map((stat, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.statCard}
                            onPress={() => {
                                if (stat.label === 'Rating') navigation.navigate('VendorReviews');
                                else if (stat.label === 'Active Orders') navigation.navigate('Orders');
                                else if (stat.label === 'Products') navigation.navigate('Inventory');
                            }}
                        >
                            <View style={[styles.statIconBox, { backgroundColor: `${stat.color}15` }]}>
                                <Feather name={stat.icon as any} size={18} color={stat.color} />
                            </View>
                            <Text style={styles.statValue}>{stat.value}</Text>
                            <Text style={styles.statLabel}>{stat.label}</Text>

                            {/* Change row tabhi dikhayein jab value 0 se zyada ho */}
                            {parseFloat(stat.value.replace('$', '')) > 0 && (
                                <View style={styles.statChangeRow}>
                                    <Feather name="arrow-up" size={10} color={colors.primary} />
                                    <Text style={styles.statChange}>{(stat as any).change}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
                {/* Low Stock Alerts - Real Data Only */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Feather name="alert-triangle" size={16} color="#f59e0b" />
                            <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.navigate('Inventory')}>
                            <Text style={styles.viewAll}>View All</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertsRow}>
                        {/* Agar low stock items hain toh map karein */}
                        {lowStockAlerts.length > 0 ? (
                            lowStockAlerts.map((item, i) => (
                                <View key={i} style={styles.alertCard}>
                                    <Image source={{ uri: item.image || 'https://via.placeholder.com/100' }} style={styles.alertImage} />
                                    <Text style={styles.alertName} numberOfLines={1}>{item.name}</Text>
                                    <View style={[styles.alertStock, item.stock === 0 && styles.alertOutOfStock]}>
                                        <Text style={[styles.alertStockText, item.stock === 0 && styles.alertOutOfStockText]}>
                                            {item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            /* Agar stock full hai toh yeh message dikhega */
                            <View style={[styles.alertCard, { justifyContent: 'center', backgroundColor: '#f0fdf4', borderColor: '#bcf0da' }]}>
                                <Feather name="check-circle" size={24} color="#10b981" style={{ alignSelf: 'center' }} />
                                <Text style={[styles.alertName, { textAlign: 'center', color: '#065f46', marginTop: 5 }]}>Stock is Full</Text>
                            </View>
                        )}

                        <TouchableOpacity style={styles.alertAddCard} onPress={() => navigation.navigate('Inventory')}>
                            <Feather name="plus" size={24} color={colors.primary} />
                            <Text style={styles.alertAddText}>Add Stock</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Quick Actions - Dynamic Badges */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Orders')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="package" size={22} color="#3b82f6" />
                            </View>
                            <Text style={styles.actionLabel}>Orders</Text>

                            {/* Yahan active orders ka real count dikhega */}
                            {recentOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length > 0 && (
                                <View style={styles.actionBadge}>
                                    <Text style={styles.actionBadgeText}>
                                        {recentOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Inventory')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="box" size={22} color="#10b981" />
                            </View>
                            <Text style={styles.actionLabel}>Inventory</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('VendorPayouts')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                                <Feather name="credit-card" size={22} color="#f97316" />
                            </View>
                            <Text style={styles.actionLabel}>Commission</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Community')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Feather name="users" size={22} color="#8b5cf6" />
                            </View>
                            <Text style={styles.actionLabel}>Community</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('VendorComplaints')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Feather name="inbox" size={22} color="#ef4444" />
                            </View>
                            <Text style={styles.actionLabel}>Complaints</Text>
                        </TouchableOpacity>
                    </View>
                </View>


                {/* Recent Orders Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Orders</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('VendorOrders')}>
                        <Text style={styles.seeAll}>See All</Text>
                    </TouchableOpacity>
                </View>

                {recentOrders.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No orders yet</Text>
                    </View>
                ) : (
                    recentOrders.map((order) => (
                        <TouchableOpacity
                            key={order.id}
                            style={styles.orderCard}
                            onPress={() => navigation.navigate('VendorOrders')}
                        >
                            <View style={styles.orderInfo}>
                                <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                                <Text style={styles.orderCustomer}>{order.customerName || 'Customer'}</Text>
                            </View>
                            <View style={styles.orderMeta}>
                                <Text style={styles.orderAmount}>${order.total}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: order.status === 'pending' ? '#fef3c7' : '#d1fae5' }]}>
                                    <Text style={[styles.statusText, { color: order.status === 'pending' ? '#b45309' : '#065f46' }]}>
                                        {order.status}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                {/* Recent Activity - Dynamic */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                    </View>
                    <View style={styles.activityCard}>
                        {notifications.length > 0 ? (
                            notifications.map((notif, i) => (
                                <View key={i} style={[styles.activityItem, i === notifications.length - 1 && { borderBottomWidth: 0 }]}>
                                    <View style={[styles.activityIcon,
                                    notif.type === 'order' ? { backgroundColor: 'rgba(59,130,246,0.1)' } :
                                        notif.type === 'review' ? { backgroundColor: 'rgba(245,158,11,0.1)' } :
                                            { backgroundColor: 'rgba(16,185,129,0.1)' }
                                    ]}>
                                        <Feather
                                            name={notif.icon as any}
                                            size={16}
                                            color={notif.type === 'order' ? '#3b82f6' : notif.type === 'review' ? '#f59e0b' : '#10b981'}
                                        />
                                    </View>
                                    <View style={styles.activityContent}>
                                        <Text style={styles.activityMessage}>{notif.message}</Text>
                                        <Text style={styles.activityTime}>{notif.time}</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            /* Agar koi activity nahi hai */
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: '#999', fontSize: 14 }}>Everything is quiet for now</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBg: { paddingTop: spacing.xl },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
    storeInfo: { flexDirection: 'row', alignItems: 'center' },
    storeAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, marginRight: spacing.md },
    storeName: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    verifiedText: { fontSize: fontSize.xs, color: colors.primary, marginLeft: 4 },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    notifBadge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
    notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    chatBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    chatBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    revenueCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.xl, overflow: 'hidden' },
    revenueGradient: { padding: spacing.lg },
    revenueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    revenueLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)' },
    revenueValue: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: spacing.sm },
    revenueChange: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs },
    revenueStats: { flexDirection: 'row', marginTop: spacing.lg },
    revenueStat: { flex: 1 },
    revenueDivider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: spacing.md },
    revenueStatValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: '#fff' },
    revenueStatLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
    statCard: { width: '46%', margin: '2%', backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    statIconBox: { width: 36, height: 36, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
    statValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    statChangeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    statChange: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500', marginLeft: 2 },

    section: { padding: spacing.lg, paddingTop: spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    sectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center' },
    viewAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500', marginRight: 4 },
    seeAll: { fontSize: 14, color: '#10b981', fontWeight: '600' },

    alertsRow: { gap: spacing.sm },
    alertCard: { width: 100, backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    alertImage: { width: 60, height: 60, borderRadius: borderRadius.md, backgroundColor: colors.border },
    alertName: { fontSize: fontSize.xs, color: colors.text, fontWeight: '500', marginTop: spacing.xs, textAlign: 'center' },
    alertStock: { marginTop: spacing.xs, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    alertOutOfStock: { backgroundColor: 'rgba(239,68,68,0.1)' },
    alertStockText: { fontSize: 10, color: '#f59e0b', fontWeight: '600' },
    alertOutOfStockText: { color: '#ef4444' },
    alertAddCard: { width: 100, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: borderRadius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    alertAddText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500', marginTop: spacing.xs },

    actionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    actionCard: { width: '18%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', position: 'relative' },
    actionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: fontSize.xs, fontWeight: '500', color: colors.text, marginTop: spacing.xs },
    actionBadge: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
    actionBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    ordersCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    orderItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    orderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(243,244,246,0.5)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    orderInfo: { flex: 1 },
    orderId: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    orderCustomer: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    orderRight: { alignItems: 'flex-end' },
    orderTotal: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    orderCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0' },
    orderMeta: { alignItems: 'flex-end' },
    orderAmount: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 6 },
    statusBadge: { marginTop: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '500', textTransform: 'capitalize' },
    emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 14, color: '#999' },

    activityCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    activityItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    activityIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    activityContent: { flex: 1 },
    activityMessage: { fontSize: fontSize.sm, color: colors.text },
    activityTime: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

    // Commission Card Styles
    commissionCard: { backgroundColor: '#fff', marginHorizontal: spacing.lg, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderLeftWidth: 4, borderLeftColor: '#f97316' },
    commissionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    commissionTitleRow: { flexDirection: 'row', alignItems: 'center' },
    commissionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    commissionTitle: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    commissionContent: { flexDirection: 'row', backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, padding: spacing.md },
    commissionStat: { flex: 1, alignItems: 'center' },
    commissionStatDivider: { width: 1, backgroundColor: 'rgba(229,231,235,0.5)', marginHorizontal: spacing.sm },
    commissionLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 2 },
    commissionValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    overdueAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: spacing.sm, borderRadius: borderRadius.md, marginTop: spacing.md, gap: spacing.sm },
    overdueText: { fontSize: fontSize.xs, color: '#ef4444', fontWeight: '500' },
    pendingAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.1)', padding: spacing.sm, borderRadius: borderRadius.md, marginTop: spacing.md, gap: spacing.sm },
    pendingText: { fontSize: fontSize.xs, color: '#f59e0b', fontWeight: '500' },

    // Orange Commission Metric Card
    orangeMetricCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.xl, overflow: 'hidden', elevation: 3, shadowColor: '#f97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
    orangeMetricGradient: { padding: spacing.md, borderRadius: borderRadius.xl },
    orangeMetricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    orangeMetricTitleRow: { flexDirection: 'row', alignItems: 'center' },
    orangeMetricIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    orangeMetricTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },
    orangeMetricRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md, padding: spacing.md },
    orangeMetricItem: { flex: 1, alignItems: 'center' },
    orangeMetricValue: { fontSize: fontSize.xl, fontWeight: 'bold', color: '#fff' },
    orangeMetricLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    orangeMetricDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: spacing.sm },
});
