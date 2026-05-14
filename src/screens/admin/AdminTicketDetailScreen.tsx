import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, Image, Keyboard, StatusBar, StyleSheet, Alert,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { auth, db } from '../../services/firebaseConfig';
import { doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion, Timestamp, getDoc, addDoc, collection } from 'firebase/firestore';
import { TICKET_CATEGORIES } from '../../constants/ticketCategories';
import AttachmentPicker from '../../components/AttachmentPicker';
import InternalNotesPanel from '../../components/InternalNotesPanel';
import AuditTrailPanel from '../../components/AuditTrailPanel';
import MessageTemplatesModal from '../../components/MessageTemplatesModal';
import { logStatusChange, logReply } from '../../services/auditService';
import { notifyUser, notifyVendor } from '../../services/notifyHelper';

// ─── Types ───────────────────────────────────────────────────
interface TicketData {
    id: string;
    ticketId?: string;
    userId: string;
    userName: string;
    vendorId: string;
    vendorName?: string;
    vendorStoreName?: string;
    orderId: string;
    description: string;
    subject?: string;
    status: string;
    priority?: string;
    category?: string;
    productName?: string;
    userPhone?: string;
    userEmail?: string;
    createdAt: Date | any;
    updatedAt?: Date | null;
    messages?: TicketMessage[];
    internalNotes?: any[];
    auditTrail?: any[];
    assignedTo?: string;
    assignedToName?: string;
    source?: 'tickets' | 'complaints';
}

interface TicketMessage {
    from: 'user' | 'vendor' | 'admin';
    senderId: string;
    senderName: string;
    text: string;
    createdAt: Date | any;
    status?: 'sending' | 'sent' | 'delivered' | 'read';
    imageUrl?: string;
    fileName?: string;
}

// ─── Constants ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    new: { label: 'New', color: '#7c3aed' },
    open: { label: 'Open', color: '#ef4444' },
    in_progress: { label: 'In Progress', color: '#f59e0b' },
    'in-progress': { label: 'In Progress', color: '#f59e0b' },
    reopened: { label: 'Reopened', color: '#ef4444' },
    resolved: { label: 'Resolved', color: '#10b981' },
    closed: { label: 'Closed', color: '#6b7280' },
    rejected: { label: 'Rejected', color: '#6b7280' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    high: { label: 'High', color: '#ef4444', icon: 'alert-circle' },
    medium: { label: 'Medium', color: '#f59e0b', icon: 'alert-triangle' },
    low: { label: 'Low', color: '#3b82f6', icon: 'info' },
};

// ─── Message Ticks ───────────────────────────────────────────
function MessageTicks({ status, isAdmin }: { status?: string; isAdmin: boolean }) {
    if (!isAdmin) return null;
    const color = status === 'read' ? '#34d399' : status === 'delivered' ? '#60a5fa' : '#94a3b8';
    return (
        <View style={{ flexDirection: 'row', marginLeft: 4 }}>
            <Feather name="check" size={12} color={color} style={{ marginRight: -6 }} />
            {(['delivered', 'read'].includes(status || '')) && <Feather name="check" size={12} color={color} />}
        </View>
    );
}

