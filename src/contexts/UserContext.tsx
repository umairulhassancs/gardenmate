import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interfaces (No changes here)
export interface ShippingAddress {
    id: string;
    label: string;
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    isDefault?: boolean; // Optional rakha hai kyunke hum ab use nahi kar rahe
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar?: string;
    location: string;
}

interface UserContextType {
    profile: UserProfile;
    addresses: ShippingAddress[];
    loading: boolean; // Loading state add ki hai taake UI mein spinner dikh sake
    updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
    addAddress: (address: Omit<ShippingAddress, 'id'>) => Promise<void>;
    updateAddress: (id: string, updates: Partial<ShippingAddress>) => Promise<void>;
    deleteAddress: (id: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY_PROFILE = '@gardenmate_user_profile';
const STORAGE_KEY_ADDRESSES = '@gardenmate_shipping_addresses';

export function UserProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile>({
        id: '1',
        name: 'Guest User',
        email: '',
        phone: '',
        location: '',
    });
    const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const profileData = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
            const addressData = await AsyncStorage.getItem(STORAGE_KEY_ADDRESSES);
            
            if (profileData) setProfile(JSON.parse(profileData));
            if (addressData) setAddresses(JSON.parse(addressData));
        } catch (error) {
            console.log('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Save Logic ---
    const saveAddresses = async (newAddresses: ShippingAddress[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_ADDRESSES, JSON.stringify(newAddresses));
        } catch (error) {
            console.log('Error saving addresses:', error);
        }
    };

    // --- Actions (Cleaned from "isDefault" logic) ---

    const addAddress = async (address: Omit<ShippingAddress, 'id'>) => {
        const newAddress: ShippingAddress = {
            ...address,
            id: Date.now().toString(), // Unique ID generate hogi
        };
        
        const newAddresses = [...addresses, newAddress];
        setAddresses(newAddresses);
        await saveAddresses(newAddresses);
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));
    };

    const updateAddress = async (id: string, updates: Partial<ShippingAddress>) => {
        const newAddresses = addresses.map(a =>
            a.id === id ? { ...a, ...updates } : a
        );
        setAddresses(newAddresses);
        await saveAddresses(newAddresses);
    };

    const deleteAddress = async (id: string) => {
        const newAddresses = addresses.filter(a => a.id !== id);
        setAddresses(newAddresses);
        await saveAddresses(newAddresses);
    };

    return (
        <UserContext.Provider value={{
            profile,
            addresses,
            loading,
            updateProfile,
            addAddress,
            updateAddress,
            deleteAddress,
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within a UserProvider');
    return context;
}