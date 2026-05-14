import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image, Keyboard, StatusBar, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { auth, db } from '../../services/firebaseConfig';
import { doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion, Timestamp, getDoc, addDoc, collection } from 'firebase/firestore';
import { notifyAdmins, notifyUser } from '../../services/notifyHelper';
import { setTypingStatus, subscribeToPresence } from '../../services/presenceService';
import { TICKET_CATEGORIES } from '../../constants/ticketCategories';
import AttachmentPicker from '../../components/AttachmentPicker';
import InternalNotesPanel from '../../components/InternalNotesPanel';
import AuditTrailPanel from '../../components/AuditTrailPanel';
import MessageTemplatesModal from '../../components/MessageTemplatesModal';
import EscalationModal from '../../components/EscalationModal';
import { logStatusChange, logReply } from '../../services/auditService';

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

interface ComplaintDetail {
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
  createdAt: Date | any;
  updatedAt?: Date | null;
  messages?: TicketMessage[];
  internalNotes?: any[];
  auditTrail?: any[];
}

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

function MessageTicks({ status, isVendor }: { status?: string; isVendor: boolean }) {
  if (!isVendor) return null;
  const tickColor = status === 'read' ? '#34d399' : 'rgba(255,255,255,0.7)';
  switch (status) {
    case 'read': return <Text style={[styles.ticks, { color: tickColor }]}>✓✓</Text>;
    case 'delivered': return <Text style={[styles.ticks, { color: tickColor }]}>✓✓</Text>;
    case 'sent': return <Text style={[styles.ticks, { color: tickColor }]}>✓</Text>;
    case 'sending': return <Feather name="clock" size={10} color={tickColor} />;
    default: return <Text style={[styles.ticks, { color: tickColor }]}>✓</Text>;
  }
}

