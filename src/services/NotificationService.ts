import { Platform } from 'react-native';
import { db } from './firebaseConfig';
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';

// Lazy getter - only loads expo-notifications when actually needed (not at import time)
function getNotifications() {
  return require('expo-notifications') as typeof import('expo-notifications');
}

// === NOTIFICATION HANDLER ===
export function setupNotificationHandler() {
  const Notifications = getNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// === SETUP NOTIFICATION CHANNELS ===
export async function registerForPushNotificationsAsync() {
  const Notifications = getNotifications();
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Plant Reminders',
      description: 'Notifications for plant care reminders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
      enableVibrate: true,
      showBadge: true,
    });
  }

  if (Platform.OS !== 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('❌ Notification permission NOT granted!');
      return;
    }
    console.log('✅ Notification permission granted');

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
    } catch (e) {
      console.log('⚠️ Could not get push token (local notifications still work):', e);
    }
  }

  return token;
}

export async function updateUserPushToken(userId: string) {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await updateDoc(doc(db, 'users', userId), { expoPushToken: token });
    }
  } catch (error) {
    console.log('Error updating push token:', error);
  }
}

export async function sendPushNotification(expoPushToken: string, title: string, body: string) {
  if (!expoPushToken) return;

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    channelId: 'default',
    data: { url: 'gardenmate://orders' },
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error('Failed to send push:', err);
  }
}

// === SCHEDULE REMINDER NOTIFICATION ===
export async function scheduleReminderNotification(
  title: string,
  body: string,
  date: Date,
  data?: Record<string, any>
) {
  const Notifications = getNotifications();
  try {
    // Check permission first
    const { status } = await Notifications.getPermissionsAsync();
    console.log('📱 Notification permission status:', status);
    if (status !== 'granted') {
      console.log('❌ Cannot schedule: notification permission not granted');
      return;
    }

    console.log(`⏰ Scheduling reminder for: ${date.toLocaleString()}`);

    // Use absolute DATE trigger which is native to Expo Notifications
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: date,
        channelId: 'reminders',
      },
    });
    console.log(`✅ Reminder scheduled! ID: ${notifId}`);

    // Log all scheduled notifications for debug
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`📋 Total scheduled notifications: ${allScheduled.length}`);
    allScheduled.forEach((n, i) => {
      console.log(`  📌 [${i}] ID: ${n.identifier}, trigger:`, JSON.stringify(n.trigger));
    });

    return notifId;
  } catch (error) {
    console.error('❌ Failed to schedule notification:', error);
  }
}

// === FIRE IMMEDIATE TEST NOTIFICATION ===
export async function triggerTestNotification() {
  const Notifications = getNotifications();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 GardenMate Test',
        body: 'Notifications are working! You will receive reminders.',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // fires immediately
    });
    console.log('✅ Test notification fired! ID:', id);
  } catch (error) {
    console.error('❌ Test notification failed:', error);
  }
}

// === DELETE ALL EXISTING TASKS/REMINDERS FROM FIRESTORE ===
export async function deleteAllReminders(userId: string) {
  const Notifications = getNotifications();
  try {
    // Delete all tasks
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    );
    const tasksSnap = await getDocs(tasksQuery);
    let taskCount = 0;
    for (const docSnap of tasksSnap.docs) {
      await deleteDoc(doc(db, 'tasks', docSnap.id));
      taskCount++;
    }
    console.log(`🗑️ Deleted ${taskCount} tasks`);

    // Delete all reminder notifications
    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'reminder')
    );
    const notifSnap = await getDocs(notifQuery);
    let notifCount = 0;
    for (const docSnap of notifSnap.docs) {
      await deleteDoc(doc(db, 'notifications', docSnap.id));
      notifCount++;
    }
    console.log(`🗑️ Deleted ${notifCount} reminder notifications`);

    // Cancel all scheduled local notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ Cancelled all scheduled push notifications');

    return { taskCount, notifCount };
  } catch (error) {
    console.error('❌ Failed to delete reminders:', error);
    return { taskCount: 0, notifCount: 0 };
  }
}

// Kept for compatibility
export async function initNotifications() {
  setupNotificationHandler();
  return registerForPushNotificationsAsync();
}

// === CANCEL SPECIFIC NOTIFICATION ===
export async function cancelNotification(notificationId: string) {
  const Notifications = getNotifications();
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`🗑️ Cancelled notification: ${notificationId}`);
  } catch (error) {
    console.error('❌ Failed to cancel notification:', error);
  }
}
