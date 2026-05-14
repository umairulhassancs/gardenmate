import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../data/marketplaceData';

const WISHLIST_STORAGE_KEY = '@gardenmate_wishlist';

interface WishlistContextType {
    items: Product[];
    loading: boolean;
    addToWishlist: (product: Product) => void;
    removeFromWishlist: (productId: string) => void;
    toggleWishlist: (product: Product) => void;
    isInWishlist: (productId: string) => boolean;
    getCount: () => number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Load wishlist from AsyncStorage on mount
    useEffect(() => {
        loadWishlist();
    }, []);

    // Save wishlist to AsyncStorage whenever items change
    useEffect(() => {
        if (!loading) {
            saveWishlist(items);
        }
    }, [items, loading]);

    const loadWishlist = async () => {
        try {
            const stored = await AsyncStorage.getItem(WISHLIST_STORAGE_KEY);
            if (stored) {
                const parsedItems = JSON.parse(stored);
                setItems(parsedItems);
                console.log('❤️ Wishlist loaded from storage:', parsedItems.length, 'items');
            }
        } catch (error) {
            console.log('Error loading wishlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveWishlist = async (wishlistItems: Product[]) => {
        try {
            await AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
            console.log('❤️ Wishlist saved to storage:', wishlistItems.length, 'items');
        } catch (error) {
            console.log('Error saving wishlist:', error);
        }
    };

    const addToWishlist = (product: Product) => {
        setItems(prev => {
            if (prev.some(p => p.id === product.id)) return prev;
            return [...prev, product];
        });
    };

    const removeFromWishlist = (productId: string) => {
        setItems(prev => prev.filter(p => p.id !== productId));
    };

    const toggleWishlist = (product: Product) => {
        if (isInWishlist(product.id)) {
            removeFromWishlist(product.id);
        } else {
            addToWishlist(product);
        }
    };

    const isInWishlist = (productId: string) =>
        items.some(p => p.id === productId);

    const getCount = () => items.length;

    return (
        <WishlistContext.Provider
            value={{
                items,
                loading,
                addToWishlist,
                removeFromWishlist,
                toggleWishlist,
                isInWishlist,
                getCount,
            }}
        >
            {children}
        </WishlistContext.Provider>
    );
}

export function useWishlist() {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error('useWishlist must be used within a WishlistProvider');
    }
    return context;
}
