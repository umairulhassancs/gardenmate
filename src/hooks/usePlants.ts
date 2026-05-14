import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { cancelNotification } from '../services/NotificationService';

export type HealthStatus = 'good' | 'average' | 'worst';

export interface CareSchedule {
    taskType: 'water' | 'fertilize' | 'clean' | 'rotate' | 'prune';
    frequency: 'daily' | 'every-2-days' | 'weekly' | 'bi-weekly' | 'monthly';
    enabled: boolean;
}

export interface Plant {
    id: string;
    name: string;
    species: string;
    location: string;
    image?: string;
    healthStatus: HealthStatus;
    careSchedule: CareSchedule[];
    notes?: string;
    tags: string[];
    dateAdded: string;
    lastWatered?: string;
    lastFertilized?: string;
    lastCleaned?: string;
    legacyTasksSynced?: boolean;
}

const STORAGE_KEY = 'plants';

export function usePlants() {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loading, setLoading] = useState(true);

    // Load plants on mount
    useEffect(() => {
        loadPlants();
    }, []);

    const loadPlants = async () => {
        try {
            setLoading(true);

            // 1. AsyncStorage se load karo (For Fast UI)
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsedPlants = JSON.parse(stored);
                setPlants(parsedPlants);
                console.log('📦 Loaded from AsyncStorage:', parsedPlants.length, 'plants');
            }

            // 2. Firebase se sync karo (For Accuracy)
            if (auth.currentUser) {
                // ✅ FIXED: Correct Firebase Path
                const plantsRef = collection(db, 'users', auth.currentUser.uid, 'plants');
                const snapshot = await getDocs(plantsRef);
                const firebasePlants = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Plant[];

                console.log('🔥 Loaded from Firebase:', firebasePlants.length, 'plants');

                setPlants(firebasePlants);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(firebasePlants));
            }
        } catch (error) {
            console.error('❌ Error loading plants:', error);
        } finally {
            setLoading(false);
        }
    };

    const addPlant = async (plantData: Omit<Plant, 'id' | 'dateAdded'>) => {
        const plantId = `plant_${Date.now()}`;
        const newPlant: Plant = {
            ...plantData,
            id: plantId,
            dateAdded: new Date().toISOString(),
        };

        try {
            // ✅ FIXED: Correct Firebase Path
            if (auth.currentUser) {
                const plantRef = doc(db, 'users', auth.currentUser.uid, 'plants', plantId);
                await setDoc(plantRef, newPlant);
                console.log('✅ Plant added to Firebase:', plantId);
            }

            // Update Local State AFTER Firebase success
            setPlants(prev => {
                const updated = [...prev, newPlant];
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });

            return newPlant;
        } catch (error) {
            console.error('❌ Error adding plant:', error);
            return null;
        }
    };

    const updatePlant = async (plantId: string, updates: Partial<Plant>) => {
        try {
            // ✅ FIXED: Correct Firebase Path
            if (auth.currentUser) {
                const plantRef = doc(db, 'users', auth.currentUser.uid, 'plants', plantId);
                await updateDoc(plantRef, updates);
                console.log('✅ Plant updated in Firebase:', plantId);
            }

            // Update Local State AFTER Firebase success
            setPlants(prev => {
                const updated = prev.map(p =>
                    p.id === plantId ? { ...p, ...updates } : p
                );
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });

            return true;
        } catch (error) {
            console.error('❌ Error updating plant:', error);
            return false;
        }
    };

    const removePlant = async (plantId: string) => {
        try {
            // ✅ FIXED: Delete plant AND its tasks
            if (auth.currentUser) {
                const userId = auth.currentUser.uid;

                // 1. Delete Plant
                const plantRef = doc(db, 'users', userId, 'plants', plantId);
                await deleteDoc(plantRef);
                console.log('✅ Plant deleted from Firebase:', plantId);

                // 2. Delete All Tasks for this Plant
                const tasksRef = collection(db, 'tasks');
                const q = query(tasksRef, where('userId', '==', userId), where('plantId', '==', plantId));
                const tasksSnapshot = await getDocs(q);

                if (!tasksSnapshot.empty) {
                    // Cancel all scheduled notifications for these tasks
                    for (const taskDoc of tasksSnapshot.docs) {
                        const taskData = taskDoc.data();
                        if (taskData.notificationId) {
                            try {
                                await cancelNotification(taskData.notificationId);
                                console.log(`🔕 Cancelled notification for task ${taskDoc.id}`);
                            } catch (e) { /* notification may already be expired */ }
                        }
                    }

                    const batch = writeBatch(db);
                    tasksSnapshot.docs.forEach((taskDoc) => {
                        batch.delete(taskDoc.ref);
                    });
                    await batch.commit();
                    console.log(`✅ Deleted ${tasksSnapshot.docs.length} tasks for plant ${plantId}`);
                }
            }

            // Update Local State AFTER Firebase success
            setPlants(prev => {
                const updated = prev.filter(p => p.id !== plantId);
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                return updated;
            });

            return true;
        } catch (error) {
            console.error('❌ Error removing plant:', error);
            return false;
        }
    };

    const getPlantById = useCallback((id: string) => {
        return plants.find(p => p.id === id);
    }, [plants]);

    const logCareAction = async (
        plantId: string,
        action: 'water' | 'fertilize' | 'clean'
    ) => {
        const timestamp = new Date().toISOString();
        const updates: Partial<Plant> = {};

        if (action === 'water') updates.lastWatered = timestamp;
        if (action === 'fertilize') updates.lastFertilized = timestamp;
        if (action === 'clean') updates.lastCleaned = timestamp;

        await updatePlant(plantId, updates);
    };

    return {
        plants,
        loading,
        addPlant,
        updatePlant,
        removePlant,
        getPlantById,
        logCareAction,
        loadPlants,
    };
}