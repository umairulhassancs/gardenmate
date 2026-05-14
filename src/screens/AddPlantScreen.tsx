import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
    SafeAreaView, Image, Alert, ActivityIndicator, Modal, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { usePlants, type CareSchedule } from '../hooks/usePlants';
import { useTasks, type TaskFrequency } from '../hooks/useTasks';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';

// Extended care schedule with optional reminder date/time
interface CareScheduleWithReminder extends Omit<CareSchedule, 'frequency'> {
    frequency: TaskFrequency;
    reminderDateTime?: Date | null;
}

const CARE_TEMPLATES = [
    {
        name: 'Tropical',
        tasks: [
            { taskType: 'water' as const, frequency: 'every-2-days' as const, enabled: true },
            { taskType: 'fertilize' as const, frequency: 'monthly' as const, enabled: true },
        ]
    },
    {
        name: 'Succulent',
        tasks: [
            { taskType: 'water' as const, frequency: 'weekly' as const, enabled: true },
            { taskType: 'rotate' as const, frequency: 'bi-weekly' as const, enabled: true },
        ]
    },
    {
        name: 'Flowering',
        tasks: [
            { taskType: 'water' as const, frequency: 'daily' as const, enabled: true },
            { taskType: 'fertilize' as const, frequency: 'weekly' as const, enabled: true },
        ]
    },
];

// Icon component (matching MyPlantsScreen)
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

