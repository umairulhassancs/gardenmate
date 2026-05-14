import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert } from 'react-native';

interface Toast {
    id: string;
    title: string;
    description?: string;
}

interface ToastContextType {
    toast: (options: { title: string; description?: string }) => void;
    dismiss: (id?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const toast = useCallback(({ title, description }: { title: string; description?: string }) => {
        Alert.alert(title, description);
    }, []);

    const dismiss = useCallback((id?: string) => {
        // Dismiss handled by Alert automatically
    }, []);

    const contextValue = { toast, dismiss };

    return React.createElement(ToastContext.Provider, { value: contextValue }, children);
}

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        return {
            toast: ({ title, description }: { title: string; description?: string }) => {
                Alert.alert(title, description);
            },
            dismiss: () => { },
        };
    }

    return context;
}

export { ToastContext };