export default function VendorComplaintDetailScreen({ route, navigation }: any) {
  const { complaint: initialComplaint } = route.params || {};
  const [ticket, setTicket] = useState<ComplaintDetail | null>(initialComplaint || null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [collectionName, setCollectionName] = useState<'complaints' | 'tickets'>('complaints');
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'audit'>('chat');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const vendorId = auth.currentUser?.uid;

  // ── Real-time listener: auto-detect collection ──
  useEffect(() => {
    if (!initialComplaint?.id) return;

    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const ticketRef = doc(db, 'tickets', initialComplaint.id);
        const ticketSnap = await getDoc(ticketRef);
        const col = ticketSnap.exists() ? 'tickets' : 'complaints';
        setCollectionName(col);

        const ref = doc(db, col, initialComplaint.id);

        // Mark messages as read for this vendor (once on mount)
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
            orderId: d.orderId || '',
            description: d.description || '',
            subject: d.subject,
            status: d.status || 'open',
            category: d.category || d.issue,
            productName: d.productName || d.subject,
            userPhone: d.userPhone || d.customerPhone,
            userEmail: d.userEmail || d.customerEmail,
            createdAt: d.createdAt?.toDate?.() ?? new Date(),
            updatedAt: d.updatedAt?.toDate?.() ?? null,
            messages,
            internalNotes: (d.internalNotes || []).map((n: any) => ({
              ...n,
              createdAt: n.createdAt?.toDate?.() ?? new Date(n.createdAt),
            })),
            auditTrail: (d.auditTrail || []).map((a: any) => ({
              ...a,
              timestamp: a.timestamp?.toDate?.() ?? new Date(a.timestamp),
            })),
          });
        });
      } catch (err) {
        console.error('Error setting up ticket listener:', err);
      }
    })();

    return () => unsub?.();
  }, [initialComplaint?.id]);

  // ── Subscribe to customer typing status ──
  useEffect(() => {
    if (!ticket?.userId || !ticket?.id) return;
    const unsub = subscribeToPresence(ticket.userId, (presence) => {
      setCustomerTyping(presence?.typing?.ticketId === ticket.id);
    });
    return () => unsub();
  }, [ticket?.userId, ticket?.id]);

  // ── Mark user messages as 'read' when vendor views the ticket ──
  const isMarkingReadRef = React.useRef(false);
  useEffect(() => {
    if (!ticket?.id || !ticket?.messages?.length) return;
    if (isMarkingReadRef.current) return; // Prevent re-entry while write is in-flight

    // Check if there are any user messages not yet marked as 'read'
    const hasUnreadUserMessages = ticket.messages.some(
      (m) => m.from === 'user' && m.status !== 'read'
    );

    if (!hasUnreadUserMessages) return;

    isMarkingReadRef.current = true;

    // Update all messages: mark user messages as 'read'
    const updatedMessages = ticket.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt instanceof Date ? Timestamp.fromDate(m.createdAt) : m.createdAt,
      ...(m.from === 'user' ? { status: 'read' } : {}),
    }));

    (async () => {
      try {
        // Auto-detect correct collection
        const ticketRef = doc(db, 'tickets', ticket.id);
        const ticketSnap = await getDoc(ticketRef);
        const col = ticketSnap.exists() ? 'tickets' : 'complaints';

        const ref = doc(db, col, ticket.id);
        await updateDoc(ref, { messages: updatedMessages });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      } finally {
        isMarkingReadRef.current = false;
      }
    })();
  }, [ticket?.id, ticket?.messages?.length]);

  const handleStatusChange = async (newStatus: 'open' | 'in-progress' | 'resolved' | 'rejected' | 'reopened') => {
    if (!ticket?.id) return;
    try {
      await updateDoc(doc(db, collectionName, ticket.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', `Ticket marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`);

      // Log audit event
      logStatusChange(ticket.id, collectionName, ticket.status, newStatus, 'Vendor', 'vendor');

      // Notify customer about status change
      if (ticket.userId) {
        try {
          const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
          const notifTitle = newStatus === 'resolved' ? 'Ticket Resolved ✅'
            : newStatus === 'rejected' ? 'Ticket Rejected ❌'
              : 'Ticket Updated 🔄';
          const notifBody = `Your ticket ${ticket.ticketId || ticket.id.slice(-6)} has been marked as ${statusLabel}.`;

          // Use notifyUser for customer notifications
          await notifyUser(
            ticket.userId,
            notifTitle,
            notifBody,
            'complaint',
            ticket.id,
            { status: newStatus }
          );
        } catch (notifyErr) {
          console.error('Failed to notify customer on status change:', notifyErr);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleReply = async () => {
    const text = reply.trim();
    if (!text || !ticket?.id) return;
    const vendorId = auth.currentUser?.uid;
    if (!vendorId) return;

    setSending(true);
    try {
      const ref = doc(db, collectionName, ticket.id);
      const newMsg: TicketMessage = {
        from: 'vendor',
        senderId: vendorId,
        senderName: 'Vendor',
        text,
        createdAt: Timestamp.fromDate(new Date()),
        status: 'sent',
      };

      await updateDoc(ref, {
        messages: arrayUnion(newMsg),
        updatedAt: serverTimestamp(),
        status: ticket.status === 'open' || ticket.status === 'new' ? 'in-progress' : ticket.status,
      });

      // Notify customer
      if (ticket.userId) {
        try {
          await notifyUser(
            ticket.userId,
            'Vendor Replied 📩',
            `Order ${ticket.orderId} — "${text.length > 50 ? text.slice(0, 50) + '...' : text}"`,
            'complaint',
            ticket.id
          );
        } catch (notifyErr) {
          console.error('Failed to notify customer:', notifyErr);
        }
      }

      // Notify admins
      try {
        await notifyAdmins(
          'Vendor Replied 📩',
          `Order ${ticket.orderId}: "${text.slice(0, 50)}..."`,
          ticket.id,
          'complaint'
        );
      } catch { }

      setReply('');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  // ── Send Image (vendor) ──
  const handleImageReady = async (imageUrl: string, fileName: string) => {
    if (!ticket?.id) return;
    const vendorId = auth.currentUser?.uid;
    if (!vendorId) return;
    try {
      const ref = doc(db, collectionName, ticket.id);
      const newMsg: TicketMessage = {
        from: 'vendor', senderId: vendorId, senderName: 'Vendor',
        text: '📷 Photo', imageUrl, fileName,
        createdAt: Timestamp.fromDate(new Date()), status: 'sent',
      };
      await updateDoc(ref, {
        messages: arrayUnion(newMsg), updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error sending image:', err);
      Alert.alert('Error', 'Failed to send image');
    }
  };

  const formatTime = (date: Date | any) => {
    if (!date) return '—';
    const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayId = (item: ComplaintDetail) => {
    if (item.ticketId) return item.ticketId;
    return `#${item.id.slice(-8).toUpperCase()}`;
  };

  const getCategoryInfo = (cat?: string) => {
    if (!cat || !TICKET_CATEGORIES[cat]) return { icon: 'message-circle' as any, label: 'General' };
    return { icon: TICKET_CATEGORIES[cat].icon as any, label: TICKET_CATEGORIES[cat].label };
  };

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ticket</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Ticket not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const categoryInfo = getCategoryInfo(ticket.category);
  const canReply = !['resolved', 'rejected', 'closed'].includes(ticket.status);
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
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => navigation.navigate('UserProfileView', {
              userId: ticket.userId,
              userName: ticket.userName,
              isVendorProfile: false,
            })}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.headerTitle}>{ticket.userName}</Text>
              <Feather name="external-link" size={12} color="#94a3b8" />
            </View>
            <Text style={styles.headerSubtitle}>{getDisplayId(ticket)}</Text>
          </TouchableOpacity>
          <View />
        </View>

        {/* Info Bar */}
        <View style={styles.infoBar}>
          <View style={[styles.statusChip, { backgroundColor: statusCfg.color + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
          <View style={styles.categoryChip}>
            <Feather name={categoryInfo.icon} size={11} color="#6b7280" />
            <Text style={styles.categoryLabel}>{categoryInfo.label}</Text>
          </View>
        </View>

        {/* Contact & Order Info */}
        <View style={styles.metaBar}>
          <View style={styles.metaItem}>
            <Feather name="shopping-cart" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>Order: {ticket.orderId?.slice(-8) || 'N/A'}</Text>
          </View>
          {ticket.userPhone && (
            <View style={styles.metaItem}>
              <Feather name="phone" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{ticket.userPhone}</Text>
            </View>
          )}
        </View>

        {/* Tab Switcher */}
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
            userRole="vendor"
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
                const isVendor = item.from === 'vendor';
                return (
                  <View style={[styles.bubble, isVendor ? styles.bubbleVendor : styles.bubbleCustomer]}>
                    {!isVendor && <Text style={styles.bubbleSenderName}>{item.senderName || 'Customer'}</Text>}
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
                    {(!item.imageUrl || (item.text && item.text !== '📷 Photo')) && (
                      <Text style={[styles.bubbleText, isVendor && styles.bubbleTextVendor]}>{item.text}</Text>
                    )}
                    <View style={styles.bubbleFooter}>
                      <Text style={[styles.bubbleTime, isVendor && styles.bubbleTimeVendor]}>
                        {formatTime(item.createdAt)}
                      </Text>
                      <MessageTicks status={item.status} isVendor={isVendor} />
                    </View>
                  </View>
                );
              }}
            />

            {/* Customer Typing Indicator */}
            {customerTyping && (
              <View style={styles.typingBubble}>
                <Text style={styles.typingText}>{ticket.userName} is typing...</Text>
              </View>
            )}

            {/* Reply Input */}
            {canReply && (
              <View style={styles.inputRow}>
                <AttachmentPicker
                  ticketId={ticket?.id || ''}
                  onImageReady={handleImageReady}
                  disabled={sending}
                />
                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => setShowTemplates(true)}
                >
                  <Feather name="zap" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="Reply to customer..."
                  placeholderTextColor={colors.textMuted}
                  value={reply}
                  onChangeText={(text) => {
                    setReply(text);
                    if (vendorId && ticket?.id) {
                      setTypingStatus(vendorId, ticket.id);
                      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = setTimeout(() => {
                        setTypingStatus(vendorId, null);
                      }, 3000);
                    }
                  }}
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
              {(ticket.status === 'open' || ticket.status === 'reopened') && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatusChange('in-progress')}>
                  <Feather name="clock" size={16} color="#f59e0b" />
                  <Text style={styles.actionBtnText}>Mark In Progress</Text>
                </TouchableOpacity>
              )}
              {canReply && (
                <>
                  <TouchableOpacity style={styles.resolveBtn} onPress={() => handleStatusChange('resolved')}>
                    <Feather name="check-circle" size={16} color="#10b981" />
                    <Text style={styles.resolveBtnText}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleStatusChange('rejected')}>
                    <Feather name="x-circle" size={16} color="#ef4444" />
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
              {canReply && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowEscalation(true)}>
                  <Feather name="alert-triangle" size={16} color="#f59e0b" />
                  <Text style={styles.actionBtnText}>Escalate</Text>
                </TouchableOpacity>
              )}
              {isTerminal && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={() => {
                    Alert.alert('Reopen Ticket', 'Are you sure you want to reopen this ticket?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reopen', style: 'destructive', onPress: () => handleStatusChange('reopened') },
                    ]);
                  }}
                >
                  <Feather name="rotate-ccw" size={16} color="#ef4444" />
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

      {/* Escalation Modal */}
      <EscalationModal
        visible={showEscalation}
        onClose={() => setShowEscalation(false)}
        ticketId={ticket?.id || ''}
        collectionName={collectionName}
        vendorId={ticket?.vendorId || ''}
        customerName={ticket?.userName || 'Customer'}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerInfo: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2, letterSpacing: 0.2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted },

  // Info Bar
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  categoryLabel: { fontSize: 10, color: '#475569', fontWeight: '500' },

  // Meta Bar
  metaBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#64748b' },

  // Messages
  messagesList: { padding: 14, paddingBottom: 20 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, marginBottom: 8 },
  bubbleCustomer: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleVendor: { alignSelf: 'flex-end', backgroundColor: '#f97316', borderBottomRightRadius: 4 },
  bubbleSenderName: { fontSize: 11, color: colors.primary, fontWeight: '600', marginBottom: 3 },
  bubbleText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  bubbleTextVendor: { color: '#fff' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 10, color: '#94a3b8' },
  bubbleTimeVendor: { color: 'rgba(255,255,255,0.8)' },
  ticks: { fontSize: 11, marginLeft: 2 },
  chatImage: {
    width: 200, height: 200, borderRadius: 10, marginVertical: 6,
  },

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
  tabText: { fontSize: 13, fontWeight: '500', color: '#94a3b8' },
  tabTextActive: { color: '#1e293b', fontWeight: '600' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1, minHeight: 38, maxHeight: 100,
    backgroundColor: '#f1f5f9', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 13, color: colors.text, marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#f97316', width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  // Actions
  actionsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef3c7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flex: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#f59e0b' },
  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#d1fae5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flex: 1,
  },
  resolveBtnText: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fee2e2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flex: 1,
  },
  rejectBtnText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },
  templateBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primary + '12',
  },
  typingBubble: {
    paddingHorizontal: 14, paddingVertical: 8,
    marginHorizontal: 12, marginBottom: 4,
    backgroundColor: '#f1f5f9', borderRadius: 16,
    alignSelf: 'flex-start',
  },
  typingText: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
});
