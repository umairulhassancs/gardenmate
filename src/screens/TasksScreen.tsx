import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    FlatList,
    Modal,
    TextInput,
    Alert,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTasks, Task, TaskType, TaskFrequency } from '../hooks/useTasks';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import DateTimePicker from '@react-native-community/datetimepicker';

type FilterTab = 'today' | 'scheduled' | 'history';
type HistoryFilter = 'all' | 'completed' | 'missed';

// Task Type Icon Component
const TaskTypeIcon = ({ type, size = 18 }: { type: TaskType | string; size?: number }) => {
    const iconMap: Record<string, string> = {
        water: 'droplet',
        fertilize: 'sun',
        prune: 'scissors',
        rotate: 'rotate-cw',
        clean: 'star',
        custom: 'edit-2',
    };
    return (
        <View style={[styles.taskTypeIcon, { width: size + 16, height: size + 16 }]}>
            <Feather name={iconMap[type] || 'circle'} size={size} color={colors.primary} />
        </View>
    );
};

// Frequency Badge Component
const FrequencyBadge = ({ frequency }: { frequency?: TaskFrequency }) => {
    if (!frequency || frequency === 'once') return null;

    const labelMap: Record<string, string> = {
        'daily': 'Daily',
        'every-2-days': '2 Days',
        'weekly': 'Weekly',
        'bi-weekly': 'Bi-Weekly',
        'monthly': 'Monthly',
    };

    return (
        <View style={styles.frequencyBadge}>
            <Feather name="repeat" size={10} color={colors.primary} />
            <Text style={styles.frequencyBadgeText}>{labelMap[frequency] || frequency}</Text>
        </View>
    );
};

// Status Badge Component for History
const StatusBadge = ({ task }: { task: Task }) => {
    const isRecurring = task.isRecurring;
    const completionCount = task.completionCount || 0;
    const isCompleted = isRecurring ? completionCount > 0 : task.completed;

    return (
        <View style={[styles.statusBadge, isCompleted ? styles.statusBadgeCompleted : styles.statusBadgeMissed]}>
            <Feather
                name={isCompleted ? 'check-circle' : 'x-circle'}
                size={12}
                color={isCompleted ? colors.primary : '#ef4444'}
            />
            <Text style={[styles.statusBadgeText, !isCompleted && { color: '#ef4444' }]}>
                {isRecurring
                    ? `${completionCount}x Done`
                    : (task.completed ? 'Completed' : 'Missed')}
            </Text>
        </View>
    );
};

