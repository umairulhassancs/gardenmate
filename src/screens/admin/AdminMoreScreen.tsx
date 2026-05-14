import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { formatPrice } from '../../utils/currency';
import { useCommission } from '../../contexts/CommissionContext';

// Firebase Imports
import { db, auth } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function AdminMoreScreen({ navigation }: any) {
    const { vendors = [] } = useCommission();

    // Real-time states for Backend data
    const [openComplaints, setOpenComplaints] = useState(0);
    const [pendingApprovals, setPendingApprovals] = useState(0);
    const [feedbackCount, setFeedbackCount] = useState(0);
    const [postsCount, setPostsCount] = useState(0);

    // Fetching Real-time data from Firebase
    useEffect(() => {
        // 1. Get Open Complaints count
        const qComplaints = query(
            collection(db, "complaints"),
            where("status", "==", "open")
        );
        const unsubComplaints = onSnapshot(qComplaints, (snapshot) => {
            setOpenComplaints(snapshot.size);
        });

        // 2. Get Pending Vendor Approvals count
        const qVendors = query(
            collection(db, "users"),
            where("role", "==", "vendor"),
            where("status", "==", "pending")
        );
        const unsubVendors = onSnapshot(qVendors, (snapshot) => {
            setPendingApprovals(snapshot.size);
        });

        // 3. Get Feedback count
        const unsubFeedback = onSnapshot(collection(db, "feedbacks"), (snapshot) => {
            setFeedbackCount(snapshot.size);
        });

        // 4. Get Community Posts count
        const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
            setPostsCount(snapshot.size);
        });

        return () => {
            unsubComplaints();
            unsubVendors();
            unsubFeedback();
            unsubPosts();
        };
    }, []);

    // Calculate Stats from Context
    const pendingCommission = vendors.reduce((sum, v) => {
        const vendorPending = v.payments?.filter(p => p.status !== 'paid')
            .reduce((s, p) => s + p.commissionAmount, 0) || 0;
        return sum + vendorPending;
    }, 0);

    const overdueVendors = vendors.filter(v =>
        v.payments?.some(p => p.status === 'overdue')
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
                            console.log("Logout Error:", e);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                {/* Header */}
                <LinearGradient
                    colors={['rgba(16,185,129,0.15)', 'transparent']}
                    style={styles.headerBg}
                >
                    <View style={styles.header}>
                        <View style={styles.adminProfile}>
                            <View style={styles.adminAvatar}>
                                <Text style={styles.avatarText}>A</Text>
                            </View>
                            <View>
                                <Text style={styles.adminName}>Administrator</Text>
                                <Text style={styles.adminRole}>Super Admin</Text>
                            </View>
                        </View>
                        {/* Logout shortcut icon in header */}
                        <TouchableOpacity onPress={handleLogout}>
                            <Feather name="log-out" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Quick Stats */}
                <View style={styles.statsRow}>
                    {/* Pending Commission Stat */}
                    <View style={[styles.statCard, { backgroundColor: 'rgba(249,115,22,0.08)' }]}>
                        <View style={styles.statIconCircle}>
                            <Feather name="dollar-sign" size={16} color="#f97316" />
                        </View>
                        <Text style={[styles.statValue, { color: '#f97316' }]}>
                            {formatPrice(pendingCommission)}
                        </Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>

                    {/* Overdue Vendors Stat */}
                    <View style={[styles.statCard, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                        <View style={styles.statIconCircle}>
                            <Feather name="alert-circle" size={16} color="#ef4444" />
                        </View>
                        <Text style={[styles.statValue, { color: '#ef4444' }]}>
                            {overdueVendors}
                        </Text>
                        <Text style={styles.statLabel}>Overdue</Text>
                    </View>

                    {/* Real-time Complaints Stat from Firebase */}
                    <View style={[styles.statCard, { backgroundColor: 'rgba(59,130,246,0.08)' }]}>
                        <View style={styles.statIconCircle}>
                            <Feather name="clipboard" size={16} color="#3b82f6" />
                        </View>
                        <Text style={[styles.statValue, { color: '#3b82f6' }]}>
                            {openComplaints}
                        </Text>
                        <Text style={styles.statLabel}>Complaints</Text>
                    </View>
                </View>

                {/* Commission & Payments */}
                {/* Commission & Payments Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Commission & Payments</Text>
                    <View style={styles.menuCard}>
                        {/* Commission Management */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('AdminCommissions')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                                <Feather name="percent" size={20} color="#f97316" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Commission Management</Text>
                                <Text style={styles.menuSubtitle}>Track vendor payments & collect dues</Text>
                            </View>
                            {/* Dynamic Badge: Sirf tab dikhega jab amount 0 se zyada ho */}
                            {pendingCommission > 0 && (
                                <View style={styles.menuBadge}>
                                    <Text style={styles.menuBadgeText}>{formatPrice(pendingCommission)}</Text>
                                </View>
                            )}
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* Payment History */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="credit-card" size={20} color="#10b981" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Payment History</Text>
                                <Text style={styles.menuSubtitle}>All commission transactions</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* Financial Reports */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Feather name="file-text" size={20} color="#8b5cf6" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Financial Reports</Text>
                                <Text style={styles.menuSubtitle}>Monthly & yearly summaries</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Support & Complaints */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support & Complaints</Text>
                    <View style={styles.menuCard}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AdminComplaints')}>
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Feather name="alert-triangle" size={20} color="#ef4444" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>All Complaints</Text>
                                <Text style={styles.menuSubtitle}>User & vendor issues</Text>
                            </View>
                            <View style={[styles.menuBadge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Text style={[styles.menuBadgeText, { color: '#ef4444' }]}>{openComplaints}</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                <Feather name="flag" size={20} color="#f59e0b" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Reported Content</Text>
                                <Text style={styles.menuSubtitle}>Flagged posts & reviews</Text>
                            </View>
                            <View style={[styles.menuBadge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                <Text style={[styles.menuBadgeText, { color: '#f59e0b' }]}>12</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem}>
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="help-circle" size={20} color="#3b82f6" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Complaints</Text>
                                <Text style={styles.menuSubtitle}>Customer support requests</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Feedback & Community */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Feedback & Community</Text>
                    <View style={styles.menuCard}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(251,191,36,0.1)' }]}>
                                <Feather name="star" size={20} color="#fbbf24" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>User Feedback</Text>
                                <Text style={styles.menuSubtitle}>Ratings & reviews</Text>
                            </View>
                            <View style={[styles.menuBadge, { backgroundColor: 'rgba(251,191,36,0.1)' }]}>
                                <Text style={[styles.menuBadgeText, { color: '#fbbf24' }]}>{feedbackCount}</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('AdminCommunity')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                                <Feather name="message-square" size={20} color="#6366f1" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Community Posts</Text>
                                <Text style={styles.menuSubtitle}>User posts & moderation</Text>
                            </View>
                            <View style={[styles.menuBadge, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                                <Text style={[styles.menuBadgeText, { color: '#6366f1' }]}>{postsCount}</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Vendor Management */}
                {/* Vendor Management */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Vendor Management</Text>
                    <View style={styles.menuCard}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('AdminVendors')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="shield" size={20} color="#10b981" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Pending Approvals</Text>
                                <Text style={styles.menuSubtitle}>New vendor requests</Text>
                            </View>

                            {/* Firebase backend count */}
                            {pendingApprovals > 0 && (
                                <View style={[styles.menuBadge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                    <Text style={[styles.menuBadgeText, { color: '#10b981' }]}>
                                        {pendingApprovals}
                                    </Text>
                                </View>
                            )}

                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                                <Feather name="eye" size={20} color="#6366f1" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Vendor Audit</Text>
                                <Text style={styles.menuSubtitle}>Activity & compliance logs</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(236,72,153,0.1)' }]}>
                                <Feather name="star" size={20} color="#ec4899" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Top Vendors</Text>
                                <Text style={styles.menuSubtitle}>Performance rankings</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Reports & Analytics */}
                {/* Reports & Analytics */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Reports & Analytics</Text>
                    <View style={styles.menuCard}>
                        {/* Sales Reports */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('AdminSalesReports')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="bar-chart-2" size={20} color="#3b82f6" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Sales Reports</Text>
                                <Text style={styles.menuSubtitle}>Revenue & transaction data</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* User Analytics */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('AdminAnalytics')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="trending-up" size={20} color="#10b981" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>User Analytics</Text>
                                <Text style={styles.menuSubtitle}>Growth & engagement metrics</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* Export Data */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {/* Logic for CSV export */ }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Feather name="download" size={20} color="#8b5cf6" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Export Data</Text>
                                <Text style={styles.menuSubtitle}>Download CSV/Excel reports</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* System Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>System Settings</Text>
                    <View style={styles.menuCard}>
                        {/* App Configuration */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('AppConfig')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(107,114,128,0.1)' }]}>
                                <Feather name="sliders" size={20} color="#6b7280" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>App Configuration</Text>
                                <Text style={styles.menuSubtitle}>Commission rates, limits, fees</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* Notifications */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('NotificationSettings')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="bell" size={20} color="#3b82f6" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Notifications</Text>
                                <Text style={styles.menuSubtitle}>Push & email settings</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* Security & Access */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('SecuritySettings')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <Feather name="shield" size={20} color="#10b981" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Security & Access</Text>
                                <Text style={styles.menuSubtitle}>Admin roles & permissions</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        {/* Backup & Restore */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {/* Database backup logic */ }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                <Feather name="database" size={20} color="#f59e0b" />
                            </View>
                            <View style={styles.menuContent}>
                                <Text style={styles.menuTitle}>Backup & Restore</Text>
                                <Text style={styles.menuSubtitle}>Data management</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Account */}
                <View style={styles.section}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Feather name="log-out" size={18} color="#ef4444" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                    <Text style={styles.version}>GardenMate Admin v2.1.0</Text>
                </View>

                <View style={{ height: 24 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBg: { paddingTop: spacing.md },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
    adminProfile: { flexDirection: 'row', alignItems: 'center' },
    adminAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    avatarText: { color: '#fff', fontSize: fontSize.xl, fontWeight: 'bold' },
    adminName: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    adminRole: { fontSize: fontSize.sm, color: colors.textMuted },

    statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
    statCard: { flex: 1, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center' },
    statIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: fontSize.lg, fontWeight: 'bold', marginTop: spacing.xs },
    statLabel: { fontSize: fontSize.xs, color: colors.textMuted },

    section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },

    menuCard: { backgroundColor: '#fff', borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    menuIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    menuContent: { flex: 1 },
    menuTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    menuSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    menuDivider: { height: 1, backgroundColor: 'rgba(229,231,235,0.5)', marginLeft: 68 },
    menuBadge: { backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, marginRight: spacing.sm },
    menuBadgeText: { fontSize: fontSize.xs, fontWeight: 'bold', color: '#f97316' },

    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    logoutText: { color: '#ef4444', fontWeight: 'bold', marginLeft: spacing.sm },
    version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.md },
});
