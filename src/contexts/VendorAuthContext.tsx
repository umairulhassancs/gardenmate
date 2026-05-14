import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VendorUser {
    id: string;
    email: string;
    name: string;
    storeName: string;
}

interface VendorAuthContextType {
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    user: VendorUser | null;
}

const VendorAuthContext = createContext<VendorAuthContextType | null>(null);

const VENDOR_AUTH_KEY = 'vendor_user';

export function VendorAuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<VendorUser | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const stored = await AsyncStorage.getItem(VENDOR_AUTH_KEY);
            if (stored) {
                const userData = JSON.parse(stored);
                setUser(userData);
                setIsAuthenticated(true);
            }
        } catch (error) {
            console.error('Error checking vendor auth:', error);
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        // Check for vendor credentials (any email with 'vendor' or valid credentials)
        if (email.includes('vendor') || (email && password)) {
            const userData: VendorUser = {
                id: '1',
                email,
                name: 'Alex Thompson',
                storeName: 'Green Thumb Gardens',
            };
            await AsyncStorage.setItem(VENDOR_AUTH_KEY, JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = async () => {
        await AsyncStorage.removeItem(VENDOR_AUTH_KEY);
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <VendorAuthContext.Provider value={{ isAuthenticated, login, logout, user }}>
            {children}
        </VendorAuthContext.Provider>
    );
}

export function useVendorAuth() {
    const context = useContext(VendorAuthContext);
    if (!context) {
        throw new Error('useVendorAuth must be used within VendorAuthProvider');
    }
    return context;
}

export { VendorAuthContext };
