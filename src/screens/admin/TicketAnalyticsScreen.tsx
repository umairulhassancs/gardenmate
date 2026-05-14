import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';

const { width } = Dimensions.get('window');

interface TicketData {
    id: string;
    status: string;
    priority: string;
    category: string;
    createdAt: any;
    resolvedAt?: any;
    csatRating?: number;
    escalatedToAdmin?: boolean;
    slaDeadline?: any;
    firstResponseAt?: any;
    responses?: any[];
}

export default function TicketAnalyticsScreen({ navigation }: any) {
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

    useEffect(() => {
        const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data: TicketData[] = [];
            snap.forEach((d) => {
                const raw = d.data();
                data.push({
                    id: d.id,
                    status: raw.status || 'open',
                    priority: raw.priority || 'medium',
                    category: raw.category || raw.issue || 'other',
                    createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate() : new Date(raw.createdAt || Date.now()),
                    resolvedAt: raw.resolvedAt?.toDate ? raw.resolvedAt.toDate() : (raw.resolvedAt ? new Date(raw.resolvedAt) : null),
                    csatRating: raw.csatRating || null,
                    escalatedToAdmin: raw.escalatedToAdmin || false,
                    slaDeadline: raw.slaDeadline?.toDate ? raw.slaDeadline.toDate() : null,
                    firstResponseAt: raw.firstResponseAt?.toDate ? raw.firstResponseAt.toDate() : null,
                    responses: raw.responses || [],
                });
            });
            setTickets(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Filter by period
    const filteredTickets = useMemo(() => {
        if (period === 'all') return tickets;
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysMap[period]);
        return tickets.filter(t => t.createdAt >= cutoff);
    }, [tickets, period]);

    // ── Metrics ──
    const totalTickets = filteredTickets.length;
    const openTickets = filteredTickets.filter(t => t.status === 'open').length;
    const inProgressTickets = filteredTickets.filter(t => t.status === 'in-progress').length;
    const resolvedTickets = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
    const escalatedTickets = filteredTickets.filter(t => t.escalatedToAdmin).length;

    const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    // Average Response Time (hours)
    const ticketsWithResponse = filteredTickets.filter(t => t.firstResponseAt && t.createdAt);
    const avgResponseTime = ticketsWithResponse.length > 0
        ? Math.round(ticketsWithResponse.reduce((sum, t) => {
            const diff = (t.firstResponseAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
            return sum + diff;
        }, 0) / ticketsWithResponse.length * 10) / 10
        : 0;

    // Average Resolution Time (hours)
    const resolvedWithTime = filteredTickets.filter(t => t.resolvedAt && t.createdAt);
    const avgResolutionTime = resolvedWithTime.length > 0
        ? Math.round(resolvedWithTime.reduce((sum, t) => {
            const diff = (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
            return sum + diff;
        }, 0) / resolvedWithTime.length * 10) / 10
        : 0;

    // SLA Compliance
    const ticketsWithSLA = filteredTickets.filter(t => t.slaDeadline);
    const slaCompliant = ticketsWithSLA.filter(t => {
        if (t.resolvedAt) return t.resolvedAt <= t.slaDeadline;
        return new Date() <= t.slaDeadline;
    }).length;
    const slaComplianceRate = ticketsWithSLA.length > 0
        ? Math.round((slaCompliant / ticketsWithSLA.length) * 100)
        : 100; // Default to 100% if no SLA tickets

    // CSAT
    const ratedTickets = filteredTickets.filter(t => t.csatRating && t.csatRating > 0);
    const avgCSAT = ratedTickets.length > 0
        ? Math.round(ratedTickets.reduce((sum, t) => sum + t.csatRating!, 0) / ratedTickets.length * 10) / 10
        : 0;

    // CSAT Distribution
    const csatDistribution = [1, 2, 3, 4, 5].map(star => ({
        star,
        count: ratedTickets.filter(t => t.csatRating === star).length,
    }));

    // Priority Distribution
    const priorityDist = ['high', 'medium', 'low'].map(p => ({
        priority: p,
        count: filteredTickets.filter(t => t.priority === p).length,
    }));

    // Category Distribution (top 5)
    const categoryCounts: Record<string, number> = {};
    filteredTickets.forEach(t => {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading analytics...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>📊 Analytics</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Period Selector */}
            <View style={styles.periodRow}>
                {(['7d', '30d', '90d', 'all'] as const).map(p => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.periodChip, period === p && styles.periodChipActive]}
                        onPress={() => setPeriod(p)}
                    >
                        <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                            {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : 'All Time'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Key Metrics Grid */}
                <View style={styles.metricsGrid}>
                    <MetricCard icon="inbox" label="Total" value={totalTickets} color="#3b82f6" />
                    <MetricCard icon="alert-circle" label="Open" value={openTickets} color="#ef4444" />
                    <MetricCard icon="clock" label="In Progress" value={inProgressTickets} color="#f59e0b" />
                    <MetricCard icon="check-circle" label="Resolved" value={resolvedTickets} color="#10b981" />
                </View>

                {/* Performance Metrics */}
                <Text style={styles.sectionTitle}>Performance</Text>
                <View style={styles.performanceRow}>
                    <View style={styles.performanceCard}>
                        <Text style={styles.perfValue}>{resolutionRate}%</Text>
                        <Text style={styles.perfLabel}>Resolution Rate</Text>
                        <ProgressBar value={resolutionRate} color="#10b981" />
                    </View>
                    <View style={styles.performanceCard}>
                        <Text style={styles.perfValue}>{slaComplianceRate}%</Text>
                        <Text style={styles.perfLabel}>SLA Compliance</Text>
                        <ProgressBar value={slaComplianceRate} color="#3b82f6" />
                    </View>
                </View>

                <View style={styles.performanceRow}>
                    <View style={styles.performanceCard}>
                        <Text style={styles.perfValue}>{avgResponseTime}h</Text>
                        <Text style={styles.perfLabel}>Avg Response Time</Text>
                    </View>
                    <View style={styles.performanceCard}>
                        <Text style={styles.perfValue}>{avgResolutionTime}h</Text>
                        <Text style={styles.perfLabel}>Avg Resolution Time</Text>
                    </View>
                </View>

                {/* CSAT Section */}
                <Text style={styles.sectionTitle}>Customer Satisfaction</Text>
                <View style={styles.csatCard}>
                    <View style={styles.csatHeader}>
                        <View>
                            <Text style={styles.csatScore}>{avgCSAT > 0 ? avgCSAT.toFixed(1) : '—'}</Text>
                            <Text style={styles.csatLabel}>Average CSAT ({ratedTickets.length} ratings)</Text>
                        </View>
                        <View style={styles.csatStars}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <Feather
                                    key={s}
                                    name="star"
                                    size={16}
                                    color={s <= Math.round(avgCSAT) ? '#f59e0b' : '#e2e8f0'}
                                />
                            ))}
                        </View>
                    </View>
                    <View style={styles.csatBars}>
                        {csatDistribution.reverse().map(d => (
                            <View key={d.star} style={styles.csatBarRow}>
                                <Text style={styles.csatBarLabel}>{d.star}★</Text>
                                <View style={styles.csatBarTrack}>
                                    <View
                                        style={[styles.csatBarFill, {
                                            width: ratedTickets.length > 0 ? `${(d.count / ratedTickets.length) * 100}%` : '0%',
                                            backgroundColor: d.star >= 4 ? '#10b981' : d.star === 3 ? '#f59e0b' : '#ef4444',
                                        }]}
                                    />
                                </View>
                                <Text style={styles.csatBarCount}>{d.count}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Priority Distribution */}
                <Text style={styles.sectionTitle}>Priority Distribution</Text>
                <View style={styles.distCard}>
                    {priorityDist.map(d => {
                        const pct = totalTickets > 0 ? Math.round((d.count / totalTickets) * 100) : 0;
                        const color = d.priority === 'high' ? '#ef4444' : d.priority === 'medium' ? '#f59e0b' : '#3b82f6';
                        return (
                            <View key={d.priority} style={styles.distRow}>
                                <View style={[styles.distDot, { backgroundColor: color }]} />
                                <Text style={styles.distLabel}>{d.priority}</Text>
                                <Text style={styles.distCount}>{d.count}</Text>
                                <View style={styles.distBarTrack}>
                                    <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                                </View>
                                <Text style={styles.distPct}>{pct}%</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Top Categories */}
                {topCategories.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Top Categories</Text>
                        <View style={styles.distCard}>
                            {topCategories.map((c, i) => (
                                <View key={c.name} style={styles.catRow}>
                                    <Text style={styles.catRank}>#{i + 1}</Text>
                                    <Text style={styles.catName}>{c.name}</Text>
                                    <Text style={styles.catCount}>{c.count}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* Escalation Stats */}
                {escalatedTickets > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Escalations</Text>
                        <View style={styles.escalationCard}>
                            <View style={styles.escalationHeader}>
                                <Feather name="alert-triangle" size={20} color="#8b5cf6" />
                                <Text style={styles.escalationCount}>{escalatedTickets}</Text>
                                <Text style={styles.escalationLabel}>tickets escalated to admin</Text>
                            </View>
                            <Text style={styles.escalationPct}>
                                {Math.round((escalatedTickets / totalTickets) * 100)}% of total tickets
                            </Text>
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Sub-components ──
function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
    return (
        <View style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: color + '12' }]}>
                <Feather name={icon as any} size={18} color={color} />
            </View>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
    );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
    return (
        <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },

    // Period
    periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    periodChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    },
    periodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    periodText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    periodTextActive: { color: '#fff' },

    scrollContent: { paddingHorizontal: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 20, marginBottom: 12 },

    // Metrics Grid
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    metricCard: {
        width: (width - 42) / 2, backgroundColor: '#fff', borderRadius: 14,
        padding: 16, borderWidth: 1, borderColor: '#f1f5f9',
    },
    metricIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    metricValue: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
    metricLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },

    // Performance
    performanceRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    performanceCard: {
        flex: 1, backgroundColor: '#fff', borderRadius: 14,
        padding: 16, borderWidth: 1, borderColor: '#f1f5f9',
    },
    perfValue: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    perfLabel: { fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 8 },
    progressTrack: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },

    // CSAT
    csatCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: '#f1f5f9',
    },
    csatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    csatScore: { fontSize: 36, fontWeight: '800', color: '#1e293b' },
    csatLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
    csatStars: { flexDirection: 'row', gap: 2, marginTop: 8 },
    csatBars: { gap: 6 },
    csatBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    csatBarLabel: { width: 24, fontSize: 11, color: '#64748b', textAlign: 'right' },
    csatBarTrack: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
    csatBarFill: { height: '100%', borderRadius: 4 },
    csatBarCount: { width: 20, fontSize: 11, color: '#64748b', textAlign: 'right' },

    // Distribution
    distCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: '#f1f5f9', gap: 12,
    },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distDot: { width: 8, height: 8, borderRadius: 4 },
    distLabel: { fontSize: 13, color: '#334155', textTransform: 'capitalize', width: 60 },
    distCount: { fontSize: 13, fontWeight: '700', color: '#1e293b', width: 30, textAlign: 'right' },
    distBarTrack: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
    distBarFill: { height: '100%', borderRadius: 4 },
    distPct: { fontSize: 11, color: '#64748b', width: 32, textAlign: 'right' },

    // Categories
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    catRank: { fontSize: 12, fontWeight: '700', color: colors.primary, width: 24 },
    catName: { flex: 1, fontSize: 13, color: '#334155', textTransform: 'capitalize' },
    catCount: { fontSize: 13, fontWeight: '700', color: '#1e293b' },

    // Escalation
    escalationCard: {
        backgroundColor: '#faf5ff', borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: '#e9d5ff',
    },
    escalationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    escalationCount: { fontSize: 24, fontWeight: '800', color: '#8b5cf6' },
    escalationLabel: { fontSize: 13, color: '#7c3aed' },
    escalationPct: { fontSize: 12, color: '#a78bfa' },
});
