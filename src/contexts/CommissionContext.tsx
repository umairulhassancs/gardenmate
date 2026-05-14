import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { notifyVendor, notifyAdmins } from '../services/notifyHelper';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';
export type VendorStatus = 'active' | 'blocked' | 'pending_approval';

export interface CommissionPayment {
    id: string;
    vendorId: string;
    month: string; // 'January 2026'
    year: number;
    salesAmount: number;
    commissionRate: number; // 0.10 for 10%
    commissionAmount: number;
    status: PaymentStatus;
    dueDate: string;
    paidDate?: string;
    transactionRef?: string;
    screenshotUrl?: string;
    paymentStatus?: 'pending_verification' | 'verified' | 'rejected';
    createdAt?: string;
}

export interface VendorCommissionRecord {
    vendorId: string;
    vendorName: string;
    storeName: string;
    email: string;
    phone: string;
    status: VendorStatus;
    // Registration details
    cnic: string;
    nurseryAddress: string;
    nurseryPhotos: string[];
    registrationDocs: string[];
    registeredAt: string;
    // Commission summary
    totalSales: number;
    totalCommissionDue: number;
    totalCommissionPaid: number;
    currentMonthSales: number;
    currentMonthCommission: number;
    payments: CommissionPayment[];
}

interface CommissionContextType {
    vendors: VendorCommissionRecord[];
    currentVendor: VendorCommissionRecord | null;
    setCurrentVendorId: (vendorId: string) => void;
    addPayment: (vendorId: string, payment: Omit<CommissionPayment, 'id'>) => Promise<void>;
    markPaymentPaid: (vendorId: string, paymentId: string, transactionRef: string) => Promise<void>;
    blockVendor: (vendorId: string) => Promise<void>;
    unblockVendor: (vendorId: string) => Promise<void>;
    sendReminder: (vendorId: string) => Promise<void>;
    getVendorById: (vendorId: string) => VendorCommissionRecord | undefined;
    getUnpaidVendors: () => VendorCommissionRecord[];
    getOverdueVendors: () => VendorCommissionRecord[];
    registerVendor: (vendorData: Omit<VendorCommissionRecord, 'payments' | 'totalSales' | 'totalCommissionDue' | 'totalCommissionPaid' | 'currentMonthSales' | 'currentMonthCommission'>) => Promise<void>;
}

const CommissionContext = createContext<CommissionContextType | undefined>(undefined);

const STORAGE_KEY = '@gardenmate_commissions';

