// AR View Screen - Main AR Experience
// Phase 2: Core AR Scene with real camera

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    Alert,
    StatusBar,
    Dimensions,
    ScrollView,
    Image,
    Switch,
    PanResponder,
    GestureResponderEvent,
    PanResponderGestureState,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const { width, height } = Dimensions.get('window');

// Plant models for AR with enhanced visuals
const AR_PLANTS = [
    {
        id: 'monstera',
        name: 'Monstera Deliciosa',
        price: 35.00,
        emoji: '🌿',
        category: 'floor',
        color: '#22c55e',
        potColor: '#8b4513',
        size: 'large',
    },
    {
        id: 'fiddle',
        name: 'Fiddle Leaf Fig',
        price: 45.00,
        emoji: '🌳',
        category: 'floor',
        color: '#16a34a',
        potColor: '#d4a574',
        size: 'large',
    },
    {
        id: 'pothos',
        name: 'Golden Pothos',
        price: 28.00,
        emoji: '🌱',
        category: 'hanging',
        color: '#84cc16',
        potColor: '#f5f5dc',
        size: 'medium',
    },
    {
        id: 'rubber',
        name: 'Rubber Plant',
        price: 52.00,
        emoji: '🪴',
        category: 'floor',
        color: '#166534',
        potColor: '#8b4513',
        size: 'large',
    },
    {
        id: 'peace',
        name: 'Peace Lily',
        price: 32.00,
        emoji: '🌷',
        category: 'table',
        color: '#86efac',
        potColor: '#fff',
        size: 'medium',
    },
    {
        id: 'palm',
        name: 'Bamboo Palm',
        price: 58.00,
        emoji: '🌴',
        category: 'floor',
        color: '#15803d',
        potColor: '#d4a574',
        size: 'xlarge',
    },
    {
        id: 'fern',
        name: 'Boston Fern',
        price: 24.00,
        emoji: '🌿',
        category: 'hanging',
        color: '#4ade80',
        potColor: '#cd853f',
        size: 'medium',
    },
    {
        id: 'snake',
        name: 'Snake Plant',
        price: 29.00,
        emoji: '🎋',
        category: 'floor',
        color: '#365314',
        potColor: '#fff',
        size: 'medium',
    },
    {
        id: 'succulent',
        name: 'Succulent Mix',
        price: 18.00,
        emoji: '🪻',
        category: 'table',
        color: '#a3e635',
        potColor: '#d4a574',
        size: 'small',
    },
    {
        id: 'ivy',
        name: 'English Ivy',
        price: 22.00,
        emoji: '🍃',
        category: 'wall',
        color: '#22c55e',
        potColor: '#8b4513',
        size: 'medium',
    },
];

type PlacementMode = 'floor' | 'table' | 'wall' | 'ceiling';

interface PlacedPlant {
    id: string;
    plantId: string;
    name: string;
    emoji: string;
    price: number;
    color: string;
    potColor: string;
    size: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    locked: boolean;
    mode: PlacementMode;
}

