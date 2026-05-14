import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, auth } from '../services/firebaseConfig'; 
import { 
    collection, addDoc, query, where, onSnapshot, 
    serverTimestamp, doc, updateDoc, orderBy 
} from 'firebase/firestore';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderReview {
    rating: number;
    title: string;
    text: string;
    date: string;
}

export interface Order {
    id: string;
    orderNumber: string;
    userId: string;
    items: any[];
    subtotal: number;
    shipping: number;
    total: number;
    status: OrderStatus;
    shippingAddress: {
        fullName: string;
        phone: string;
        street: string;
        city: string;
        state: string;
        postalCode: string;
    };
    paymentMethod: 'cod';
    createdAt: any;
    updatedAt: any;
    estimatedDelivery: string;
    review?: OrderReview; // '?' means this might not exist
}

interface OrderContextType {
    orders: Order[];
    addOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => Promise<any>;
    getOrderById: (id: string) => Order | undefined;
    updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
    addReview: (orderId: string, review: OrderReview) => Promise<void>;
    canReview: (orderId: string) => boolean;
    getOrdersByStatus: (status: OrderStatus) => Order[];
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
    const [orders, setOrders] = useState<Order[]>([]);

    // 1. Real-time Listen from Firebase
    useEffect(() => {
        if (!auth.currentUser) {
            setOrders([]);
            return;
        }

        const ordersQuery = query(
            collection(db, "orders"),
            where("userId", "==", auth.currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Safety check for review and dates
                    review: data.review || undefined,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
                };
            }) as Order[];
            setOrders(fetchedOrders);
        }, (error) => {
            console.error("Snapshot Error:", error);
        });

        return () => unsubscribe();
    }, [auth.currentUser]);

    // 2. Add Order to Firebase
    const addOrder = async (orderData: any) => {
        try {
            const orderNumber = `GDN-${Date.now().toString().slice(-6)}`;
            
            const docRef = await addDoc(collection(db, "orders"), {
                ...orderData,
                userId: auth.currentUser?.uid,
                orderNumber: orderNumber,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            return { id: docRef.id, orderNumber, ...orderData };
        } catch (error) {
            console.error("Firestore Save Error:", error);
            throw error;
        }
    };

    // 3. Helper Functions
    const getOrderById = (id: string) => orders.find(o => o.id === id);

    const updateOrderStatus = async (id: string, status: OrderStatus) => {
        try {
            const orderRef = doc(db, "orders", id);
            await updateDoc(orderRef, { 
                status, 
                updatedAt: serverTimestamp() 
            });
        } catch (error) {
            console.error("Update Status Error:", error);
        }
    };

    const addReview = async (orderId: string, review: OrderReview) => {
        try {
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, { 
                review, 
                updatedAt: serverTimestamp() 
            });
        } catch (error) {
            console.error("Add Review Error:", error);
        }
    };

    const canReview = (orderId: string): boolean => {
        const order = orders.find(o => o.id === orderId);
        // User can review ONLY if delivered AND no review exists yet
        return !!(order && order.status === 'delivered' && !order.review);
    };

    const getOrdersByStatus = (status: OrderStatus) => {
        return orders.filter(o => o.status === status);
    };

    return (
        <OrderContext.Provider value={{
            orders, addOrder, getOrderById, updateOrderStatus,
            addReview, canReview, getOrdersByStatus
        }}>
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (!context) throw new Error('useOrders must be used within an OrderProvider');
    return context;
}