import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db, auth } from '../services/firebaseConfig';
import {
  collection, doc, setDoc, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, or, where, getDoc, updateDoc, increment,
  getDocs, writeBatch
} from 'firebase/firestore';
import { sendPushNotification } from '../services/NotificationService';
import { onAuthStateChanged } from 'firebase/auth';
import { notifyUser } from '../services/notifyHelper';

interface ChatContextType {
  conversations: any[];
  sendMessage: (myId: string, targetId: string, text: string, senderType: string, vendorData: any) => Promise<void>;
  getMessages: (myId: string, targetId: string, callback: (msgs: any[]) => void) => () => void;
  getMessagesByConversationId: (conversationId: string, callback: (msgs: any[]) => void) => () => void;
  markAsRead: (id: string, userType: 'vendor' | 'customer') => Promise<void>;
  getTotalUnreadCount: (userType?: 'vendor' | 'customer') => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(auth.currentUser?.uid || null);

  // Track auth state changes to update user ID when user logs in/out
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Fetch conversations for the current user
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:33', message: 'useEffect entry', data: { currentUserId, hasCurrentUserId: !!currentUserId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
    // #endregion
    if (!currentUserId) {
      setConversations([]);
      return;
    }

    let isMounted = true;
    const q = query(
      collection(db, 'conversations'),
      or(
        where('userId', '==', currentUserId),
        where('vendorId', '==', currentUserId)
      ),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:48', message: 'onSnapshot callback triggered', data: { snapshotSize: snapshot.size, isMounted, currentUserId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
      // #endregion
      const convs = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as any;
        const conv: any = {
          id: docSnap.id,
          ...data,
          lastMessageTime: (data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now())).toISOString(),
        };

