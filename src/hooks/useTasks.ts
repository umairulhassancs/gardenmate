import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebaseConfig';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    getDocs
} from 'firebase/firestore';
import { scheduleReminderNotification, cancelNotification } from '../services/NotificationService';

export type TaskType = 'water' | 'fertilize' | 'clean' | 'rotate' | 'prune' | 'custom';
export type TaskFrequency = 'daily' | 'every-2-days' | 'weekly' | 'bi-weekly' | 'monthly' | 'once';

export interface Task {
    id: string;
    title: string;
    completed: boolean;
    dueDate: string;
    reminderDateTime?: Date | null;
    location?: string;
    plantId?: string;
    plantName?: string;
    taskType?: TaskType;
    frequency?: TaskFrequency;
    isRecurring?: boolean;
    userId: string;
    createdAt?: any;
    lastCompletedAt?: Date | null; // Track when recurring task was last completed
    completionCount?: number; // Track total completions for recurring tasks
    notificationId?: string; // Track scheduled notification ID
}

// Helper to group tasks by date
export function groupTasksByDate(tasks: Task[]): { today: Task[]; tomorrow: Task[]; later: Task[] } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(todayStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const today: Task[] = [];
    const tomorrow: Task[] = [];
    const later: Task[] = [];

    tasks.forEach(task => {
        let taskDate: Date | null = null;

        if (task.reminderDateTime) {
            taskDate = task.reminderDateTime instanceof Date
                ? task.reminderDateTime
                : new Date((task.reminderDateTime as any).seconds * 1000);
        } else if (task.dueDate === 'Today') {
            taskDate = todayStart;
        } else if (task.dueDate === 'Tomorrow') {
            taskDate = tomorrowStart;
        }

        if (!taskDate || taskDate < tomorrowStart) {
            today.push(task);
        } else if (taskDate < dayAfterTomorrow) {
            tomorrow.push(task);
        } else {
            later.push(task);
        }
    });

    return { today, tomorrow, later };
}

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ Frequency ke mutabiq agli date calculate karna
    const calculateNextDue = (frequency: TaskFrequency): string => {
        const daysMap: Record<string, number> = {
            daily: 1, 'every-2-days': 2, weekly: 7, 'bi-weekly': 14, monthly: 30, once: 0
        };
        const diff = daysMap[frequency] || 0;
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        return `In ${diff} days`;
    };

    // ✅ 1. Get Tasks (Real-time from Backend)
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            setTasks([]);
            return;
        }

        console.log('🔄 Setting up tasks listener for user:', user.uid);

        const q = query(
            collection(db, 'tasks'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                console.log('📡 Tasks snapshot received:', snapshot.docs.length, 'tasks');

                const taskList = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        title: data.title,
                        completed: data.completed || false,
                        dueDate: data.dueDate || 'Today',
                        reminderDateTime: data.reminderDateTime ? (data.reminderDateTime.toDate ? data.reminderDateTime.toDate() : new Date(data.reminderDateTime)) : null,
                        location: data.location,
                        plantId: data.plantId,
                        plantName: data.plantName,
                        taskType: data.taskType,
                        frequency: data.frequency,
                        isRecurring: data.isRecurring || false,
                        userId: data.userId,
                        createdAt: data.createdAt,
                        lastCompletedAt: data.lastCompletedAt ? (data.lastCompletedAt.toDate ? data.lastCompletedAt.toDate() : new Date(data.lastCompletedAt)) : null,
                        completionCount: data.completionCount || 0,
                        notificationId: data.notificationId,
                    } as Task;
                });

                // Sort by createdAt (newest first)
                taskList.sort((a, b) => {
                    if (!a.createdAt || !b.createdAt) return 0;
                    return b.createdAt?.seconds - a.createdAt?.seconds;
                });

                console.log('✅ Tasks updated:', taskList.length);
                setTasks(taskList);
                setLoading(false);
            },
            (error) => {
                console.error("❌ Firestore Error:", error);
                setLoading(false);
            }
        );

        return () => {
            console.log('🛑 Cleaning up tasks listener');
            unsubscribe();
        };
    }, []);

    // ✅ 2. Add Task (To Backend)
    const addTask = async (taskData: Partial<Task> & { title: string }) => {
        const user = auth.currentUser;
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }

        try {
            let notificationId = null;
            let reminderTitle = `GardenMate Reminder: ${taskData.title}`;
            let reminderBody = `Time to ${taskData.taskType || 'care for'} your ${taskData.plantName || 'plant'}!`;

            if (taskData.reminderDateTime && new Date(taskData.reminderDateTime) > new Date()) {
                notificationId = await scheduleReminderNotification(
                    reminderTitle,
                    reminderBody,
                    taskData.reminderDateTime,
                    {
                        taskType: taskData.taskType || 'custom',
                        plantName: taskData.plantName || 'plant',
                        isReminder: true
                    }
                );
            }

            const docRef = await addDoc(collection(db, 'tasks'), {
                title: taskData.title,
                completed: false,
                dueDate: taskData.dueDate || "Today",
                reminderDateTime: taskData.reminderDateTime || null,
                location: taskData.location || "Garden",
                plantId: taskData.plantId || null,
                plantName: taskData.plantName || null,
                taskType: taskData.taskType || 'custom',
                frequency: taskData.frequency || 'once',
                isRecurring: taskData.isRecurring || false,
                userId: user.uid,
                createdAt: serverTimestamp(),
                notificationId: notificationId,
            });

            // Add future notification to increment bell icon badge reliably
            if (notificationId) {
                await addDoc(collection(db, 'notifications'), {
                    type: 'reminder',
                    title: reminderTitle,
                    description: reminderBody,
                    userId: user.uid,
                    relatedId: docRef.id,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    triggerAt: taskData.reminderDateTime
                });
            }

            console.log('✅ Task added:', docRef.id);
        } catch (error) {
            console.error("❌ Add Task Error:", error);
        }
    };

    // ✅ 3. Toggle Task (Update Backend) - RECURRING TASKS UPDATE SAME ENTRY (like iPhone alarms)
    const toggleTask = async (id: string): Promise<{ isRecurring: boolean; nextDate?: Date; task?: Task } | null> => {
        try {
            const task = tasks.find(t => t.id === id);
            if (!task) {
                console.log('❌ Task not found:', id);
                return null;
            }

            const taskRef = doc(db, 'tasks', id);
            const newCompletedStatus = !task.completed;

            // If completing a recurring task, UPDATE THE SAME TASK with next occurrence
            if (newCompletedStatus && task.isRecurring && task.frequency && task.frequency !== 'once') {
                // ... (existing calc logic) ...
                const daysMap: Record<string, number> = {
                    'daily': 1,
                    'every-2-days': 2,
                    'weekly': 7,
                    'bi-weekly': 14,
                    'monthly': 30,
                };
                const daysToAdd = daysMap[task.frequency] || 7;

                // Calculate next reminder date from current due date (not from today)
                let nextReminderDate: Date;
                if (task.reminderDateTime) {
                    const currentDueDate = task.reminderDateTime instanceof Date
                        ? task.reminderDateTime
                        : new Date((task.reminderDateTime as any).seconds * 1000);
                    nextReminderDate = new Date(currentDueDate);
                    nextReminderDate.setDate(nextReminderDate.getDate() + daysToAdd);
                } else {
                    nextReminderDate = new Date();
                    nextReminderDate.setDate(nextReminderDate.getDate() + daysToAdd);
                }

                // Track last completed date for history
                const lastCompletedAt = new Date();

                // CANCEL OLD NOTIFICATION
                if (task.notificationId) {
                    await cancelNotification(task.notificationId);
                }

                // SCHEDULE NEW NOTIFICATION
                let newNotificationId = null;
                let reminderTitle = `GardenMate Reminder: ${task.title}`;
                let reminderBody = `It's time again! ${task.taskType} your ${task.plantName || 'plant'}.`;

                if (nextReminderDate > new Date()) {
                    newNotificationId = await scheduleReminderNotification(
                        reminderTitle,
                        reminderBody,
                        nextReminderDate
                    );
                }

                // Delete old notification if any
                const q = query(collection(db, 'notifications'), where('relatedId', '==', id), where('type', '==', 'reminder'));
                const snap = await getDocs(q);
                snap.docs.forEach(async (d) => await deleteDoc(doc(db, 'notifications', d.id)));

                // Add new future notification
                if (newNotificationId) {
                    await addDoc(collection(db, 'notifications'), {
                        type: 'reminder',
                        title: reminderTitle,
                        description: reminderBody,
                        userId: task.userId,
                        relatedId: id,
                        isRead: false,
                        createdAt: serverTimestamp(),
                        triggerAt: nextReminderDate
                    });
                }

                // Update the SAME task with new due date (not creating a new task)
                await updateDoc(taskRef, {
                    completed: false, // Reset to incomplete for next occurrence
                    reminderDateTime: nextReminderDate,
                    lastCompletedAt: lastCompletedAt, // Track when it was last completed
                    completionCount: (task.completionCount || 0) + 1, // Track total completions
                    notificationId: newNotificationId,
                });
                console.log('✅ Recurring task reset to next occurrence:', nextReminderDate.toDateString());

                return {
                    isRecurring: true,
                    nextDate: nextReminderDate,
                    task: task
                };
            } else {
                // Non-recurring task, just toggle completed status

                // Example: If completing, cancel notification. If un-completing, maybe re-schedule?
                // For simplicity: If completing, cancel. If un-completing, we leave it (or re-schedule if future).
                if (newCompletedStatus && task.notificationId) {
                    await cancelNotification(task.notificationId);
                    await updateDoc(taskRef, { completed: true, notificationId: null });

                    // Mark as read / delete associated notification
                    const q = query(collection(db, 'notifications'), where('relatedId', '==', id), where('type', '==', 'reminder'));
                    const snap = await getDocs(q);
                    snap.docs.forEach(async (d) => await deleteDoc(doc(db, 'notifications', d.id)));
                } else {
                    await updateDoc(taskRef, { completed: newCompletedStatus });
                }

                console.log('✅ Task toggled:', id, 'completed:', newCompletedStatus);
                return { isRecurring: false };
            }
        } catch (error) {
            console.error("❌ Toggle Error:", error);
            return null;
        }
    };

    // ✅ 4. Update Task (Edit in Backend)
    const updateTask = async (id: string, updates: Partial<Task>) => {
        try {
            // Handle Notification Rescheduling
            const task = tasks.find(t => t.id === id);
            let newNotificationId = undefined; // undefined means no change if not touched

            if (task && updates.reminderDateTime) {
                // If date changed, cancel old and schedule new
                if (task.notificationId) {
                    await cancelNotification(task.notificationId);
                }

                const newDate = updates.reminderDateTime instanceof Date ? updates.reminderDateTime : new Date(updates.reminderDateTime as any);
                let reminderTitle = `GardenMate Reminder: ${updates.title || task.title}`;
                let reminderBody = `Time to ${updates.taskType || task.taskType || 'care for'} your ${updates.plantName || task.plantName || 'plant'}!`;

                if (newDate > new Date()) {
                    newNotificationId = await scheduleReminderNotification(
                        reminderTitle,
                        reminderBody,
                        newDate,
                        {
                            taskType: updates.taskType || task.taskType || 'custom',
                            plantName: updates.plantName || task.plantName || 'plant',
                            isReminder: true
                        }
                    );

                    // Replace old notification in DB
                    const q = query(collection(db, 'notifications'), where('relatedId', '==', id), where('type', '==', 'reminder'));
                    const snap = await getDocs(q);
                    snap.docs.forEach(async (d) => await deleteDoc(doc(db, 'notifications', d.id)));

                    await addDoc(collection(db, 'notifications'), {
                        type: 'reminder',
                        title: reminderTitle,
                        description: reminderBody,
                        userId: task.userId,
                        relatedId: id,
                        isRead: false,
                        createdAt: serverTimestamp(),
                        triggerAt: newDate
                    });
                } else {
                    newNotificationId = null; // Clear if past
                    // Also clear DB
                    const q = query(collection(db, 'notifications'), where('relatedId', '==', id), where('type', '==', 'reminder'));
                    const snap = await getDocs(q);
                    snap.docs.forEach(async (d) => await deleteDoc(doc(db, 'notifications', d.id)));
                }
            }

            const taskRef = doc(db, 'tasks', id);
            await updateDoc(taskRef, {
                ...updates,
                ...(newNotificationId !== undefined ? { notificationId: newNotificationId } : {}),
                updatedAt: serverTimestamp(),
            });
            console.log('✅ Task updated:', id);
            return true;
        } catch (error) {
            console.error("❌ Update Error:", error);
            return false;
        }
    };

    // ✅ 5. Remove Task (Delete from Backend)
    const removeTask = async (id: string) => {
        try {
            // Cancel Notification
            const task = tasks.find(t => t.id === id);
            if (task?.notificationId) {
                await cancelNotification(task.notificationId);
            }
            // Delete associated notification record
            const q = query(collection(db, 'notifications'), where('relatedId', '==', id), where('type', '==', 'reminder'));
            const snap = await getDocs(q);
            snap.docs.forEach(async (d) => await deleteDoc(doc(db, 'notifications', d.id)));

            await deleteDoc(doc(db, 'tasks', id));
            console.log('✅ Task deleted:', id);
        } catch (error) {
            console.error("❌ Delete Error:", error);
        }
    };

    return { tasks, loading, addTask, toggleTask, updateTask, removeTask };
}