export default function ARViewScreen({ navigation }: any) {
    // AR State
    const [placementMode, setPlacementMode] = useState<PlacementMode>('floor');
    const [selectedPlant, setSelectedPlant] = useState<typeof AR_PLANTS[0] | null>(null);
    const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
    const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(true);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [surfaceDetected, setSurfaceDetected] = useState(false);

    // Simulate surface detection after a delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setSurfaceDetected(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // Save scene to AsyncStorage
    const handleSaveScene = async () => {
        try {
            const sceneData = {
                id: `scene_${Date.now()}`,
                name: `Scene ${new Date().toLocaleDateString()}`,
                plants: placedPlants,
                createdAt: Date.now(),
            };
            const existingScenes = await AsyncStorage.getItem('@ar_scenes');
            const scenes = existingScenes ? JSON.parse(existingScenes) : [];
            scenes.push(sceneData);
            await AsyncStorage.setItem('@ar_scenes', JSON.stringify(scenes));
            Alert.alert('✅ Saved!', `Scene saved with ${placedPlants.length} plants.`);
        } catch (error) {
            Alert.alert('Error', 'Failed to save scene.');
        }
    };

    // Handle drag move for plants
    const handleDragMove = (id: string, dx: number, dy: number) => {
        setPlacedPlants(prev => prev.map(p => {
            if (p.id === id && !p.locked) {
                return {
                    ...p,
                    x: Math.max(20, Math.min(width - 70, p.x + dx)),
                    y: Math.max(100, Math.min(height - 300, p.y + dy)),
                };
            }
            return p;
        }));
    };

    // Filter plants by placement mode
    const getFilteredPlants = () => {
        // All plants can be placed anywhere for flexibility
        return AR_PLANTS;
    };

    // Handle placing a plant
    const handlePlacePlant = (e: any) => {
        if (!selectedPlant) return;

        const newPlant: PlacedPlant = {
            id: `placed_${Date.now()}`,
            plantId: selectedPlant.id,
            name: selectedPlant.name,
            emoji: selectedPlant.emoji,
            price: selectedPlant.price,
            color: selectedPlant.color,
            potColor: selectedPlant.potColor,
            size: selectedPlant.size,
            x: Math.random() * (width - 100) + 50,
            y: 150 + Math.random() * 200,
            scale: 1,
            rotation: 0,
            locked: false,
            mode: placementMode,
        };

        setPlacedPlants(prev => [...prev, newPlant]);
        setSelectedPlant(null);
        setShowInstructions(false);
    };

    // Handle selecting a placed plant
    const handleSelectPlaced = (id: string) => {
        const plant = placedPlants.find(p => p.id === id);
        if (plant?.locked) {
            Alert.alert('Locked', 'This plant is locked. Unlock it to edit.');
            return;
        }
        setSelectedPlacedId(id === selectedPlacedId ? null : id);
    };

    // Scale controls
    const handleScale = (direction: 'up' | 'down') => {
        if (!selectedPlacedId) return;
        setPlacedPlants(prev => prev.map(p => {
            if (p.id === selectedPlacedId && !p.locked) {
                const newScale = direction === 'up'
                    ? Math.min(p.scale * 1.2, 2.5)
                    : Math.max(p.scale * 0.8, 0.3);
                return { ...p, scale: newScale };
            }
            return p;
        }));
    };

    // Rotate control
    const handleRotate = () => {
        if (!selectedPlacedId) return;
        setPlacedPlants(prev => prev.map(p => {
            if (p.id === selectedPlacedId && !p.locked) {
                return { ...p, rotation: (p.rotation + 45) % 360 };
            }
            return p;
        }));
    };

    // Lock/unlock
    const handleToggleLock = () => {
        if (!selectedPlacedId) return;
        setPlacedPlants(prev => prev.map(p => {
            if (p.id === selectedPlacedId) {
                return { ...p, locked: !p.locked };
            }
            return p;
        }));
    };

    // Delete
    const handleDelete = () => {
        if (!selectedPlacedId) return;
        Alert.alert('Delete Plant', 'Remove this plant from the scene?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    setPlacedPlants(prev => prev.filter(p => p.id !== selectedPlacedId));
                    setSelectedPlacedId(null);
                }
            }
        ]);
    };

    // Clear all
    const handleClearAll = () => {
        if (placedPlants.length === 0) return;
        Alert.alert('Clear Scene', 'Remove all plants?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All',
                style: 'destructive',
                onPress: () => {
                    setPlacedPlants([]);
                    setSelectedPlacedId(null);
                }
            }
        ]);
    };

    // Get current plant
    const selectedPlacedPlant = placedPlants.find(p => p.id === selectedPlacedId);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* AR Camera View */}
            <TouchableOpacity
                style={styles.arView}
                activeOpacity={1}
                onPress={handlePlacePlant}
            >
                {/* Simulation Mode (Grid) */}
                <LinearGradient
                    colors={['#1a1a2e', '#16213e', '#0f3460']}
                    style={styles.arBackground}
                >
                    <View style={styles.gridOverlay}>
                        {[...Array(10)].map((_, i) => (
                            <View key={i} style={[styles.gridLine, { top: i * (height / 10) }]} />
                        ))}
                        {[...Array(8)].map((_, i) => (
                            <View key={i} style={[styles.gridLineV, { left: i * (width / 8) }]} />
                        ))}
                    </View>

                    {/* Surface Detection Indicator */}
                    {!surfaceDetected && (
                        <View style={styles.surfaceDetecting}>
                            <ActivityIndicator size="small" color="#10b981" />
                            <Text style={styles.surfaceText}>Detecting surfaces...</Text>
                        </View>
                    )}

                    {surfaceDetected && placedPlants.length === 0 && !selectedPlant && (
                        <View style={styles.surfaceFound}>
                            <View style={styles.surfaceIndicator} />
                            <Text style={styles.surfaceFoundText}>✓ Surface detected</Text>
                        </View>
                    )}

                    {placedPlants.map(plant => (
                        <TouchableOpacity
                            key={plant.id}
                            style={[
                                styles.placedPlant,
                                {
                                    left: plant.x,
                                    top: plant.y,
                                    transform: [
                                        { scale: plant.scale },
                                        { rotate: `${plant.rotation}deg` }
                                    ],
                                },
                                selectedPlacedId === plant.id && styles.selectedPlant,
                                plant.locked && styles.lockedPlant,
                            ]}
                            onPress={() => handleSelectPlaced(plant.id)}
                        >
                            {/* Shadow */}
                            <View style={[styles.plantShadow, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />

                            {/* Pot */}
                            <View style={[styles.plantPot, { backgroundColor: plant.potColor }]}>
                                <View style={[styles.plantPotRim, { backgroundColor: plant.potColor }]} />
                            </View>

                            {/* Plant Body */}
                            <View style={[styles.plantBody, { backgroundColor: plant.color }]}>
                                <Text style={styles.plantEmoji}>{plant.emoji}</Text>
                            </View>

                            {/* Lock indicator */}
                            {plant.locked && (
                                <View style={styles.lockBadge}>
                                    <Feather name="lock" size={10} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}

                    {selectedPlant && surfaceDetected && (
                        <View style={styles.placementIndicator}>
                            <Text style={styles.placementEmoji}>{selectedPlant.emoji}</Text>
                            <Text style={styles.placementText}>Tap anywhere to place</Text>
                        </View>
                    )}

                    {showInstructions && placedPlants.length === 0 && !selectedPlant && (
                        <View style={styles.instructions}>
                            <Feather name="info" size={24} color="#10b981" />
                            <Text style={styles.instructionTitle}>AR Plant Viewer</Text>
                            <Text style={styles.instructionText}>
                                1. Select a placement mode{'\n'}
                                2. Choose a plant from below{'\n'}
                                3. Tap the screen to place
                            </Text>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Top Toolbar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.topButton} onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.plantCount}>
                    <Text style={styles.plantCountText}>🌿 {placedPlants.length}</Text>
                </View>

                <View style={styles.topActions}>
                    <TouchableOpacity style={styles.topButton} onPress={handleClearAll}>
                        <Feather name="trash-2" size={20} color={placedPlants.length > 0 ? '#fff' : '#666'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.topButton, styles.saveButton]}
                        onPress={handleSaveScene}
                        disabled={placedPlants.length === 0}
                    >
                        <Feather name="save" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Plant Controls (when selected) */}
            {selectedPlacedPlant && (
                <View style={styles.controlsBar}>
                    <View style={styles.controlsHeader}>
                        <Text style={styles.controlsTitle}>{selectedPlacedPlant.name}</Text>
                        <TouchableOpacity onPress={() => setSelectedPlacedId(null)}>
                            <Feather name="x" size={20} color="#6b7280" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.controlsRow}>
                        <TouchableOpacity
                            style={styles.controlBtn}
                            onPress={() => handleScale('down')}
                            disabled={selectedPlacedPlant.locked}
                        >
                            <Feather name="minus" size={20} color={selectedPlacedPlant.locked ? '#ccc' : '#374151'} />
                            <Text style={styles.controlLabel}>Smaller</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.controlBtn}
                            onPress={() => handleScale('up')}
                            disabled={selectedPlacedPlant.locked}
                        >
                            <Feather name="plus" size={20} color={selectedPlacedPlant.locked ? '#ccc' : '#374151'} />
                            <Text style={styles.controlLabel}>Larger</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.controlBtn}
                            onPress={handleRotate}
                            disabled={selectedPlacedPlant.locked}
                        >
                            <Feather name="rotate-cw" size={20} color={selectedPlacedPlant.locked ? '#ccc' : '#374151'} />
                            <Text style={styles.controlLabel}>Rotate</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.controlBtn, selectedPlacedPlant.locked && styles.controlBtnActive]}
                            onPress={handleToggleLock}
                        >
                            <Feather
                                name={selectedPlacedPlant.locked ? 'lock' : 'unlock'}
                                size={20}
                                color={selectedPlacedPlant.locked ? '#fff' : '#374151'}
                            />
                            <Text style={[styles.controlLabel, selectedPlacedPlant.locked && styles.controlLabelActive]}>
                                {selectedPlacedPlant.locked ? 'Locked' : 'Lock'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.controlBtnDelete} onPress={handleDelete}>
                            <Feather name="trash-2" size={20} color="#ef4444" />
                            <Text style={styles.controlLabelDelete}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Placement Mode Bar */}
            <View style={styles.modeBar}>
                {(['floor', 'table', 'wall', 'ceiling'] as PlacementMode[]).map(mode => (
                    <TouchableOpacity
                        key={mode}
                        style={[styles.modeBtn, placementMode === mode && styles.modeBtnActive]}
                        onPress={() => setPlacementMode(mode)}
                    >
                        <Feather
                            name={mode === 'floor' ? 'square' : mode === 'table' ? 'box' : mode === 'wall' ? 'sidebar' : 'cloud'}
                            size={18}
                            color={placementMode === mode ? '#fff' : '#6b7280'}
                        />
                        <Text style={[styles.modeLabel, placementMode === mode && styles.modeLabelActive]}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Plant Selector */}
            <View style={styles.plantSelector}>
                <View style={styles.selectorHeader}>
                    <Text style={styles.selectorTitle}>Select Plant</Text>
                    <Text style={styles.selectorCount}>{AR_PLANTS.length} available</Text>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.plantScroll}
                >
                    {getFilteredPlants().map(plant => (
                        <TouchableOpacity
                            key={plant.id}
                            style={[
                                styles.plantCard,
                                selectedPlant?.id === plant.id && styles.plantCardSelected
                            ]}
                            onPress={() => setSelectedPlant(plant)}
                        >
                            <View style={styles.plantCardIcon}>
                                <Text style={styles.plantCardEmoji}>{plant.emoji}</Text>
                                {selectedPlant?.id === plant.id && (
                                    <View style={styles.checkBadge}>
                                        <Feather name="check" size={10} color="#fff" />
                                    </View>
                                )}
                            </View>
                            <Text style={styles.plantCardName} numberOfLines={1}>{plant.name}</Text>
                            <Text style={styles.plantCardPrice}>Rs. {plant.price.toFixed(0)}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    arView: {
        flex: 1,
    },
    arBackground: {
        flex: 1,
        position: 'relative',
    },
    gridOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(16,185,129,0.1)',
    },
    gridLineV: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: 'rgba(16,185,129,0.1)',
    },
    placedPlant: {
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(16,185,129,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
    },
    selectedPlant: {
        borderWidth: 3,
        borderColor: '#fff',
    },
    lockedPlant: {
        backgroundColor: 'rgba(59,130,246,0.9)',
        shadowColor: '#3b82f6',
    },
    plantEmoji: {
        fontSize: 32,
    },
    plantShadow: {
        position: 'absolute',
        bottom: -5,
        left: '10%',
        width: '80%',
        height: 10,
        borderRadius: 20,
        opacity: 0.4,
    },
    plantPot: {
        position: 'absolute',
        bottom: 0,
        width: 40,
        height: 25,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 3,
    },
    plantPotRim: {
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        height: 6,
        borderRadius: 3,
    },
    plantBody: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    lockBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    placementIndicator: {
        position: 'absolute',
        top: '35%',
        alignSelf: 'center',
        alignItems: 'center',
    },
    placementEmoji: {
        fontSize: 60,
        marginBottom: 8,
    },
    placementText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '600',
    },
    instructions: {
        position: 'absolute',
        top: '30%',
        left: 40,
        right: 40,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    instructionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 12,
    },
    instructionText: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
    topBar: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    saveButton: {
        backgroundColor: '#10b981',
    },
    plantCount: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    plantCountText: {
        color: '#fff',
        fontWeight: '600',
    },
    controlsBar: {
        position: 'absolute',
        bottom: 220,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderRadius: 20,
        padding: 16,
    },
    controlsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    controlsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    controlBtn: {
        alignItems: 'center',
        padding: 8,
        borderRadius: 10,
    },
    controlBtnActive: {
        backgroundColor: '#10b981',
    },
    controlBtnDelete: {
        alignItems: 'center',
        padding: 8,
    },
    controlLabel: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 4,
    },
    controlLabelActive: {
        color: '#fff',
    },
    controlLabelDelete: {
        fontSize: 10,
        color: '#ef4444',
        marginTop: 4,
    },
    modeBar: {
        position: 'absolute',
        bottom: 160,
        left: 16,
        right: 16,
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 16,
        padding: 4,
    },
    modeBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 12,
    },
    modeBtnActive: {
        backgroundColor: '#10b981',
    },
    modeLabel: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 4,
        fontWeight: '600',
    },
    modeLabelActive: {
        color: '#fff',
    },
    plantSelector: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 16,
        paddingBottom: 34,
    },
    selectorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    selectorTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    selectorCount: {
        fontSize: 12,
        color: '#6b7280',
    },
    plantScroll: {
        paddingHorizontal: 16,
    },
    plantCard: {
        width: 90,
        backgroundColor: '#f9fafb',
        borderRadius: 14,
        padding: 10,
        marginRight: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    plantCardSelected: {
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.05)',
    },
    plantCardIcon: {
        width: 70,
        height: 60,
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
        marginBottom: 6,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    plantCardEmoji: {
        fontSize: 30,
    },
    checkBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    plantCardName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    plantCardPrice: {
        fontSize: 10,
        fontWeight: '500',
        color: '#10b981',
        textAlign: 'center',
        marginTop: 2,
    },
    // Surface detection styles
    surfaceDetecting: {
        position: 'absolute',
        top: 120,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 10,
    },
    surfaceText: {
        color: '#fff',
        fontSize: 14,
    },
    surfaceFound: {
        position: 'absolute',
        top: 120,
        alignSelf: 'center',
        alignItems: 'center',
    },
    surfaceIndicator: {
        width: 120,
        height: 80,
        borderWidth: 2,
        borderColor: 'rgba(16,185,129,0.6)',
        borderRadius: 8,
        backgroundColor: 'rgba(16,185,129,0.15)',
    },
    surfaceFoundText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
});