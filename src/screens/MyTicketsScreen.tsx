import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, ScrollView, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { auth, db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';
import type { TicketCategory } from '../types/ticket';
import KnowledgeBasePanel from '../components/KnowledgeBasePanel';

// ─── Types ───────────────────────────────────────────────────
interface TicketItem {
    id: string;
    ticketId?: string;       // GM-TKT-YYMMDD-0001
    userId: string;
    userName: string;
    vendorId: string;
    vendorStoreName?: string;
    orderId: string;
    description: string;
    subject?: string;
    status: string;
    priority?: string;
    category?: TicketCategory;
    createdAt: Date;
    updatedAt?: Date | null;
    sla?: { firstResponseDue?: Date; resolutionDue?: Date; isOverdue?: boolean };
    messages?: any[];
    lastReadBy?: Record<string, any>;
    source: 'tickets' | 'complaints';
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    new: { label: 'New', color: '#7c3aed' },
    open: { label: 'Open', color: '#ef4444' },
    assigned: { label: 'Assigned', color: '#3b82f6' },
    in_progress: { label: 'In Progress', color: '#f59e0b' },
    'in-progress': { label: 'In Progress', color: '#f59e0b' },
    pending_customer: { label: 'Pending Reply', color: '#8b5cf6' },
    resolved: { label: 'Resolved', color: '#10b981' },
    closed: { label: 'Closed', color: '#6b7280' },
    reopened: { label: 'Reopened', color: '#ef4444' },
    rejected: { label: 'Rejected', color: '#6b7280' },
};

// ─── SLA Countdown Helper ────────────────────────────────────
function getSlaCountdown(dueDate: Date | undefined | null): { text: string; color: string; urgent: boolean } {
    if (!dueDate) return { text: '', color: '#6b7280', urgent: false };
    const now = new Date();
    const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return { text: 'SLA Breached', color: '#dc2626', urgent: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours < 1) return { text: `${mins}m left`, color: '#dc2626', urgent: true };
    if (hours < 4) return { text: `${hours}h ${mins}m left`, color: '#ea580c', urgent: true };
    if (hours < 24) return { text: `${hours}h left`, color: '#f59e0b', urgent: false };
    const days = Math.floor(hours / 24);
    return { text: `${days}d ${hours % 24}h left`, color: '#10b981', urgent: false };
}

// ─── Filters ─────────────────────────────────────────────────
type StatusFilter = 'all' | 'active' | 'resolved' | 'closed';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
];

