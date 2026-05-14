import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { useCommission, PaymentStatus } from '../../contexts/CommissionContext';
import { db, auth } from '../../services/firebaseConfig';
import { doc, onSnapshot, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';


const statusConfig: Record<PaymentStatus, { color: string; bgColor: string; label: string }> = {
    pending: { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: 'Pending' },
    paid: { color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', label: 'Paid' },
    overdue: { color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: 'Overdue' },
};

export default function VendorCommissionScreen({ navigation }: any) {
    const [vendorData, setVendorData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { currentVendor, markPaymentPaid } = useCommission();
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
    const [transactionRef, setTransactionRef] = useState('');
    const [saving, setSaving] = useState(false); // Yeh line add karein
    const vendorId = auth.currentUser?.uid;

    if (!currentVendor) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No vendor data available</Text>
                </View>
            </SafeAreaView>
        );
    }
    useEffect(() => {
        if (!vendorId) return;

        // Listen for changes in vendor document
        const unsub = onSnapshot(doc(db, 'vendors', vendorId), (docSnap) => {
            if (docSnap.exists()) {
                setVendorData(docSnap.data());
            }
            setLoading(false);
        });

        return () => unsub();
    }, [vendorId]);

    const handlePayNow = (paymentId: string) => {
        setSelectedPaymentId(paymentId);
        setTransactionRef('');
        setShowPayModal(true);
    };

    const submitPayment = async () => {
        if (!transactionRef.trim() || !selectedPaymentId) {
            Alert.alert('Required', 'Please enter a transaction reference.');
            return;
        }

        setSaving(true); // Kaam shuru: Loading On
        try {
            const vendorRef = doc(db, 'vendors', vendorId!);

            const updatedPayments = vendorData.payments.map((p: any) => {
                if (p.id === selectedPaymentId) {
                    return {
                        ...p,
                        status: 'paid',
                        transactionRef: transactionRef,
                        paidAt: new Date().toISOString()
                    };
                }
                return p;
            });

            await updateDoc(vendorRef, {
                payments: updatedPayments
            });

            // ✅ Notify Admin about Commission Payment
            const paidAmount = updatedPayments.find((p: any) => p.id === selectedPaymentId)?.commissionAmount || 0;
            await addDoc(collection(db, 'notifications'), {
                type: 'commission_payment',
                title: 'Commission Payment Received 💰',
                description: `${vendorData?.nurseryName || 'Vendor'} submitted payment of Rs. ${typeof paidAmount === 'number' ? paidAmount.toFixed(2) : paidAmount}`,
                userId: 'admin',
                relatedId: vendorId,
                isRead: false,
                read: false,
                createdAt: serverTimestamp(),
            });

            setShowPayModal(false);
            setTransactionRef('');
            Alert.alert('Success 🎉', 'Payment recorded for Admin verification!');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Update failed. Please try again.');
        } finally {
            setSaving(false); // Kaam khatam: Loading Off
        }
    };

    // UI Calculations
    const pendingPayments = vendorData?.payments?.filter((p: any) => p.status !== 'paid') || [];
    const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + p.commissionAmount, 0);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Commission History</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Summary Card - Connected to vendorData */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Total Sales</Text>
                            {/* fallback to 0 if data not loaded */}
                            <Text style={styles.summaryValue}>Rs. {(vendorData?.totalSales || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Commission Rate</Text>
                            <Text style={styles.summaryValue}>{vendorData?.commissionPercentage || '2'}%</Text>
                        </View>
                    </View>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Total Paid</Text>
                            <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                                Rs. {(vendorData?.totalCommissionPaid || 0).toFixed(2)}
                            </Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Pending</Text>
                            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                                Rs. {totalPending.toFixed(2)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Payment Info Card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoIconBox}>
                        <Feather name="info" size={18} color="#3b82f6" />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Payment Instructions</Text>
                        <Text style={styles.infoText}>
                            Transfer your commission to:{'\n'}
                            <Text style={styles.boldText}>Bank:</Text> GardenMate Bank{'\n'}
                            <Text style={styles.boldText}>Account:</Text> 1234-5678-9012-3456{'\n'}
                            <Text style={styles.boldText}>IBAN:</Text> PK00GDNM0001234567890
                        </Text>
                    </View>
                </View>
                {/* Pending Payments Section */}
                {pendingPayments.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Pending Payments</Text>
                        {pendingPayments.map(payment => {
                            // Status config se colors aur label nikalna
                            const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;

                            return (
                                <View key={payment.id} style={styles.paymentCard}>
                                    <View style={styles.paymentHeader}>
                                        <View>
                                            <Text style={styles.paymentMonth}>{payment.month} {payment.year}</Text>
                                            <Text style={styles.paymentDue}>Due: {payment.dueDate}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                                            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.paymentDetails}>
                                        <View style={styles.paymentRow}>
                                            <Text style={styles.paymentLabel}>Sales</Text>
                                            {/* Rs. use kar rahe hain local feel ke liye */}
                                            <Text style={styles.paymentValue}>Rs. {payment.salesAmount.toLocaleString()}</Text>
                                        </View>
                                        <View style={styles.paymentRow}>
                                            <Text style={styles.paymentLabel}>Commission ({vendorData?.commissionPercentage || 2}%)</Text>
                                            <Text style={styles.paymentAmount}>Rs. {payment.commissionAmount.toFixed(2)}</Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.payButton, { backgroundColor: colors.primary }]}
                                        onPress={() => handlePayNow(payment.id)}
                                    >
                                        <Feather name="credit-card" size={16} color="#fff" />
                                        <Text style={styles.payButtonText}>Mark as Paid</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    /* Empty State: Jab sab clear ho */
                    <View style={styles.section}>
                        <View style={styles.emptyCard}>
                            <Feather name="check-circle" size={40} color="#10b981" />
                            <Text style={styles.emptyText}>All Settled!</Text>
                            <Text style={styles.emptySubText}>No pending commission.</Text>
                        </View>
                    </View>
                )}
                {/* Payment History Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment History</Text>

                    {/* Paid payments filter kar ke map karein */}
                    {vendorData?.payments?.filter((p: any) => p.status === 'paid').map((payment: any) => (
                        <View key={payment.id} style={styles.historyCard}>
                            <View style={styles.historyHeader}>
                                <View>
                                    <Text style={styles.historyMonth}>{payment.month} {payment.year}</Text>
                                    {/* paidAt humne submitPayment function mein set kiya tha */}
                                    <Text style={styles.historyDate}>Paid on: {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : payment.paidDate}</Text>
                                </View>

                                {/* Green Status Badge for History */}
                                <View style={[styles.statusBadge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                    <Feather name="check-circle" size={12} color="#10b981" />
                                    <Text style={[styles.statusText, { color: '#10b981', marginLeft: 4 }]}>Paid</Text>
                                </View>
                            </View>

                            <View style={styles.historyDetails}>
                                <Text style={styles.historyLabel}>Sales: Rs. {(payment.salesAmount || 0).toLocaleString()}</Text>
                                <Text style={styles.historyAmount}>Rs. {(payment.commissionAmount || 0).toFixed(2)}</Text>
                            </View>

                            {/* Transaction Reference Number agar maujood ho */}
                            {payment.transactionRef && (
                                <View style={styles.refContainer}>
                                    <Feather name="hash" size={12} color="#9ca3af" />
                                    <Text style={styles.transactionRef}> Ref: {payment.transactionRef}</Text>
                                </View>
                            )}
                        </View>
                    ))}

                    {/* Empty State for History */}
                    {(!vendorData?.payments || vendorData.payments.filter((p: any) => p.status === 'paid').length === 0) && (
                        <View style={styles.emptyHistoryBox}>
                            <Text style={styles.noHistory}>No payment history yet</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Payment Modal */}
            <Modal visible={showPayModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowPayModal(false)} disabled={saving}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Record Payment</Text>

                        <TouchableOpacity onPress={submitPayment} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.submitText}>Submit</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalContent}>
                        {/* Warning/Info Box */}
                        <View style={styles.modalInfo}>
                            <Feather name="alert-circle" size={20} color="#f59e0b" />
                            <Text style={styles.modalInfoText}>
                                Please enter your bank transfer reference number. Admin will verify payment within 24 hours.
                            </Text>
                        </View>

                        {/* Input Field */}
                        <Text style={styles.inputLabel}>Transaction Reference *</Text>
                        <TextInput
                            style={[styles.input, { borderColor: transactionRef ? colors.primary : '#e5e7eb' }]}
                            value={transactionRef}
                            onChangeText={setTransactionRef}
                            placeholder="e.g., TXN-123456789"
                            placeholderTextColor="#9ca3af"
                            autoFocus={true} // Modal khulte hi keyboard aa jaye ga
                            returnKeyType="done"
                            onSubmitEditing={submitPayment} // Keyboard se hi submit ho jaye
                        />

                        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                            * Receipt par mojood 8-12 digits ka reference number yahan likhein.
                        </Text>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textMuted },
    summaryCard: { backgroundColor: '#fff', margin: spacing.lg, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    summaryRow: { flexDirection: 'row', marginBottom: spacing.md },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, backgroundColor: 'rgba(229,231,235,0.5)', marginHorizontal: spacing.md },
    summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 4 },
    summaryValue: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    infoCard: { flexDirection: 'row', backgroundColor: 'rgba(59,130,246,0.1)', marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: borderRadius.lg },
    infoContent: { flex: 1, marginLeft: spacing.md },
    infoTitle: { fontSize: fontSize.sm, fontWeight: 'bold', color: '#1d4ed8', marginBottom: 4 },
    infoText: { fontSize: fontSize.xs, color: '#1d4ed8', lineHeight: 18 },
    section: { padding: spacing.lg },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    paymentCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    paymentMonth: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    paymentDue: { fontSize: fontSize.xs, color: colors.textMuted },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '600' },
    paymentDetails: { backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
    paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    paymentLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    paymentValue: { fontSize: fontSize.sm, color: colors.text },
    paymentAmount: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm },
    payButtonText: { color: '#fff', fontWeight: 'bold' },
    historyCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    historyMonth: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    historyDate: { fontSize: fontSize.xs, color: colors.textMuted },
    historyDetails: { flexDirection: 'row', justifyContent: 'space-between' },
    historyLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    historyAmount: { fontSize: fontSize.base, fontWeight: 'bold', color: '#10b981' },
    transactionRef: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
    noHistory: { textAlign: 'center', color: colors.textMuted, padding: spacing.lg },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    cancelText: { color: colors.textMuted, fontWeight: '500' },
    submitText: { color: colors.primary, fontWeight: 'bold' },
    modalContent: { padding: spacing.lg },
    modalInfo: { flexDirection: 'row', backgroundColor: 'rgba(245,158,11,0.1)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.xl },
    modalInfoText: { flex: 1, marginLeft: spacing.sm, fontSize: fontSize.sm, color: '#b45309', lineHeight: 20 },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    input: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.base, color: colors.text },

    infoIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    boldText: { fontWeight: 'bold' },
    emptyCard: { alignItems: 'center', padding: spacing.xl, backgroundColor: '#fff', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
    emptySubText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
    refContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    emptyHistoryBox: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg },
});
