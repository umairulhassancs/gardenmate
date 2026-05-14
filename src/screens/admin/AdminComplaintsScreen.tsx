import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Modal, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { collection, query, onSnapshot, orderBy, addDoc, Timestamp, doc, updateDoc, serverTimestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebaseConfig';
import { Complaint as FirebaseComplaint } from '../../api/feedbackApi';
import { notifyUser } from '../../services/notifyHelper';
import BulkActionsBar from '../../components/BulkActionsBar';
import MergeTicketsModal from '../../components/MergeTicketsModal';
import LinkTicketsModal from '../../components/LinkTicketsModal';
import ExportModal from '../../components/ExportModal';
import { getSLAStatusBadge, autoEscalateBreached } from '../../services/slaAlertService';

interface Complaint {
    id: string;
    ticketId?: string;  // GM-TKT-YYMMDD-0001 format
    subject: string;
    description: string;
    customer: string;
    customerEmail: string;
    status: 'open' | 'in-progress' | 'resolved' | 'new' | 'assigned' | 'in_progress' | 'pending_customer' | 'closed' | 'reopened' | 'rejected';
    priority: 'high' | 'medium' | 'low' | 'critical' | 'urgent';
    type: 'order' | 'product' | 'vendor' | 'other';
    createdAt: string;
    responses: { from: string; message: string; date: string }[];
    messages?: any[];
    lastReadBy?: Record<string, any>;
    userId?: string;
    vendorId?: string;
    orderId?: string;
    escalatedToAdmin?: boolean;
    escalationReason?: string;
    sla?: any;
    source: 'complaints' | 'tickets'; // Which Firestore collection this came from
}

export default function AdminComplaintsScreen({ navigation }: any) {
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in-progress' | 'resolved' | 'escalated'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [response, setResponse] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const clearSelection = () => {
        setSelectedIds([]);
        setSelectionMode(false);
    };

    const [showMergeModal, setShowMergeModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkTargetId, setLinkTargetId] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);

    // Helper: determine priority — use actual field first, fallback to keyword heuristic
    const guessPriority = (data: any): Complaint['priority'] => {
        if (data.priority && ['critical', 'urgent', 'high', 'medium', 'low'].includes(data.priority)) {
            return data.priority;
        }
        const desc = data.description?.toLowerCase() || '';
        const issue = data.issue?.toLowerCase() || '';
        if (desc.includes('urgent') || desc.includes('refund') || desc.includes('damaged') || issue.includes('damaged')) return 'high';
        if (desc.includes('slow') || desc.includes('delay') || issue.includes('delivery')) return 'medium';
        return 'low';
    };

    // Helper: determine type
    const guessType = (data: any): Complaint['type'] => {
        const issue = (data.issue || data.category || '').toLowerCase();
        if (issue.includes('delivery') || issue.includes('quality') || issue.includes('packaging')) return 'order';
        if (issue.includes('service')) return 'vendor';
        return 'product';
    };

    // Helper: display formatted ticket ID
    const getDisplayId = (item: Complaint) => {
        if (item.ticketId) return item.ticketId;
        return `#${item.id.slice(-8).toUpperCase()}`;
    };

    // Load from BOTH collections in real-time
    useEffect(() => {
        let complaintsFromOld: Complaint[] = [];
        let complaintsFromNew: Complaint[] = [];
        let loadedCount = 0;

        const mergeAndSet = () => {
            loadedCount++;
            if (loadedCount >= 2) {
                // Deduplicate: new-format tickets take priority
                const newIds = new Set(complaintsFromNew.map(t => t.id));
                const oldOnly = complaintsFromOld.filter(c => !newIds.has(c.id));
                const merged = [...complaintsFromNew, ...oldOnly]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setComplaints(merged);
                setLoading(false);
            }
        };

        // 1. Listen to OLD complaints collection
        const unsubOld = onSnapshot(
            query(collection(db, 'complaints'), orderBy('createdAt', 'desc')),
            (snapshot) => {
                complaintsFromOld = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        subject: data.issue || 'Complaint',
                        description: data.description || '',
                        customer: data.userName || 'Customer',
                        customerEmail: data.userEmail || '',
                        status: data.status || 'open',
                        priority: guessPriority(data),
                        type: guessType(data),
                        createdAt: (data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())).toISOString(),
                        responses: data.responses || [],
                        userId: data.userId || '',
                        vendorId: data.vendorId || '',
                        orderId: data.orderId || '',
                        escalatedToAdmin: data.escalatedToAdmin || false,
                        escalationReason: data.escalationReason || '',
                        sla: data.sla || null,
                        messages: data.messages || [],
                        lastReadBy: data.lastReadBy || {},
                        source: 'complaints' as const,
                    };
                });
                mergeAndSet();
            },
            (err) => { console.error('Error loading complaints:', err); mergeAndSet(); }
        );

        // 2. Listen to NEW tickets collection
        const unsubNew = onSnapshot(
            query(collection(db, 'tickets'), orderBy('createdAt', 'desc')),
            (snapshot) => {
                complaintsFromNew = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        ticketId: data.ticketId || '',
                        subject: data.subject || data.category || 'Ticket',
                        description: data.description || '',
                        customer: data.customerName || 'Customer',
                        customerEmail: data.customerEmail || '',
                        status: data.status || 'open',
                        priority: guessPriority(data),
                        type: guessType(data),
                        createdAt: (data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())).toISOString(),
                        responses: data.responses || [],
                        userId: data.customerId || '',
                        vendorId: data.vendorId || '',
                        orderId: data.orderId || '',
                        escalatedToAdmin: data.escalatedToAdmin || false,
                        escalationReason: data.escalationReason || '',
                        sla: data.sla || null,
                        messages: data.messages || [],
                        lastReadBy: data.lastReadBy || {},
                        source: 'tickets' as const,
                    };
                });
                mergeAndSet();
            },
            (err) => { console.error('Error loading tickets:', err); mergeAndSet(); }
        );

        return () => { unsubOld(); unsubNew(); };
    }, []);

    // Auto-escalate breached SLA tickets on load
    useEffect(() => {
        autoEscalateBreached().then(count => {
            if (count > 0) {
                Alert.alert('SLA Alert', `${count} ticket(s) auto-escalated due to SLA breach.`);
            }
        }).catch(console.error);
    }, []);

    const filteredComplaints = complaints.filter(complaint => {
        const matchesSearch = complaint.subject.toLowerCase().includes(search.toLowerCase()) ||
            complaint.customer.toLowerCase().includes(search.toLowerCase()) ||
            complaint.id.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'escalated' ? complaint.escalatedToAdmin : complaint.status === statusFilter);
        const matchesPriority = priorityFilter === 'all' || complaint.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
    });

    const openCount = complaints.filter(c => c.status === 'open').length;
    const inProgressCount = complaints.filter(c => c.status === 'in-progress').length;
    const highPriorityCount = complaints.filter(c => c.priority === 'high' && c.status !== 'resolved').length;
    const escalatedCount = complaints.filter(c => c.escalatedToAdmin).length;

    const handleUpdateStatus = async (complaintId: string, newStatus: string) => {
        try {
            // Auto-detect collection: check 'tickets' first, fallback to 'complaints'
            const ticketRef = doc(db, 'tickets', complaintId);
            const ticketSnap = await getDoc(ticketRef);
            const collName = ticketSnap.exists() ? 'tickets' : 'complaints';
            const complaintRef = doc(db, collName, complaintId);
            const updateData: any = {
                status: newStatus,
                updatedAt: Timestamp.fromDate(new Date()),
            };

            if (newStatus === 'resolved') {
                updateData.resolvedAt = Timestamp.fromDate(new Date());
            }
            if (newStatus === 'closed') {
                updateData.closedAt = Timestamp.fromDate(new Date());
            }

            await updateDoc(complaintRef, updateData);
            Alert.alert('Status Updated', `Ticket status changed to ${newStatus}.`);
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update ticket status');
        }
    };

    const handleChangePriority = async (complaintId: string, newPriority: 'high' | 'medium' | 'low') => {
        try {
            const item = complaints.find(c => c.id === complaintId);
            const collName = item?.source || 'complaints';
            await updateDoc(doc(db, collName, complaintId), {
                priority: newPriority,
                updatedAt: Timestamp.fromDate(new Date()),
            });
            Alert.alert('Priority Updated', `Ticket priority changed to ${newPriority}.`);
        } catch (error) {
            console.error('Error updating priority:', error);
            Alert.alert('Error', 'Failed to update priority');
        }
    };

    const handleSendResponse = async () => {
        if (selectedComplaint && response.trim()) {
            try {
                // Use the correct collection based on the ticket's source
                const collName = selectedComplaint.source || 'complaints';
                const complaintRef = doc(db, collName, selectedComplaint.id);
                const newResponse = {
                    from: 'Admin',
                    message: response.trim(),
                    date: new Date().toISOString(),
                };

                // Also write to messages[] so admin replies appear in customer's real-time chat
                const chatMessage = {
                    from: 'admin',
                    senderId: auth.currentUser?.uid || 'admin',
                    senderName: 'Admin',
                    text: response.trim(),
                    createdAt: new Date(),
                    status: 'sent',
                };

                const currentResponses = selectedComplaint.responses || [];

                await updateDoc(complaintRef, {
                    status: selectedComplaint.status === 'new' || selectedComplaint.status === 'open' ? 'in-progress' : selectedComplaint.status,
                    responses: [...currentResponses, newResponse],
                    messages: arrayUnion(chatMessage),
                    updatedAt: Timestamp.fromDate(new Date()),
                });

                const text = response.trim();
                const preview = text.length > 40 ? text.slice(0, 40) + '...' : text;
                const orderInfo = selectedComplaint.orderId ? ` — Order ${selectedComplaint.orderId}` : '';

                // ✅ Notify User about admin reply
                if (selectedComplaint.userId) {
                    try {
                        await notifyUser(
                            selectedComplaint.userId,
                            'Admin Replied on Your Complaint 📩',
                            `Admin replied${orderInfo}: "${preview}"`,
                            'complaint',
                            selectedComplaint.id
                        );
                    } catch (e) { console.error('Failed to notify user:', e); }
                }

                // ✅ Notify Vendor about admin reply
                if (selectedComplaint.vendorId && selectedComplaint.vendorId !== selectedComplaint.userId) {
                    try {
                        await notifyUser(
                            selectedComplaint.vendorId,
                            'Admin Replied on Complaint 📩',
                            `Admin replied${orderInfo}: "${preview}"`,
                            'complaint',
                            selectedComplaint.id,
                            { vendorId: selectedComplaint.vendorId }
                        );
                    } catch (e) { console.error('Failed to notify vendor:', e); }
                }

                setResponse('');
                Alert.alert('Response Sent', 'Your response has been sent to the customer and vendor.');
            } catch (error) {
                console.error('Error sending response:', error);
                Alert.alert('Error', 'Failed to send response');
            }
        }
    };

    const openViewDialog = (complaint: Complaint) => {
        setSelectedComplaint(complaint);
        setShowDetailModal(true);
    };

    const openFullDetail = (complaint: Complaint) => {
        navigation.navigate('AdminTicketDetail', {
            ticketId: complaint.id,
            source: complaint.source || 'complaints',
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return '#ef4444';
            case 'in-progress': return '#f59e0b';
            case 'resolved': return '#10b981';
            default: return colors.textMuted;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#3b82f6';
            default: return colors.textMuted;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => selectionMode ? clearSelection() : navigation.goBack()}>
                    <Feather name={selectionMode ? 'x' : 'arrow-left'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>{selectionMode ? `${selectedIds.length} Selected` : 'Complaints'}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }}>
                        <Feather name={selectionMode ? 'check-square' : 'check-square'} size={22} color={selectionMode ? '#7c3aed' : colors.textMuted} />
                    </TouchableOpacity>
                    {!selectionMode && (
                        <TouchableOpacity onPress={() => navigation.navigate('TicketAnalytics')}>
                            <Feather name="bar-chart-2" size={22} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                    {!selectionMode && (
                        <TouchableOpacity onPress={() => setShowExportModal(true)}>
                            <Feather name="download" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                    {selectionMode && selectedIds.length === 2 && (
                        <TouchableOpacity onPress={() => setShowMergeModal(true)}>
                            <Feather name="git-merge" size={22} color="#7c3aed" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Stats Badges */}
            <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Feather name="alert-circle" size={14} color="#ef4444" />
                    <Text style={[styles.badgeText, { color: '#ef4444' }]}>{openCount} Open</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Feather name="clock" size={14} color="#f59e0b" />
                    <Text style={[styles.badgeText, { color: '#f59e0b' }]}>{inProgressCount} In Progress</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Feather name="alert-triangle" size={14} color="#ef4444" />
                    <Text style={[styles.badgeText, { color: '#ef4444' }]}>{highPriorityCount} High Priority</Text>
                </View>
                {escalatedCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                        <Feather name="alert-triangle" size={14} color="#8b5cf6" />
                        <Text style={[styles.badgeText, { color: '#8b5cf6' }]}>{escalatedCount} Escalated</Text>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading complaints...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredComplaints}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    ListHeaderComponent={
                        <>
                            {/* Search */}
                            <View style={styles.searchContainer}>
                                <Feather name="search" size={16} color={colors.textMuted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search complaints..."
                                    placeholderTextColor={colors.textMuted}
                                    value={search}
                                    onChangeText={setSearch}
                                />
                            </View>

                            {/* Status Filter */}
                            <Text style={styles.filterLabel}>Status</Text>
                            <View style={styles.filterRow}>
                                {(['all', 'open', 'in-progress', 'resolved', 'escalated'] as const).map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
                                        onPress={() => setStatusFilter(f)}
                                    >
                                        <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Priority Filter */}
                            <Text style={styles.filterLabel}>Priority</Text>
                            <View style={styles.filterRow}>
                                {(['all', 'high', 'medium', 'low'] as const).map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        style={[styles.filterChip, priorityFilter === f && styles.filterChipActive]}
                                        onPress={() => setPriorityFilter(f)}
                                    >
                                        <Text style={[styles.filterText, priorityFilter === f && styles.filterTextActive]}>{f}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.resultCount}>{filteredComplaints.length} complaints found</Text>
                        </>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.complaintCard, selectedIds.includes(item.id) && { borderColor: '#7c3aed', borderWidth: 2 }]}
                            onPress={() => selectionMode ? toggleSelect(item.id) : openFullDetail(item)}
                            onLongPress={() => { if (!selectionMode) { setSelectionMode(true); setSelectedIds([item.id]); } }}
                            activeOpacity={0.9}
                        >
                            {selectionMode && (
                                <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}>
                                    <Feather name={selectedIds.includes(item.id) ? 'check-square' : 'square'} size={20} color={selectedIds.includes(item.id) ? '#7c3aed' : '#94a3b8'} />
                                </View>
                            )}
                            <View style={styles.complaintHeader}>
                                <View style={styles.complaintIdRow}>
                                    <Text style={styles.complaintId}>{getDisplayId(item)}</Text>
                                    <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(item.priority)}15` }]}>
                                        <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>{item.priority}</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status.replace('-', ' ')}</Text>
                                </View>
                            </View>
                            <Text style={styles.complaintSubject} numberOfLines={1}>{item.subject}</Text>
                            <Text style={styles.complaintDescription} numberOfLines={2}>{item.description}</Text>
                            <View style={styles.complaintFooter}>
                                <View style={styles.customerInfo}>
                                    <Feather name="user" size={12} color={colors.textMuted} />
                                    <Text style={styles.customerName}>{item.customer}</Text>
                                </View>
                                <Text style={styles.complaintDate}>{formatDate(item.createdAt)}</Text>
                            </View>
                            {item.responses.length > 0 && (
                                <View style={styles.responseIndicator}>
                                    <Feather name="message-circle" size={12} color={colors.primary} />
                                    <Text style={styles.responseCount}>{item.responses.length} response{item.responses.length > 1 ? 's' : ''}</Text>
                                </View>
                            )}
                            {item.escalatedToAdmin && (
                                <View style={[styles.responseIndicator, { borderTopWidth: item.responses.length > 0 ? 0 : 1 }]}>
                                    <Feather name="alert-triangle" size={12} color="#8b5cf6" />
                                    <Text style={[styles.responseCount, { color: '#8b5cf6' }]}>Escalated: {item.escalationReason}</Text>
                                </View>
                            )}
                            {/* SLA Status Badge */}
                            {(() => {
                                const slaBadge = getSLAStatusBadge(item.sla);
                                if (!slaBadge || slaBadge.label === 'Within SLA') return null;
                                return (
                                    <View style={[styles.responseIndicator, { borderTopWidth: 0, backgroundColor: slaBadge.bgColor, borderRadius: 6, marginTop: 6, paddingHorizontal: 8, paddingVertical: 4 }]}>
                                        <Feather name={slaBadge.icon as any} size={12} color={slaBadge.color} />
                                        <Text style={[styles.responseCount, { color: slaBadge.color, fontWeight: '600' }]}>{slaBadge.label}</Text>
                                    </View>
                                );
                            })()}
                            {/* Unread Message Badge */}
                            {(() => {
                                const uid = auth.currentUser?.uid;
                                const msgs = item.messages || [];
                                if (!uid || !msgs.length) return null;
                                const lastRead = item.lastReadBy?.[uid];
                                const lastReadTime = lastRead?.toDate?.() ?? (lastRead ? new Date(lastRead) : null);
                                const unread = msgs.filter((m: any) => {
                                    if (m.senderId === uid || m.from === 'admin') return false;
                                    const msgTime = m.createdAt?.toDate?.() ?? (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt));
                                    if (!lastReadTime) return true;
                                    return msgTime > lastReadTime;
                                }).length;
                                if (unread === 0) return null;
                                return (
                                    <View style={[styles.responseIndicator, { borderTopWidth: 0 }]}>
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadCount}>{unread}</Text>
                                        </View>
                                        <Text style={[styles.responseCount, { color: '#ef4444', fontWeight: '600' }]}>{unread} unread message{unread > 1 ? 's' : ''}</Text>
                                    </View>
                                );
                            })()}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Feather name="check-circle" size={48} color="#10b981" />
                            <Text style={styles.emptyText}>No complaints found</Text>
                        </View>
                    }
                />
            )}

            {/* Complaint Detail Modal */}
            <Modal visible={showDetailModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.detailModalContent}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Complaint Details</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {selectedComplaint && (
                            <ScrollView style={styles.detailScroll}>
                                <View style={styles.detailTop}>
                                    <View style={styles.detailBadges}>
                                        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedComplaint.status)}15` }]}>
                                            <Text style={[styles.statusText, { color: getStatusColor(selectedComplaint.status) }]}>{selectedComplaint.status.replace('-', ' ')}</Text>
                                        </View>
                                        <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(selectedComplaint.priority)}15` }]}>
                                            <Text style={[styles.priorityText, { color: getPriorityColor(selectedComplaint.priority) }]}>{selectedComplaint.priority}</Text>
                                        </View>
                                        <View style={[styles.typeBadge]}>
                                            <Text style={styles.typeText}>{selectedComplaint.type}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.detailSubject}>{selectedComplaint.subject}</Text>
                                    <Text style={styles.detailDescription}>{selectedComplaint.description}</Text>
                                    <View style={styles.detailMeta}>
                                        <Text style={styles.detailCustomer}>{selectedComplaint.customer}</Text>
                                        <Text style={styles.detailEmail}>{selectedComplaint.customerEmail}</Text>
                                        <Text style={styles.detailDate}>{formatDate(selectedComplaint.createdAt)}</Text>
                                    </View>
                                </View>

                                {/* Responses */}
                                {selectedComplaint.responses.length > 0 && (
                                    <View style={styles.responsesSection}>
                                        <Text style={styles.responsesTitle}>Responses</Text>
                                        {selectedComplaint.responses.map((resp, i) => (
                                            <View key={i} style={styles.responseItem}>
                                                <Text style={styles.responseFrom}>{resp.from}</Text>
                                                <Text style={styles.responseMessage}>{resp.message}</Text>
                                                <Text style={styles.responseDate}>{formatDate(resp.date)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Reply */}
                                {selectedComplaint.status !== 'resolved' && (
                                    <View style={styles.replySection}>
                                        <Text style={styles.replyTitle}>Send Response</Text>
                                        <TextInput
                                            style={styles.replyInput}
                                            placeholder="Type your response..."
                                            placeholderTextColor={colors.textMuted}
                                            value={response}
                                            onChangeText={setResponse}
                                            multiline
                                        />
                                        <TouchableOpacity style={styles.sendBtn} onPress={handleSendResponse}>
                                            <Feather name="send" size={16} color="#fff" />
                                            <Text style={styles.sendBtnText}>Send Response</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Status Actions */}
                                <View style={styles.statusActions}>
                                    <Text style={styles.statusActionsTitle}>Update Status</Text>

                                    {/* Link Ticket Button */}
                                    <TouchableOpacity
                                        style={[styles.statusBtn, { backgroundColor: 'rgba(59,130,246,0.1)', marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
                                        onPress={() => { setLinkTargetId(selectedComplaint.id); setShowDetailModal(false); setShowLinkModal(true); }}
                                    >
                                        <Feather name="link" size={14} color="#3b82f6" />
                                        <Text style={[styles.statusBtnText, { color: '#3b82f6' }]}>Link to Another Ticket</Text>
                                    </TouchableOpacity>
                                    <View style={styles.statusBtnsRow}>
                                        {!['in-progress', 'in_progress'].includes(selectedComplaint.status) && (
                                            <TouchableOpacity
                                                style={[styles.statusBtn, { backgroundColor: 'rgba(245,158,11,0.1)' }]}
                                                onPress={() => { handleUpdateStatus(selectedComplaint.id, 'in-progress'); setShowDetailModal(false); }}
                                            >
                                                <Text style={[styles.statusBtnText, { color: '#f59e0b' }]}>In Progress</Text>
                                            </TouchableOpacity>
                                        )}
                                        {selectedComplaint.status !== 'resolved' && (
                                            <TouchableOpacity
                                                style={[styles.statusBtn, { backgroundColor: 'rgba(16,185,129,0.1)' }]}
                                                onPress={() => { handleUpdateStatus(selectedComplaint.id, 'resolved'); setShowDetailModal(false); }}
                                            >
                                                <Text style={[styles.statusBtnText, { color: '#10b981' }]}>Resolved</Text>
                                            </TouchableOpacity>
                                        )}
                                        {selectedComplaint.status !== 'closed' && (
                                            <TouchableOpacity
                                                style={[styles.statusBtn, { backgroundColor: 'rgba(107,114,128,0.1)' }]}
                                                onPress={() => {
                                                    Alert.alert('Close Ticket', 'Are you sure?', [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        { text: 'Close', onPress: () => { handleUpdateStatus(selectedComplaint.id, 'closed'); setShowDetailModal(false); } },
                                                    ]);
                                                }}
                                            >
                                                <Text style={[styles.statusBtnText, { color: '#6b7280' }]}>Close</Text>
                                            </TouchableOpacity>
                                        )}
                                        {selectedComplaint.status !== 'rejected' && (
                                            <TouchableOpacity
                                                style={[styles.statusBtn, { backgroundColor: 'rgba(239,68,68,0.05)' }]}
                                                onPress={() => {
                                                    Alert.alert('Reject Ticket', 'Are you sure?', [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        { text: 'Reject', style: 'destructive', onPress: () => { handleUpdateStatus(selectedComplaint.id, 'rejected'); setShowDetailModal(false); } },
                                                    ]);
                                                }}
                                            >
                                                <Text style={[styles.statusBtnText, { color: '#ef4444' }]}>Reject</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {['resolved', 'closed', 'rejected'].includes(selectedComplaint.status) && (
                                        <TouchableOpacity
                                            style={[styles.statusBtn, { backgroundColor: 'rgba(239,68,68,0.1)', marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
                                            onPress={() => {
                                                Alert.alert('Reopen Ticket', 'Are you sure you want to reopen this ticket?', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Reopen', style: 'destructive', onPress: () => { handleUpdateStatus(selectedComplaint.id, 'reopened'); setShowDetailModal(false); } },
                                                ]);
                                            }}
                                        >
                                            <Feather name="rotate-ccw" size={14} color="#ef4444" />
                                            <Text style={[styles.statusBtnText, { color: '#ef4444' }]}>Reopen Ticket</Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Priority Change */}
                                    <Text style={[styles.statusActionsTitle, { marginTop: 16 }]}>Change Priority</Text>
                                    <View style={styles.statusBtnsRow}>
                                        {(['high', 'medium', 'low'] as const).map(p => (
                                            <TouchableOpacity
                                                key={p}
                                                style={[
                                                    styles.statusBtn,
                                                    {
                                                        backgroundColor: selectedComplaint.priority === p ? `${getPriorityColor(p)}25` : '#f8fafc',
                                                        borderWidth: selectedComplaint.priority === p ? 1 : 0,
                                                        borderColor: selectedComplaint.priority === p ? getPriorityColor(p) : 'transparent',
                                                    },
                                                ]}
                                                onPress={() => {
                                                    if (selectedComplaint.priority !== p) {
                                                        handleChangePriority(selectedComplaint.id, p);
                                                        setSelectedComplaint({ ...selectedComplaint, priority: p });
                                                    }
                                                }}
                                            >
                                                <Text style={[styles.statusBtnText, { color: getPriorityColor(p), textTransform: 'capitalize' }]}>{p}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Bulk Actions Bar — detect collection per selection */}
            <BulkActionsBar
                selectedIds={selectedIds}
                collectionName={(() => {
                    // If all selected items are from the same collection, use that; otherwise default to complaints
                    const sources = complaints.filter(c => selectedIds.includes(c.id)).map(c => c.source);
                    const unique = [...new Set(sources)];
                    return unique.length === 1 ? unique[0] : 'complaints';
                })()}
                onClearSelection={clearSelection}
                onActionComplete={() => { }}
            />

            {/* Merge Modal (only when exactly 2 selected) */}
            {selectedIds.length === 2 && (
                <MergeTicketsModal
                    visible={showMergeModal}
                    tickets={complaints.filter(c => selectedIds.includes(c.id))}
                    onClose={() => setShowMergeModal(false)}
                    onMerged={() => { clearSelection(); }}
                />
            )}

            <LinkTicketsModal
                visible={showLinkModal}
                currentTicketId={linkTargetId}
                onClose={() => setShowLinkModal(false)}
                onLinked={() => { }}
            />

            {/* Export Modal */}
            <ExportModal
                visible={showExportModal}
                tickets={complaints}
                onClose={() => setShowExportModal(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },

    badgeRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: 4 },
    badgeText: { fontSize: fontSize.xs, fontWeight: '500' },

    list: { padding: spacing.lg, paddingTop: 0 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
    searchInput: { flex: 1, height: 44, fontSize: fontSize.base, color: colors.text, marginLeft: spacing.sm },

    filterLabel: { fontSize: fontSize.xs, fontWeight: '500', color: colors.textMuted, marginBottom: spacing.xs },
    filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', fontWeight: '500' },
    filterTextActive: { color: '#fff' },

    resultCount: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },

    complaintCard: { backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    complaintHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    complaintIdRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    complaintId: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted },
    priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
    priorityText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '500', textTransform: 'capitalize' },
    complaintSubject: { fontSize: fontSize.base, fontWeight: '600', color: colors.text, marginBottom: 4 },
    complaintDescription: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 18 },
    complaintFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    customerName: { fontSize: fontSize.xs, color: colors.textMuted },
    complaintDate: { fontSize: fontSize.xs, color: colors.textMuted },
    responseIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    responseCount: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500' },

    // Unread badge
    unreadBadge: {
        minWidth: 18, height: 18, borderRadius: 9,
        backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 4,
    },
    unreadCount: { fontSize: 10, fontWeight: '700', color: '#fff' },

    emptyState: { alignItems: 'center', padding: spacing.xl },
    emptyText: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.md },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl * 2 },
    loadingText: { marginTop: spacing.md, color: colors.textMuted, fontSize: fontSize.base },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    detailModalContent: { backgroundColor: '#fff', borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '90%' },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    detailTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    detailScroll: { padding: spacing.lg },
    detailTop: { marginBottom: spacing.lg },
    detailBadges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, backgroundColor: 'rgba(59,130,246,0.1)' },
    typeText: { fontSize: fontSize.xs, fontWeight: '500', color: '#3b82f6', textTransform: 'capitalize' },
    detailSubject: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    detailDescription: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
    detailMeta: { gap: 2 },
    detailCustomer: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    detailEmail: { fontSize: fontSize.xs, color: colors.textMuted },
    detailDate: { fontSize: fontSize.xs, color: colors.textMuted },

    responsesSection: { marginBottom: spacing.lg },
    responsesTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    responseItem: { backgroundColor: 'rgba(16,185,129,0.05)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
    responseFrom: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary, marginBottom: 4 },
    responseMessage: { fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
    responseDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },

    replySection: { marginBottom: spacing.lg },
    replyTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    replyInput: { backgroundColor: 'rgba(243,244,246,0.8)', borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.sm, color: colors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: spacing.sm },
    sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
    sendBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },

    statusActions: { marginBottom: spacing.xl },
    statusActionsTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    statusBtnsRow: { flexDirection: 'row', gap: spacing.sm },
    statusBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    statusBtnText: { fontSize: fontSize.sm, fontWeight: '600' },
});
