import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, StatusBar,
    Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { usePlants, type HealthStatus } from '../hooks/usePlants';
import { useTasks, Task, TaskType, TaskFrequency } from '../hooks/useTasks';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { doc, deleteDoc, addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { scheduleReminderNotification, cancelNotification } from '../services/NotificationService';
import DateTimePicker from '@react-native-community/datetimepicker';

// Icon component for care actions
function CareIcon({ type, size = 24, color }: { type: string; size?: number; color?: string }) {
    const iconMap: Record<string, any> = {
        water: 'droplet',
        fertilize: 'sun',
        clean: 'star',
        rotate: 'rotate-cw',
        prune: 'scissors',
        custom: 'edit-2',
    };
    return <Feather name={iconMap[type] || 'feather'} size={size} color={color || colors.primary} />;
}

export default function PlantDetailScreen({ navigation, route }: any) {
    const plantId = route.params?.plantId;
    const { getPlantById, logCareAction, updatePlant, removePlant } = usePlants();
    const { tasks, toggleTask, addTask, removeTask } = useTasks();

    const plant = getPlantById(plantId);

    // All tasks (reminders) for this plant
    const allPlantTasks = tasks.filter(t => t.plantId === plantId);
    const pendingPlantTasks = allPlantTasks.filter(t => !t.completed || t.isRecurring);
    const completedPlantTasks = allPlantTasks.filter(t => {
        if (t.isRecurring) return (t.completionCount || 0) > 0;
        return t.completed;
    });

    // ── Compute dynamic status based on reminder completion ──
    const computedStatus: HealthStatus = useMemo(() => {
        if (allPlantTasks.length === 0) return 'good'; // No reminders → default GOOD

        let totalScore = 0;
        let count = 0;

        allPlantTasks.forEach(task => {
            count++;
            if (task.isRecurring) {
                totalScore += (task.completionCount || 0) > 0 ? 1 : 0;
            } else {
                totalScore += task.completed ? 1 : 0;
            }
        });

        const ratio = count > 0 ? totalScore / count : 0;
        if (ratio >= 0.7) return 'good';
        if (ratio >= 0.4) return 'average';
        return 'worst';
    }, [allPlantTasks]);

    // ── Auto-Sync Legacy Care Schedule to Real Tasks ──
    React.useEffect(() => {
        const syncLegacyTasks = async () => {
            if (!plant || plant.legacyTasksSynced) return;

            // If the plant has care schedules but no tasks in Firestore (legacy plant)
            if (plant.careSchedule && plant.careSchedule.length > 0 && allPlantTasks.length === 0) {
                console.log(`🔄 Auto-syncing ${plant.careSchedule.length} legacy tasks for ${plant.name}...`);

                for (const schedule of plant.careSchedule) {
                    await addTask({
                        title: `${schedule.taskType.charAt(0).toUpperCase() + schedule.taskType.slice(1)} ${plant.name}`,
                        plantId: plant.id,
                        plantName: plant.name,
                        taskType: schedule.taskType,
                        frequency: schedule.frequency as TaskFrequency,
                        isRecurring: true, // Legacy care schedules are always recurring
                        location: plant.location,
                        dueDate: 'Today', // Default to today for legacy tasks catching up
                    });
                }

                // Mark this plant as fully synced so we don't do this again
                console.log(`✅ Legacy auto-sync complete for ${plant.name}`);
                await updatePlant(plant.id, { legacyTasksSynced: true });
            }
        };

        syncLegacyTasks();
    }, [plant?.id, plant?.legacyTasksSynced, allPlantTasks.length]);

    // ── Add Reminder Modal State ──
    const [showAddReminderModal, setShowAddReminderModal] = useState(false);
    const [taskType, setTaskType] = useState<TaskType | 'custom'>('water');
    const [customTaskName, setCustomTaskName] = useState('');
    const [repeatFrequency, setRepeatFrequency] = useState<'once' | 'daily' | 'every-3-days' | 'weekly' | 'monthly' | 'custom'>('once');
    const [customDays, setCustomDays] = useState('');
    const [reminderDate, setReminderDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    if (!plant) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.notFound}>
                    <Feather name="feather" size={64} color={colors.textMuted} />
                    <Text style={styles.notFoundText}>Plant not found</Text>
                    <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={16} color={colors.primary} />
                        <Text style={styles.backLinkText}>Back to Garden</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ── Helper: can complete task (time has passed) ──
    const getTaskDateTime = (task: Task): Date | null => {
        if (task.reminderDateTime) {
            return task.reminderDateTime instanceof Date
                ? task.reminderDateTime
                : new Date((task.reminderDateTime as any).seconds * 1000);
        }
        return null;
    };

    const canCompleteTask = (task: Task): boolean => {
        if (task.completed && !task.isRecurring) return false;
        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime) return true;
        return new Date() >= taskDateTime;
    };

    const handleQuickDone = (task: Task) => {
        if (!canCompleteTask(task)) {
            Alert.alert('Not Available Yet', 'You can only mark reminders as done after their scheduled time.');
            return;
        }
        toggleTask(task.id);
        // Also log the care action for backwards compatibility
        const actionMap: Record<string, 'water' | 'fertilize' | 'clean'> = {
            water: 'water', fertilize: 'fertilize', clean: 'clean'
        };
        if (task.taskType && actionMap[task.taskType]) {
            logCareAction(plantId, actionMap[task.taskType]);
        }
        Alert.alert('Done!', `"${task.title}" marked as completed!`);
    };

    // ── Add Reminder Submit ──
    const handleAddReminder = async () => {
        if (taskType === 'custom' && !customTaskName.trim()) {
            Alert.alert('Reminder Name Required', 'Please enter a custom reminder name');
            return;
        }
        if (repeatFrequency === 'custom' && !customDays.trim()) {
            Alert.alert('Custom Days Required', 'Please enter number of days');
            return;
        }

        const taskTitleText = taskType === 'custom'
            ? `${customTaskName} - ${plant.name}`
            : `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} ${plant.name}`;

        const frequencyMap: Record<string, TaskFrequency> = {
            'once': 'once',
            'daily': 'daily',
            'every-3-days': 'every-2-days',
            'weekly': 'weekly',
            'monthly': 'monthly',
            'custom': 'weekly',
        };

        await addTask({
            title: taskTitleText,
            plantId: plant.id,
            plantName: plant.name,
            taskType: taskType === 'custom' ? 'custom' : taskType,
            dueDate: reminderDate.toDateString() === new Date().toDateString() ? 'Today' :
                reminderDate.toDateString() === new Date(Date.now() + 86400000).toDateString() ? 'Tomorrow' : 'Later',
            reminderDateTime: reminderDate,
            frequency: frequencyMap[repeatFrequency] || 'once',
            isRecurring: repeatFrequency !== 'once',
        });

        // Schedule push notification
        const reminderBody = taskType === 'custom'
            ? `${customTaskName} for ${plant.name}!`
            : `Time to ${taskType} ${plant.name}!`;

        await scheduleReminderNotification(
            `🌱 Plant Reminder`,
            reminderBody,
            reminderDate
        );

        // Create in-app notification
        const user = auth.currentUser;
        if (user) {
            const reminderDesc = taskType === 'custom'
                ? `${customTaskName} for ${plant.name}`
                : `Time to ${taskType} ${plant.name}`;
            const dateStr = reminderDate.toLocaleDateString();
            const timeStr = reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            await addDoc(collection(db, 'notifications'), {
                userId: user.uid,
                title: `🌱 Reminder: ${taskTitleText}`,
                description: `${reminderDesc} — ${dateStr} at ${timeStr}${repeatFrequency !== 'once' ? ` (Repeats ${repeatFrequency})` : ''}`,
                type: 'reminder',
                read: false,
                isRead: false,
                time: serverTimestamp(),
                createdAt: serverTimestamp(),
            });
        }

        // Reset form
        setShowAddReminderModal(false);
        setTaskType('water');
        setCustomTaskName('');
        setRepeatFrequency('once');
        setCustomDays('');
        setReminderDate(new Date());
        Alert.alert('Success', `Reminder added for ${plant.name}!`);
    };

    // ── Delete Plant + all associated reminders (queries Firestore directly) ──
    const handleDelete = () => {
        Alert.alert(
            'Delete Plant',
            `Are you sure you want to remove ${plant.name} and all its reminders from your garden?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const user = auth.currentUser;
                            if (!user) return;

                            // 1. Cancel all scheduled notifications for this plant's reminders
                            const tasksQuery = query(
                                collection(db, 'tasks'),
                                where('userId', '==', user.uid),
                                where('plantId', '==', plantId)
                            );
                            const tasksSnapshot = await getDocs(tasksQuery);
                            console.log(`🗑️ Found ${tasksSnapshot.docs.length} reminders for plant ${plantId}`);

                            // Cancel notifications before deleting
                            for (const taskDoc of tasksSnapshot.docs) {
                                const taskData = taskDoc.data();
                                if (taskData.notificationId) {
                                    try {
                                        await cancelNotification(taskData.notificationId);
                                        console.log(`🔕 Cancelled notification: ${taskData.notificationId}`);
                                    } catch (e) { /* notification may already be expired */ }
                                }
                            }

                            // 2. Delete the plant + all tasks via removePlant (handles Firestore + local state)
                            if (typeof removePlant === 'function') {
                                await removePlant(plantId);
                            }

                            // 3. Also clean up legacy path (plants saved before fix)
                            try {
                                const legacyPlantRef = doc(db, 'plants', user.uid, 'items', plantId);
                                await deleteDoc(legacyPlantRef);
                                console.log('✅ Also deleted from legacy path');
                            } catch (e) { /* may not exist at legacy path */ }

                            Alert.alert('Success', `${plant.name} and all its reminders have been removed.`);
                            navigation.goBack();
                        } catch (error) {
                            console.error('❌ Error deleting plant:', error);
                            Alert.alert('Error', 'Failed to delete plant. Please try again.');
                        }
                    }
                },
            ]
        );
    };

    const healthColors: Record<HealthStatus, string> = {
        'good': '#22c55e',
        'average': '#f59e0b',
        'worst': '#ef4444',
    };

    const healthIcons: Record<HealthStatus, any> = {
        'good': 'smile',
        'average': 'alert-circle',
        'worst': 'alert-triangle',
    };

    const healthLabels: Record<HealthStatus, string> = {
        'good': 'GOOD',
        'average': 'Avg',
        'worst': 'Worst',
    };

    // Task type icon/color map for quick actions
    const taskTypeColors: Record<string, { bg: string; color: string }> = {
        water: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
        fertilize: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
        clean: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' },
        rotate: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
        prune: { bg: 'rgba(236,72,153,0.1)', color: '#ec4899' },
        custom: { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Image */}
                <View style={styles.imageContainer}>
                    {plant.image ? (
                        <Image source={{ uri: plant.image }} style={styles.headerImage} />
                    ) : (
                        <LinearGradient
                            colors={['rgba(243,244,246,0.8)', 'rgba(229,231,235,0.5)']}
                            style={styles.imagePlaceholder}
                        >
                            <Feather name="feather" size={80} color={colors.primary} />
                        </LinearGradient>
                    )}

                    {/* Back Button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={20} color={colors.text} />
                    </TouchableOpacity>

                    {/* Health Badge — dynamic status */}
                    <View style={[styles.healthBadge, { backgroundColor: healthColors[computedStatus] }]}>
                        <Feather name={healthIcons[computedStatus]} size={14} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.healthText}>{healthLabels[computedStatus]}</Text>
                    </View>
                </View>

                <View style={styles.content}>
                    {/* Plant Info */}
                    <View style={styles.infoSection}>
                        <Text style={styles.plantName}>{plant.name}</Text>
                        <Text style={styles.plantSpecies}>{plant.species || 'Unknown species'}</Text>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Feather name="map-pin" size={14} color={colors.textMuted} />
                                <Text style={styles.metaText}>{plant.location || 'No location'}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Feather name="calendar" size={14} color={colors.textMuted} />
                                <Text style={styles.metaText}>
                                    Added {new Date(plant.dateAdded).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>

                        {/* Status Explanation */}
                        <View style={[styles.statusExplainer, { backgroundColor: healthColors[computedStatus] + '15' }]}>
                            <Feather name={healthIcons[computedStatus]} size={16} color={healthColors[computedStatus]} />
                            <Text style={[styles.statusExplainerText, { color: healthColors[computedStatus] }]}>
                                {computedStatus === 'good' ? 'Great job! Most reminders completed' :
                                    computedStatus === 'average' ? 'Some reminders pending attention' :
                                        'Needs care! Most reminders not completed'}
                                {' '}({allPlantTasks.length > 0
                                    ? `${completedPlantTasks.length}/${allPlantTasks.length} done`
                                    : 'No reminders set'})
                            </Text>
                        </View>
                    </View>

                    {/* Quick Actions — only plant's own reminders */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Quick Actions</Text>
                            <TouchableOpacity
                                style={styles.addReminderBtn}
                                onPress={() => setShowAddReminderModal(true)}
                            >
                                <Feather name="plus" size={16} color="#fff" />
                                <Text style={styles.addReminderBtnText}>Add Reminder</Text>
                            </TouchableOpacity>
                        </View>


                        {pendingPlantTasks.length > 0 ? (
                            <View style={styles.tasksCard}>
                                {pendingPlantTasks.map((task, index) => {
                                    const typeColor = taskTypeColors[task.taskType || 'custom'] || taskTypeColors.custom;
                                    const canDo = canCompleteTask(task);
                                    return (
                                        <View
                                            key={`quick-${task.id}-${index}`}
                                            style={[
                                                styles.quickActionItem,
                                                index === pendingPlantTasks.length - 1 && { borderBottomWidth: 0 }
                                            ]}
                                        >
                                            <View style={[styles.quickActionIcon, { backgroundColor: typeColor.bg }]}>
                                                <CareIcon type={task.taskType || 'custom'} size={20} color={typeColor.color} />
                                            </View>
                                            <View style={styles.quickActionContent}>
                                                <Text style={styles.quickActionTitle}>{task.title}</Text>
                                                <Text style={styles.quickActionSub}>
                                                    {task.frequency && task.frequency !== 'once'
                                                        ? `${task.frequency} • `
                                                        : ''}
                                                    {task.dueDate || 'No date'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.doneBtn,
                                                    !canDo && styles.doneBtnDisabled
                                                ]}
                                                onPress={() => handleQuickDone(task)}
                                                disabled={!canDo}
                                            >
                                                {canDo ? (
                                                    <>
                                                        <Feather name="check" size={14} color="#fff" />
                                                        <Text style={styles.doneBtnText}>Done</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Feather name="clock" size={14} color={colors.textMuted} />
                                                        <Text style={[styles.doneBtnText, { color: colors.textMuted }]}>Wait</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.emptyCard}>
                                <Feather name="bell" size={32} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No reminders set for {plant.name}</Text>
                                <Text style={styles.emptySubText}>Tap "Add Reminder" to set one</Text>
                            </View>
                        )}
                    </View>

                    {/* Care History — all completed reminders */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Care History</Text>
                            {completedPlantTasks.length > 0 && (
                                <View style={styles.taskCount}>
                                    <Text style={styles.taskCountText}>{completedPlantTasks.length}</Text>
                                </View>
                            )}
                        </View>
                        {completedPlantTasks.length > 0 ? (
                            <View style={styles.historyCard}>
                                {completedPlantTasks.map((task, index) => {
                                    const typeColor = taskTypeColors[task.taskType || 'custom'] || taskTypeColors.custom;
                                    const completedAt = task.lastCompletedAt
                                        ? (task.lastCompletedAt instanceof Date
                                            ? task.lastCompletedAt
                                            : new Date((task.lastCompletedAt as any).seconds * 1000))
                                        : (task.createdAt?.seconds
                                            ? new Date(task.createdAt.seconds * 1000)
                                            : null);

                                    return (
                                        <View
                                            key={`history-${task.id}-${index}`}
                                            style={[
                                                styles.historyItem,
                                                index === completedPlantTasks.length - 1 && { borderBottomWidth: 0 }
                                            ]}
                                        >
                                            <View style={[styles.historyIcon, { backgroundColor: typeColor.bg }]}>
                                                <CareIcon type={task.taskType || 'custom'} size={18} color={typeColor.color} />
                                            </View>
                                            <View style={styles.historyContent}>
                                                <Text style={styles.historyLabel}>{task.title}</Text>
                                                <Text style={styles.historyDate}>
                                                    {completedAt
                                                        ? completedAt.toLocaleString()
                                                        : 'Completed'}
                                                    {task.isRecurring && task.completionCount
                                                        ? ` • ${task.completionCount}x completed`
                                                        : ''}
                                                </Text>
                                            </View>
                                            <View style={styles.historyDoneIcon}>
                                                <Feather name="check-circle" size={18} color={colors.primary} />
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.emptyCard}>
                                <Feather name="clock" size={32} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No care history yet</Text>
                                <Text style={styles.emptySubText}>Complete reminders to build history</Text>
                            </View>
                        )}
                    </View>

                    {/* Notes */}
                    {plant.notes && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Notes</Text>
                            <View style={styles.notesCard}>
                                <Text style={styles.notesText}>{plant.notes}</Text>
                            </View>
                        </View>
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Feather name="trash-2" size={18} color="#ef4444" />
                        <Text style={styles.deleteText}>Remove from Garden</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>

            {/* ── Add Reminder Modal (same form as HomeScreen) ── */}
            <Modal
                visible={showAddReminderModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddReminderModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.taskModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Reminder for {plant.name}</Text>
                            <TouchableOpacity onPress={() => setShowAddReminderModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Task Type Picker */}
                            <Text style={styles.inputLabel}>Task Type</Text>
                            <View style={styles.taskTypeRow}>
                                {(['water', 'fertilize', 'prune', 'rotate', 'clean', 'custom'] as (TaskType | 'custom')[]).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.taskTypeBtn,
                                            taskType === type && styles.taskTypeBtnSelected
                                        ]}
                                        onPress={() => setTaskType(type)}
                                    >
                                        <Feather
                                            name={type === 'water' ? 'droplet' : type === 'fertilize' ? 'sun' : type === 'prune' ? 'scissors' : type === 'rotate' ? 'rotate-cw' : type === 'clean' ? 'star' : 'edit-2'}
                                            size={18}
                                            color={taskType === type ? '#fff' : colors.primary}
                                        />
                                        <Text style={[styles.taskTypeBtnText, taskType === type && { color: '#fff' }]}>
                                            {type === 'custom' ? 'Custom' : type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Custom Task Name */}
                            {taskType === 'custom' && (
                                <TextInput
                                    style={styles.customTaskInput}
                                    placeholder="Enter custom task name..."
                                    placeholderTextColor={colors.textMuted}
                                    value={customTaskName}
                                    onChangeText={setCustomTaskName}
                                />
                            )}

                            {/* Repeat Frequency */}
                            <Text style={styles.inputLabel}>Repeat Frequency</Text>
                            <View style={styles.frequencyRow}>
                                {([
                                    { key: 'once', label: 'Once', icon: 'circle' },
                                    { key: 'daily', label: 'Daily', icon: 'sun' },
                                    { key: 'every-3-days', label: '3 Days', icon: 'calendar' },
                                    { key: 'weekly', label: 'Weekly', icon: 'repeat' },
                                    { key: 'monthly', label: 'Monthly', icon: 'calendar' },
                                    { key: 'custom', label: 'Custom', icon: 'edit-3' },
                                ] as { key: typeof repeatFrequency; label: string; icon: any }[]).map((freq) => (
                                    <TouchableOpacity
                                        key={freq.key}
                                        style={[
                                            styles.frequencyBtn,
                                            repeatFrequency === freq.key && styles.frequencyBtnSelected
                                        ]}
                                        onPress={() => setRepeatFrequency(freq.key)}
                                    >
                                        <Feather
                                            name={freq.icon}
                                            size={14}
                                            color={repeatFrequency === freq.key ? '#fff' : colors.primary}
                                        />
                                        <Text style={[styles.frequencyBtnText, repeatFrequency === freq.key && { color: '#fff' }]}>
                                            {freq.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Custom Days */}
                            {repeatFrequency === 'custom' && (
                                <View style={styles.customDaysRow}>
                                    <Text style={styles.customDaysLabel}>Repeat every</Text>
                                    <TextInput
                                        style={styles.customDaysInput}
                                        placeholder="7"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="numeric"
                                        value={customDays}
                                        onChangeText={setCustomDays}
                                    />
                                    <Text style={styles.customDaysLabel}>days</Text>
                                </View>
                            )}

                            {/* Date/Time Picker */}
                            <Text style={styles.inputLabel}>Reminder Date & Time</Text>
                            <View style={styles.dateTimeRow}>
                                <TouchableOpacity
                                    style={styles.dateTimeBtn}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Feather name="calendar" size={18} color={colors.primary} />
                                    <Text style={styles.dateTimeText}>
                                        {reminderDate.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.dateTimeBtn}
                                    onPress={() => setShowTimePicker(true)}
                                >
                                    <Feather name="clock" size={18} color={colors.primary} />
                                    <Text style={styles.dateTimeText}>
                                        {reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={reminderDate}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event, date) => {
                                        setShowDatePicker(false);
                                        if (date) setReminderDate(date);
                                    }}
                                />
                            )}

                            {showTimePicker && (
                                <DateTimePicker
                                    value={reminderDate}
                                    mode="time"
                                    display="default"
                                    onChange={(event, date) => {
                                        setShowTimePicker(false);
                                        if (date) setReminderDate(date);
                                    }}
                                />
                            )}

                            {/* Submit */}
                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={handleAddReminder}
                            >
                                <Feather name="check" size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>Add Reminder</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    notFoundText: { fontSize: fontSize.lg, color: colors.textMuted, marginVertical: spacing.md },
    backLink: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    backLinkText: { color: colors.primary, fontWeight: '500', marginLeft: 4 },
    imageContainer: { height: 300, position: 'relative' },
    headerImage: { width: '100%', height: '100%' },
    imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backButton: {
        position: 'absolute', top: spacing.lg, left: spacing.lg,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    },
    healthBadge: {
        position: 'absolute', top: spacing.lg, right: spacing.lg,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadius.full
    },
    healthText: { color: '#fff', fontSize: fontSize.xs, fontWeight: 'bold', textTransform: 'uppercase' },
    content: {
        padding: spacing.lg, marginTop: -spacing.xl,
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl
    },
    infoSection: { marginBottom: spacing.xl },
    plantName: { fontSize: 32, fontWeight: 'bold', color: colors.text },
    plantSpecies: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg, marginTop: spacing.sm },
    metaText: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: 4 },
    statusExplainer: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: spacing.md, padding: spacing.md,
        borderRadius: borderRadius.md
    },
    statusExplainerText: { fontSize: fontSize.sm, fontWeight: '500', marginLeft: spacing.sm, flex: 1 },
    section: { marginBottom: spacing.xl },
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.md
    },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    addReminderBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: borderRadius.full,
        gap: 4
    },
    addReminderBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '600' },
    taskCount: {
        backgroundColor: colors.primary, width: 24, height: 24,
        borderRadius: 12, justifyContent: 'center', alignItems: 'center'
    },
    taskCountText: { color: '#fff', fontSize: fontSize.xs, fontWeight: 'bold' },
    tasksCard: {
        backgroundColor: '#fff', borderRadius: borderRadius.lg,
        padding: spacing.md, borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)'
    },
    quickActionItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: spacing.md, borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.3)'
    },
    quickActionIcon: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginRight: spacing.md
    },
    quickActionContent: { flex: 1 },
    quickActionTitle: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    quickActionSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    doneBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: borderRadius.md,
        gap: 4
    },
    doneBtnDisabled: { backgroundColor: 'rgba(243,244,246,0.8)' },
    doneBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '600' },
    emptyCard: {
        backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.lg,
        padding: spacing.xl, alignItems: 'center'
    },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, fontWeight: '500' },
    emptySubText: { color: colors.textMuted, textAlign: 'center', marginTop: 4, fontSize: fontSize.xs },
    historyCard: {
        backgroundColor: '#fff', borderRadius: borderRadius.lg,
        padding: spacing.md, borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)'
    },
    historyItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: spacing.md, borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.3)'
    },
    historyIcon: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginRight: spacing.md
    },
    historyContent: { flex: 1 },
    historyLabel: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    historyDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    historyDoneIcon: { marginLeft: spacing.sm },
    emptyHistory: { padding: spacing.lg, alignItems: 'center' },
    notesCard: {
        backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.lg,
        padding: spacing.md
    },
    notesText: { fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
    deleteButton: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        padding: spacing.lg, backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: borderRadius.lg, marginTop: spacing.lg,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)'
    },
    deleteText: { color: '#ef4444', fontWeight: '600', marginLeft: spacing.sm },

    // ── Modal Styles (matching HomeScreen) ──
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    taskModalContent: {
        backgroundColor: '#fff', borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl, padding: spacing.lg,
        maxHeight: '85%'
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.lg
    },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
    taskTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    taskTypeBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: colors.primary, gap: 4
    },
    taskTypeBtnSelected: { backgroundColor: colors.primary },
    taskTypeBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    customTaskInput: {
        backgroundColor: '#f8fafc', borderRadius: borderRadius.md,
        padding: spacing.md, fontSize: fontSize.base, color: colors.text,
        borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginTop: spacing.sm
    },
    frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    frequencyBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: colors.primary, gap: 4
    },
    frequencyBtnSelected: { backgroundColor: colors.primary },
    frequencyBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    customDaysRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
    customDaysLabel: { fontSize: fontSize.sm, color: colors.text },
    customDaysInput: {
        backgroundColor: '#f8fafc', paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)',
        width: 60, textAlign: 'center', fontSize: fontSize.base, color: colors.text
    },
    dateTimeRow: { flexDirection: 'row', gap: spacing.md },
    dateTimeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        padding: spacing.md, backgroundColor: '#f8fafc',
        borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)', gap: spacing.sm
    },
    dateTimeText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
    submitBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.primary, padding: spacing.lg,
        borderRadius: borderRadius.lg, marginTop: spacing.xl, gap: spacing.sm
    },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
});