export default function TasksScreen() {
    const navigation = useNavigation();
    const { tasks, loading, toggleTask, updateTask, removeTask } = useTasks();
    const [activeTab, setActiveTab] = useState<FilterTab>('today');
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState(new Date());
    const [editTime, setEditTime] = useState(new Date());
    const [editTaskType, setEditTaskType] = useState<TaskType>('custom');
    const [editFrequency, setEditFrequency] = useState<TaskFrequency>('once');
    const [editLocation, setEditLocation] = useState('');
    const [editPlantName, setEditPlantName] = useState('');
    const [editIsRecurring, setEditIsRecurring] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Helper: Get task datetime
    const getTaskDateTime = (task: Task): Date | null => {
        if (task.reminderDateTime) {
            return task.reminderDateTime instanceof Date
                ? task.reminderDateTime
                : new Date((task.reminderDateTime as any).seconds * 1000);
        }
        return null;
    };

    // Helper: Check if task can be marked complete (time has passed)
    const canCompleteTask = (task: Task): boolean => {
        if (task.completed) return false; // Already completed

        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime) return true; // No datetime set, allow completion

        const now = new Date();
        return now >= taskDateTime; // Can only complete if current time >= task time
    };

    // Helper: Get time status message
    const getTimeStatus = (task: Task): string | null => {
        if (task.completed) return null;

        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime) return null;

        const now = new Date();
        if (now < taskDateTime) {
            const diff = taskDateTime.getTime() - now.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 0) {
                return `Available in ${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                return `Available in ${minutes}m`;
            }
        }
        return null;
    };

    // Calculate comprehensive stats
    const stats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const completedTasks = tasks.filter(t => t.completed);
        const pendingTasks = tasks.filter(t => !t.completed);

        // Calculate missed tasks (past due and not completed)
        const missedTasks = pendingTasks.filter(task => {
            const taskDate = getTaskDateTime(task);
            return taskDate && taskDate < todayStart;
        });

        // Weekly stats
        const weeklyCompleted = completedTasks.filter(t => {
            if (t.createdAt?.seconds) {
                return new Date(t.createdAt.seconds * 1000) >= weekAgo;
            }
            return false;
        }).length;

        const weeklyTotal = tasks.filter(t => {
            if (t.createdAt?.seconds) {
                return new Date(t.createdAt.seconds * 1000) >= weekAgo;
            }
            return false;
        }).length;

        // Completion percentage
        const completionRate = tasks.length > 0
            ? Math.round((completedTasks.length / tasks.length) * 100)
            : 0;

        // Streak calculation
        let streak = 0;
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(todayStart);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toDateString();

            const hasCompleted = completedTasks.some(t => {
                if (t.createdAt?.seconds) {
                    return new Date(t.createdAt.seconds * 1000).toDateString() === dateStr;
                }
                return false;
            });

            if (hasCompleted) streak++;
            else if (i > 0) break;
        }

        return {
            completed: completedTasks.length,
            pending: pendingTasks.length,
            missed: missedTasks.length,
            total: tasks.length,
            completionRate,
            weeklyCompleted,
            weeklyTotal,
            streak,
        };
    }, [tasks]);

    // Filter tasks based on tab
    const filteredTasks = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        // Pending = not completed non-recurring OR recurring tasks
        const pendingTasks = tasks.filter(t => !t.completed || t.isRecurring);

        // History for recurring tasks: show if completionCount > 0
        // History for non-recurring: show if completed
        const historyTasks = tasks.filter(task => {
            if (task.isRecurring) {
                // Recurring tasks appear in history if they have at least 1 completion
                return (task.completionCount || 0) > 0;
            } else {
                // Non-recurring tasks appear in history when completed
                return task.completed;
            }
        });

        switch (activeTab) {
            case 'today':
                return tasks.filter(task => {
                    // Show tasks due today that are not yet completed
                    if (task.completed && !task.isRecurring) return false;
                    if (task.dueDate === 'Today') return true;
                    const taskDate = getTaskDateTime(task);
                    if (taskDate) {
                        return taskDate >= todayStart && taskDate < tomorrowStart;
                    }
                    return false;
                });
            case 'scheduled':
                // All active tasks (recurring always show, non-recurring show if not completed)
                return tasks.filter(t => t.isRecurring || !t.completed);
            case 'history':
                // Filter history based on sub-filter
                // For recurring tasks: 'completed' = has completionCount > 0
                // For non-recurring: 'completed' = completed === true
                if (historyFilter === 'completed') {
                    return historyTasks; // historyTasks already filters for completions
                } else if (historyFilter === 'missed') {
                    // Missed = non-recurring tasks that are past due and not completed
                    return tasks.filter(task => {
                        if (task.isRecurring) return false; // Recurring can't be "missed" in same way
                        if (task.completed) return false;
                        const taskDate = getTaskDateTime(task);
                        return taskDate && taskDate < todayStart;
                    });
                }
                return historyTasks;
            default:
                return pendingTasks;
        }
    }, [tasks, activeTab, historyFilter]);

    // Open edit modal with task data
    const openEditModal = (task: Task) => {
        setEditingTask(task);
        setEditTitle(task.title);

        const taskDateTime = getTaskDateTime(task) || new Date();
        setEditDate(taskDateTime);
        setEditTime(taskDateTime);

        // Set all other editable fields
        setEditTaskType(task.taskType || 'custom');
        setEditFrequency(task.frequency || 'once');
        setEditLocation(task.location || '');
        setEditPlantName(task.plantName || '');
        setEditIsRecurring(task.isRecurring || false);

        setShowEditModal(true);
    };

    // Close edit modal and reset state
    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingTask(null);
        setEditTitle('');
        setEditTaskType('custom');
        setEditFrequency('once');
        setEditLocation('');
        setEditPlantName('');
        setEditIsRecurring(false);
        setShowDatePicker(false);
        setShowTimePicker(false);
    };

    // Save edited task
    const saveEditedTask = async () => {
        if (!editingTask) return;

        if (!editTitle.trim()) {
            Alert.alert('Error', 'Reminder name cannot be empty');
            return;
        }

        // Combine date and time
        const combinedDateTime = new Date(
            editDate.getFullYear(),
            editDate.getMonth(),
            editDate.getDate(),
            editTime.getHours(),
            editTime.getMinutes()
        );

        const success = await updateTask(editingTask.id, {
            title: editTitle.trim(),
            reminderDateTime: combinedDateTime,
            taskType: editTaskType,
            frequency: editFrequency,
            location: editLocation,
            plantName: editPlantName,
            isRecurring: editIsRecurring,
        });

        if (success) {
            closeEditModal();
        } else {
            Alert.alert('Error', 'Failed to update reminder. Please try again.');
        }
    };

    // Delete task with confirmation
    const deleteTask = () => {
        if (!editingTask) return;

        Alert.alert(
            'Delete Reminder',
            `Are you sure you want to delete "${editingTask.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await removeTask(editingTask.id);
                        closeEditModal();
                    }
                }
            ]
        );
    };

    // Handle task completion attempt
    const handleTaskComplete = (task: Task) => {
        if (!canCompleteTask(task)) {
            const timeStatus = getTimeStatus(task);
            Alert.alert(
                'Not Available Yet',
                timeStatus
                    ? `This reminder is scheduled for later. ${timeStatus}`
                    : 'You can only mark reminders as done after their scheduled time.'
            );
            return;
        }
        toggleTask(task.id);
    };

    // Handle date change
    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setEditDate(selectedDate);
        }
    };

    // Handle time change
    const onTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) {
            setEditTime(selectedTime);
        }
    };

    const formatDate = (task: Task): string => {
        const date = getTaskDateTime(task);
        if (date) {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
        return task.dueDate || 'Not set';
    };

    const formatTime = (task: Task): string => {
        const date = getTaskDateTime(task);
        if (date) {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return '';
    };

    // Render task item based on tab
    const renderTaskItem = ({ item }: { item: Task }) => {
        const isHistory = activeTab === 'history';
        const canComplete = canCompleteTask(item);
        const timeStatus = getTimeStatus(item);

        return (
            <View style={[styles.taskCard, item.completed && styles.taskCardCompleted]}>
                <View style={styles.taskMainArea}>
                    <TaskTypeIcon type={item.taskType || 'custom'} />
                    <View style={styles.taskCardContent}>
                        <Text style={[styles.taskCardTitle, item.completed && styles.taskCardTitleCompleted]}>
                            {item.title}
                        </Text>
                        <View style={styles.taskCardMeta}>
                            <Text style={styles.taskCardDate}>{formatDate(item)}</Text>
                            <Text style={styles.taskCardTime}>{formatTime(item)}</Text>
                            <FrequencyBadge frequency={item.frequency} />
                        </View>
                        {/* Show time status for future tasks */}
                        {timeStatus && !isHistory && (
                            <Text style={styles.timeStatusText}>{timeStatus}</Text>
                        )}
                        {/* Show status badge in history */}
                        {isHistory && <StatusBadge task={item} />}
                    </View>
                </View>

                {/* Edit button - only for non-history */}
                {!isHistory && (
                    <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEditModal(item)}
                    >
                        <Feather name="edit-2" size={16} color={colors.primary} />
                    </TouchableOpacity>
                )}

                {/* Checkbox - only for non-history, and only if can complete */}
                {!isHistory && (
                    <TouchableOpacity
                        style={[styles.checkboxArea, !canComplete && styles.checkboxDisabled]}
                        onPress={() => handleTaskComplete(item)}
                        disabled={!canComplete && !item.completed}
                    >
                        <View style={[
                            styles.taskCheckbox,
                            item.completed && styles.taskCheckboxCompleted,
                            !canComplete && !item.completed && styles.taskCheckboxLocked
                        ]}>
                            {item.completed ? (
                                <Feather name="check" size={14} color="#fff" />
                            ) : !canComplete ? (
                                <Feather name="clock" size={12} color={colors.textMuted} />
                            ) : null}
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reminders</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('MainTabs', { screen: 'Home', params: { openAddTask: true } } as never)}
                    style={styles.addBtn}
                >
                    <Feather name="plus" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Stats Overview Card */}
            <View style={styles.statsCard}>
                <View style={styles.statsMainRow}>
                    <View style={styles.completionCircle}>
                        <Text style={styles.completionPercent}>{stats.completionRate}%</Text>
                        <Text style={styles.completionLabel}>Complete</Text>
                    </View>
                    <View style={styles.statsDetails}>
                        <View style={styles.statRow}>
                            <Feather name="check-circle" size={16} color={colors.primary} />
                            <Text style={styles.statText}>{stats.completed} Completed</Text>
                        </View>
                        <View style={styles.statRow}>
                            <Feather name="clock" size={16} color="#f59e0b" />
                            <Text style={styles.statText}>{stats.pending} Pending</Text>
                        </View>
                        <View style={styles.statRow}>
                            <Feather name="alert-circle" size={16} color="#ef4444" />
                            <Text style={[styles.statText, stats.missed > 0 && { color: '#ef4444', fontWeight: '600' }]}>
                                {stats.missed} Missed
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Weekly Report */}
                <View style={styles.weeklyReport}>
                    <Text style={styles.weeklyTitle}>This Week</Text>
                    <View style={styles.weeklyStats}>
                        <View style={styles.weeklyStat}>
                            <Text style={styles.weeklyValue}>{stats.weeklyCompleted}</Text>
                            <Text style={styles.weeklyLabel}>Done</Text>
                        </View>
                        <View style={styles.weeklyDivider} />
                        <View style={styles.weeklyStat}>
                            <Text style={styles.weeklyValue}>{stats.weeklyTotal - stats.weeklyCompleted}</Text>
                            <Text style={styles.weeklyLabel}>Remaining</Text>
                        </View>
                        <View style={styles.weeklyDivider} />
                        <View style={styles.weeklyStat}>
                            <Text style={[styles.weeklyValue, { color: colors.primary }]}>{stats.streak}</Text>
                            <Text style={styles.weeklyLabel}>Day Streak</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Tab Filters */}
            <View style={styles.tabsContainer}>
                {(['today', 'scheduled', 'history'] as FilterTab[]).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Feather
                            name={tab === 'today' ? 'calendar' : tab === 'scheduled' ? 'list' : 'clock'}
                            size={16}
                            color={activeTab === tab ? colors.primary : colors.textMuted}
                        />
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab === 'today' ? 'Today' : tab === 'scheduled' ? 'All Reminders' : 'History'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* History Filter Pills */}
            {activeTab === 'history' && (
                <View style={styles.historyFilterContainer}>
                    {(['all', 'completed', 'missed'] as HistoryFilter[]).map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.historyFilterPill, historyFilter === filter && styles.historyFilterPillActive]}
                            onPress={() => setHistoryFilter(filter)}
                        >
                            <Text style={[styles.historyFilterText, historyFilter === filter && styles.historyFilterTextActive]}>
                                {filter === 'all' ? 'All' : filter === 'completed' ? 'Completed' : 'Missed'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Task List */}
            {loading ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Loading reminders...</Text>
                </View>
            ) : filteredTasks.length > 0 ? (
                <FlatList
                    data={filteredTasks}
                    renderItem={renderTaskItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Feather
                        name={activeTab === 'today' ? 'check-circle' : activeTab === 'scheduled' ? 'list' : 'archive'}
                        size={48}
                        color={colors.textMuted}
                    />
                    <Text style={styles.emptyTitle}>
                        {activeTab === 'today' ? 'No reminders for today' :
                            activeTab === 'scheduled' ? 'No reminders scheduled' :
                                'No history yet'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {activeTab === 'today' ? 'You\'re all caught up!' :
                            activeTab === 'scheduled' ? 'Add reminders from the home screen' :
                                'Completed reminders will appear here'}
                    </Text>
                </View>
            )}

            {/* Edit Task Modal */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={closeEditModal}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={closeEditModal}
                    />
                    <View style={styles.editModal}>
                        {/* Modal Header */}
                        <View style={styles.editModalHeader}>
                            <Text style={styles.editModalTitle}>Edit Reminder</Text>
                            <TouchableOpacity onPress={closeEditModal} style={styles.closeModalBtn}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Task Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Reminder Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editTitle}
                                onChangeText={setEditTitle}
                                placeholder="Enter reminder name"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Date & Time Row */}
                        <View style={styles.dateTimeRow}>
                            {/* Date Picker */}
                            <View style={styles.dateTimeGroup}>
                                <Text style={styles.inputLabel}>Date</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeBtn}
                                    onPress={() => {
                                        setShowTimePicker(false);
                                        setShowDatePicker(true);
                                    }}
                                >
                                    <Feather name="calendar" size={18} color={colors.primary} />
                                    <Text style={styles.dateTimeBtnText}>
                                        {editDate.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Time Picker */}
                            <View style={styles.dateTimeGroup}>
                                <Text style={styles.inputLabel}>Time</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeBtn}
                                    onPress={() => {
                                        setShowDatePicker(false);
                                        setShowTimePicker(true);
                                    }}
                                >
                                    <Feather name="clock" size={18} color={colors.primary} />
                                    <Text style={styles.dateTimeBtnText}>
                                        {editTime.toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Plant Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Plant Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editPlantName}
                                onChangeText={setEditPlantName}
                                placeholder="e.g. Monstera"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Task Type */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Task Type</Text>
                            <View style={styles.pillContainer}>
                                {(['water', 'fertilize', 'clean', 'prune', 'rotate', 'custom'] as TaskType[]).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.pill, editTaskType === type && styles.pillActive]}
                                        onPress={() => setEditTaskType(type)}
                                    >
                                        <Text style={[styles.pillText, editTaskType === type && styles.pillTextActive]}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Frequency */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Frequency</Text>
                            <View style={styles.pillContainer}>
                                {(['once', 'daily', 'every-2-days', 'weekly', 'bi-weekly', 'monthly'] as TaskFrequency[]).map((freq) => (
                                    <TouchableOpacity
                                        key={freq}
                                        style={[styles.pill, editFrequency === freq && styles.pillActive]}
                                        onPress={() => {
                                            setEditFrequency(freq);
                                            setEditIsRecurring(freq !== 'once');
                                        }}
                                    >
                                        <Text style={[styles.pillText, editFrequency === freq && styles.pillTextActive]}>
                                            {freq === 'once' ? 'Once' :
                                                freq === 'every-2-days' ? 'Every 2 Days' :
                                                    freq.charAt(0).toUpperCase() + freq.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Date Picker Component */}
                        {showDatePicker && (
                            <DateTimePicker
                                value={editDate}
                                mode="date"
                                display="default"
                                minimumDate={new Date()}
                                onChange={onDateChange}
                            />
                        )}

                        {/* Time Picker Component */}
                        {showTimePicker && (
                            <DateTimePicker
                                value={editTime}
                                mode="time"
                                display="default"
                                onChange={onTimeChange}
                            />
                        )}

                        {/* Action Buttons */}
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={deleteTask}
                            >
                                <Feather name="trash-2" size={18} color="#ef4444" />
                                <Text style={styles.deleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={saveEditedTask}
                            >
                                <Feather name="check" size={18} color="#fff" />
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },

    // Stats Card
    statsCard: { marginHorizontal: spacing.lg, backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    statsMainRow: { flexDirection: 'row', alignItems: 'center' },
    completionCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.lg },
    completionPercent: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.primary },
    completionLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    statsDetails: { flex: 1, gap: spacing.xs },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    statText: { fontSize: fontSize.sm, color: colors.text },

    // Weekly Report
    weeklyReport: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    weeklyTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    weeklyStats: { flexDirection: 'row', justifyContent: 'space-around' },
    weeklyStat: { alignItems: 'center' },
    weeklyValue: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    weeklyLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    weeklyDivider: { width: 1, backgroundColor: colors.border },

    // Tabs
    tabsContainer: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, backgroundColor: '#f3f4f6' },
    tabActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
    tabText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.primary },

    // History Filter
    historyFilterContainer: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
    historyFilterPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: '#f3f4f6' },
    historyFilterPillActive: { backgroundColor: colors.primary },
    historyFilterText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted },
    historyFilterTextActive: { color: '#fff' },

    // Task List
    listContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
    taskCardCompleted: { opacity: 0.7, backgroundColor: '#f9fafb' },
    taskMainArea: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    taskTypeIcon: { borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center' },
    taskCardContent: { flex: 1, marginLeft: spacing.md },
    taskCardTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text, marginBottom: 4 },
    taskCardTitleCompleted: { textDecorationLine: 'line-through', color: colors.textMuted },
    taskCardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    taskCardDate: { fontSize: fontSize.xs, color: colors.textMuted },
    taskCardTime: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500' },
    frequencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full },
    frequencyBadgeText: { fontSize: 10, fontWeight: '600', color: colors.primary },
    editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    checkboxArea: { padding: spacing.xs },
    checkboxDisabled: { opacity: 0.5 },
    taskCheckbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    taskCheckboxCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
    taskCheckboxLocked: { backgroundColor: '#f3f4f6', borderColor: colors.border },

    // Status Badge
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full, marginTop: spacing.xs },
    statusBadgeCompleted: { backgroundColor: 'rgba(16,185,129,0.1)' },
    statusBadgeMissed: { backgroundColor: 'rgba(239,68,68,0.1)' },
    statusBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },

    // Time Status
    timeStatusText: { fontSize: fontSize.xs, color: '#f59e0b', fontWeight: '500', marginTop: 2 },

    // Empty State
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginTop: spacing.md },
    emptySubtext: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
    emptyText: { fontSize: fontSize.base, color: colors.textMuted },

    // Edit Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    editModal: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl + 20 },
    editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    editModalTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    closeModalBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },

    // Form Elements
    inputGroup: { marginBottom: spacing.lg },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    textInput: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, fontSize: fontSize.base, borderWidth: 1, borderColor: colors.border, color: colors.text },

    // Date Time Row
    dateTimeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    dateTimeGroup: { flex: 1 },
    dateTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    dateTimeBtnText: { fontSize: fontSize.base, color: colors.text, fontWeight: '500' },

    // Action Buttons
    actionButtonsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: 'rgba(239,68,68,0.1)', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    deleteBtnText: { fontSize: fontSize.base, fontWeight: '600', color: '#ef4444' },
    saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.lg },
    saveBtnText: { fontSize: fontSize.base, fontWeight: '600', color: '#fff' },

    // New Form Styles
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 4 },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '500' },
    pillTextActive: { color: '#fff' },
});