// Mock data for demo
const mockVendors: VendorCommissionRecord[] = [
    {
        vendorId: '1',
        vendorName: 'Alex Thompson',
        storeName: 'Green Thumb Gardens',
        email: 'alex@greenthumb.com',
        phone: '+1 (555) 123-4567',
        status: 'active',
        cnic: '12345-6789012-3',
        nurseryAddress: '123 Garden Lane, San Francisco, CA 94102',
        nurseryPhotos: [],
        registrationDocs: [],
        registeredAt: '2025-10-15',
        totalSales: 15750.00,
        totalCommissionDue: 1575.00,
        totalCommissionPaid: 1050.00,
        currentMonthSales: 4250.00,
        currentMonthCommission: 425.00,
        payments: [
            { id: '1', vendorId: '1', month: 'October', year: 2025, salesAmount: 5200.00, commissionRate: 0.10, commissionAmount: 520.00, status: 'paid', dueDate: '2025-11-05', paidDate: '2025-11-03', transactionRef: 'TXN-001' },
            { id: '2', vendorId: '1', month: 'November', year: 2025, salesAmount: 5300.00, commissionRate: 0.10, commissionAmount: 530.00, status: 'paid', dueDate: '2025-12-05', paidDate: '2025-12-02', transactionRef: 'TXN-002' },
            { id: '3', vendorId: '1', month: 'December', year: 2025, salesAmount: 5250.00, commissionRate: 0.10, commissionAmount: 525.00, status: 'pending', dueDate: '2026-01-05' },
        ],
    },
    {
        vendorId: '2',
        vendorName: 'Maria Garcia',
        storeName: 'Botanical Bliss',
        email: 'maria@botanicalbliss.com',
        phone: '+1 (555) 987-6543',
        status: 'active',
        cnic: '98765-4321098-7',
        nurseryAddress: '456 Bloom Street, Los Angeles, CA 90001',
        nurseryPhotos: [],
        registrationDocs: [],
        registeredAt: '2025-08-20',
        totalSales: 22400.00,
        totalCommissionDue: 2240.00,
        totalCommissionPaid: 1640.00,
        currentMonthSales: 6000.00,
        currentMonthCommission: 600.00,
        payments: [
            { id: '4', vendorId: '2', month: 'November', year: 2025, salesAmount: 8200.00, commissionRate: 0.10, commissionAmount: 820.00, status: 'paid', dueDate: '2025-12-05', paidDate: '2025-12-01', transactionRef: 'TXN-003' },
            { id: '5', vendorId: '2', month: 'December', year: 2025, salesAmount: 8200.00, commissionRate: 0.10, commissionAmount: 820.00, status: 'paid', dueDate: '2026-01-05', paidDate: '2026-01-02', transactionRef: 'TXN-004' },
            { id: '6', vendorId: '2', month: 'January', year: 2026, salesAmount: 6000.00, commissionRate: 0.10, commissionAmount: 600.00, status: 'pending', dueDate: '2026-02-05' },
        ],
    },
    {
        vendorId: '3',
        vendorName: 'James Wilson',
        storeName: 'Urban Jungle',
        email: 'james@urbanjungle.com',
        phone: '+1 (555) 456-7890',
        status: 'blocked',
        cnic: '45678-9012345-6',
        nurseryAddress: '789 Forest Ave, Seattle, WA 98101',
        nurseryPhotos: [],
        registrationDocs: [],
        registeredAt: '2025-06-10',
        totalSales: 8900.00,
        totalCommissionDue: 890.00,
        totalCommissionPaid: 0,
        currentMonthSales: 0,
        currentMonthCommission: 0,
        payments: [
            { id: '7', vendorId: '3', month: 'November', year: 2025, salesAmount: 4500.00, commissionRate: 0.10, commissionAmount: 450.00, status: 'overdue', dueDate: '2025-12-05' },
            { id: '8', vendorId: '3', month: 'December', year: 2025, salesAmount: 4400.00, commissionRate: 0.10, commissionAmount: 440.00, status: 'overdue', dueDate: '2026-01-05' },
        ],
    },
];

