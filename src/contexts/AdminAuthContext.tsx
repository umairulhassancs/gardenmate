import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AdminAuthContextType {
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    user: { email: string } | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const ADMIN_AUTH_KEY = 'planthub_admin_auth';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<{ email: string } | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const stored = await AsyncStorage.getItem(ADMIN_AUTH_KEY);
            if (stored) {
                const userData = JSON.parse(stored);
                setUser(userData);
                setIsAuthenticated(true);
            }
        } catch (error) {
            console.error('Error checking admin auth:', error);
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        // Check for admin credentials
        if (email === 'admin@gmail.com' && password === 'admin') {
            const userData = { email };
            await AsyncStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = async () => {
        await AsyncStorage.removeItem(ADMIN_AUTH_KEY);
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AdminAuthContext.Provider value={{ isAuthenticated, login, logout, user }}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth() {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error('useAdminAuth must be used within AdminAuthProvider');
    }
    return context;
}

export { AdminAuthContext };