// ─── Main Component ──────────────────────────────────────────
export default function AdminTicketDetailScreen({ route, navigation }: any) {
    const { ticketId, source } = route.params || {};
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'audit'>('chat');
    const [showTemplates, setShowTemplates] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Vendor profile state
    const [vendorProfile, setVendorProfile] = useState<{
        name: string; storeName: string; profilePic?: string; rating?: number; verified?: boolean;
    } | null>(null);

    // Determine collection (auto-detect)
    const [collectionName, setCollectionName] = useState(source || 'complaints');

    // ── Subscribe to ticket ──
    useEffect(() => {
        if (!ticketId) return;
        let unsubscribe: (() => void) | undefined;

        (async () => {
            // Auto-detect collection: check tickets first
            const ticketRef = doc(db, 'tickets', ticketId);
            const ticketSnap = await getDoc(ticketRef);
            const col = ticketSnap.exists() ? 'tickets' : 'complaints';
            setCollectionName(col);

            // Mark messages as read for admin (once on mount)
            const uid = auth.currentUser?.uid;
            if (uid) {
                updateDoc(doc(db, col, ticketId), { [`lastReadBy.${uid}`]: serverTimestamp() }).catch(() => { });
            }
            unsubscribe = onSnapshot(doc(db, col, ticketId), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setTicket({
                        id: snap.id,
                        ticketId: data.ticketId,
                        userId: data.userId || data.customerId || '',
                        userName: data.userName || data.customerName || 'Customer',
                        vendorId: data.vendorId || '',
                        vendorName: data.vendorName || '',
                        vendorStoreName: data.vendorStoreName || '',
                        orderId: data.orderId || '',
                        description: data.description || data.complaint || '',
                        subject: data.subject || '',
                        status: data.status || 'open',
                        priority: data.priority || 'medium',
                        category: data.category,
                        productName: data.productName,
                        userPhone: data.userPhone || data.customerPhone,
                        userEmail: data.userEmail || data.customerEmail,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                        messages: data.messages || [],
                        internalNotes: data.internalNotes || [],
                        auditTrail: data.auditTrail || [],
                        assignedTo: data.assignedTo,
                        assignedToName: data.assignedToName,
                        source: col as any,
                    });
                }
                setLoading(false);
            });
        })();

        return () => { if (unsubscribe) unsubscribe(); };
    }, [ticketId]);

    // ── Fetch Vendor Profile ──
    useEffect(() => {
        if (!ticket?.vendorId) return;
        const fetchVendor = async () => {
            try {
                const vendorSnap = await getDoc(doc(db, 'users', ticket.vendorId));
                if (vendorSnap.exists()) {
                    const vData = vendorSnap.data();
                    setVendorProfile({
                        name: vData.name || vData.displayName || 'Vendor',
                        storeName: vData.storeName || vData.businessName || 'Vendor Store',
                        profilePic: vData.profilePic || vData.photoURL || undefined,
                        rating: vData.rating || undefined,
                        verified: vData.verified || vData.isVerified || false,
                    });
                }
            } catch (e) {
                console.warn('Failed to fetch vendor profile', e);
            }
        };
        fetchVendor();
    }, [ticket?.vendorId]);

    // ── Send Reply ──
    const handleReply = async () => {
        if (!ticket?.id || !reply.trim()) return;
        setSending(true);
        Keyboard.dismiss();

        const adminName = 'Admin';
        const adminId = auth.currentUser?.uid || 'admin';

        const newMessage: TicketMessage = {
            from: 'admin',
            senderId: adminId,
            senderName: adminName,
            text: reply.trim(),
            createdAt: new Date(),
            status: 'sent',
        };

        try {
            await updateDoc(doc(db, collectionName, ticket.id), {
                messages: arrayUnion(newMessage),
                updatedAt: serverTimestamp(),
            });

            // Log audit event
            logReply(ticket.id, collectionName as any, adminName, 'admin');

            // Notify customer
            if (ticket.userId) {
                await notifyUser(
                    ticket.userId,
                    'Admin Reply 👨‍💼',
                    `Admin responded to your ticket ${ticket.ticketId || ticket.id.slice(-6)}.`,
                    'complaint',
                    ticket.id
                );
            }

            // Notify vendor (if involved)
            if (ticket.vendorId) {
                await notifyVendor(
                    ticket.vendorId,
                    'Admin Reply 👨‍💼',
                    `Admin responded on ticket ${ticket.ticketId || ticket.id.slice(-6)}.`,
                    'complaint',
                    ticket.id
                );
            }

            setReply('');
        } catch (error) {
            console.error('Error sending reply:', error);
            Alert.alert('Error', 'Failed to send reply');
        }
        setSending(false);
    };

    // ── Send Image ──
    const handleImageReady = async (imageUrl: string, fileName: string) => {
        if (!ticket?.id) return;
        const adminId = auth.currentUser?.uid || 'admin';
        const imgMessage: TicketMessage = {
            from: 'admin',
            senderId: adminId,
            senderName: 'Admin',
            text: '📷 Photo',
            imageUrl,
            fileName,
            createdAt: new Date(),
            status: 'sent',
        };
        try {
            await updateDoc(doc(db, collectionName, ticket.id), {
                messages: arrayUnion(imgMessage),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to send image');
        }
    };

    // ── Status Change ──
    const handleStatusChange = async (newStatus: string) => {
        if (!ticket?.id) return;
        try {
            const updateData: any = {
                status: newStatus,
                updatedAt: serverTimestamp(),
            };
            if (newStatus === 'resolved') updateData.resolvedAt = serverTimestamp();
            if (newStatus === 'closed') updateData.closedAt = serverTimestamp();

            await updateDoc(doc(db, collectionName, ticket.id), updateData);

            // Log audit
            logStatusChange(ticket.id, collectionName as any, ticket.status, newStatus, 'Admin', 'admin');

            // Notify customer
            if (ticket.userId) {
                const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
                await notifyUser(
                    ticket.userId,
                    `Ticket ${statusLabel} ${newStatus === 'resolved' ? '✅' : newStatus === 'closed' ? '🔒' : '🔄'}`,
                    `Your ticket ${ticket.ticketId || ticket.id.slice(-6)} has been ${statusLabel.toLowerCase()} by admin.`,
                    'complaint',
                    ticket.id,
                    { status: newStatus }
                );
            }

            Alert.alert('Success', `Ticket marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
        } catch (error) {
            console.error('Status change error:', error);
            Alert.alert('Error', 'Failed to update status');
        }
    };

    // ── Priority Change ──
    const handlePriorityChange = async (newPriority: string) => {
        if (!ticket?.id) return;
        try {
            await updateDoc(doc(db, collectionName, ticket.id), {
                priority: newPriority,
                updatedAt: serverTimestamp(),
            });
            Alert.alert('Priority Updated', `Priority changed to ${newPriority}.`);
        } catch (error) {
            Alert.alert('Error', 'Failed to update priority');
        }
    };

    // ── Assign Ticket ──
    const handleAssign = () => {
        // Assignment is done via admin panel; this is a placeholder for future UI
        Alert.alert('Assign Ticket', 'Use the admin panel to assign this ticket to a vendor/agent.');
    };

    // ── Helpers ──
    const formatTime = (date: Date | any) => {
        try {
            const d = date?.toDate?.() ?? new Date(date);
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    const formatFullDate = (date: Date | any) => {
        try {
            const d = date?.toDate?.() ?? new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return 'N/A'; }
    };

    const getDisplayId = () => ticket?.ticketId || `#${ticket?.id?.slice(-6).toUpperCase()}`;

    const getCategoryInfo = (cat?: string) => {
        const cats = TICKET_CATEGORIES as Record<string, any>;
        const found = Object.values(cats).find((c: any) => c.id === cat);
        return found || { label: cat || 'General', icon: 'tag' };
    };

    // ── Loading ──
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!ticket) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Ticket</Text>
                    <View />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={{ color: colors.textMuted }}>Ticket not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
    const priorityCfg = PRIORITY_CONFIG[ticket.priority || 'medium'] || PRIORITY_CONFIG.medium;
    const categoryInfo = getCategoryInfo(ticket.category);
    const canReply = !['closed'].includes(ticket.status);
    const isTerminal = ['resolved', 'rejected', 'closed'].includes(ticket.status);

    // Prepare messages for display
    const rawMessages = ticket.messages ?? [];
    const hasInitialInMessages = rawMessages.length > 0 && rawMessages[0].from === 'user';
    const displayMessages: TicketMessage[] =
        ticket.description && (rawMessages.length === 0 || !hasInitialInMessages)
            ? [{ from: 'user', senderId: ticket.userId, senderName: ticket.userName, text: ticket.description, createdAt: ticket.createdAt }, ...rawMessages]
            : rawMessages;

    return (
        <>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>{getDisplayId()}</Text>
                        <Text style={styles.headerSubtitle}>{ticket.userName} • {ticket.subject || ticket.category || 'Ticket'}</Text>
                    </View>
                    <View />
                </View>

                {/* Info Bar — Status, Priority, Category */}
                <View style={styles.infoBar}>
                    <View style={[styles.badge, { backgroundColor: statusCfg.color + '15' }]}>
                        <View style={[styles.badgeDot, { backgroundColor: statusCfg.color }]} />
                        <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.badge, { backgroundColor: priorityCfg.color + '15' }]}
                        onPress={() => {
                            const priorities = ['high', 'medium', 'low'];
                            const next = priorities[(priorities.indexOf(ticket.priority || 'medium') + 1) % 3];
                            handlePriorityChange(next);
                        }}
                    >
                        <Feather name={priorityCfg.icon as any} size={11} color={priorityCfg.color} />
                        <Text style={[styles.badgeText, { color: priorityCfg.color }]}>{priorityCfg.label}</Text>
                        <Feather name="chevron-down" size={10} color={priorityCfg.color} />
                    </TouchableOpacity>
                    <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
                        <Feather name={(categoryInfo as any).icon || 'tag'} size={11} color="#6b7280" />
                        <Text style={[styles.badgeText, { color: '#6b7280' }]}>{(categoryInfo as any).label}</Text>
                    </View>
                </View>

                {/* Vendor & Order Info Card */}
                {(ticket.vendorId || ticket.orderId) && (
                    <View style={styles.vendorOrderCard}>
                        {/* Vendor Profile */}
                        {ticket.vendorId && (
                            <TouchableOpacity
                                style={styles.vendorRow}
                                onPress={() => navigation.navigate('VendorPublicStore', { vendorId: ticket.vendorId })}
                                activeOpacity={0.7}
                            >
                                {vendorProfile?.profilePic ? (
                                    <Image source={{ uri: vendorProfile.profilePic }} style={styles.vendorAvatar} />
                                ) : (
                                    <View style={styles.vendorAvatarPlaceholder}>
                                        <Feather name="shopping-bag" size={18} color="#fff" />
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.vendorName}>
                                            {vendorProfile?.storeName || ticket.vendorStoreName || 'Vendor Store'}
                                        </Text>
                                        {vendorProfile?.verified && (
                                            <View style={styles.verifiedBadge}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                        <View style={styles.vendorTag}>
                                            <Feather name="shopping-bag" size={9} color="#8b5cf6" />
                                            <Text style={styles.vendorTagText}>Vendor</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.vendorSubName}>
                                        {vendorProfile?.name || ticket.vendorName || 'Vendor'}
                                        {vendorProfile?.rating ? ` • ⭐ ${vendorProfile.rating.toFixed(1)}` : ''}
                                    </Text>
                                </View>
                                <Feather name="chevron-right" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}

                        {/* Order Number */}
                        {ticket.orderId && (
                            <View style={styles.orderRow}>
                                <Feather name="package" size={14} color={colors.primary} />
                                <Text style={styles.orderLabel}>Order:</Text>
                                <Text style={styles.orderNumber}>{ticket.orderId}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Contact & Meta */}
                <View style={styles.metaBar}>
                    <View style={styles.metaItem}>
                        <Feather name="user" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{ticket.userName}</Text>
                    </View>
                    {ticket.userPhone && (
                        <View style={styles.metaItem}>
                            <Feather name="phone" size={12} color={colors.textMuted} />
                            <Text style={styles.metaText}>{ticket.userPhone}</Text>
                        </View>
                    )}
                    {ticket.userEmail && (
                        <View style={styles.metaItem}>
                            <Feather name="mail" size={12} color={colors.textMuted} />
                            <Text style={styles.metaText}>{ticket.userEmail}</Text>
                        </View>
                    )}
                    {ticket.assignedToName && (
                        <View style={styles.metaItem}>
                            <Feather name="user-check" size={12} color={colors.primary} />
                            <Text style={[styles.metaText, { color: colors.primary, fontWeight: '600' }]}>Assigned: {ticket.assignedToName}</Text>
                        </View>
                    )}
                    <View style={styles.metaItem}>
                        <Feather name="calendar" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{formatFullDate(ticket.createdAt)}</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
                        onPress={() => setActiveTab('chat')}
                    >
                        <Feather name="message-circle" size={14} color={activeTab === 'chat' ? colors.primary : '#94a3b8'} />
                        <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'notes' && styles.tabActive]}
                        onPress={() => setActiveTab('notes')}
                    >
                        <Feather name="file-text" size={14} color={activeTab === 'notes' ? '#f59e0b' : '#94a3b8'} />
                        <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
                            {'Notes'}{ticket.internalNotes && ticket.internalNotes.length ? ` (${ticket.internalNotes.length})` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'audit' && styles.tabActive]}
                        onPress={() => setActiveTab('audit')}
                    >
                        <Feather name="clock" size={14} color={activeTab === 'audit' ? '#6366f1' : '#94a3b8'} />
                        <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>Audit</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'notes' ? (
                    <InternalNotesPanel
                        ticketId={ticket.id}
                        collectionName={collectionName}
                        notes={ticket.internalNotes || []}
                        userRole="admin"
                    />
                ) : activeTab === 'audit' ? (
                    <AuditTrailPanel auditTrail={ticket.auditTrail || []} />
                ) : (
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                        {/* Messages */}
                        <FlatList
                            ref={flatListRef}
                            data={displayMessages}
                            keyExtractor={(_, i) => String(i)}
                            contentContainerStyle={styles.messagesList}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            renderItem={({ item }) => {
                                const isAdmin = item.from === 'admin';
                                const isVendor = item.from === 'vendor';
                                return (
                                    <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : isVendor ? styles.bubbleVendor : styles.bubbleCustomer]}>
                                        <Text style={styles.bubbleSenderName}>
                                            {item.from === 'admin' ? '👨‍💼 Admin' : item.from === 'vendor' ? '🏪 ' + (item.senderName || 'Vendor') : '👤 ' + (item.senderName || 'Customer')}
                                        </Text>
                                        {item.imageUrl && (
                                            <TouchableOpacity activeOpacity={0.9}>
                                                <Image source={{ uri: item.imageUrl }} style={styles.chatImage} resizeMode="cover" />
                                            </TouchableOpacity>
                                        )}
                                        {(!item.imageUrl || (item.text && item.text !== '📷 Photo')) && (
                                            <Text style={[styles.bubbleText, isAdmin && styles.bubbleTextAdmin]}>{item.text}</Text>
                                        )}
                                        <View style={styles.bubbleFooter}>
                                            <Text style={[styles.bubbleTime, isAdmin && styles.bubbleTimeAdmin]}>{formatTime(item.createdAt)}</Text>
                                            <MessageTicks status={item.status} isAdmin={isAdmin} />
                                        </View>
                                    </View>
                                );
                            }}
                        />

                        {/* Reply Input */}
                        {canReply && (
                            <View style={styles.inputRow}>
                                <AttachmentPicker
                                    ticketId={ticket?.id || ''}
                                    onImageReady={handleImageReady}
                                    disabled={sending}
                                />
                                <TouchableOpacity style={styles.templateBtn} onPress={() => setShowTemplates(true)}>
                                    <Feather name="zap" size={18} color={colors.primary} />
                                </TouchableOpacity>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Reply as admin..."
                                    placeholderTextColor={colors.textMuted}
                                    value={reply}
                                    onChangeText={setReply}
                                    multiline
                                    maxLength={2000}
                                    editable={!sending}
                                />
                                <TouchableOpacity
                                    style={[styles.sendBtn, (!reply.trim() || sending) && styles.sendBtnDisabled]}
                                    onPress={handleReply}
                                    disabled={!reply.trim() || sending}
                                >
                                    {sending ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Feather name="send" size={18} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.actionsRow}>
                            {(ticket.status === 'open' || ticket.status === 'new' || ticket.status === 'reopened') && (
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatusChange('in-progress')}>
                                    <Feather name="clock" size={14} color="#f59e0b" />
                                    <Text style={styles.actionBtnText}>In Progress</Text>
                                </TouchableOpacity>
                            )}
                            {!isTerminal && (
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => handleStatusChange('resolved')}>
                                    <Feather name="check-circle" size={14} color="#10b981" />
                                    <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Resolve</Text>
                                </TouchableOpacity>
                            )}
                            {!isTerminal && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]}
                                    onPress={() => Alert.alert('Close Ticket', 'Are you sure?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Close', onPress: () => handleStatusChange('closed') },
                                    ])}
                                >
                                    <Feather name="lock" size={14} color="#6b7280" />
                                    <Text style={[styles.actionBtnText, { color: '#6b7280' }]}>Close</Text>
                                </TouchableOpacity>
                            )}
                            {isTerminal && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                                    onPress={() => Alert.alert('Reopen Ticket', 'Are you sure?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Reopen', style: 'destructive', onPress: () => handleStatusChange('reopened') },
                                    ])}
                                >
                                    <Feather name="rotate-ccw" size={14} color="#ef4444" />
                                    <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Reopen</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>

            {/* Message Templates Modal */}
            <MessageTemplatesModal
                visible={showTemplates}
                onClose={() => setShowTemplates(false)}
                onSelect={(text) => setReply(text)}
                variables={{
                    customerName: ticket?.userName || 'Customer',
                    orderId: ticket?.orderId?.slice(-8) || 'N/A',
                    ticketId: ticket?.ticketId || ticket?.id?.slice(-6) || 'N/A',
                }}
            />
        </>
    );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
        gap: 12,
    },
    backBtn: { padding: 4 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    // Info Bar
    infoBar: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8,
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 11, fontWeight: '600' },

    // Meta Bar
    metaBar: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12,
        backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: colors.textMuted },

    // Tabs
    tabRow: {
        flexDirection: 'row', backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
    tabTextActive: { color: colors.primary, fontWeight: '600' },

    // Messages
    messagesList: { paddingHorizontal: 14, paddingVertical: 10, paddingBottom: 10 },
    bubble: {
        maxWidth: '85%', padding: 10, borderRadius: 16, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
    },
    bubbleCustomer: {
        alignSelf: 'flex-start', backgroundColor: '#fff',
        borderBottomLeftRadius: 4, marginRight: '15%',
    },
    bubbleVendor: {
        alignSelf: 'flex-start', backgroundColor: '#fefce8',
        borderBottomLeftRadius: 4, marginRight: '15%',
    },
    bubbleAdmin: {
        alignSelf: 'flex-end', backgroundColor: '#ede9fe',
        borderBottomRightRadius: 4, marginLeft: '15%',
    },
    bubbleSenderName: { fontSize: 11, color: colors.primary, fontWeight: '700', marginBottom: 3 },
    bubbleText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    bubbleTextAdmin: { color: '#4c1d95' },
    bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
    bubbleTime: { fontSize: 10, color: '#94a3b8' },
    bubbleTimeAdmin: { color: '#7c3aed' },
    chatImage: { width: 200, height: 200, borderRadius: 10, marginVertical: 6 },

    // Input
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
        paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    },
    templateBtn: {
        padding: 8, borderRadius: 20, backgroundColor: `${colors.primary}10`,
    },
    input: {
        flex: 1, fontSize: 14, color: colors.text,
        maxHeight: 100, paddingHorizontal: 14, paddingVertical: 8,
        backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },

    // Action Buttons
    actionsRow: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8,
        paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: '#f59e0b' },

    // Vendor & Order Card
    vendorOrderCard: {
        backgroundColor: '#fff', marginHorizontal: 0,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
        paddingVertical: 8,
    },
    vendorRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 6,
    },
    vendorAvatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0',
    },
    vendorAvatarPlaceholder: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    vendorName: {
        fontSize: 14, fontWeight: '700', color: colors.text,
    },
    vendorSubName: {
        fontSize: 12, color: colors.textMuted, marginTop: 1,
    },
    verifiedBadge: {
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
    },
    vendorTag: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    },
    vendorTagText: { fontSize: 9, fontWeight: '700', color: '#8b5cf6' },
    orderRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 6,
        marginTop: 2, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)',
    },
    orderLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    orderNumber: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