export default function AddPlantScreen({ navigation }: any) {
    const { addPlant } = usePlants();
    const { addTask } = useTasks();

    // States
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form Data (matching MyPlantsScreen structure)
    const [photoPreview, setPhotoPreview] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        species: '',
        location: '',
        notes: ''
    });
    const [careSchedule, setCareSchedule] = useState<CareScheduleWithReminder[]>([]);

    // Edit Reminder Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTaskType, setEditingTaskType] = useState<CareSchedule['taskType'] | null>(null);
    const [editFrequency, setEditFrequency] = useState<TaskFrequency>('weekly');
    const [editReminderDate, setEditReminderDate] = useState(new Date());
    const [showEditDatePicker, setShowEditDatePicker] = useState(false);
    const [showEditTimePicker, setShowEditTimePicker] = useState(false);

    // Image Picker (matching MyPlantsScreen)
    const handleImagePick = async () => {
        Alert.alert('Add Photo', 'Choose an option', [
            {
                text: 'Camera',
                onPress: async () => {
                    const result = await ImagePicker.launchCameraAsync({
                        quality: 0.8,
                        allowsEditing: true,
                        aspect: [1, 1]
                    });
                    if (!result.canceled && result.assets[0]) {
                        setPhotoPreview(result.assets[0].uri);
                        setStep(2);
                    }
                }
            },
            {
                text: 'Gallery',
                onPress: async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                        quality: 0.8,
                        allowsEditing: true,
                        aspect: [1, 1]
                    });
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
        setCareSchedule(template.tasks.map(t => ({ ...t, enabled: true, reminderDateTime: null })));
    };

    const toggleCareTask = (taskType: CareSchedule['taskType']) => {
        const exists = careSchedule.find(t => t.taskType === taskType);
        if (exists) {
            setCareSchedule(prev => prev.filter(t => t.taskType !== taskType));
        } else {
            setCareSchedule(prev => [...prev, { taskType, frequency: 'weekly', enabled: true, reminderDateTime: null }]);
        }
    };

    // Open edit modal for a specific care task
    const openEditModal = (taskType: CareSchedule['taskType']) => {
        const existing = careSchedule.find(t => t.taskType === taskType);
        if (existing) {
            setEditingTaskType(taskType);
            setEditFrequency(existing.frequency || 'weekly');
            setEditReminderDate(existing.reminderDateTime || new Date());
            setShowEditModal(true);
        }
    };

    // Save edit modal changes
    const saveEditReminder = () => {
        if (!editingTaskType) return;
        setCareSchedule(prev => prev.map(t =>
            t.taskType === editingTaskType
                ? { ...t, frequency: editFrequency, reminderDateTime: editReminderDate }
                : t
        ));
        setShowEditModal(false);
        setEditingTaskType(null);
    };

    // ✅ SUBMIT WITH FIREBASE BACKEND
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

            // ✅ Add plant to Firebase + local state (usePlants handles both)
            const newPlant = await addPlant({
                ...formData,
                image: photoPreview,
                healthStatus: 'good',
                careSchedule: careSchedule.map(({ reminderDateTime, ...rest }) => rest) as any,
                notes: formData.notes,
                tags: []
            });

            if (!newPlant) {
                Alert.alert("Error", "Failed to add plant. Please try again.");
                return;
            }

            console.log('✅ Plant saved:', newPlant.id);

            // ✅ Create tasks for care schedule (using the SAME plantId from addPlant)
            for (const schedule of careSchedule) {
                await addTask({
                    title: `${schedule.taskType.charAt(0).toUpperCase() + schedule.taskType.slice(1)} ${formData.name}`,
                    plantId: newPlant.id,
                    plantName: formData.name,
                    taskType: schedule.taskType,
                    frequency: schedule.frequency,
                    isRecurring: schedule.frequency !== 'once',
                    location: formData.location,
                    reminderDateTime: schedule.reminderDateTime || null,
                    dueDate: schedule.reminderDateTime
                        ? (schedule.reminderDateTime.toDateString() === new Date().toDateString() ? 'Today'
                            : schedule.reminderDateTime.toDateString() === new Date(Date.now() + 86400000).toDateString() ? 'Tomorrow'
                                : 'Later')
                        : 'Today',
                });
            }

            Alert.alert('Success!', `${formData.name} has been added to your garden!`, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error("❌ Error saving plant:", error);
            Alert.alert("Error", "Failed to add plant. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loaderText}>Adding to your garden...</Text>
                </View>
            )}

            {/* Header (matching MyPlantsScreen style) */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
                    style={styles.backButton}
                >
                    <Feather name="arrow-left" size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.plantName}>Add Plant</Text>
                    <Text style={styles.plantSpecies}>Step {step} of 3</Text>
                </View>
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

                {/* Step 3: Care Schedule */}
                {step === 3 && (
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>Care Schedule</Text>

                        {/* Templates */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Quick Templates</Text>
                            <View style={styles.actionsRow}>
                                {CARE_TEMPLATES.map((template, idx) => (
                                    <TouchableOpacity
                                        key={`template-${idx}`}
                                        style={styles.templateBtn}
                                        onPress={() => handleTemplateSelect(template)}
                                    >
                                        <Feather name="zap" size={20} color={colors.primary} />
                                        <Text style={styles.actionLabel}>{template.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Care Tasks */}
                        <Text style={styles.label}>Care Tasks</Text>
                        <View style={styles.tasksCard}>
                            {(['water', 'fertilize', 'clean', 'rotate', 'prune'] as const).map((taskType, index) => {
                                const scheduleItem = careSchedule.find(t => t.taskType === taskType);
                                const isSelected = !!scheduleItem;
                                return (
                                    <View
                                        key={`task-${taskType}-${index}`}
                                        style={[
                                            styles.taskItem,
                                            index === 4 && { borderBottomWidth: 0 }
                                        ]}
                                    >
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                                            onPress={() => toggleCareTask(taskType)}
                                        >
                                            <View style={[
                                                styles.taskCheckbox,
                                                isSelected && styles.taskCheckboxSelected
                                            ]}>
                                                {isSelected && <Feather name="check" size={14} color="#fff" />}
                                            </View>
                                            <View style={styles.taskContent}>
                                                <Text style={styles.taskTitle}>
                                                    {taskType.charAt(0).toUpperCase() + taskType.slice(1)}
                                                </Text>
                                                <Text style={styles.taskDue}>
                                                    {isSelected
                                                        ? `${scheduleItem.frequency}${scheduleItem.reminderDateTime ? ' • ' + scheduleItem.reminderDateTime.toLocaleDateString() + ' ' + scheduleItem.reminderDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                                                        : 'Tap to enable'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                        <CareIcon type={taskType} size={20} />
                                        {isSelected && (
                                            <TouchableOpacity
                                                style={styles.editBtn}
                                                onPress={() => openEditModal(taskType)}
                                            >
                                                <Feather name="edit-2" size={16} color={colors.primary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

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

            {/* ── Edit Reminder Modal ── */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Reminder</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Plant Name (Disabled) */}
                            <Text style={styles.inputLabel}>Plant</Text>
                            <View style={[styles.disabledField]}>
                                <Feather name="feather" size={16} color={colors.textMuted} />
                                <Text style={styles.disabledFieldText}>
                                    {formData.name || 'No name set'}
                                </Text>
                            </View>

                            {/* Task Type (Disabled) */}
                            <Text style={styles.inputLabel}>Type</Text>
                            <View style={[styles.disabledField]}>
                                {editingTaskType && <CareIcon type={editingTaskType} size={16} color={colors.textMuted} />}
                                <Text style={styles.disabledFieldText}>
                                    {editingTaskType ? editingTaskType.charAt(0).toUpperCase() + editingTaskType.slice(1) : ''}
                                </Text>
                            </View>

                            {/* Frequency Picker (Enabled) */}
                            <Text style={styles.inputLabel}>Frequency</Text>
                            <View style={styles.frequencyRow}>
                                {([
                                    { key: 'once' as TaskFrequency, label: 'Once' },
                                    { key: 'daily' as TaskFrequency, label: 'Daily' },
                                    { key: 'every-2-days' as TaskFrequency, label: '2 Days' },
                                    { key: 'weekly' as TaskFrequency, label: 'Weekly' },
                                    { key: 'bi-weekly' as TaskFrequency, label: 'Bi-Weekly' },
                                    { key: 'monthly' as TaskFrequency, label: 'Monthly' },
                                ]).map((freq) => (
                                    <TouchableOpacity
                                        key={freq.key}
                                        style={[
                                            styles.frequencyBtn,
                                            editFrequency === freq.key && styles.frequencyBtnSelected
                                        ]}
                                        onPress={() => setEditFrequency(freq.key)}
                                    >
                                        <Text style={[
                                            styles.frequencyBtnText,
                                            editFrequency === freq.key && { color: '#fff' }
                                        ]}>
                                            {freq.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Date & Time Pickers (Enabled) */}
                            <Text style={styles.inputLabel}>Reminder Date & Time</Text>
                            <View style={styles.dateTimeRow}>
                                <TouchableOpacity
                                    style={styles.dateTimeBtn}
                                    onPress={() => setShowEditDatePicker(true)}
                                >
                                    <Feather name="calendar" size={18} color={colors.primary} />
                                    <Text style={styles.dateTimeText}>
                                        {editReminderDate.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.dateTimeBtn}
                                    onPress={() => setShowEditTimePicker(true)}
                                >
                                    <Feather name="clock" size={18} color={colors.primary} />
                                    <Text style={styles.dateTimeText}>
                                        {editReminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {showEditDatePicker && (
                                <DateTimePicker
                                    value={editReminderDate}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event: any, date?: Date) => {
                                        setShowEditDatePicker(false);
                                        if (date) setEditReminderDate(date);
                                    }}
                                />
                            )}

                            {showEditTimePicker && (
                                <DateTimePicker
                                    value={editReminderDate}
                                    mode="time"
                                    display="default"
                                    onChange={(event: any, date?: Date) => {
                                        setShowEditTimePicker(false);
                                        if (date) setEditReminderDate(date);
                                    }}
                                />
                            )}

                            {/* Save Button */}
                            <TouchableOpacity
                                style={styles.saveEditBtn}
                                onPress={saveEditReminder}
                            >
                                <Feather name="check" size={20} color="#fff" />
                                <Text style={styles.saveEditBtnText}>Save Reminder</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// Styles (matching MyPlantsScreen)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.95)',
        zIndex: 999,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loaderText: { marginTop: 15, fontWeight: '600', color: colors.primary, fontSize: fontSize.base },

    // Header (matching MyPlantsScreen)
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: spacing.xl,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.3)'
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(243,244,246,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md
    },
    headerContent: { flex: 1 },

    // Content
    content: { padding: spacing.lg, backgroundColor: colors.background },
    infoSection: { marginBottom: spacing.xl },
    plantName: { fontSize: 32, fontWeight: 'bold', color: colors.text },
    plantSpecies: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4 },

    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        marginBottom: spacing.md
    },
    metaInput: {
        flex: 1,
        fontSize: fontSize.base,
        color: colors.text,
        marginLeft: spacing.sm
    },

    // Sections
    section: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.md
    },

    // Action Buttons
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    templateBtn: {
        flex: 1,
        padding: spacing.md,
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginRight: spacing.sm
    },
    actionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginTop: 4 },

    // Photo Upload
    photoUploadCard: {
        height: 250,
        backgroundColor: 'rgba(243,244,246,0.8)',
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(16,185,129,0.3)',
        marginBottom: spacing.lg
    },
    photoPreview: { width: '100%', height: '100%' },
    photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    uploadText: { color: colors.textMuted, fontWeight: '500', marginTop: spacing.md },

    // Form
    label: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.md
    },
    notesCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        fontSize: fontSize.base,
        color: colors.text
    },

    // Tasks Card
    tasksCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)'
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.3)'
    },
    taskCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.primary,
        marginRight: spacing.md,
        justifyContent: 'center',
        alignItems: 'center'
    },
    taskCheckboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    taskDue: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

    // Buttons
    buttonRow: { flexDirection: 'row', marginTop: spacing.xl, gap: spacing.md },
    deleteButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: 'rgba(16,185,129,0.05)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.2)'
    },
    deleteText: { color: colors.primary, fontWeight: '600', marginRight: spacing.sm },
    backLinkText: { color: colors.textMuted, fontWeight: '500', marginLeft: 4 },
    submitButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg
    },
    submitButtonText: { color: '#fff', fontWeight: 'bold' },

    // Edit Button on task card
    editBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.sm,
    },

    // Edit Reminder Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    editModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    inputLabel: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },
    disabledField: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(243,244,246,0.8)',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        gap: spacing.sm,
    },
    disabledFieldText: {
        fontSize: fontSize.base,
        color: colors.textMuted,
        fontWeight: '500',
    },
    frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    frequencyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary,
        gap: 4,
    },
    frequencyBtnSelected: { backgroundColor: colors.primary },
    frequencyBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    dateTimeRow: { flexDirection: 'row', gap: spacing.md },
    dateTimeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: '#f8fafc',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        gap: spacing.sm,
    },
    dateTimeText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
    saveEditBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginTop: spacing.xl,
        gap: spacing.sm,
    },
    saveEditBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
});