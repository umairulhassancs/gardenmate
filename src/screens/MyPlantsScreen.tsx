import React, { useState, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet,
    SafeAreaView, Modal, Alert, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { usePlants, type CareSchedule } from '../hooks/usePlants';
import { useTasks, TaskType, TaskFrequency } from '../hooks/useTasks';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { collection, getDocs, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { scheduleReminderNotification } from '../services/NotificationService';
import DateTimePicker from '@react-native-community/datetimepicker';

const CARE_TEMPLATES = [
    { name: 'Tropical', tasks: [{ taskType: 'water' as const, frequency: 'every-2-days' as const }, { taskType: 'fertilize' as const, frequency: 'monthly' as const }] },
    { name: 'Succulent', tasks: [{ taskType: 'water' as const, frequency: 'weekly' as const }, { taskType: 'rotate' as const, frequency: 'bi-weekly' as const }] },
    { name: 'Flowering', tasks: [{ taskType: 'water' as const, frequency: 'daily' as const }, { taskType: 'fertilize' as const, frequency: 'weekly' as const }] },
];

// Icon component for care actions
function CareIcon({ type, size = 24, color }: { type: string; size?: number; color?: string }) {
    const iconMap: Record<string, any> = {
        water: 'droplet',
        fertilize: 'sun',
        clean: 'star',
        rotate: 'rotate-cw',
        prune: 'scissors',
    };
    return <Feather name={iconMap[type] || 'feather'} size={size} color={color || colors.primary} />;
}

export default function MyPlantsScreen({ navigation }: any) {

    const { addTask, tasks } = useTasks();
    const { plants, addPlant, loadPlants } = usePlants();
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [step, setStep] = useState(1);
    const [photoPreview, setPhotoPreview] = useState('');
    const [formData, setFormData] = useState({ name: '', species: '', location: '', notes: '' });
    const [careSchedule, setCareSchedule] = useState<CareSchedule[]>([]);
    const [loading, setLoading] = useState(false);

    // ── Reminder form state for Step 3 ──
    type PendingReminder = {
        taskType: TaskType | 'custom';
        customName: string;
        frequency: 'once' | 'daily' | 'every-3-days' | 'weekly' | 'monthly';
        reminderDate: Date;
    };
    const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [editingReminderIndex, setEditingReminderIndex] = useState<number | null>(null); // null = adding new, number = editing existing
    const [rmTaskType, setRmTaskType] = useState<TaskType | 'custom'>('water');
    const [rmCustomName, setRmCustomName] = useState('');
    const [rmFrequency, setRmFrequency] = useState<'once' | 'daily' | 'every-3-days' | 'weekly' | 'monthly'>('weekly');
    const [rmDate, setRmDate] = useState(new Date());
    const [rmShowDatePicker, setRmShowDatePicker] = useState(false);
    const [rmShowTimePicker, setRmShowTimePicker] = useState(false);

    // Apply to All state
    const [applyAllDate, setApplyAllDate] = useState(new Date());
    const [showApplyAllDatePicker, setShowApplyAllDatePicker] = useState(false);
    const [showApplyAllTimePicker, setShowApplyAllTimePicker] = useState(false);

    // Per-reminder date/time editing
    const [editingRmIndex, setEditingRmIndex] = useState<number | null>(null);
    const [editingRmMode, setEditingRmMode] = useState<'date' | 'time'>('date');

    // Firebase Data Fetching
    useEffect(() => {
        const fetchPlants = async () => {
            try {
                if (!auth.currentUser) return;
                setLoading(true);
                const plantsRef = collection(db, 'users', auth.currentUser.uid, 'plants');
                const snapshot = await getDocs(plantsRef);
                console.log('Fetched plants from Firebase:', snapshot.docs.length);
            } catch (error) {
                console.error("Firebase Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlants();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            console.log('🔄 MyPlantsScreen focused, refreshing plants...');
            if (loadPlants) {
                loadPlants();
            }
        }, [])
    );

    const filteredPlants = plants.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.species && p.species.toLowerCase().includes(search.toLowerCase()))
    );

    const handleImagePick = async () => {
        Alert.alert('Add Photo', 'Choose an option', [
            {
                text: 'Camera',
                onPress: async () => {
                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                    if (!result.canceled && result.assets[0]) {
                        setPhotoPreview(result.assets[0].uri);
                        setStep(2);
                    }
                }
            },
            {
                text: 'Gallery',
                onPress: async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
                    if (!result.canceled && result.assets[0]) {
                        setPhotoPreview(result.assets[0].uri);
                        setStep(2);
                    }
                }
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleTemplateSelect = (template: typeof CARE_TEMPLATES[0]) => {
        setCareSchedule(template.tasks.map(t => ({ ...t, enabled: true })));
    };

    const toggleCareTask = (taskType: CareSchedule['taskType']) => {
        const exists = careSchedule.find(t => t.taskType === taskType);
        if (exists) {
            setCareSchedule(prev => prev.filter(t => t.taskType !== taskType));
        } else {
            setCareSchedule(prev => [...prev, { taskType, frequency: 'weekly', enabled: true }]);
        }
    };

    // ── Add or update a reminder in the pending list ──
    const handleAddReminderToList = () => {
        if (rmTaskType === 'custom' && !rmCustomName.trim()) {
            Alert.alert('Name Required', 'Please enter a custom reminder name');
            return;
        }
        const reminderData: PendingReminder = {
            taskType: rmTaskType,
            customName: rmCustomName,
            frequency: rmFrequency,
            reminderDate: new Date(rmDate),
        };

        if (editingReminderIndex !== null) {
            // Update existing reminder
            setPendingReminders(prev => prev.map((rm, i) =>
                i === editingReminderIndex ? reminderData : rm
            ));
        } else {
            // Add new reminder
            setPendingReminders(prev => [...prev, reminderData]);
        }
        // Reset mini-form
        setShowReminderForm(false);
        setEditingReminderIndex(null);
        setRmTaskType('water');
        setRmCustomName('');
        setRmFrequency('weekly');
        setRmDate(new Date());
    };

    // ── Start editing an existing reminder ──
    const startEditReminder = (index: number) => {
        const rm = pendingReminders[index];
        setRmTaskType(rm.taskType);
        setRmCustomName(rm.customName);
        setRmFrequency(rm.frequency);
        setRmDate(new Date(rm.reminderDate));
        setEditingReminderIndex(index);
        setShowReminderForm(true);
    };

    const removeReminder = (index: number) => {
        setPendingReminders(prev => prev.filter((_, i) => i !== index));
    };

    // Update a specific reminder's date/time
    const updateReminderDate = (index: number, newDate: Date) => {
        setPendingReminders(prev => prev.map((rm, i) =>
            i === index ? { ...rm, reminderDate: newDate } : rm
        ));
    };

    // Apply same date & time to ALL reminders
    const applyDateTimeToAll = () => {
        if (pendingReminders.length === 0) return;
        setPendingReminders(prev => prev.map(rm => ({
            ...rm,
            reminderDate: new Date(applyAllDate),
        })));
        Alert.alert('Updated!', `Date & time applied to all ${pendingReminders.length} reminders.`);
    };

    const handleSubmit = async () => {
        try {
            if (!formData.name) {
                Alert.alert('Error', 'Please enter a plant name');
                return;
            }

            if (!auth.currentUser) {
                Alert.alert("Login Required", "Please login to add plants");
                return;
            }

            setLoading(true);

            const userId = auth.currentUser.uid;

            // Build careSchedule from pendingReminders
            const builtCareSchedule: CareSchedule[] = pendingReminders.map(r => ({
                taskType: (r.taskType === 'custom' ? 'water' : r.taskType) as CareSchedule['taskType'],
                frequency: (r.frequency === 'every-3-days' ? 'weekly' : r.frequency === 'once' ? 'daily' : r.frequency) as CareSchedule['frequency'],
                enabled: true,
            }));

            // Save plant via usePlants (saves to correct Firestore path: users/{uid}/plants/{id})
            const newPlant = await addPlant({
                ...formData,
                image: photoPreview,
                healthStatus: 'good',
                careSchedule: builtCareSchedule,
                notes: formData.notes,
                tags: []
            });

            if (!newPlant) {
                Alert.alert("Error", "Failed to add plant. Please try again.");
                return;
            }

            const plantId = newPlant.id;

            // Create tasks/reminders from pendingReminders
            const frequencyMap: Record<string, TaskFrequency> = {
                'once': 'once', 'daily': 'daily', 'every-3-days': 'every-2-days',
                'weekly': 'weekly', 'monthly': 'monthly',
            };

            for (const reminder of pendingReminders) {
                const titleText = reminder.taskType === 'custom'
                    ? `${reminder.customName} - ${formData.name}`
                    : `${reminder.taskType.charAt(0).toUpperCase() + reminder.taskType.slice(1)} ${formData.name}`;

                await addTask({
                    title: titleText,
                    plantId: plantId,
                    plantName: formData.name,
                    taskType: reminder.taskType === 'custom' ? 'custom' : reminder.taskType,
                    dueDate: reminder.reminderDate.toDateString() === new Date().toDateString() ? 'Today' : 'Later',
                    reminderDateTime: reminder.reminderDate,
                    frequency: frequencyMap[reminder.frequency] || 'once',
                    isRecurring: reminder.frequency !== 'once',
                    location: formData.location,
                });

                // Schedule push notification
                const body = reminder.taskType === 'custom'
                    ? `${reminder.customName} for ${formData.name}!`
                    : `Time to ${reminder.taskType} ${formData.name}!`;
                await scheduleReminderNotification('🌱 Plant Reminder', body, reminder.reminderDate);

                // In-app notification
                await addDoc(collection(db, 'notifications'), {
                    userId, title: `🌱 Reminder: ${titleText}`,
                    description: `${body} — ${reminder.reminderDate.toLocaleDateString()} at ${reminder.reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    type: 'reminder', read: false, isRead: false,
                    time: serverTimestamp(), createdAt: serverTimestamp(),
                });
            }

            Alert.alert('Success!', `${formData.name} has been added with ${pendingReminders.length} reminder(s)!`);
            resetForm();
        } catch (error) {
            console.error("Error saving plant:", error);
            Alert.alert("Error", "Failed to add plant. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setShowAddModal(false);
        setStep(1);
        setPhotoPreview('');
        setFormData({ name: '', species: '', location: '', notes: '' });
        setCareSchedule([]);
        setPendingReminders([]);
        setShowReminderForm(false);
        setEditingReminderIndex(null);
    };

    // Health status colors — dynamic based on reminder completion
    const healthColors: Record<string, string> = {
        'good': '#22c55e',
        'average': '#f59e0b',
        'worst': '#ef4444',
    };

    const healthIcons: Record<string, string> = {
        'good': 'smile',
        'average': 'alert-circle',
        'worst': 'alert-triangle',
    };

    const healthLabels: Record<string, string> = {
        'good': 'GOOD',
        'average': 'Avg',
        'worst': 'Worst',
    };

    // Compute dynamic status for a plant based on reminder completion
    const getPlantStatus = (plantId: string): 'good' | 'average' | 'worst' => {
        const plantTasks = tasks.filter(t => t.plantId === plantId);
        if (plantTasks.length === 0) return 'good'; // No reminders → default GOOD

        let totalScore = 0;
        plantTasks.forEach(task => {
            if (task.isRecurring) {
                totalScore += (task.completionCount || 0) > 0 ? 1 : 0;
            } else {
                totalScore += task.completed ? 1 : 0;
            }
        });

        const ratio = totalScore / plantTasks.length;
        if (ratio >= 0.7) return 'good';
        if (ratio >= 0.4) return 'average';
        return 'worst';
    };

    // Loading State
    if (loading && plants.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.notFound}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.notFoundText}>Loading your garden...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (

        <SafeAreaView style={styles.container}>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.plantName}>My Garden</Text>
                        <Text style={styles.plantSpecies}>{plants.length} Plants in your collection</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.section}>
                    <View style={styles.searchContainer}>
                        <Feather name="search" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search your plants..."
                            placeholderTextColor={colors.textMuted}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <Feather name="x" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Plants Grid Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Your Plants</Text>
                        <View style={styles.taskCount}>
                            <Text style={styles.taskCountText}>{filteredPlants.length}</Text>
                        </View>
                    </View>

                    {/* Add Plant Card */}
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => setShowAddModal(true)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.actionIconBox}>
                            <Feather name="plus" size={28} color={colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Add New Plant</Text>
                    </TouchableOpacity>

                    {/* Plants List */}
                    {filteredPlants.length > 0 ? (
                        <View style={styles.historyCard}>
                            {filteredPlants.map((plant, index) => (
                                <TouchableOpacity
                                    key={`plant-${plant.id}-${index}`} // ✅ FIXED: Unique key with index
                                    style={[
                                        styles.historyItem,
                                        index === filteredPlants.length - 1 && { borderBottomWidth: 0 }
                                    ]}
                                    onPress={() => navigation.navigate('PlantDetail', { plantId: plant.id })}
                                    activeOpacity={0.7}
                                >
                                    {/* Plant Image */}
                                    {(() => {
                                        const status = getPlantStatus(plant.id);
                                        return (
                                            <>
                                                <View style={[
                                                    styles.historyIcon,
                                                    { backgroundColor: healthColors[status] + '20' }
                                                ]}>
                                                    {plant.image ? (
                                                        <Image
                                                            source={{ uri: plant.image }}
                                                            style={styles.plantThumbnail}
                                                        />
                                                    ) : (
                                                        <Feather
                                                            name="feather"
                                                            size={24}
                                                            color={healthColors[status]}
                                                        />
                                                    )}
                                                </View>

                                                {/* Plant Info */}
                                                <View style={styles.historyContent}>
                                                    <Text style={styles.historyLabel}>{plant.name}</Text>
                                                    <Text style={styles.historyDate}>
                                                        {plant.species || 'Unknown species'} • {plant.location || 'No location'}
                                                    </Text>

                                                    {/* Care Schedule Tags */}
                                                    {plant.careSchedule && plant.careSchedule.length > 0 && (
                                                        <View style={styles.tagsRow}>
                                                            {plant.careSchedule.slice(0, 3).map((schedule, i) => (
                                                                <View key={`care-${plant.id}-${i}`} style={styles.careTag}>
                                                                    <CareIcon type={schedule.taskType} size={10} />
                                                                    <Text style={styles.careTagText}>{schedule.taskType}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Health Badge — dynamic status */}
                                                <View style={[
                                                    styles.healthBadgeSmall,
                                                    { backgroundColor: healthColors[status] }
                                                ]}>
                                                    <Feather
                                                        name={healthIcons[status]}
                                                        size={12}
                                                        color="#fff"
                                                    />
                                                </View>
                                                <Text style={[
                                                    styles.statusLabel,
                                                    { color: healthColors[status] }
                                                ]}>
                                                    {healthLabels[status]}
                                                </Text>

                                                {/* Arrow */}
                                                <Feather name="chevron-right" size={20} color={colors.textMuted} />
                                            </>
                                        );
                                    })()}
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyCard}>
                            <Feather name="feather" size={32} color={colors.primary} />
                            <Text style={styles.emptyText}>
                                {search ? 'No plants match your search' : 'No plants yet. Add your first!'}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>

            {/* Add Plant Modal */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={resetForm}>
                            <Feather name="x" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Add Plant ({step}/3)</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Step 1: Photo Upload */}
                        {step === 1 && (
                            <View style={styles.infoSection}>
                                <Text style={styles.sectionTitle}>Plant Photo</Text>
                                <TouchableOpacity
                                    style={styles.photoUploadCard}
                                    onPress={handleImagePick}
                                    activeOpacity={0.8}
                                >
                                    {photoPreview ? (
                                        <Image source={{ uri: photoPreview }} style={styles.photoPreview} />
                                    ) : (
                                        <View style={styles.photoPlaceholder}>
                                            <Feather name="camera" size={48} color={colors.textMuted} />
                                            <Text style={styles.uploadText}>Take or Upload Photo</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {photoPreview && (
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => setStep(2)}
                                    >
                                        <Text style={styles.deleteText}>Continue</Text>
                                        <Feather name="arrow-right" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Step 2: Basic Information */}
                        {step === 2 && (
                            <View style={styles.infoSection}>
                                <Text style={styles.sectionTitle}>Plant Information</Text>

                                <Text style={styles.label}>Plant Name *</Text>
                                <TextInput
                                    style={styles.notesCard}
                                    placeholder="e.g., Monty"
                                    placeholderTextColor={colors.textMuted}
                                    value={formData.name}
                                    onChangeText={v => setFormData({ ...formData, name: v })}
                                />

                                <Text style={styles.label}>Species</Text>
                                <TextInput
                                    style={styles.notesCard}
                                    placeholder="e.g., Monstera Deliciosa"
                                    placeholderTextColor={colors.textMuted}
                                    value={formData.species}
                                    onChangeText={v => setFormData({ ...formData, species: v })}
                                />

                                <Text style={styles.label}>Location</Text>
                                <View style={styles.metaRow}>
                                    <Feather name="map-pin" size={14} color={colors.textMuted} />
                                    <TextInput
                                        style={styles.metaInput}
                                        placeholder="e.g., Living Room"
                                        placeholderTextColor={colors.textMuted}
                                        value={formData.location}
                                        onChangeText={v => setFormData({ ...formData, location: v })}
                                    />
                                </View>

                                <Text style={styles.label}>Notes (Optional)</Text>
                                <TextInput
                                    style={[styles.notesCard, { height: 100, textAlignVertical: 'top' }]}
                                    placeholder="Any special care instructions..."
                                    placeholderTextColor={colors.textMuted}
                                    value={formData.notes}
                                    onChangeText={v => setFormData({ ...formData, notes: v })}
                                    multiline
                                />

                                <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                        style={[styles.deleteButton, { flex: 1 }]}
                                        onPress={() => setStep(1)}
                                    >
                                        <Feather name="arrow-left" size={18} color={colors.textMuted} />
                                        <Text style={styles.backLinkText}>Back</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.deleteButton, { flex: 1, borderColor: colors.primary }]}
                                        onPress={() => setStep(3)}
                                    >
                                        <Text style={styles.deleteText}>Continue</Text>
                                        <Feather name="arrow-right" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Step 3: Add Reminders */}
                        {step === 3 && (
                            <View style={styles.infoSection}>
                                <Text style={styles.sectionTitle}>Set Reminders</Text>
                                <Text style={[styles.label, { marginTop: 0 }]}>Add reminders for {formData.name || 'your plant'}</Text>

                                {/* List of added reminders */}
                                {pendingReminders.length > 0 && (
                                    <View style={styles.tasksCard}>
                                        {pendingReminders.map((rm, idx) => (
                                            <View key={`pending-rm-${idx}`} style={[styles.taskItem, { flexDirection: 'column', alignItems: 'flex-start' }, idx === pendingReminders.length - 1 && { borderBottomWidth: 0 }]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                                                    <CareIcon type={rm.taskType === 'custom' ? 'water' : rm.taskType} size={20} />
                                                    <View style={[styles.taskContent, { marginLeft: spacing.sm }]}>
                                                        <Text style={styles.taskTitle}>
                                                            {rm.taskType === 'custom' ? rm.customName : rm.taskType.charAt(0).toUpperCase() + rm.taskType.slice(1)}
                                                        </Text>
                                                        <Text style={[styles.taskDue, { textTransform: 'capitalize' }]}>
                                                            {rm.frequency}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => startEditReminder(idx)} style={{ padding: 4, marginRight: 8 }}>
                                                        <Feather name="edit-2" size={16} color={colors.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => removeReminder(idx)} style={{ padding: 4 }}>
                                                        <Feather name="trash-2" size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                                {/* Tappable Date & Time row */}
                                                <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm, paddingLeft: 28 }}>
                                                    <TouchableOpacity
                                                        style={styles.rmDateBtnSmall}
                                                        onPress={() => { setEditingRmIndex(idx); setEditingRmMode('date'); }}
                                                    >
                                                        <Feather name="calendar" size={12} color={colors.primary} />
                                                        <Text style={styles.rmDateTextSmall}>
                                                            {rm.reminderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </Text>
                                                        <Feather name="edit-2" size={10} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.rmDateBtnSmall}
                                                        onPress={() => { setEditingRmIndex(idx); setEditingRmMode('time'); }}
                                                    >
                                                        <Feather name="clock" size={12} color={colors.primary} />
                                                        <Text style={styles.rmDateTextSmall}>
                                                            {rm.reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                        <Feather name="edit-2" size={10} color={colors.textMuted} />
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Inline DateTimePicker for this reminder */}
                                                {editingRmIndex === idx && (
                                                    <DateTimePicker
                                                        value={rm.reminderDate}
                                                        mode={editingRmMode}
                                                        display="default"
                                                        minimumDate={editingRmMode === 'date' ? new Date() : undefined}
                                                        onChange={(e, date) => {
                                                            setEditingRmIndex(null);
                                                            if (date) updateReminderDate(idx, date);
                                                        }}
                                                    />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Apply Date & Time to All — only if 2+ reminders */}
                                {pendingReminders.length >= 2 && (
                                    <View style={styles.applyAllCard}>
                                        <Text style={styles.applyAllTitle}>Set Date & Time for All Reminders</Text>
                                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                                            <TouchableOpacity
                                                style={styles.rmDateBtn}
                                                onPress={() => setShowApplyAllDatePicker(true)}
                                            >
                                                <Feather name="calendar" size={16} color={colors.primary} />
                                                <Text style={styles.rmDateText}>
                                                    {applyAllDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.rmDateBtn}
                                                onPress={() => setShowApplyAllTimePicker(true)}
                                            >
                                                <Feather name="clock" size={16} color={colors.primary} />
                                                <Text style={styles.rmDateText}>
                                                    {applyAllDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {showApplyAllDatePicker && (
                                            <DateTimePicker
                                                value={applyAllDate}
                                                mode="date"
                                                display="default"
                                                minimumDate={new Date()}
                                                onChange={(e, date) => { setShowApplyAllDatePicker(false); if (date) setApplyAllDate(date); }}
                                            />
                                        )}
                                        {showApplyAllTimePicker && (
                                            <DateTimePicker
                                                value={applyAllDate}
                                                mode="time"
                                                display="default"
                                                onChange={(e, date) => { setShowApplyAllTimePicker(false); if (date) setApplyAllDate(date); }}
                                            />
                                        )}

                                        <TouchableOpacity
                                            style={styles.applyAllBtn}
                                            onPress={applyDateTimeToAll}
                                        >
                                            <Feather name="check-circle" size={16} color="#fff" />
                                            <Text style={styles.rmAddBtnText}>Apply to All ({pendingReminders.length} reminders)</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Add Reminder Button / Form */}
                                {!showReminderForm ? (
                                    <TouchableOpacity
                                        style={styles.addReminderCard}
                                        onPress={() => { setEditingReminderIndex(null); setShowReminderForm(true); }}
                                    >
                                        <Feather name="plus-circle" size={24} color={colors.primary} />
                                        <Text style={styles.addReminderCardText}>Add a Reminder</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.reminderFormCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                                            <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>
                                                {editingReminderIndex !== null ? 'Edit Reminder' : 'New Reminder'}
                                            </Text>
                                            <TouchableOpacity onPress={() => { setShowReminderForm(false); setEditingReminderIndex(null); }}>
                                                <Feather name="x" size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Plant Name (disabled, shown for context) */}
                                        {editingReminderIndex !== null && (
                                            <View style={{ marginBottom: spacing.sm }}>
                                                <Text style={styles.rmInputLabel}>Plant</Text>
                                                <View style={[styles.rmDateBtn, { backgroundColor: 'rgba(243,244,246,0.8)', opacity: 0.7 }]}>
                                                    <Feather name="feather" size={14} color={colors.textMuted} />
                                                    <Text style={[styles.rmDateText, { color: colors.textMuted }]}>
                                                        {formData.name || 'Your Plant'}
                                                    </Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Task Type */}
                                        <Text style={styles.rmInputLabel}>Task Type</Text>
                                        <View style={styles.rmPillRow}>
                                            {(['water', 'fertilize', 'prune', 'rotate', 'clean', 'custom'] as (TaskType | 'custom')[]).map((type) => {
                                                const isEditing = editingReminderIndex !== null;
                                                const isDisabled = isEditing && type !== rmTaskType;
                                                return (
                                                    <TouchableOpacity
                                                        key={type}
                                                        style={[
                                                            styles.rmPill,
                                                            rmTaskType === type && styles.rmPillActive,
                                                            isDisabled && { opacity: 0.35, borderColor: 'rgba(200,200,200,0.5)' },
                                                        ]}
                                                        onPress={() => { if (!isDisabled) setRmTaskType(type); }}
                                                        disabled={isDisabled}
                                                    >
                                                        <Feather
                                                            name={type === 'water' ? 'droplet' : type === 'fertilize' ? 'sun' : type === 'prune' ? 'scissors' : type === 'rotate' ? 'rotate-cw' : type === 'clean' ? 'star' : 'edit-2'}
                                                            size={14}
                                                            color={rmTaskType === type ? '#fff' : isDisabled ? colors.textMuted : colors.primary}
                                                        />
                                                        <Text style={[
                                                            styles.rmPillText,
                                                            rmTaskType === type && { color: '#fff' },
                                                            isDisabled && { color: colors.textMuted },
                                                        ]}>
                                                            {type === 'custom' ? 'Custom' : type.charAt(0).toUpperCase() + type.slice(1)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        {/* Custom Name */}
                                        {rmTaskType === 'custom' && (
                                            <TextInput
                                                style={styles.rmInput}
                                                placeholder="Enter custom reminder name..."
                                                placeholderTextColor={colors.textMuted}
                                                value={rmCustomName}
                                                onChangeText={setRmCustomName}
                                            />
                                        )}

                                        {/* Frequency */}
                                        <Text style={styles.rmInputLabel}>Frequency</Text>
                                        <View style={styles.rmPillRow}>
                                            {([
                                                { key: 'once', label: 'Once' },
                                                { key: 'daily', label: 'Daily' },
                                                { key: 'every-3-days', label: '3 Days' },
                                                { key: 'weekly', label: 'Weekly' },
                                                { key: 'monthly', label: 'Monthly' },
                                            ] as { key: typeof rmFrequency; label: string }[]).map((freq) => (
                                                <TouchableOpacity
                                                    key={freq.key}
                                                    style={[styles.rmPill, rmFrequency === freq.key && styles.rmPillActive]}
                                                    onPress={() => setRmFrequency(freq.key)}
                                                >
                                                    <Text style={[styles.rmPillText, rmFrequency === freq.key && { color: '#fff' }]}>
                                                        {freq.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Date & Time */}
                                        <Text style={styles.rmInputLabel}>Date & Time</Text>
                                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                            <TouchableOpacity
                                                style={styles.rmDateBtn}
                                                onPress={() => setRmShowDatePicker(true)}
                                            >
                                                <Feather name="calendar" size={16} color={colors.primary} />
                                                <Text style={styles.rmDateText}>{rmDate.toLocaleDateString()}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.rmDateBtn}
                                                onPress={() => setRmShowTimePicker(true)}
                                            >
                                                <Feather name="clock" size={16} color={colors.primary} />
                                                <Text style={styles.rmDateText}>
                                                    {rmDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {rmShowDatePicker && (
                                            <DateTimePicker
                                                value={rmDate}
                                                mode="date"
                                                display="default"
                                                minimumDate={new Date()}
                                                onChange={(e, date) => { setRmShowDatePicker(false); if (date) setRmDate(date); }}
                                            />
                                        )}
                                        {rmShowTimePicker && (
                                            <DateTimePicker
                                                value={rmDate}
                                                mode="time"
                                                display="default"
                                                onChange={(e, date) => { setRmShowTimePicker(false); if (date) setRmDate(date); }}
                                            />
                                        )}

                                        {/* Add to List Button */}
                                        <TouchableOpacity
                                            style={styles.rmAddBtn}
                                            onPress={handleAddReminderToList}
                                        >
                                            <Feather name={editingReminderIndex !== null ? 'check' : 'plus'} size={16} color="#fff" />
                                            <Text style={styles.rmAddBtnText}>
                                                {editingReminderIndex !== null ? 'Save Changes' : 'Add This Reminder'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Submit Buttons */}
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                        style={[styles.deleteButton, { flex: 1 }]}
                                        onPress={() => setStep(2)}
                                    >
                                        <Feather name="arrow-left" size={18} color={colors.textMuted} />
                                        <Text style={styles.backLinkText}>Back</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.submitButton, { flex: 1 }]}
                                        onPress={handleSubmit}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                                                <Text style={styles.submitButtonText}>Add Plant</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

// Styles remain same... (copy from previous response)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    notFoundText: { fontSize: fontSize.lg, color: colors.textMuted, marginVertical: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(243,244,246,0.5)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    headerContent: { flex: 1 },
    content: { padding: spacing.lg, marginTop: -spacing.xl, backgroundColor: colors.background },
    infoSection: { marginBottom: spacing.xl },
    plantName: { fontSize: 32, fontWeight: 'bold', color: colors.text },
    plantSpecies: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginBottom: spacing.md },
    metaInput: { flex: 1, fontSize: fontSize.base, color: colors.text, marginLeft: spacing.sm },
    section: { marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    taskCount: { backgroundColor: colors.primary, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    taskCountText: { color: '#fff', fontSize: fontSize.xs, fontWeight: 'bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', height: 44 },
    searchInput: { flex: 1, fontSize: fontSize.base, color: colors.text },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: borderRadius.lg, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(16,185,129,0.3)' },
    templateBtn: { flex: 1, padding: spacing.md, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: borderRadius.md, alignItems: 'center', marginRight: spacing.sm },
    actionIconBox: { marginRight: spacing.md },
    actionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    historyCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginHorizontal: spacing.lg },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    historyIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md, overflow: 'hidden' },
    plantThumbnail: { width: '100%', height: '100%' },
    historyContent: { flex: 1 },
    historyLabel: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    historyDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    tagsRow: { flexDirection: 'row', marginTop: spacing.sm, flexWrap: 'wrap', gap: 4 },
    careTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, gap: 2 },
    careTagText: { fontSize: 9, color: colors.primary, textTransform: 'capitalize', fontWeight: '600' },
    healthBadgeSmall: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
    statusLabel: { fontSize: fontSize.xs, fontWeight: 'bold', marginRight: spacing.sm },
    tasksCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    taskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    taskCheckbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, marginRight: spacing.md, justifyContent: 'center', alignItems: 'center' },
    taskCheckboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    taskDue: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    emptyCard: { backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center', marginHorizontal: spacing.lg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    photoUploadCard: { height: 250, backgroundColor: 'rgba(243,244,246,0.8)', borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(16,185,129,0.3)', marginBottom: spacing.lg },
    photoPreview: { width: '100%', height: '100%' },
    photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    uploadText: { color: colors.textMuted, fontWeight: '500', marginTop: spacing.md },
    label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
    notesCard: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', fontSize: fontSize.base, color: colors.text },
    buttonRow: { flexDirection: 'row', marginTop: spacing.xl, gap: spacing.md },
    deleteButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
    deleteText: { color: colors.primary, fontWeight: '600', marginRight: spacing.sm },
    backLinkText: { color: colors.textMuted, fontWeight: '500', marginLeft: 4 },
    submitButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.lg },
    submitButtonText: { color: '#fff', fontWeight: 'bold' },

    // ── Reminder Form Styles ──
    addReminderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: borderRadius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(16,185,129,0.25)', marginTop: spacing.md, gap: spacing.sm },
    addReminderCardText: { fontSize: fontSize.base, fontWeight: '600', color: colors.primary },
    reminderFormCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginTop: spacing.md },
    rmInputLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
    rmPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    rmPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.primary, gap: 4 },
    rmPillActive: { backgroundColor: colors.primary },
    rmPillText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    rmInput: { backgroundColor: '#f8fafc', borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.base, color: colors.text, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginTop: spacing.sm },
    rmDateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: '#f8fafc', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', gap: spacing.sm },
    rmDateText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
    rmAddBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.lg, marginTop: spacing.lg, gap: spacing.sm },
    rmAddBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.sm },
    applyAllCard: { backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' },
    applyAllTitle: { fontSize: fontSize.sm, fontWeight: '600', color: '#3b82f6' },
    applyAllBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#3b82f6', padding: spacing.md, borderRadius: borderRadius.lg, marginTop: spacing.md, gap: spacing.sm },
    rmDateBtnSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: borderRadius.sm, gap: 4 },
    rmDateTextSmall: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500' },
});