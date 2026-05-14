import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { sendPushNotification } from './NotificationService';

/**
 * Send a notification to all admin users.
 * Admins are users in the 'users' collection with role === 'admin'.
 */
export async function notifyAdmins(title: string, description: string, relatedId?: string, type: string = 'complaint') {
    try {
        const adminsQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminSnap = await getDocs(adminsQuery);

        // Also notify 'admin' logical user if it exists (for dashboard counts)
        // We will create a notification for the general 'admin' role listener as well
        await addDoc(collection(db, 'notifications'), {
            type,
            title,
            description,
            userId: 'admin', // General admin listener
            relatedId: relatedId || '',
            isRead: false,
            createdAt: serverTimestamp(),
        });

        for (const adminDoc of adminSnap.docs) {
            const adminData = adminDoc.data();

            // Push notification
            if (adminData.expoPushToken) {
                await sendPushNotification(adminData.expoPushToken, title, description);
            }
        }
    } catch (error) {
        console.error('Failed to notify admins:', error);
    }
}

/**
 * Send a notification to a specific user by their userId.
 * Also sends a push notification if they have an expoPushToken.
 */
export async function notifyUser(
    userId: string,
    title: string,
    description: string,
    type: string = 'complaint',
    relatedId?: string,
    extraFields?: Record<string, any>
) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        // In-app notification
        await addDoc(collection(db, 'notifications'), {
            type,
            title,
            description,
            userId,
            relatedId: relatedId || '',
            isRead: false,
            createdAt: serverTimestamp(),
            ...extraFields,
        });

        // Push notification (respects user's notification preference)
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const pushEnabled = userData?.pushNotificationsEnabled !== false; // default true
            const token = userData?.expoPushToken;
            if (token && pushEnabled) {
                await sendPushNotification(token, title, description);
            }
        }
    } catch (error) {
        console.error('Failed to notify user:', error);
    }
}

/**
 * Send a notification to a vendor.
 * Wrapper around notifyUser for semantic clarity.
 */
export async function notifyVendor(
    vendorId: string,
    title: string,
    description: string,
    type: string = 'order',
    relatedId?: string,
    extraFields?: Record<string, any>
) {
    return notifyUser(vendorId, title, description, type, relatedId, extraFields);
}
