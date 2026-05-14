import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Alert, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { formatPrice } from '../../utils/currency';
import { useCommission } from '../../contexts/CommissionContext';
import { useNotification } from '../../contexts/NotificationContext';
import { db, auth } from '../../services/firebaseConfig';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toDateSafe } from '../../utils/dateUtils';

const { width } = Dimensions.get('window');

// Mock Data (Inhe abhi static rakha hai jab tak aap inka backend nahi banate)
// Helper to get month name
const getMonthName = (date: Date) => date.toLocaleString('default', { month: 'short' });

const getChartColors = (index: number) => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
    return colors[index % colors.length];
};

const recentActivity = [
    { id: 1, action: 'New vendor registered', user: 'Green Gardens', time: '5 min ago', icon: 'shopping-bag', color: '#10b981' },
    { id: 2, action: 'Complaint resolved', user: 'User #4521', time: '15 min ago', icon: 'check-circle', color: '#3b82f6' },
    { id: 3, action: 'New plant listed', user: 'Plant Paradise', time: '1 hour ago', icon: 'box', color: '#8b5cf6' },
    { id: 4, action: 'User blocked', user: 'spam_user@test.com', time: '2 hours ago', icon: 'user-x', color: '#ef4444' },
];

export default function AdminDashboardScreen({ navigation }: any) {
    const { vendors } = useCommission();

    // State variables for Live Data
    const [userCount, setUserCount] = useState(0);
    const [vendorCount, setVendorCount] = useState(0);
    const [plantCount, setPlantCount] = useState(0);
    const [openComplaintsCount, setOpenComplaintsCount] = useState(0);
    const [feedbackCount, setFeedbackCount] = useState(0);
    const [postsCount, setPostsCount] = useState(0);
    const { unreadCount: unreadNotifCount } = useNotification();

    const [plantsByCategory, setPlantsByCategory] = useState<any[]>([]);
    const [complaintsData, setComplaintsData] = useState<any[]>([]);
    const [userGrowth, setUserGrowth] = useState<any[]>([]);

    useEffect(() => {
        // 1. Users aur Vendors Live Fetching + User Growth
        const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ ...doc.data(), createdAt: toDateSafe(doc.data().createdAt) }));

            const totalUsers = docs.filter((u: any) => u.role === 'user' || !u.role).length;
            const totalVendors = docs.filter((u: any) => u.role === 'vendor').length;

            setUserCount(totalUsers);
            setVendorCount(totalVendors);

            // User Growth Logic (Group by Month)
            const growth: Record<string, number> = {};
            docs.forEach((u: any) => {
                const month = getMonthName(u.createdAt);
                growth[month] = (growth[month] || 0) + 1;
            });
            const growthChart = Object.keys(growth).map(m => ({ month: m, users: growth[m] })).slice(-6);
            // Sort by month index? Simplification: just showing captured months.
            setUserGrowth(growthChart);
        });

        // 2. Plants Total Count + By Category
        const unsubscribePlants = onSnapshot(collection(db, "plants"), (snapshot) => {
            setPlantCount(snapshot.size);

            const docs = snapshot.docs.map(doc => doc.data());
            const categories: Record<string, number> = {};
            docs.forEach((p: any) => {
                const cat = p.category || 'Other';
                categories[cat] = (categories[cat] || 0) + 1;
            });

            const catChart = Object.keys(categories).map((c, i) => ({
                name: c,
                value: categories[c],
                color: getChartColors(i)
            }));
            setPlantsByCategory(catChart);
        });

        // 3. Open Complaints + Trend
        const unsubscribeComplaints = onSnapshot(collection(db, "complaints"), (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ ...doc.data(), createdAt: toDateSafe(doc.data().createdAt) }));

            const openOnes = docs.filter((c: any) => c.status === 'open' || c.status === 'pending').length;
            setOpenComplaintsCount(openOnes);

            // Complaints Trend Logic
            const trend: Record<string, number> = {};
            docs.forEach((c: any) => {
                const month = getMonthName(c.createdAt);
                trend[month] = (trend[month] || 0) + 1;
            });
            const trendChart = Object.keys(trend).map(m => ({ month: m, count: trend[m] })).slice(-6);
            setComplaintsData(trendChart);
        });

        // 4. Feedback Count Live Fetching
        const unsubscribeFeedback = onSnapshot(collection(db, "feedbacks"), (snapshot) => {
            setFeedbackCount(snapshot.size);
        });

        // 5. Community Posts Live Fetching
        const unsubscribePosts = onSnapshot(collection(db, "posts"), (snapshot) => {
            setPostsCount(snapshot.size);
        });

        // Listeners Cleanup
        return () => {
            unsubscribeUsers();
            unsubscribePlants();
            unsubscribeComplaints();
            unsubscribeFeedback();
            unsubscribePosts();
        };
    }, []);

    // Stats Configuration (Using live states)
    const stats = [
        { label: 'Total Users', value: userCount.toString(), change: '+0%', icon: 'users', color: '#3b82f6', href: 'AdminUsers' },
        { label: 'Active Vendors', value: vendorCount.toString(), change: '+0%', icon: 'shopping-bag', color: '#10b981', href: 'AdminVendors' },
        { label: 'Plants Listed', value: plantCount.toString(), change: '+0%', icon: 'box', color: '#8b5cf6', href: 'AdminPlants' },
        { label: 'Open Complaints', value: openComplaintsCount.toString(), change: '-0', icon: 'alert-circle', color: '#f59e0b', href: 'AdminComplaints' },
    ];

    const maxUsers = Math.max(...userGrowth.map(d => d.users));
    const totalPlantsSum = plantsByCategory.reduce((sum, cat) => sum + cat.value, 0);
    const maxComplaints = Math.max(...complaintsData.map(d => d.count));

    // Commission Calculations (Added safety checks to prevent crashes)
    const safeVendors = vendors || [];

    const totalCommissionCollected = safeVendors.reduce((sum, v) => sum + (v.totalCommissionPaid || 0), 0);

    const totalCommissionPending = safeVendors.reduce((sum, v) => {
        const pending = (v.payments || [])
            .filter(p => p.status !== 'paid')
            .reduce((s, p) => s + (p.commissionAmount || 0), 0);
        return sum + pending;
    }, 0);

    const overdueVendorsCount = safeVendors.filter(v =>
        (v.payments || []).some(p => p.status === 'overdue')
    ).length;

    const paidVendorsThisMonth = safeVendors.filter(v =>
        (v.payments || []).some(p => p.status === 'paid' && p.month === 'December')
    ).length;

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await auth.signOut();
                            navigation.replace('Auth');
                        } catch (e) {
                            console.log('Logout Error:', e);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header with Bell icon + Logout */}
                <LinearGradient colors={['rgba(16,185,129,0.1)', 'transparent']} style={styles.headerBg}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greeting}>Admin Dashboard</Text>
                            <Text style={styles.subtitle}>Welcome back, Administrator</Text>
                        </View>
                        <View style={styles.headerActions}>
                            {/* Bell Icon with Badge */}
                            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('AdminNotifications')}>
                                <Feather name="bell" size={20} color="#f97316" />
                                {unreadNotifCount > 0 && (
                                    <View style={styles.bellBadge}>
                                        <Text style={styles.bellBadgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            {/* Logout Button */}
                            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                                <Feather name="log-out" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {/* Commission Overview Card - ON TOP */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Commission Overview</Text>
                        <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('AdminCommissions')}>
                            <Text style={styles.viewAllText}>Manage</Text>
                            <Feather name="chevron-right" size={16} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <LinearGradient colors={['#f97316', '#ea580c']} style={styles.commissionCard}>
                        <View style={styles.commissionHeader}>
                            <View style={styles.commissionIconBox}>
                                <Feather name="percent" size={20} color="#fff" />
                            </View>
                            <Text style={styles.commissionTitle}>Monthly Commission (10%)</Text>
                        </View>
                        <View style={styles.commissionStats}>
                            <View style={styles.commissionStat}>
                                <Text style={styles.commissionStatValue}>{formatPrice(totalCommissionCollected)}</Text>
                                <Text style={styles.commissionStatLabel}>Total Collected</Text>
                            </View>
                            <View style={styles.commissionDivider} />
                            <View style={styles.commissionStat}>
                                <Text style={styles.commissionStatValue}>{formatPrice(totalCommissionPending)}</Text>
                                <Text style={styles.commissionStatLabel}>Pending</Text>
                            </View>
                            <View style={styles.commissionDivider} />
                            <View style={styles.commissionStat}>
                                <Text style={[styles.commissionStatValue, overdueVendorsCount > 0 && { color: '#fef3c7' }]}>{overdueVendorsCount}</Text>
                                <Text style={styles.commissionStatLabel}>Overdue</Text>
                            </View>
                        </View>
                        <View style={styles.commissionFooter}>
                            <View style={styles.vendorPaymentStatus}>
                                <Feather name="check-circle" size={14} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.vendorPaymentText}>{paidVendorsThisMonth} vendors paid</Text>
                            </View>
                            <View style={styles.vendorPaymentStatus}>
                                <Feather name="clock" size={14} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.vendorPaymentText}>{vendors.length - paidVendorsThisMonth} pending</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {stats.map((stat, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.statCard}
                            onPress={() => navigation.navigate(stat.href as any)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.statHeader}>
                                <View style={[styles.statIconBox, { backgroundColor: `${stat.color}15` }]}>
                                    <Feather name={stat.icon as any} size={18} color={stat.color} />
                                </View>
                                <Feather name="arrow-right" size={14} color={colors.textMuted} />
                            </View>
                            <Text style={styles.statValue}>{stat.value}</Text>
                            <Text style={styles.statLabel}>{stat.label}</Text>
                            <View style={styles.statChangeRow}>
                                <Feather
                                    name={stat.change.startsWith('+') ? 'trending-up' : 'trending-down'}
                                    size={12}
                                    color={stat.change.startsWith('+') ? '#10b981' : '#f59e0b'}
                                />
                                <Text style={[styles.statChange, { color: stat.change.startsWith('+') ? '#10b981' : '#f59e0b' }]}>
                                    {stat.change} this month
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>



                {/* Management Tabs */}
                {/* Management Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Management</Text>
                    <View style={styles.managementGrid}>
                        <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('AdminCommissions')}>
                            <LinearGradient colors={['#fff', '#fff7ed']} style={styles.managementGradient}>
                                <Feather name="dollar-sign" size={22} color="#f97316" />
                                <Text style={styles.managementTitle}>Commission</Text>
                                <Text style={styles.managementSubtitle}>Track payments</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('AdminVendors')}>
                            <LinearGradient colors={['#fff', '#ecfdf5']} style={styles.managementGradient}>
                                <Feather name="shield" size={22} color="#10b981" />
                                <Text style={styles.managementTitle}>Vendors</Text>
                                <Text style={styles.managementSubtitle}>Approvals</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('AdminComplaints')}>
                            <LinearGradient colors={['#fff', '#fef2f2']} style={styles.managementGradient}>
                                <Feather name="alert-triangle" size={22} color="#ef4444" />
                                <Text style={styles.managementTitle}>Complaints</Text>
                                <Text style={styles.managementSubtitle}>Open issues</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('AdminCommunity')}>
                            <LinearGradient colors={['#fff', '#eef2ff']} style={styles.managementGradient}>
                                <Feather name="message-square" size={22} color="#6366f1" />
                                <Text style={styles.managementTitle}>Community</Text>
                                <Text style={styles.managementSubtitle}>Posts & Moderation</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Plants by Category Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Plants by Category</Text>
                    <View style={styles.chartCard}>
                        {plantsByCategory.map((cat, i) => (
                            <View key={i} style={styles.categoryRow}>
                                <Text style={styles.categoryName}>{cat.name}</Text>
                                <View style={styles.categoryBarContainer}>
                                    <View style={[styles.categoryBar, { width: `${(cat.value / totalPlantsSum) * 100}%`, backgroundColor: cat.color }]} />
                                </View>
                                <Text style={styles.categoryValue}>{cat.value.toLocaleString()}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Complaints Trend Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Complaints Trend</Text>
                    <View style={styles.chartCard}>
                        <View style={styles.barChart}>
                            {complaintsData.map((item, i) => (
                                <View key={i} style={styles.barColumn}>
                                    <View style={[styles.bar, { height: (item.count / maxComplaints) * 80, backgroundColor: '#f59e0b' }]} />
                                    <Text style={styles.chartLabel}>{item.month}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* User Growth Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>User Growth</Text>
                    <View style={styles.chartCard}>
                        <View style={styles.lineChart}>
                            {userGrowth.map((item, i) => (
                                <View key={i} style={styles.chartColumn}>
                                    <View style={styles.chartBarContainer}>
                                        <View
                                            style={[
                                                styles.chartLine,
                                                { height: (item.users / maxUsers) * 100 }
                                            ]}
                                        />
                                        <View style={[styles.chartDot, { bottom: (item.users / maxUsers) * 100 - 6 }]} />
                                    </View>
                                    <Text style={styles.chartLabel}>{item.month}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('AdminUsers')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="users" size={22} color="#3b82f6" />
                            </View>
                            <Text style={styles.actionLabel}>Users</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('AdminVendors')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="shopping-bag" size={22} color="#10b981" />
                            </View>
                            <Text style={styles.actionLabel}>Vendors</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('AdminPlants')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Feather name="box" size={22} color="#8b5cf6" />
                            </View>
                            <Text style={styles.actionLabel}>Plants</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('AdminComplaints')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Feather name="clipboard" size={22} color="#ef4444" />
                            </View>
                            <Text style={styles.actionLabel}>Complaints</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Recent Activity */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Platform Overview</Text>
                    </View>
                    <View style={styles.activityCard}>
                        <TouchableOpacity
                            style={styles.activityItem}
                            onPress={() => navigation.navigate('AdminComplaints')}
                        >
                            <View style={[styles.activityIconBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Feather name="alert-triangle" size={14} color="#ef4444" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityAction}>Open Complaints</Text>
                                <Text style={styles.activityMeta}>{openComplaintsCount} issues need attention</Text>
                            </View>
                            <Feather name="chevron-right" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={[styles.activityItem, { borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' }]} />
                        <View style={styles.activityItem}>
                            <View style={[styles.activityIconBox, { backgroundColor: 'rgba(251,191,36,0.1)' }]}>
                                <Feather name="star" size={14} color="#fbbf24" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityAction}>Total Feedback</Text>
                                <Text style={styles.activityMeta}>{feedbackCount} ratings received</Text>
                            </View>
                        </View>
                        <View style={[styles.activityItem, { borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' }]} />
                        <TouchableOpacity
                            style={styles.activityItem}
                            onPress={() => navigation.navigate('AdminCommunity')}
                        >
                            <View style={[styles.activityIconBox, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                                <Feather name="message-square" size={14} color="#6366f1" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityAction}>Community Posts</Text>
                                <Text style={styles.activityMeta}>{postsCount} active posts</Text>
                            </View>
                            <Feather name="chevron-right" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={[styles.activityItem, { borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' }]} />
                        <View style={[styles.activityItem, { borderBottomWidth: 0 }]}>
                            <View style={[styles.activityIconBox, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="box" size={14} color="#10b981" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityAction}>Plants Listed</Text>
                                <Text style={styles.activityMeta}>{plantCount} products available</Text>
                            </View>
                        </View>
                    </View>
                </View>


                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBg: { paddingTop: spacing.md },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
    greeting: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text },
    subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(249,115,22,0.1)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    bellBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
    bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center' },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md },
    statCard: { width: '46%', margin: '2%', padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    statIconBox: { width: 36, height: 36, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    statChangeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    statChange: { fontSize: 10, marginLeft: 4 },

    section: { padding: spacing.lg, paddingTop: spacing.sm },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },

    chartCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    lineChart: { flexDirection: 'row', justifyContent: 'space-around', height: 120, alignItems: 'flex-end' },
    chartColumn: { alignItems: 'center' },
    chartBarContainer: { height: 100, width: 40, justifyContent: 'flex-end', alignItems: 'center' },
    chartLine: { width: 3, backgroundColor: colors.primary, borderRadius: 2 },
    chartDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },
    chartLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

    categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    categoryName: { width: 80, fontSize: fontSize.sm, color: colors.text },
    categoryBarContainer: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginHorizontal: spacing.sm },
    categoryBar: { height: '100%', borderRadius: 4 },
    categoryValue: { width: 40, fontSize: fontSize.sm, color: colors.text, textAlign: 'right', fontWeight: '500' },

    barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150, paddingBottom: spacing.sm },
    barColumn: { alignItems: 'center', flex: 1 },
    bar: { width: 12, borderRadius: 6, marginBottom: 4 },

    quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
    actionBtn: { width: '23%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    actionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: fontSize.xs, fontWeight: '500', color: colors.text, marginTop: spacing.xs },

    activityCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    activityItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    activityIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    activityContent: { flex: 1 },
    activityAction: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    activityMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

    uptimeText: { fontSize: fontSize.xs, color: colors.textMuted },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center' },
    viewAllText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500', marginRight: 2 },

    commissionCard: { borderRadius: borderRadius.xl, padding: spacing.lg },
    commissionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    commissionIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    commissionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },
    commissionStats: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: borderRadius.lg, padding: spacing.md },
    commissionStat: { flex: 1, alignItems: 'center' },
    commissionStatValue: { fontSize: fontSize.xl, fontWeight: 'bold', color: '#fff' },
    commissionStatLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)' },
    commissionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    commissionFooter: { flexDirection: 'row', marginTop: spacing.md, justifyContent: 'space-between' },
    vendorPaymentStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    vendorPaymentText: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)' },

    managementGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    managementCard: { width: '48%', marginBottom: spacing.md, borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    managementGradient: { padding: spacing.md },
    managementIcon: { width: 44, height: 44, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
    managementTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    managementSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
    managementBadge: { backgroundColor: 'rgba(243,244,246,0.8)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
    managementBadgeText: { fontSize: fontSize.xs, fontWeight: '600' },
});
