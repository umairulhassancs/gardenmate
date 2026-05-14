import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
    Animated, Image, Keyboard, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { auth, db } from '../services/firebaseConfig';
import { doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion, Timestamp, getDoc } from 'firebase/firestore';
import { setActiveTicket, setUserOnline, setTypingStatus, subscribeToPresence } from '../services/presenceService';
import { notifyVendor, notifyAdmins } from '../services/notifyHelper';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';
import type { TicketCategory, TicketPriority } from '../types/ticket';
import AttachmentPicker from '../components/AttachmentPicker';
import CSATSurveyModal from '../components/CSATSurveyModal';

// ─── Types ───────────────────────────────────────────────────
interface TicketData {
    id: string;
    ticketId?: string;
    userId: string;
    userName: string;
    vendorId: string;
    vendorStoreName?: string;
    orderId: string;
    description: string;
    subject?: string;
    status: string;
    priority?: TicketPriority;
    category?: TicketCategory;
    createdAt: Date | any;
    updatedAt?: Date | any;
    messages?: MessageItem[];
    sla?: { firstResponseDue?: Date; resolutionDue?: Date; isOverdue?: boolean };
    source?: 'tickets' | 'complaints';
}

interface MessageItem {
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
const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    critical: { label: 'Critical', color: '#dc2626', icon: 'zap' },
    high: { label: 'High', color: '#ea580c', icon: 'arrow-up' },
    medium: { label: 'Medium', color: '#ca8a04', icon: 'minus' },
    low: { label: 'Low', color: '#16a34a', icon: 'arrow-down' },
};

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

// ─── Message Status Ticks Component ──────────────────────────
function MessageTicks({ status, isUser }: { status?: string; isUser: boolean }) {
    if (!isUser) return null;
    const isRead = status === 'read';
    const isDelivered = status === 'delivered';
    const isSent = status === 'sent';
    const isSending = status === 'sending';

    if (isSending) {
        return <Feather name="clock" size={10} color="rgba(255,255,255,0.6)" />;
    }
    if (isSent) {
        return <Text style={[styles.ticks, { color: 'rgba(255,255,255,0.7)' }]}>✓</Text>;
    }
    if (isDelivered) {
        return <Text style={[styles.ticks, { color: 'rgba(255,255,255,0.7)', fontWeight: '600' }]}>✓✓</Text>;
    }
    if (isRead) {
        return <Text style={[styles.ticks, { color: '#34d399', fontWeight: '700' }]}>✓✓</Text>;
    }
    // Default: sent
    return <Text style={[styles.ticks, { color: 'rgba(255,255,255,0.7)' }]}>✓</Text>;
}

// ─── Typing Animation Component ─────────────────────────────
function TypingIndicator({ name }: { name: string }) {
    const [dots, setDots] = useState('');
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(d => d.length >= 3 ? '' : d + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <View style={styles.typingBubble}>
            <Text style={styles.typingText}>{name} is typing{dots}</Text>
        </View>
    );
}

