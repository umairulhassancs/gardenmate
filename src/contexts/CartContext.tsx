import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../data/marketplaceData';

const CART_STORAGE_KEY = '@gardenmate_cart';

export interface CartItem {
    product: Product;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    loading: boolean;
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    getItemCount: () => number;
    getSubtotal: () => number;
    getShipping: () => number;
    getTotal: () => number;
    isInCart: (productId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Load cart from AsyncStorage on mount
    useEffect(() => {
        loadCart();
    }, []);

    // Save cart to AsyncStorage whenever items change
    useEffect(() => {
        if (!loading) {
            saveCart(items);
        }
    }, [items, loading]);

    const loadCart = async () => {
        try {
            const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
            if (stored) {
                const parsedItems = JSON.parse(stored);
                setItems(parsedItems);
                console.log('🛒 Cart loaded from storage:', parsedItems.length, 'items');
            }
        } catch (error) {
            console.log('Error loading cart:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveCart = async (cartItems: CartItem[]) => {
        try {
            await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
            console.log('🛒 Cart saved to storage:', cartItems.length, 'items');
        } catch (error) {
            console.log('Error saving cart:', error);
        }
    };

    const addToCart = (product: Product, quantity: number = 1) => {
        setItems(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { product, quantity }];
        });
    };

    const removeFromCart = (productId: string) => {
        setItems(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setItems(prev =>
            prev.map(item =>
                item.product.id === productId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = async () => {
        setItems([]);
        try {
            await AsyncStorage.removeItem(CART_STORAGE_KEY);
            console.log('🛒 Cart cleared from storage');
        } catch (error) {
            console.log('Error clearing cart:', error);
        }
    };

    const getItemCount = () => items.reduce((sum, item) => sum + item.quantity, 0);

    const getSubtotal = () =>
        items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    const getShipping = () => {
        const subtotal = getSubtotal();
        // Free shipping over Rs.5000, otherwise Rs.200
        return subtotal >= 5000 ? 0 : 200;
    };

    const getTotal = () => getSubtotal() + getShipping();

    const isInCart = (productId: string) =>
        items.some(item => item.product.id === productId);

    return (
        <CartContext.Provider
            value={{
                items,
                loading,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                getItemCount,
                getSubtotal,
                getShipping,
                getTotal,
                isInCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
