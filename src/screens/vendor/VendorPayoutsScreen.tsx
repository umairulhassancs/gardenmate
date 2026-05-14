import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, Image, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { formatPrice } from '../../utils/currency';
import { auth, db, storage } from '../../services/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { notifyAdmins } from '../../services/notifyHelper';

interface Payout {
    id: string;
    amount: number;
    date: Date;
    status: 'completed' | 'pending' | 'failed';
    method: string;
}

interface CommissionPaymentRecord {
    id: string;
    vendorId: string;
    amount: number;
    screenshotUrl: string;
    status: 'pending_verification' | 'verified' | 'rejected';
    createdAt: Date;
}

export default function VendorPayoutsScreen({ navigation }: any) {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [pendingBalance, setPendingBalance] = useState(0);
    const [deliveredTotal, setDeliveredTotal] = useState(0);
    const [deliveredCount, setDeliveredCount] = useState(0);

    // Commission Financials
    const [totalCommission, setTotalCommission] = useState(0);
    const [verifiedPaid, setVerifiedPaid] = useState(0);
    const [pendingPaid, setPendingPaid] = useState(0);
    const [commissionDue, setCommissionDue] = useState(0); // Actual Due (Total - Verified)
    const [remainingPayable, setRemainingPayable] = useState(0); // Payable (Due - Pending)

    const [commissionPayments, setCommissionPayments] = useState<CommissionPaymentRecord[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState(''); // New state for custom amount

    const vendorId = auth.currentUser?.uid;
    const COMMISSION_RATE = 0.10; // 10%

    // Fetch Delivered Orders to calculate Total Sales & Commission
    useEffect(() => {
        if (!vendorId) return;

        setLoading(true);
        const q = query(
            collection(db, 'orders'),
            where('vendorId', '==', vendorId),
            where('status', '==', 'delivered')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let total = 0;
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                // Ensure we handle string/number price
                const price = typeof data.total === 'number' ? data.total : (typeof data.totalPrice === 'string' ? parseFloat(data.totalPrice) : (data.totalPrice || 0));
                total += price;
                count++;
            });

            setDeliveredTotal(total);
            setDeliveredCount(count);

            // Sync stats to Vendor Document so Admin sees correct values
            // detailed calculation happens in the next effect, but we can sync basics here or there.
            // Let's sync here.
            updateDoc(doc(db, 'vendors', vendorId), {
                totalSales: total,
                totalCommissionDue: total * COMMISSION_RATE,
                lastStatsUpdate: serverTimestamp()
            }).catch(err => console.log("Stats sync error (harmless if permission issue):", err));

            setLoading(false);
        }, (error) => {
            console.error("Error fetching orders:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vendorId]);

    // Listen for commission payment records
    useEffect(() => {
        if (!vendorId) return;

        // REMOVED orderBy to avoid index error
        const unsubscribe = onSnapshot(
            query(
                collection(db, 'commission_payments'),
                where('vendorId', '==', vendorId)
            ),
            (snapshot) => {
                const payments: CommissionPaymentRecord[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    payments.push({
                        id: doc.id,
                        vendorId: data.vendorId,
                        amount: data.amount || 0,
                        screenshotUrl: data.screenshotUrl || '',
                        status: data.status || 'pending_verification',
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    });
                });
                // Sort client-side
                payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                setCommissionPayments(payments);
            },
            (error) => {
                console.error('Error loading commission payments:', error);
            }
        );

        return () => unsubscribe();
    }, [vendorId]);

    // Calculate Commission Due based on Verified Payments
    // Calculate Commission Due based on Verified Payments
    useEffect(() => {
        // Always calculate, even if 0
        const totalComm = deliveredTotal * COMMISSION_RATE;
        setTotalCommission(totalComm);

        const vPaid = commissionPayments
            .filter(p => p.status === 'verified')
            .reduce((sum, p) => sum + p.amount, 0);
        setVerifiedPaid(vPaid);

        const pPaid = commissionPayments
            .filter(p => p.status === 'pending_verification')
            .reduce((sum, p) => sum + p.amount, 0);
        setPendingPaid(pPaid);

        const due = Math.max(0, totalComm - vPaid);
        setCommissionDue(due);

        const remaining = Math.max(0, due - pPaid);
        setRemainingPayable(remaining);

        // Pre-fill amount if empty and there is a balance
        if (!paymentAmount && remaining > 0) {
            setPaymentAmount(remaining.toString());
        }
    }, [deliveredTotal, commissionPayments]);

    const hasPendingPayment = commissionPayments.some(p => p.status === 'pending_verification');

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow access to your photo library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.4,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
                // Basic duplicate check
                if (selectedImage === base64) {
                    Alert.alert("Duplicate Selection", "You selected the same image again.");
                    return;
                }
                setSelectedImage(base64);
            }
        } catch (error) {
            console.error('Pick image error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const handleSubmitPayment = async () => {
        if (!selectedImage) {
            Alert.alert('Error', 'Please select a screenshot first.');
            return;
        }

        const amountToPay = parseFloat(paymentAmount);
        if (isNaN(amountToPay) || amountToPay <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        // Strict check:
        if (amountToPay > remainingPayable + 1) {
            Alert.alert('Amount Exceeds Limit', `You only need to pay ${formatPrice(remainingPayable)}. Use 'Unsubmit' on pending payments if you need to adjust.`);
            return;
        }

        try {
            setUploading(true);

            // Create commission_payments document
            const paymentRef = await addDoc(collection(db, 'commission_payments'), {
                vendorId,
                amount: amountToPay,
                screenshotUrl: selectedImage,
                status: 'pending_verification',
                createdAt: serverTimestamp(),
            });

            // Notify admin
            await notifyAdmins(
                'Commission Payment 💰',
                `Vendor has submitted commission payment of ${formatPrice(amountToPay)} with proof screenshot.`,
                paymentRef.id,
                'commission_paid'
            );

            setUploading(false);
            setSelectedImage(null);
            setPaymentAmount('');
            Alert.alert(
                'Payment Submitted ✅',
                'Your payment screenshot has been uploaded. Admin will verify.',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            console.error('Error uploading payment details:', error);
            setUploading(false);
            Alert.alert('Upload Failed', `Failed to upload payment screenshot.`);
        }
    };

    const handleUnsubmitPayment = async (paymentId: string) => {
        Alert.alert(
            'Unsubmit Payment',
            'Are you sure you want to cancel this pending payment? This will remove the record.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unsubmit',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'commission_payments', paymentId));
                            Alert.alert('Success', 'Payment unsubmitted successfully.');
                        } catch (error) {
                            console.error("Error deleting payment:", error);
                            Alert.alert('Error', 'Failed to unsubmit payment.');
                        }
                    }
                }
            ]
        );
    };

    // ... (rest of render until pay button) ...


    const getPaymentStatusConfig = (status: string) => {
        switch (status) {
            case 'pending_verification':
                return { label: 'Awaiting Verification', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'clock' as const };
            case 'verified':
                return { label: 'Verified ✅', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: 'check-circle' as const };
            case 'rejected':
                return { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'x-circle' as const };
            default:
                return { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: 'help-circle' as const };
        }
    };

    if (loading) {
        // ... (existing loading)
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#059669" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Payouts & Commission</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Commission Details Card - Green Themed */}
                <View style={styles.commissionSection}>
                    <View style={styles.commissionSectionHeader}>
                        <View style={styles.commissionTitleRow}>
                            <View style={styles.commissionIconCircle}>
                                <Feather name="percent" size={16} color="#10b981" />
                            </View>
                            <Text style={styles.commissionSectionTitle}>Commission Details (10%)</Text>
                        </View>
                    </View>

                    <LinearGradient colors={['#ecfdf5', '#d1fae5']} style={styles.commissionCard}>
                        <View style={styles.commissionRow}>
                            <View style={styles.commissionItem}>
                                <Feather name="package" size={18} color="#059669" />
                                <Text style={styles.commissionItemValue}>{deliveredCount}</Text>
                                <Text style={styles.commissionItemLabel}>Delivered Orders</Text>
                            </View>
                            <View style={styles.commissionDivider} />
                            <View style={styles.commissionItem}>
                                <Feather name="dollar-sign" size={18} color="#059669" />
                                <Text style={styles.commissionItemValue}>{formatPrice(deliveredTotal)}</Text>
                                <Text style={styles.commissionItemLabel}>Total Sales</Text>
                            </View>
                            <View style={styles.commissionDivider} />
                            <View style={styles.commissionItem}>
                                <Feather name="trending-up" size={18} color="#059669" />
                                <Text style={[styles.commissionItemValue, { color: '#dc2626' }]}>{formatPrice(commissionDue)}</Text>
                                <Text style={styles.commissionItemLabel}>Commission Due</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Commission Breakdown Card */}
                    <View style={styles.breakdownCard}>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Total Sales</Text>
                            <Text style={styles.breakdownValue}>{formatPrice(deliveredTotal)}</Text>
                        </View>
                        <View style={styles.breakdownDividerLine} />
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Total Commission (10%)</Text>
                            <Text style={styles.breakdownValue}>{formatPrice(totalCommission)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Verified Paid</Text>
                            <Text style={[styles.breakdownValue, { color: '#10b981' }]}>-{formatPrice(verifiedPaid)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Pending Verification</Text>
                            <Text style={[styles.breakdownValue, { color: '#f59e0b' }]}>-{formatPrice(pendingPaid)}</Text>
                        </View>
                        <View style={styles.breakdownDividerLine} />
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { fontWeight: 'bold' }]}>Remaining to Pay</Text>
                            <Text style={[styles.breakdownValue, { fontWeight: 'bold', color: '#dc2626' }]}>{formatPrice(remainingPayable)}</Text>
                        </View>

                        {/* Show actual Due (without pending subtracted) for clarity if needed, or just keep Remaining */}
                    </View>

                    {/* Pay Commission Section - Show if Remaining > 0 */}
                    <View style={{ marginTop: spacing.md }}>
                        {remainingPayable <= 0 && pendingPaid === 0 ? (
                            <View style={[styles.paymentStatusCard, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10b981' }]}>
                                <Feather name="check-circle" size={20} color="#10b981" />
                                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                    <Text style={[styles.paymentStatusTitle, { color: '#064e3b' }]}>All Due Commission Paid</Text>
                                    <Text style={[styles.paymentStatusDesc, { color: '#065f46' }]}>Great job! You are all caught up.</Text>
                                </View>
                            </View>
                        ) : null}

                        {remainingPayable <= 0 && pendingPaid > 0 ? (
                            <View style={styles.paymentStatusCard}>
                                <Feather name="clock" size={20} color="#f59e0b" />
                                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                    <Text style={styles.paymentStatusTitle}>Payments Pending Verification</Text>
                                    <Text style={styles.paymentStatusDesc}>Once verified, your balance will be cleared.</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Allow Upload if Remaining > 0 */}
                        {remainingPayable > 0 && (
                            <>
                                {selectedImage ? (
                                    <View style={styles.previewContainer}>
                                        <View style={styles.previewHeader}>
                                            <Text style={styles.previewLabel}>Screenshot Preview</Text>
                                            <TouchableOpacity onPress={() => setSelectedImage(null)} disabled={uploading}>
                                                <Feather name="x" size={20} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                        <Image source={{ uri: selectedImage }} style={styles.previewImg} resizeMode="contain" />

                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={styles.previewLabel}>Amount to Pay</Text>
                                            <TextInput
                                                style={styles.amountInput}
                                                value={paymentAmount}
                                                onChangeText={setPaymentAmount}
                                                keyboardType="numeric"
                                                placeholder={`Max: ${Math.ceil(remainingPayable)}`}
                                            />
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.submitBtn, uploading && styles.disabledBtn]}
                                            onPress={handleSubmitPayment}
                                            disabled={uploading}
                                        >
                                            {uploading ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                                                    <Text style={styles.submitBtnText}>Submit Payment {paymentAmount ? formatPrice(parseFloat(paymentAmount) || 0) : ''}</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.payCommissionBtn}
                                        onPress={pickImage}
                                    >
                                        <Feather name="upload" size={18} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.payCommissionText}>
                                            Select Payment Screenshot
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </View>

                {/* Pending Payments Section with Unsubmit */}
                {commissionPayments.filter(p => p.status === 'pending_verification').length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Pending Approvals</Text>
                        {commissionPayments.filter(p => p.status === 'pending_verification').map(payment => (
                            <View key={payment.id} style={styles.payoutCard}>
                                <View style={[styles.payoutIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                    <Feather name="clock" size={20} color="#f59e0b" />
                                </View>
                                <View style={styles.payoutInfo}>
                                    <Text style={styles.payoutAmount}>{formatPrice(payment.amount)}</Text>
                                    <Text style={styles.payoutMeta}>Submitted: {payment.createdAt.toLocaleDateString()}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => payment.screenshotUrl && setViewImage(payment.screenshotUrl)}
                                        style={{ padding: 6 }}
                                    >
                                        <Feather name="eye" size={16} color={colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleUnsubmitPayment(payment.id)}
                                        style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}
                                    >
                                        <Feather name="trash-2" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.transactionsSection}>
                    <Text style={styles.sectionTitle}>Commission Payment History</Text>
                    {commissionPayments.length > 0 ? (
                        commissionPayments.map((payment) => (
                            <TouchableOpacity
                                key={payment.id}
                                style={styles.transactionCard}
                                onPress={() => payment.screenshotUrl && setViewImage(payment.screenshotUrl)}
                            >
                                <View style={styles.transactionIcon}>
                                    <Feather name="check" size={20} color={colors.primary} />
                                </View>
                                <View style={styles.transactionDetails}>
                                    <Text style={styles.transactionTitle}>Commission Paid</Text>
                                    <Text style={styles.transactionDate}>
                                        {payment.createdAt.toLocaleDateString()} at {payment.createdAt.toLocaleTimeString()}
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: payment.status === 'verified' ? 'rgba(16,185,129,0.1)' : payment.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }
                                        ]}>
                                            <Text style={[
                                                styles.statusText,
                                                { color: payment.status === 'verified' ? '#10b981' : payment.status === 'rejected' ? '#ef4444' : '#f59e0b' }
                                            ]}>
                                                {payment.status === 'verified' ? 'Verified' : payment.status === 'rejected' ? 'Rejected' : 'Pending'}
                                            </Text>
                                        </View>
                                        {payment.screenshotUrl && (
                                            <View style={[styles.statusBadge, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                                <Feather name="image" size={10} color="#3b82f6" style={{ marginRight: 4 }} />
                                                <Text style={[styles.statusText, { color: '#3b82f6' }]}>Screenshot</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Text style={styles.transactionAmount}>-{formatPrice(payment.amount)}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Feather name="clock" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No commission payments yet</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Screenshot Preview Modal (For History) */}
            <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Payment Proof</Text>
                            <TouchableOpacity onPress={() => setViewImage(null)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {viewImage && (
                            <Image
                                source={{ uri: viewImage }}
                                style={styles.previewImage}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* This loading overlay is for the initial data fetch, not for uploading */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            )}

            {uploading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Uploading proof...</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    withdrawTextDisabled: { color: '#9ca3af' },

    // Commission Section - Green
    commissionSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    commissionSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    commissionTitleRow: { flexDirection: 'row', alignItems: 'center' },
    commissionIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    commissionSectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    commissionCard: { borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
    commissionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    commissionItem: { flex: 1, alignItems: 'center' },
    commissionItemValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: '#065f46', marginTop: spacing.xs },
    commissionItemLabel: { fontSize: 11, color: '#047857', marginTop: 2 },
    commissionDivider: { width: 1, backgroundColor: 'rgba(16,185,129,0.2)', marginHorizontal: spacing.xs },

    breakdownCard: { marginTop: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
    breakdownLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    breakdownValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    breakdownDividerLine: { height: 1, backgroundColor: 'rgba(229,231,235,0.5)' },

    // Pay Commission Button
    payCommissionBtn: {
        marginTop: spacing.md, backgroundColor: '#059669', flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    payCommissionBtnDisabled: { opacity: 0.5 },
    payCommissionText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },

    // Payment Status Card
    paymentStatusCard: {
        marginTop: spacing.md, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fffbeb', padding: spacing.md, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
    },
    paymentStatusTitle: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    paymentStatusDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    paymentStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
    paymentStatusBadgeText: { fontSize: fontSize.xs, fontWeight: '600' },

    section: { padding: spacing.lg, paddingTop: 0 },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    payoutCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    payoutIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    payoutInfo: { flex: 1 },
    payoutAmount: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    payoutMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    // Transactions
    transactionsSection: { flex: 1, paddingHorizontal: spacing.lg },
    transactionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    transactionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    transactionDetails: { flex: 1 },
    transactionTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    transactionDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    transactionAmount: { fontSize: fontSize.base, fontWeight: 'bold', color: '#ef4444' },

    // Status
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start' },
    statusText: { fontSize: 10, fontWeight: 'bold' },

    // Empty State
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
    emptyText: { color: colors.textMuted, marginTop: spacing.md },

    // Modals & Overlays
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '80%', backgroundColor: '#fff', borderRadius: borderRadius.xl, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    previewImage: { flex: 1, width: '100%', height: '100%' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: spacing.md, color: colors.primary, fontWeight: 'bold' },

    // Preview
    previewContainer: {
        backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md,
        borderWidth: 1, borderColor: colors.border, marginTop: spacing.md
    },
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    previewLabel: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    previewImg: { width: '100%', height: 200, borderRadius: borderRadius.md, backgroundColor: '#f3f4f6', marginBottom: spacing.md },
    submitBtn: {
        backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: spacing.md, borderRadius: borderRadius.lg
    },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    disabledBtn: { opacity: 0.7 },
    amountInput: {
        borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
        padding: spacing.md, fontSize: fontSize.base, marginTop: 4, backgroundColor: '#f9fafb'
    },
});