// ─── Main Component ──────────────────────────────────────────
export default function TicketDetailScreen({ route, navigation }: any) {
    const { ticket: initialTicket } = route.params || {};
    const [ticket, setTicket] = useState<TicketData | null>(initialTicket || null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [collectionName, setCollectionName] = useState<'complaints' | 'tickets'>('complaints');
    const [vendorStoreName, setVendorStoreName] = useState<string>('');
    const [vendorProfilePic, setVendorProfilePic] = useState<string>('');
    const flatListRef = useRef<FlatList>(null);
    const currentUserId = auth.currentUser?.uid;
    const [showCSAT, setShowCSAT] = useState(false);
    const prevStatusRef = useRef<string | null>(null);
    const [otherPartyTyping, setOtherPartyTyping] = useState(false);
    const typingTimeoutRef = useRef<any>(null);

    // ── Detect collection + subscribe to real-time updates ──
    useEffect(() => {
        if (!initialTicket?.id) return;

        let unsub: (() => void) | undefined;

        (async () => {
            try {
                // Auto-detect: tickets or complaints?
                const ticketRef = doc(db, 'tickets', initialTicket.id);
                const ticketSnap = await getDoc(ticketRef);
                const col = ticketSnap.exists() ? 'tickets' : 'complaints';
                setCollectionName(col);

                const ref = doc(db, col, initialTicket.id);

                // Mark messages as read for this user (once on mount)
                const uid = auth.currentUser?.uid;
                if (uid) {
                    updateDoc(ref, { [`lastReadBy.${uid}`]: serverTimestamp() }).catch(() => { });
                }

                unsub = onSnapshot(ref, (snap) => {
                    if (!snap.exists()) return;
                    const d = snap.data()!;
                    const messages = (d.messages || []).map((m: any) => ({
                        ...m,
                        createdAt: m.createdAt?.toDate?.() ?? new Date(m.createdAt),
                    }));
                    setTicket({
                        id: snap.id,
                        ticketId: d.ticketId,
                        userId: d.userId || d.customerId || '',
                        userName: d.userName || d.customerName || 'Customer',
                        vendorId: d.vendorId || '',
                        vendorStoreName: d.vendorStoreName,
                        orderId: d.orderId || '',
                        description: d.description || '',
                        subject: d.subject,
                        status: d.status || 'open',
                        priority: d.priority,
                        category: d.category || d.issue,
                        createdAt: d.createdAt?.toDate?.() ?? new Date(),
                        updatedAt: d.updatedAt?.toDate?.() ?? null,
                        messages,
                        sla: d.sla ? {
                            firstResponseDue: d.sla.firstResponseDue?.toDate?.() ?? null,
                            resolutionDue: d.sla.resolutionDue?.toDate?.() ?? null,
                            isOverdue: d.sla.isOverdue ?? false,
                        } : undefined,
                        source: col,
                    });

                    // Detect status change to 'resolved' -> show CSAT after a short delay
                    const newStatus = d.status || 'open';
                    if (prevStatusRef.current && prevStatusRef.current !== 'resolved' && newStatus === 'resolved' && !d.csatRating) {
                        setTimeout(() => setShowCSAT(true), 3000); // 3s delay to avoid jarring UX
                    }
                    prevStatusRef.current = newStatus;
                });
            } catch (err) {
                console.error('Error setting up ticket listener:', err);
            }
        })();

        return () => unsub?.();
    }, [initialTicket?.id]);

    // ── Fetch vendor store name and profile pic ──
    useEffect(() => {
        if (!ticket?.vendorId) return;
        (async () => {
            try {
                const vendorSnap = await getDoc(doc(db, 'vendors', ticket.vendorId));
                if (vendorSnap.exists()) {
                    const d = vendorSnap.data();
                    setVendorStoreName(d.storeName || d.vendorName || d.displayName || 'Vendor Store');
                    setVendorProfilePic(d.logoUrl || d.profileImage || '');
                } else {
                    // Fallback to ticket's vendorStoreName if vendor doc doesn't exist
                    setVendorStoreName(ticket.vendorStoreName || 'Vendor Store');
                }
            } catch (err) {
                console.error('Error fetching vendor:', err);
                setVendorStoreName(ticket.vendorStoreName || 'Vendor Store');
            }
        })();
    }, [ticket?.vendorId]);



    // ── Set current user as active on this ticket ──
    useEffect(() => {
        if (!currentUserId || !ticket?.id) return;
        setUserOnline(currentUserId, true);
        setActiveTicket(currentUserId, ticket.id);
        return () => {
            setActiveTicket(currentUserId, null);
        };
    }, [currentUserId, ticket?.id]);

    // ── Subscribe to OTHER party's typing status ──
    // If I'm the vendor, watch the customer. If I'm the customer, watch the vendor.
    const isCurrentUserVendor = currentUserId === ticket?.vendorId;
    const otherPartyId = isCurrentUserVendor ? ticket?.userId : ticket?.vendorId;

    useEffect(() => {
        if (!otherPartyId || !ticket?.id) return;
        const unsub = subscribeToPresence(otherPartyId, (presence) => {
            setOtherPartyTyping(
                presence?.typing?.ticketId === ticket.id
            );
        });
        return () => unsub();
    }, [otherPartyId, ticket?.id]);

    // ── Handle typing ──
    const handleTextChange = useCallback((text: string) => {
        setReply(text);
        // Send typing status
        if (currentUserId && ticket?.id) {
            setTypingStatus(currentUserId, ticket.id);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setTypingStatus(currentUserId, null);
            }, 3000);
        }
    }, [currentUserId, ticket?.id]);

    // ── Build message list – use ACTUAL status from DB (real read receipts) ──
    const rawMessages = ticket?.messages ?? [];
    const hasInitialInMessages = rawMessages.length > 0 && rawMessages[0].from === 'user';
    const messages: MessageItem[] = useMemo(() => {
        if (!ticket) return [];

        // Use actual status from Firestore – no guessing!
        // Status is updated to 'read' by VendorComplaintDetailScreen when vendor views ticket
        let msgList: MessageItem[] = rawMessages.map(m => ({
            ...m,
            status: (m.status || 'sent') as MessageItem['status'],
        }));

        // Add initial description as first message if needed
        if (ticket.description && (msgList.length === 0 || !hasInitialInMessages)) {
            const initialMsg: MessageItem = {
                from: 'user' as const,
                senderId: ticket.userId,
                senderName: ticket.userName,
                text: ticket.description,
                createdAt: ticket.createdAt,
                status: 'sent',
            };
            msgList = [initialMsg, ...msgList];
        }

        return msgList;
    }, [ticket, rawMessages, hasInitialInMessages]);

    const canReply = ticket && !['resolved', 'closed', 'rejected'].includes(ticket.status) && !!currentUserId;
    const canConfirmClose = ticket && ['resolved', 'rejected'].includes(ticket.status);

    // ── Send Reply ──
    const handleSendReply = async () => {
        const text = reply.trim();
        if (!text || !ticket?.id || !currentUserId) return;
        setSending(true);
        try {
            const ref = doc(db, collectionName, ticket.id);
            const newMsg = {
                from: 'user' as const, senderId: currentUserId,
                senderName: ticket.userName || 'Customer', text,
                createdAt: Timestamp.fromDate(new Date()),
                status: 'sent',
            };
            await updateDoc(ref, {
                messages: arrayUnion(newMsg), updatedAt: serverTimestamp(),
                ...(ticket.status === 'open' || ticket.status === 'new' ? { status: 'in_progress' } : {}),
            });

            // Notify Vendor
            if (ticket.vendorId) {
                const ticketLabel = ticket.ticketId || `#${ticket.id.slice(-8)}`;
                await notifyVendor(
                    ticket.vendorId,
                    `New Message 📩 ${ticketLabel}`,
                    `${ticket.userName || 'Customer'}: "${text.length > 40 ? text.slice(0, 40) + '...' : text}"`,
                    'complaint',
                    ticket.id
                );
            }

            // Notify Admins
            try {
                const ticketLabel = ticket.ticketId || `#${ticket.id.slice(-8)}`;
                await notifyAdmins('Ticket Update 📩',
                    `${ticket.userName || 'Customer'} replied on ${ticketLabel}: "${text.length > 40 ? text.slice(0, 40) + '...' : text}"`,
                    ticket.id, 'complaint');
            } catch (adminErr) { console.error('Failed to notify admins:', adminErr); }

            setReply('');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    // ── Send Image ──
    const handleImageReady = async (imageUrl: string, fileName: string) => {
        if (!ticket?.id || !currentUserId) return;
        try {
            const ref = doc(db, collectionName, ticket.id);
            const newMsg = {
                from: 'user' as const, senderId: currentUserId,
                senderName: ticket.userName || 'Customer',
                text: '📷 Photo',
                imageUrl,
                fileName,
                createdAt: Timestamp.fromDate(new Date()),
                status: 'sent',
            };
            await updateDoc(ref, {
                messages: arrayUnion(newMsg), updatedAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('Error sending image:', err);
            Alert.alert('Error', 'Failed to send image');
        }
    };

    // ── Close Ticket ──
    const handleConfirmClose = async () => {
        if (!ticket?.id) return;
        try {
            await updateDoc(doc(db, collectionName, ticket.id), { status: 'closed', updatedAt: serverTimestamp() });
            Alert.alert('Ticket Closed', 'This ticket is now closed.');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to close ticket');
        }
    };

    // ── Reopen Ticket ──
    const handleReopenTicket = async () => {
        if (!ticket?.id) return;
        Alert.alert('Reopen Ticket', 'Are you sure you want to reopen this ticket?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reopen', onPress: async () => {
                    try {
                        const oldStatus = ticket.status;
                        await updateDoc(doc(db, collectionName, ticket.id), {
                            status: 'reopened',
                            updatedAt: serverTimestamp(),
                        });
                        // Log audit trail
                        try {
                            const { logStatusChange } = require('../services/auditService');
                            logStatusChange(ticket.id, collectionName, oldStatus, 'reopened', ticket.userName || 'User', 'user');
                        } catch (_) { /* audit logging is non-critical */ }
                        // Notify vendor
                        if (ticket.vendorId) {
                            await notifyVendor(
                                ticket.vendorId,
                                'Ticket Reopened 🔄',
                                `Customer reopened ticket ${ticket.ticketId || ticket.id.slice(-8)}`,
                                'complaint',
                                ticket.id
                            );
                        }
                        Alert.alert('Ticket Reopened', 'The ticket has been reopened.');
                    } catch (e) {
                        console.error(e);
                        Alert.alert('Error', 'Failed to reopen ticket');
                    }
                }
            }
        ]);
    };
    const canReopen = ticket && ['closed', 'resolved'].includes(ticket.status);

    // ── Helpers ──
    const formatTime = (date: Date | any) => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    const formatFullDate = (date: Date | any) => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getDisplayId = () => {
        if (ticket?.ticketId) return ticket.ticketId;
        return `#${ticket?.id?.slice(-8)?.toUpperCase() || ''}`;
    };

    const getVendorDisplayName = () => {
        return vendorStoreName || 'Vendor Support';
    };

    const onVendorNamePress = () => {
        if (ticket?.vendorId) {
            // Try to navigate to vendor store profile
            try {
                navigation.navigate('VendorPublicStore', { vendorId: ticket.vendorId });
            } catch {
                // Fallback: navigate to vendor store or show alert
                Alert.alert(getVendorDisplayName(), `Vendor ID: ${ticket.vendorId}`);
            }
        }
    };

    // ── Empty State ──
    if (!ticket) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Ticket</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}><Text style={styles.emptyText}>Ticket not found</Text></View>
            </SafeAreaView>
        );
    }

    const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
    const priorityCfg = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null;
    const categoryInfo = ticket.category && TICKET_CATEGORIES[ticket.category]
        ? { icon: TICKET_CATEGORIES[ticket.category].icon, label: TICKET_CATEGORIES[ticket.category].label }
        : null;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.contentContainer}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                {/* ─── Header with vendor presence ─── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerCenter} onPress={onVendorNamePress} activeOpacity={0.7}>
                        {/* Vendor Avatar */}
                        <View style={styles.avatarContainer}>
                            {vendorProfilePic ? (
                                <Image source={{ uri: vendorProfilePic }} style={styles.avatarImage} />
                            ) : (
                                <View style={styles.avatar}>
                                    <Feather name="shopping-bag" size={16} color="#fff" />
                                </View>
                            )}
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={styles.vendorName} numberOfLines={1}>{getVendorDisplayName()}</Text>
                            <Text style={styles.presenceText}>Tap to view store</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={{ width: 40 }} />
                </View>

                {/* ─── Ticket Info Bar ─── */}
                <View style={styles.infoBar}>
                    <View style={styles.infoRow}>
                        {/* Status Badge */}
                        <View style={[styles.infoBadge, { backgroundColor: statusCfg.color + '15' }]}>
                            <View style={[styles.infoDot, { backgroundColor: statusCfg.color }]} />
                            <Text style={[styles.infoBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                        </View>
                        {/* Priority Badge */}
                        {priorityCfg && (
                            <View style={[styles.infoBadge, { backgroundColor: priorityCfg.color + '12' }]}>
                                <Feather name={priorityCfg.icon as any} size={11} color={priorityCfg.color} />
                                <Text style={[styles.infoBadgeText, { color: priorityCfg.color }]}>{priorityCfg.label}</Text>
                            </View>
                        )}
                        {/* Category Badge */}
                        {categoryInfo && (
                            <View style={[styles.infoBadge, { backgroundColor: '#f1f5f9' }]}>
                                <Feather name={categoryInfo.icon as any} size={11} color="#475569" />
                                <Text style={[styles.infoBadgeText, { color: '#475569' }]}>{categoryInfo.label}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.infoMetaRow}>
                        <Text style={styles.infoMeta}>{getDisplayId()}</Text>
                        <Text style={styles.infoMetaDot}>·</Text>
                        <Text style={styles.infoMeta}>{formatFullDate(ticket.createdAt)}</Text>
                        {ticket.orderId && ticket.orderId !== 'N/A' && (
                            <>
                                <Text style={styles.infoMetaDot}>·</Text>
                                <Text style={styles.infoMeta}>Order: {ticket.orderId.slice(-8)}</Text>
                            </>
                        )}
                    </View>
                </View>

                {/* ─── Messages ─── */}
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(_, i) => String(i)}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListFooterComponent={null}
                        renderItem={({ item, index }) => {
                            const isUser = item.from === 'user' && item.senderId === currentUserId;
                            const isVendor = item.from === 'vendor';
                            const isAdmin = item.from === 'admin';

                            // Show date separator
                            const showDateSep = index === 0 || (() => {
                                const prev = messages[index - 1];
                                const prevDate = prev?.createdAt instanceof Date ? prev.createdAt : new Date(prev?.createdAt);
                                const currDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
                                return prevDate.toDateString() !== currDate.toDateString();
                            })();

                            return (
                                <>
                                    {showDateSep && (
                                        <View style={styles.dateSeparator}>
                                            <View style={styles.dateLine} />
                                            <Text style={styles.dateLabel}>{formatFullDate(item.createdAt)}</Text>
                                            <View style={styles.dateLine} />
                                        </View>
                                    )}
                                    <View style={[styles.bubble, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
                                        {/* Sender Name */}
                                        {!isUser && (
                                            <TouchableOpacity onPress={isVendor ? onVendorNamePress : undefined} activeOpacity={isVendor ? 0.7 : 1}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[styles.senderName, isVendor && styles.senderNameVendor]}>
                                                        {isVendor ? getVendorDisplayName() : (isAdmin ? '🛡️ Admin' : item.senderName || 'Support')}
                                                    </Text>
                                                    {isVendor && (
                                                        <View style={styles.vendorTag}>
                                                            <Text style={styles.vendorTagText}>Vendor</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                        {/* Image Attachment */}
                                        {item.imageUrl && (
                                            <TouchableOpacity activeOpacity={0.9}>
                                                <Image
                                                    source={{ uri: item.imageUrl }}
                                                    style={styles.chatImage}
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                        )}
                                        {/* Text (hide generic photo text if image present) */}
                                        {(!item.imageUrl || (item.text && item.text !== '📷 Photo')) && (
                                            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
                                        )}
                                        <View style={styles.bubbleFooter}>
                                            <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
                                                {formatTime(item.createdAt)}
                                            </Text>
                                            <MessageTicks status={item.status || 'sent'} isUser={isUser} />
                                        </View>
                                    </View>
                                </>
                            );
                        }}
                    />

                    {/* Typing Indicator */}
                    {otherPartyTyping && <TypingIndicator name={isCurrentUserVendor ? (ticket?.userName || 'Customer') : (vendorStoreName || 'Vendor')} />}

                    {/* ─── Reply Input ─── */}
                    {canReply && (
                        <View style={styles.inputRow}>
                            <AttachmentPicker
                                ticketId={ticket?.id || ''}
                                onImageReady={handleImageReady}
                                disabled={sending}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Type a message..."
                                placeholderTextColor="#94a3b8"
                                value={reply}
                                onChangeText={handleTextChange}
                                multiline
                                maxLength={2000}
                                editable={!sending}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!reply.trim() || sending) && styles.sendBtnDisabled]}
                                onPress={handleSendReply}
                                disabled={!reply.trim() || sending}
                            >
                                {sending
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Feather name="send" size={18} color="#fff" />
                                }
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ─── Close Button ─── */}
                    {canConfirmClose && (
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.confirmCloseBtn} onPress={handleConfirmClose}>
                                <Feather name="check-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.confirmCloseText}>Confirm & Close Ticket</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ─── Reopen Button ─── */}
                    {canReopen && (
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.confirmCloseBtn, { backgroundColor: '#ef4444' }]}
                                onPress={handleReopenTicket}
                            >
                                <Feather name="refresh-cw" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.confirmCloseText}>Reopen Ticket</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>

                {/* CSAT Survey Modal */}
                <CSATSurveyModal
                    visible={showCSAT}
                    onClose={() => setShowCSAT(false)}
                    ticketId={ticket?.id || ''}
                    collectionName={collectionName}
                    vendorId={ticket?.vendorId || ''}
                />
            </View>
        </SafeAreaView >
    );
}

// ─── useMemo import ──────────────────────────────────────────
const { useMemo } = React;

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primary },
    contentContainer: { flex: 1, backgroundColor: '#f0f2f5' },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
        paddingHorizontal: 12, paddingVertical: 10, paddingTop: Platform.OS === 'ios' ? 0 : 10,
    },
    backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
    avatarContainer: { position: 'relative' },
    avatar: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center', alignItems: 'center',
    },
    avatarImage: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)',
    },
    onlineDot: {
        position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
        borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: colors.primary,
    },
    headerInfo: { marginLeft: 10, flex: 1 },
    vendorName: { fontSize: 16, fontWeight: '700', color: '#fff' },
    presenceText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

    // Info Bar
    infoBar: {
        backgroundColor: '#fff', paddingHorizontal: spacing.md, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    infoDot: { width: 6, height: 6, borderRadius: 3 },
    infoBadgeText: { fontSize: 11, fontWeight: '600' },
    infoMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    infoMeta: { fontSize: 11, color: '#94a3b8' },
    infoMetaDot: { fontSize: 11, color: '#cbd5e1', marginHorizontal: 5 },

    // Messages
    messagesList: { padding: spacing.md, paddingBottom: spacing.xl },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textMuted },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    // Date Separator
    dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
    dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
    dateLabel: { fontSize: 11, color: '#94a3b8', marginHorizontal: 12, fontWeight: '500' },

    // Bubbles
    bubble: { maxWidth: '82%', padding: 10, borderRadius: 12, marginBottom: 4 },
    bubbleLeft: {
        alignSelf: 'flex-start', backgroundColor: '#fff',
        borderBottomLeftRadius: 4, marginRight: '18%',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
    },
    bubbleRight: {
        alignSelf: 'flex-end', backgroundColor: '#dcfce7',
        borderBottomRightRadius: 4, marginLeft: '18%',
    },
    senderName: { fontSize: 12, color: colors.primary, fontWeight: '700', marginBottom: 3 },
    senderNameVendor: { color: '#f97316' },
    vendorTag: {
        backgroundColor: '#f97316',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    vendorTagText: { fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
    chatImage: {
        width: 200, height: 200, borderRadius: 10, marginVertical: 6,
    },
    bubbleText: { fontSize: 14, color: '#1e293b', lineHeight: 20 },
    bubbleTextUser: { color: '#1e293b' },
    bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
    bubbleTime: { fontSize: 10, color: '#94a3b8' },
    bubbleTimeUser: { color: '#64748b' },
    ticks: { fontSize: 12, fontWeight: '700', letterSpacing: -1 },

    // Typing
    typingBubble: {
        alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 14,
        paddingVertical: 8, borderRadius: 12, marginBottom: 4, borderBottomLeftRadius: 4,
    },
    typingText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },

    // Input
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', padding: 8,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    },
    input: {
        flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#f1f5f9',
        borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
        fontSize: 14, color: colors.text, marginRight: 8,
    },
    sendBtn: {
        backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },

    // Footer
    footer: { padding: spacing.md, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
    confirmCloseBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#10b981', padding: 14, borderRadius: 12,
    },
    confirmCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