// ─── Main Component ──────────────────────────────────────────
export default function MyTicketsScreen({ navigation }: any) {
    const [allTickets, setAllTickets] = useState<TicketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showKB, setShowKB] = useState(false);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'status'>('newest');

    // ── Data Fetching: Listen to both collections ──
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        let ticketsFromComplaints: TicketItem[] = [];
        let ticketsFromNew: TicketItem[] = [];
        let loadedCount = 0;

        const finishIfBothLoaded = () => {
            loadedCount++;
            if (loadedCount >= 2) {
                // Merge and deduplicate
                const idSet = new Set(ticketsFromNew.map(t => t.id));
                const oldOnly = ticketsFromComplaints.filter(c => !idSet.has(c.id));
                const merged = [...ticketsFromNew, ...oldOnly]
                    .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
                setAllTickets(merged);
                setLoading(false);
            }
        };

        // 1. Listen to OLD complaints collection
        const unsubComplaints = onSnapshot(
            query(collection(db, 'complaints'), where('userId', '==', user.uid)),
            (snapshot) => {
                ticketsFromComplaints = snapshot.docs.map((docSnap) => {
                    const d = docSnap.data();
                    return {
                        id: docSnap.id,
                        userId: d.userId || '',
                        userName: d.userName || '',
                        vendorId: d.vendorId || '',
                        orderId: d.orderId || '',
                        description: d.description || '',
                        status: d.status || 'open',
                        priority: d.priority || 'medium',
                        category: d.issue as TicketCategory | undefined,
                        createdAt: d.createdAt?.toDate?.() ?? new Date(),
                        updatedAt: d.updatedAt?.toDate?.() ?? null,
                        messages: (d.messages || []).map((m: any) => ({
                            ...m, createdAt: m.createdAt?.toDate?.() ?? new Date(m.createdAt),
                        })),
                        lastReadBy: d.lastReadBy || {},
                        source: 'complaints' as const,
                    };
                });
                finishIfBothLoaded();
            },
            (err) => { console.error('Error loading complaints:', err); finishIfBothLoaded(); }
        );

        // 2. Listen to NEW tickets collection
        const unsubTickets = onSnapshot(
            query(collection(db, 'tickets'), where('customerId', '==', user.uid)),
            (snapshot) => {
                ticketsFromNew = snapshot.docs.map((docSnap) => {
                    const d = docSnap.data();
                    return {
                        id: docSnap.id,
                        ticketId: d.ticketId,
                        userId: d.customerId || '',
                        userName: d.customerName || '',
                        vendorId: d.vendorId || '',
                        vendorStoreName: d.vendorStoreName,
                        orderId: d.orderId || '',
                        description: d.description || '',
                        subject: d.subject,
                        status: d.status || 'open',
                        priority: d.priority || 'medium',
                        category: d.category as TicketCategory | undefined,
                        createdAt: d.createdAt?.toDate?.() ?? new Date(),
                        updatedAt: d.updatedAt?.toDate?.() ?? null,
                        sla: d.sla ? {
                            firstResponseDue: d.sla.firstResponseDue?.toDate?.() ?? null,
                            resolutionDue: d.sla.resolutionDue?.toDate?.() ?? null,
                            isOverdue: d.sla.isOverdue ?? false,
                        } : undefined,
                        messages: (d.messages || []).map((m: any) => ({
                            ...m, createdAt: m.createdAt?.toDate?.() ?? new Date(m.createdAt),
                        })),
                        lastReadBy: d.lastReadBy || {},
                        source: 'tickets' as const,
                    };
                });
                finishIfBothLoaded();
            },
            (err) => { console.error('Error loading tickets:', err); finishIfBothLoaded(); }
        );

        return () => { unsubComplaints(); unsubTickets(); };
    }, []);

    // ── Filtered Tickets (status + category + search) ──
    const filteredTickets = useMemo(() => {
        return allTickets.filter(t => {
            // Status filter
            if (statusFilter === 'active' && ['resolved', 'closed', 'rejected'].includes(t.status)) return false;
            if (statusFilter === 'resolved' && t.status !== 'resolved') return false;
            if (statusFilter === 'closed' && !['closed', 'rejected'].includes(t.status)) return false;

            // Category filter
            if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchId = (t.ticketId || t.id || '').toLowerCase().includes(q);
                const matchDesc = (t.description || '').toLowerCase().includes(q);
                const matchSubject = (t.subject || '').toLowerCase().includes(q);
                const matchOrder = (t.orderId || '').toLowerCase().includes(q);
                const matchVendor = (t.vendorStoreName || '').toLowerCase().includes(q);
                if (!matchId && !matchDesc && !matchSubject && !matchOrder && !matchVendor) return false;
            }

            return true;
        });
    }, [allTickets, statusFilter, categoryFilter, searchQuery]);

    // ── Sort filtered tickets ──
    const sortedTickets = useMemo(() => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const statusOrder: Record<string, number> = { open: 0, reopened: 1, 'in-progress': 2, in_progress: 2, new: 0, resolved: 3, closed: 4, rejected: 5 };
        return [...filteredTickets].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0);
                case 'priority':
                    return (priorityOrder[a.priority || 'medium'] ?? 2) - (priorityOrder[b.priority || 'medium'] ?? 2);
                case 'status':
                    return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
                default: // newest
                    return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
            }
        });
    }, [filteredTickets, sortBy]);

    // ── Stats ──
    const stats = useMemo(() => ({
        total: allTickets.length,
        active: allTickets.filter(t => !['resolved', 'closed', 'rejected'].includes(t.status)).length,
        resolved: allTickets.filter(t => t.status === 'resolved').length,
        overdue: allTickets.filter(t => t.sla?.isOverdue).length,
    }), [allTickets]);

    // ── Helpers ──
    const formatDate = (date: Date | any) => {
        if (!date) return '—';
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getDisplayId = (item: TicketItem) => {
        if (item.ticketId) return item.ticketId;
        return `#${item.id.slice(-8).toUpperCase()}`;
    };

    const getCategoryInfo = (cat?: TicketCategory) => {
        if (!cat || !TICKET_CATEGORIES[cat]) return { icon: 'help-circle' as any, label: 'General' };
        return { icon: TICKET_CATEGORIES[cat].icon as any, label: TICKET_CATEGORIES[cat].label };
    };

    // ── Render ──
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            {/* Top section — fixed height, no flex growth */}
            <View style={{ flexShrink: 0 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Tickets</Text>
                    <TouchableOpacity onPress={() => setShowKB(!showKB)} style={styles.helpBtn}>
                        <Feather name="book-open" size={20} color={showKB ? '#7c3aed' : colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Stats Bar */}
                <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.active}</Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.resolved}</Text>
                        <Text style={styles.statLabel}>Resolved</Text>
                    </View>
                    {stats.overdue > 0 && (
                        <View style={[styles.statItem, styles.statDivider]}>
                            <Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.overdue}</Text>
                            <Text style={styles.statLabel}>Overdue</Text>
                        </View>
                    )}
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Feather name="search" size={16} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search tickets, orders, vendors..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Feather name="x" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Status Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
                    {STATUS_FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
                            onPress={() => setStatusFilter(f.key)}
                        >
                            <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <View style={styles.filterDivider} />
                    {/* Category Filters */}
                    <TouchableOpacity
                        style={[styles.filterChip, categoryFilter === 'all' && styles.filterChipActive]}
                        onPress={() => setCategoryFilter('all')}
                    >
                        <Text style={[styles.filterChipText, categoryFilter === 'all' && styles.filterChipTextActive]}>All Categories</Text>
                    </TouchableOpacity>
                    {Object.entries(TICKET_CATEGORIES).map(([key, cat]) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.filterChip, categoryFilter === key && styles.filterChipActive]}
                            onPress={() => setCategoryFilter(prev => prev === key ? 'all' : key)}
                        >
                            <Feather name={cat.icon as any} size={11} color={categoryFilter === key ? colors.primary : '#64748b'} />
                            <Text style={[styles.filterChipText, categoryFilter === key && styles.filterChipTextActive]}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Knowledge Base Panel */}
            {showKB && (
                <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
                    <KnowledgeBasePanel
                        category={categoryFilter !== 'all' ? categoryFilter : undefined}
                        onDismiss={() => setShowKB(false)}
                        visible={showKB}
                    />
                </View>
            )}

            {/* Sort Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, gap: 8 }}>
                <Feather name="bar-chart-2" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>Sort:</Text>
                {(['newest', 'oldest', 'priority', 'status'] as const).map(s => (
                    <TouchableOpacity
                        key={s}
                        onPress={() => setSortBy(s)}
                        style={{
                            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                            backgroundColor: sortBy === s ? colors.primary + '15' : '#f1f5f9',
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: sortBy === s ? colors.primary : '#94a3b8', textTransform: 'capitalize' }}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Ticket List — fills remaining space */}
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
                                    {searchQuery
                                        ? `No results for "${searchQuery}"`
                                        : statusFilter !== 'all' || categoryFilter !== 'all'
                                            ? 'Try adjusting your filters'
                                            : 'Raise a complaint from Order History when you need help.'}
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                            const categoryInfo = getCategoryInfo(item.category);
                            const slaInfo = item.sla?.resolutionDue
                                ? getSlaCountdown(item.sla.resolutionDue)
                                : null;
                            const isResolved = ['resolved', 'closed', 'rejected'].includes(item.status);

                            return (
                                <TouchableOpacity
                                    style={[styles.card, isResolved && styles.cardResolved]}
                                    onPress={() => navigation.navigate('TicketDetail', { ticket: { ...item, source: item.source } })}
                                    activeOpacity={0.7}
                                >
                                    {/* Top Row: Ticket ID + Status */}
                                    <View style={styles.cardTopRow}>
                                        <Text style={styles.ticketIdText}>{getDisplayId(item)}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
                                            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                                            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                                        </View>
                                    </View>

                                    {/* Subject / Description */}
                                    <Text style={styles.cardSubject} numberOfLines={1}>
                                        {item.subject || item.description}
                                    </Text>
                                    {item.subject && item.description && (
                                        <Text style={styles.cardDescription} numberOfLines={1}>{item.description}</Text>
                                    )}

                                    {/* Category Row */}
                                    <View style={styles.badgeRow}>
                                        <View style={styles.categoryBadge}>
                                            <Feather name={categoryInfo.icon} size={12} color="#6b7280" />
                                            <Text style={styles.categoryText}>{categoryInfo.label}</Text>
                                        </View>
                                    </View>

                                    {/* SLA + Footer */}
                                    <View style={styles.cardFooter}>
                                        <View style={styles.footerLeft}>
                                            <Feather name="clock" size={12} color={colors.textMuted} />
                                            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                                        </View>
                                        <View style={styles.footerRight}>
                                            {/* SLA Countdown */}
                                            {slaInfo && slaInfo.text && !isResolved && (
                                                <View style={[styles.slaBadge, { backgroundColor: slaInfo.color + '15' }]}>
                                                    <Feather name={slaInfo.urgent ? 'alert-circle' : 'clock'} size={10} color={slaInfo.color} />
                                                    <Text style={[styles.slaText, { color: slaInfo.color }]}>{slaInfo.text}</Text>
                                                </View>
                                            )}
                                            {/* Unread Message Count */}
                                            {(() => {
                                                const uid = auth.currentUser?.uid;
                                                if (!uid || !item.messages?.length) return null;
                                                const lastRead = item.lastReadBy?.[uid];
                                                const lastReadTime = lastRead?.toDate?.() ?? (lastRead ? new Date(lastRead) : null);
                                                const unread = item.messages.filter((m: any) => {
                                                    if (m.senderId === uid || m.from === 'user') return false;
                                                    if (!lastReadTime) return true;
                                                    const msgTime = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
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

                                    {/* Vendor Store Info */}
                                    {item.vendorStoreName && (
                                        <View style={styles.vendorRow}>
                                            <Feather name="shopping-bag" size={11} color={colors.textMuted} />
                                            <Text style={styles.vendorText}>{item.vendorStoreName}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>

            {/* ─── Create Ticket FAB ─── */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreateTicket')}
                activeOpacity={0.8}
            >
                <Feather name="plus" size={24} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', backgroundColor: '#fff',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    helpBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },

    // Stats
    statsBar: {
        flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10,
        paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.08)' },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    // Search
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        marginHorizontal: spacing.md, marginTop: 6, marginBottom: 4,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
        gap: 8,
    },
    searchInput: {
        flex: 1, fontSize: 13, color: colors.text, paddingVertical: 2,
    },

    // Filters
    filterRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', height: 42 },
    filterContent: { paddingHorizontal: spacing.md, paddingVertical: 7, gap: 8, alignItems: 'center' },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: 'transparent',
    },
    filterChipActive: { backgroundColor: colors.primary + '12', borderColor: colors.primary },
    filterChipText: { fontSize: 12, fontWeight: '500', color: '#64748b' },
    filterChipTextActive: { color: colors.primary, fontWeight: '600' },
    filterDivider: { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 4 },

    // List
    list: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: spacing.md, color: colors.textMuted, fontSize: 14 },

    // Empty
    empty: { alignItems: 'center', paddingVertical: spacing.xl * 3 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: spacing.md },
    emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: spacing.xl },

    // Card
    card: {
        backgroundColor: '#fff', padding: spacing.lg, borderRadius: 14,
        marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        elevation: 1,
    },
    cardResolved: { opacity: 0.7 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ticketIdText: { fontSize: 13, fontWeight: '700', color: colors.primary, letterSpacing: 0.2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '600' },

    cardSubject: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
    cardDescription: { fontSize: 13, color: '#64748b', marginBottom: 8 },

    // Badges
    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    categoryBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    },
    categoryText: { fontSize: 11, color: '#475569', fontWeight: '500' },
    priorityBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    },
    priorityText: { fontSize: 11, fontWeight: '600' },

    // Footer
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateText: { fontSize: 11, color: colors.textMuted },
    footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slaBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    slaText: { fontSize: 10, fontWeight: '600' },
    msgBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    msgCount: { fontSize: 11, color: colors.primary, fontWeight: '600' },

    // Unread badge
    unreadBadge: {
        minWidth: 20, height: 20, borderRadius: 10,
        backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 5,
    },
    unreadCount: { fontSize: 11, fontWeight: '700', color: '#fff' },

    // Vendor
    vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    vendorText: { fontSize: 11, color: colors.textMuted },

    // FAB
    fab: {
        position: 'absolute', bottom: 24, right: 20,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25, shadowRadius: 8,
        elevation: 6,
    },
});
