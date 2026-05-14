import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { auth, db } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { TICKET_CATEGORIES } from '../../constants/ticketCategories';
import { getSLAStatusBadge } from '../../services/slaAlertService';

// ─── Types ───────────────────────────────────────────────────
interface TicketItem {
    id: string;
    ticketId?: string;
    userId: string;
    userName: string;
    vendorId: string;
    orderId: string;
    description: string;
    subject?: string;
    status: string;
    category?: string;
    productName?: string;
    userPhone?: string;
    userEmail?: string;
    createdAt: Date;
    updatedAt?: Date | null;
    messages?: any[];
    lastReadBy?: Record<string, any>;
    source: 'tickets' | 'complaints';
    sla?: any;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    new: { label: 'New', color: '#7c3aed' },
    open: { label: 'Open', color: '#ef4444' },
    in_progress: { label: 'In Progress', color: '#f59e0b' },
    'in-progress': { label: 'In Progress', color: '#f59e0b' },
    resolved: { label: 'Resolved', color: '#10b981' },
    closed: { label: 'Closed', color: '#6b7280' },
    rejected: { label: 'Rejected', color: '#6b7280' },
};

type StatusFilter = 'all' | 'open' | 'in-progress' | 'resolved';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
];

// ─── Main Component ──────────────────────────────────────────
export default function VendorComplaintsScreen({ navigation }: any) {
    const [allTickets, setAllTickets] = useState<TicketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

    // ── Fetch tickets from both collections ──
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        let ticketsFromComplaints: TicketItem[] = [];
        let ticketsFromNew: TicketItem[] = [];
        let loadedCount = 0;

        const finishIfBothLoaded = () => {
            loadedCount++;
            if (loadedCount >= 2) {
                const merged = [...ticketsFromNew, ...ticketsFromComplaints]
                    .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
                setAllTickets(merged);
                setLoading(false);
            }
        };

        // 1. Listen to OLD complaints collection
        const unsubComplaints = onSnapshot(
            query(collection(db, 'complaints'), where('vendorId', '==', user.uid)),
            async (snapshot) => {
                ticketsFromComplaints = await Promise.all(
                    snapshot.docs.map(async (docSnap) => {
                        const d = docSnap.data();
                        const ticket: TicketItem = {
                            id: docSnap.id,
                            userId: d.userId || '',
                            userName: d.userName || 'Customer',
                            vendorId: d.vendorId || '',
                            orderId: d.orderId || '',
                            description: d.description || '',
                            status: d.status || 'open',
                            category: d.issue || d.category,
                            productName: d.productName,
                            userPhone: d.userPhone,
                            userEmail: d.userEmail,
                            createdAt: d.createdAt?.toDate?.() ?? new Date(),
                            updatedAt: d.updatedAt?.toDate?.() ?? null,
                            messages: d.messages || [],
                            lastReadBy: d.lastReadBy || {},
                            source: 'complaints' as const,
                            sla: d.sla || null,
                        };

                        // Fetch user info if missing
                        if (ticket.userId && !ticket.userPhone) {
                            try {
                                const userSnap = await getDoc(doc(db, 'users', ticket.userId));
                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    ticket.userPhone = userData.phone || null;
                                    ticket.userEmail = userData.email || null;
                                }
                            } catch { }
                        }

                        return ticket;
                    })
                );
                finishIfBothLoaded();
            },
            (err) => { console.error('Error loading complaints:', err); finishIfBothLoaded(); }
        );

        // 2. Listen to NEW tickets collection
        const unsubTickets = onSnapshot(
            query(collection(db, 'tickets'), where('vendorId', '==', user.uid)),
            (snapshot) => {
                ticketsFromNew = snapshot.docs.map((docSnap) => {
                    const d = docSnap.data();
                    return {
                        id: docSnap.id,
                        ticketId: d.ticketId,
                        userId: d.customerId || '',
                        userName: d.customerName || 'Customer',
                        vendorId: d.vendorId || '',
                        orderId: d.orderId || '',
                        description: d.description || '',
                        subject: d.subject,
                        status: d.status || 'open',
                        category: d.category,
                        productName: d.subject,
                        userPhone: d.customerPhone,
                        userEmail: d.customerEmail,
                        createdAt: d.createdAt?.toDate?.() ?? new Date(),
                        updatedAt: d.updatedAt?.toDate?.() ?? null,
                        messages: d.messages || [],
                        lastReadBy: d.lastReadBy || {},
                        source: 'tickets' as const,
                        sla: d.sla || null,
                    };
                });
                finishIfBothLoaded();
            },
            (err) => { console.error('Error loading tickets:', err); finishIfBothLoaded(); }
        );

        return () => { unsubComplaints(); unsubTickets(); };
    }, []);

    // ── Filtered tickets ──
    const filteredTickets = useMemo(() => {
        if (filter === 'all') return allTickets;
        return allTickets.filter(t => {
            // Normalize status for comparison (handle both 'in-progress' and 'in_progress')
            const normalizedStatus = t.status.replace(/_/g, '-');
            const normalizedFilter = filter.replace(/_/g, '-');
            return normalizedStatus === normalizedFilter;
        });
    }, [allTickets, filter]);

    // ── Sorted tickets ──
    const sortedTickets = useMemo(() => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return [...filteredTickets].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0);
                case 'priority': {
                    const pa = priorityOrder[(a as any).priority || 'medium'] ?? 2;
                    const pb = priorityOrder[(b as any).priority || 'medium'] ?? 2;
                    return pa - pb;
                }
                default:
                    return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
            }
        });
    }, [filteredTickets, sortBy]);

    // ── Helpers ──
    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getDisplayId = (item: TicketItem) => {
        if (item.ticketId) return item.ticketId;
        return `#${item.id.slice(-8).toUpperCase()}`;
    };

    const getCategoryInfo = (cat?: string) => {
        if (!cat || !TICKET_CATEGORIES[cat]) return { icon: 'message-circle' as any, label: 'General' };
        return { icon: TICKET_CATEGORIES[cat].icon as any, label: TICKET_CATEGORIES[cat].label };
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={{ flexShrink: 0 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Customer Tickets</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{allTickets.length}</Text>
                    </View>
                </View>

                {/* Status Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
                    {STATUS_FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                            onPress={() => setFilter(f.key)}
                        >
                            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Ticket List */}
            <View style={{ flex: 1 }}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading tickets...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={sortedTickets}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Feather name="inbox" size={52} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>No tickets found</Text>
                                <Text style={styles.emptySubtext}>
                                    {filter !== 'all' ? 'Try adjusting your filter' : 'You have no customer tickets yet'}
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                            const categoryInfo = getCategoryInfo(item.category);
                            const isResolved = ['resolved', 'closed', 'rejected'].includes(item.status);

                            return (
                                <TouchableOpacity
                                    style={[styles.card, isResolved && styles.cardResolved]}
                                    onPress={() => navigation.navigate('VendorComplaintDetail', { complaint: item, source: item.source })}
                                    activeOpacity={0.7}
                                >
                                    {/* Top Row */}
                                    <View style={styles.cardTopRow}>
                                        <Text style={styles.ticketIdText}>{getDisplayId(item)}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '15' }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                                            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                                        </View>
                                    </View>

                                    {/* Customer Name */}
                                    <Text style={styles.customerName}>{item.userName}</Text>

                                    {/* Contact Info */}
                                    {(item.userPhone || item.userEmail) && (
                                        <View style={styles.contactRow}>
                                            {item.userPhone && (
                                                <View style={styles.contactItem}>
                                                    <Feather name="phone" size={11} color="#6b7280" />
                                                    <Text style={styles.contactText}>{item.userPhone}</Text>
                                                </View>
                                            )}
                                            {item.userEmail && (
                                                <View style={styles.contactItem}>
                                                    <Feather name="mail" size={11} color="#6b7280" />
                                                    <Text style={styles.contactText} numberOfLines={1}>{item.userEmail}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Category Badge */}
                                    <View style={styles.categoryBadge}>
                                        <Feather name={categoryInfo.icon} size={11} color="#6b7280" />
                                        <Text style={styles.categoryText}>{categoryInfo.label}</Text>
                                    </View>

                                    {/* Description */}
                                    <Text style={styles.description} numberOfLines={2}>
                                        {item.subject || item.description}
                                    </Text>

                                    {/* SLA Badge */}
                                    {(() => {
                                        const slaBadge = getSLAStatusBadge(item.sla);
                                        if (!slaBadge || slaBadge.label === 'Within SLA') return null;
                                        return (
                                            <View style={[styles.slaBadge, { backgroundColor: slaBadge.bgColor }]}>
                                                <Feather name={slaBadge.icon as any} size={11} color={slaBadge.color} />
                                                <Text style={[styles.slaText, { color: slaBadge.color }]}>{slaBadge.label}</Text>
                                            </View>
                                        );
                                    })()}

                                    {/* Footer */}
                                    <View style={styles.cardFooter}>
                                        <View style={styles.footerLeft}>
                                            <Feather name="shopping-cart" size={11} color={colors.textMuted} />
                                            <Text style={styles.footerText}>Order: {item.orderId?.slice(-8) || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.footerRight}>
                                            <Feather name="clock" size={11} color={colors.textMuted} />
                                            <Text style={styles.footerText}>{formatDate(item.createdAt)}</Text>
                                            {/* Unread Badge */}
                                            {(() => {
                                                const uid = auth.currentUser?.uid;
                                                if (!uid || !item.messages?.length) return null;
                                                const lastRead = item.lastReadBy?.[uid];
                                                const lastReadTime = lastRead?.toDate?.() ?? (lastRead ? new Date(lastRead) : null);
                                                const unread = item.messages.filter((m: any) => {
                                                    if (m.senderId === uid || m.from === 'vendor') return false;
                                                    const msgTime = m.createdAt?.toDate?.() ?? (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt));
                                                    if (!lastReadTime) return true;
                                                    return msgTime > lastReadTime;
                                                }).length;
                                                if (unread === 0) return null;
                                                return (
                                                    <View style={styles.unreadBadge}>
                                                        <Text style={styles.unreadCount}>{unread}</Text>
                                                    </View>
                                                );
                                            })()}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 4 },
    badge: {
        backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 12, minWidth: 32, alignItems: 'center',
    },
    badgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },

    // Filters
    filterRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', height: 42 },
    filterContent: { paddingHorizontal: 12, paddingVertical: 7, gap: 8 },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent',
    },
    filterChipActive: { backgroundColor: colors.primary + '12', borderColor: colors.primary },
    filterChipText: { fontSize: 12, fontWeight: '500', color: '#64748b' },
    filterChipTextActive: { color: colors.primary, fontWeight: '600' },

    // List
    list: { padding: 12, paddingBottom: 80 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: colors.textMuted, fontSize: 14 },
    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 },
    emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },

    // Card
    card: {
        backgroundColor: '#fff', padding: 14, borderRadius: 14,
        marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    },
    cardResolved: { opacity: 0.65 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ticketIdText: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '600' },

    customerName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
    contactRow: { flexDirection: 'row', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    contactText: { fontSize: 11, color: '#64748b', maxWidth: 140 },

    categoryBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
        alignSelf: 'flex-start', marginBottom: 8,
    },
    categoryText: { fontSize: 10, color: '#475569', fontWeight: '500' },

    description: { fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 18 },

    slaBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
        alignSelf: 'flex-start', marginBottom: 8,
    },
    slaText: { fontSize: 10, fontWeight: '600' },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText: { fontSize: 11, color: colors.textMuted },

    // Unread badge
    unreadBadge: {
        minWidth: 20, height: 20, borderRadius: 10,
        backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 5, marginLeft: 6,
    },
    unreadCount: { fontSize: 11, fontWeight: '700', color: '#fff' },
});