export function CommissionProvider({ children }: { children: ReactNode }) {
    const [vendors, setVendors] = useState<VendorCommissionRecord[]>([]);
    const [currentVendorId, setCurrentVendorIdState] = useState<string>('1');
    const [loading, setLoading] = useState(true);

    // Real-time listener for vendors collection
    useEffect(() => {
        // We need to listen to both vendors and commission_payments
        // to correctly populate the vendor.payments array.

        const unsubscribeVendors = onSnapshot(collection(db, 'vendors'), (vendorSnap) => {
            const tempVendors: any[] = [];
            vendorSnap.forEach((doc) => {
                tempVendors.push({ ...doc.data(), vendorId: doc.id });
            });

            // Now listen to payments
            const unsubscribePayments = onSnapshot(collection(db, 'commission_payments'), (paymentSnap) => {
                const allPayments: CommissionPayment[] = [];
                paymentSnap.forEach((doc) => {
                    const data = doc.data();
                    allPayments.push({
                        id: doc.id,
                        vendorId: data.vendorId,
                        month: data.month || '',
                        year: data.year || new Date().getFullYear(),
                        salesAmount: data.amount || 0, // Mapping amount to sales/commission for display
                        commissionRate: 0.10,
                        commissionAmount: data.amount || 0,
                        status: (data.status === 'verified' ? 'paid' : data.status === 'rejected' ? 'overdue' : 'pending') as PaymentStatus,
                        dueDate: '',
                        screenshotUrl: data.screenshotUrl,
                        paymentStatus: data.status,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
                    } as any);
                });

                // Merge payments into vendors
                const mergedVendors = tempVendors.map(v => {
                    const vendorPayments = allPayments.filter(p => p.vendorId === v.vendorId);

                    // Recalculate totals based on actual payments found
                    const totalPaid = vendorPayments
                        .filter(p => p.paymentStatus === 'verified')
                        .reduce((sum, p) => sum + p.commissionAmount, 0);

                    return {
                        vendorId: v.vendorId,
                        vendorName: v.vendorName || v.name || 'Unknown',
                        storeName: v.storeName || v.nurseryName || 'Unknown Store',
                        email: v.email || '',
                        phone: v.phone || '',
                        status: v.status || 'active',
                        cnic: v.cnic || '',
                        nurseryAddress: v.nurseryAddress || '',
                        nurseryPhotos: v.nurseryPhotos || [],
                        registrationDocs: v.registrationDocs || [],
                        registeredAt: v.registeredAt || v.createdAt || new Date().toISOString(),
                        totalSales: v.totalSales || 0,
                        totalCommissionDue: v.totalCommissionDue || 0,
                        totalCommissionPaid: totalPaid, // Use calculated total
                        currentMonthSales: v.currentMonthSales || 0,
                        currentMonthCommission: v.currentMonthCommission || 0,
                        payments: vendorPayments.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()),
                    };
                });

                setVendors(mergedVendors);
                setLoading(false);
            });

            return () => unsubscribePayments();
        });

        return () => unsubscribeVendors();
    }, []);

    const loadData = async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                setVendors(JSON.parse(data));
            }
        } catch (error) {
            console.log('Error loading commission data:', error);
        }
    };

    const saveData = async (newVendors: VendorCommissionRecord[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newVendors));
        } catch (error) {
            console.log('Error saving commission data:', error);
        }
    };

    const setCurrentVendorId = (vendorId: string) => {
        setCurrentVendorIdState(vendorId);
    };

    const currentVendor = vendors.find(v => v.vendorId === currentVendorId) || null;

    const addPayment = async (vendorId: string, payment: Omit<CommissionPayment, 'id'>) => {
        try {
            const vendorRef = doc(db, 'vendors', vendorId);
            const vendor = vendors.find(v => v.vendorId === vendorId);

            if (!vendor) return;

            const newPayment: CommissionPayment = {
                ...payment,
                id: Date.now().toString(),
            };

            const updatedPayments = [...vendor.payments, newPayment];

            await updateDoc(vendorRef, {
                payments: updatedPayments,
                totalCommissionDue: vendor.totalCommissionDue + payment.commissionAmount,
            });

            // Real-time listener will update the state automatically
        } catch (error) {
            console.error('Error adding payment:', error);
            throw error;
        }
    };

    const markPaymentPaid = async (vendorId: string, paymentId: string, transactionRef: string) => {
        try {
            const vendorRef = doc(db, 'vendors', vendorId);
            const vendor = vendors.find(v => v.vendorId === vendorId);

            if (!vendor) return;

            const payment = vendor.payments.find(p => p.id === paymentId);
            const paidAmount = payment?.commissionAmount || 0;

            const updatedPayments = vendor.payments.map(p =>
                p.id === paymentId
                    ? {
                        ...p,
                        status: 'paid' as PaymentStatus,
                        paidDate: new Date().toISOString().split('T')[0],
                        transactionRef,
                        paidAt: new Date().toISOString()
                    }
                    : p
            );

            await updateDoc(vendorRef, {
                payments: updatedPayments,
                totalCommissionPaid: vendor.totalCommissionPaid + paidAmount,
            });

            // Real-time listener will update the state automatically
        } catch (error) {
            console.error('Error marking payment as paid:', error);
            throw error;
        }
    };

    const blockVendor = async (vendorId: string) => {
        try {
            const vendorRef = doc(db, 'vendors', vendorId);
            const vendor = vendors.find(v => v.vendorId === vendorId);
            await updateDoc(vendorRef, {
                status: 'blocked' as VendorStatus,
                blockedAt: new Date().toISOString(),
            });

            // ... imports
            // ... imports

            // ... inside CommissionProvider
            // Notify vendor
            await notifyVendor(
                vendorId,
                'Account Blocked',
                'Your vendor account has been blocked by the admin. Contact support for more information.',
                'warning'
            );

            // Notify admin
            await notifyAdmins(
                'Vendor Blocked',
                `Vendor ${vendor?.storeName || vendorId} has been blocked.`,
                vendorId,
                'vendor_blocked'
            );
        } catch (error) {
            console.error('Error blocking vendor:', error);
            throw error;
        }
    };

    const unblockVendor = async (vendorId: string) => {
        try {
            const vendorRef = doc(db, 'vendors', vendorId);
            const vendor = vendors.find(v => v.vendorId === vendorId);
            await updateDoc(vendorRef, {
                status: 'active' as VendorStatus,
                unblockedAt: new Date().toISOString(),
            });

            // Notify vendor
            await notifyVendor(
                vendorId,
                'Account Restored',
                'Your vendor account has been restored. You can now continue selling.',
                'alert'
            );

            // Notify admin
            await notifyAdmins(
                'Vendor Unblocked',
                `Vendor ${vendor?.storeName || vendorId} has been unblocked.`,
                vendorId,
                'vendor_unblocked'
            );
        } catch (error) {
            console.error('Error unblocking vendor:', error);
            throw error;
        }
    };

    const sendReminder = async (vendorId: string) => {
        try {
            const vendor = vendors.find(v => v.vendorId === vendorId);
            const unpaidAmount = vendor?.payments
                ?.filter((p: CommissionPayment) => p.status !== 'paid')
                .reduce((s: number, p: CommissionPayment) => s + p.commissionAmount, 0) || 0;

            // Notify vendor only
            await notifyVendor(
                vendorId,
                'Commission Payment Reminder',
                `You have $${unpaidAmount.toFixed(2)} pending commission due. Please pay before the due date to avoid account restrictions.`,
                'commission'
            );

            console.log(`Reminder sent to vendor ${vendorId}`);
        } catch (error) {
            console.error('Error sending reminder:', error);
            throw error;
        }
    };

    const getVendorById = (vendorId: string) => {
        return vendors.find(v => v.vendorId === vendorId);
    };

    const getUnpaidVendors = () => {
        return vendors.filter(v =>
            v.payments.some(p => p.status === 'pending' || p.status === 'overdue')
        );
    };

    const getOverdueVendors = () => {
        return vendors.filter(v =>
            v.payments.some(p => p.status === 'overdue')
        );
    };

    const registerVendor = async (vendorData: Omit<VendorCommissionRecord, 'payments' | 'totalSales' | 'totalCommissionDue' | 'totalCommissionPaid' | 'currentMonthSales' | 'currentMonthCommission'>) => {
        try {
            const newVendor = {
                ...vendorData,
                payments: [],
                totalSales: 0,
                totalCommissionDue: 0,
                totalCommissionPaid: 0,
                currentMonthSales: 0,
                currentMonthCommission: 0,
                createdAt: new Date().toISOString(),
            };

            await addDoc(collection(db, 'vendors'), newVendor);
            // Real-time listener will update the state automatically
        } catch (error) {
            console.error('Error registering vendor:', error);
            throw error;
        }
    };

    return (
        <CommissionContext.Provider value={{
            vendors,
            currentVendor,
            setCurrentVendorId,
            addPayment,
            markPaymentPaid,
            blockVendor,
            unblockVendor,
            sendReminder,
            getVendorById,
            getUnpaidVendors,
            getOverdueVendors,
            registerVendor,
        }}>
            {children}
        </CommissionContext.Provider>
    );
}

export function useCommission() {
    const context = useContext(CommissionContext);
    if (!context) {
        throw new Error('useCommission must be used within a CommissionProvider');
    }
    return context;
}