        // If vendor is viewing conversations and customerName is missing, fetch it
        if (currentUserId && data.vendorId === currentUserId && !conv.customerName && data.userId) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:58', message: 'Fetching customer name', data: { conversationId: docSnap.id, userId: data.userId, isMounted }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2,H5' }) }).catch(() => { });
            // #endregion
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              conv.customerName = userData.name || null;
              conv.customerAvatar = userData.photoURL || null;
              // Update the conversation document with customer name
              if (conv.customerName && isMounted) {
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:66', message: 'Updating conversation with customer name', data: { conversationId: docSnap.id, customerName: conv.customerName, isMounted }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H5' }) }).catch(() => { });
                // #endregion
                await setDoc(doc(db, 'conversations', docSnap.id), {
                  customerName: conv.customerName,
                  customerAvatar: conv.customerAvatar,
                }, { merge: true });
              }
            }
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:73', message: 'Error fetching customer name', data: { error: String(error), conversationId: docSnap.id }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
            // #endregion
            console.error('Error fetching customer name for conversation:', error);
          }
        }

        return conv;
      }));
      if (isMounted) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:80', message: 'Setting conversations state', data: { convsCount: convs.length, isMounted }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
        // #endregion
        setConversations(convs);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:83', message: 'Skipping setState - component unmounted', data: { convsCount: convs.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
        // #endregion
      }
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUserId]);

  const sendMessage = async (myId: string, targetId: string, text: string, senderType: string, vendorData: any) => {
    const conversationId = [myId, targetId].sort().join('_');
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      text,
      senderId: myId,
      senderType,
      createdAt: serverTimestamp(),
      read: false,
      status: 'sent'
    });

    // If customer is sending message, fetch and save customer name
    let customerName = null;
    let customerAvatar = null;
    if (senderType === 'customer') {
      try {
        const userDoc = await getDoc(doc(db, 'users', myId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          customerName = userData.name || auth.currentUser?.displayName || null;
          customerAvatar = userData.photoURL || auth.currentUser?.photoURL || null;
        }
      } catch (error) {
        console.error('Error fetching customer name:', error);
      }
    }

    // Calculate unread counts
    const updateData: any = {
      userId: senderType === 'vendor' ? targetId : myId,
      vendorId: senderType === 'vendor' ? myId : targetId,
      lastMessage: text,
      updatedAt: serverTimestamp(),
      vendor: vendorData,
    };

    // Increment unread count for the RECEIVER
    if (senderType === 'customer') {
      updateData.unreadCountVendor = increment(1);
    } else {
      updateData.unreadCountUser = increment(1);
    }

    // Only update customerName/customerAvatar if they exist and are not already set
    if (customerName) {
      updateData.customerName = customerName;
    }
    if (customerAvatar) {
      updateData.customerAvatar = customerAvatar;
    }

    await setDoc(doc(db, 'conversations', conversationId), updateData, { merge: true });

    // Send Push Notification to Receiver
    try {
      const recipientId = targetId;

      // ✅ Prevent self-notification checking
      if (recipientId === myId) {
        console.log('🚫 Aborting notification: Sender is Recipient');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', recipientId));
      if (userDoc.exists()) {
        const token = userDoc.data()?.expoPushToken;
        if (token) {
          const title = senderType === 'vendor' ? vendorData?.storeName || 'New Message' : customerName || 'New Message';
          await sendPushNotification(token, title, text);
        }

        // Create in-app notification for chat message
        const senderName = senderType === 'vendor'
          ? vendorData?.storeName || 'Vendor'
          : customerName || 'Customer';

        await notifyUser(
          recipientId,
          `New Message from ${senderName} 💬`,
          text.length > 100 ? text.slice(0, 100) + '...' : text,
          'chat',
          conversationId,
          {
            vendorId: senderType === 'customer' ? recipientId : undefined,
            read: false
          }
        );
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  };

  const getMessages = (myId: string, targetId: string, callback: (msgs: any[]) => void) => {
    const conversationId = [myId, targetId].sort().join('_');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:75', message: 'getMessages called', data: { myId, targetId, conversationId, currentUserId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
    // #endregion
    const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:81', message: 'Messages snapshot received', data: { conversationId, messageCount: msgs.length, myId, targetId, senderIds: msgs.map(m => m.senderId), senderTypes: msgs.map(m => m.senderType) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
      // #endregion
      callback(msgs);
    });
  };

  // Get messages using conversation document ID directly (for vendor screens where we have item.id)
  const getMessagesByConversationId = (conversationId: string, callback: (msgs: any[]) => void) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:90', message: 'getMessagesByConversationId called', data: { conversationId, currentUserId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
    // #endregion
    const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/2272e361-e666-43f6-80ae-bc3b982efc1f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ChatContext.tsx:95', message: 'Messages snapshot received by conversationId', data: { conversationId, messageCount: msgs.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run4', hypothesisId: 'E' }) }).catch(() => { });
      // #endregion
      callback(msgs);
    });
  };

  const markAsRead = async (id: string, userType: 'vendor' | 'customer') => {
    const field = userType === 'vendor' ? 'unreadCountVendor' : 'unreadCountUser';
    await setDoc(doc(db, 'conversations', id), { [field]: 0 }, { merge: true });

    // Mark all messages from the other party as read (for read receipts)
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;
    const messagesSnap = await getDocs(query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'asc')));
    const batch = writeBatch(db);
    let count = 0;
    messagesSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.senderId !== currentUserId && !data.read) {
        batch.update(doc(db, 'conversations', id, 'messages', d.id), { read: true, status: 'read' });
        count++;
      }
    });
    if (count > 0) await batch.commit();
  };

  const getTotalUnreadCount = (userType?: 'vendor' | 'customer') => {
    if (!userType) return 0;
    const field = userType === 'vendor' ? 'unreadCountVendor' : 'unreadCountUser';
    return conversations.reduce((sum, conv) => sum + (conv[field] || 0), 0);
  };

  return (
    <ChatContext.Provider value={{ conversations, sendMessage, getMessages, getMessagesByConversationId, markAsRead, getTotalUnreadCount }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
