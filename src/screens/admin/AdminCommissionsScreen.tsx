import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Image, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { formatPrice } from '../../utils/currency';
import { useCommission, VendorCommissionRecord, PaymentStatus } from '../../contexts/CommissionContext';
import { db } from '../../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { notifyVendor } from '../../services/notifyHelper';

const statusConfig: Record<PaymentStatus, { color: string; bgColor: string; label: string }> = {
    pending: { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: 'Pending' },
    paid: { color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', label: 'Paid' },
    overdue: { color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: 'Overdue' },
};

type FilterType = 'all' | 'unpaid' | 'overdue' | 'blocked' | 'pending_verification';

interface CommissionPaymentRecord {
    id: string;
    vendorId: string;
    amount: number;
    screenshotUrl: string;
    status: 'pending_verification' | 'verified' | 'rejected';
    createdAt: Date;
}

export default function AdminCommissionsScreen({ navigation }: any) {
    const { vendors, markPaymentPaid, blockVendor, unblockVendor, sendReminder } = useCommission();
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [commissionPayments, setCommissionPayments] = useState<CommissionPaymentRecord[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedVendor, setSelectedVendor] = useState<VendorCommissionRecord | null>(null);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    const handleViewStore = (vendor: VendorCommissionRecord) => {
        setSelectedVendor(vendor);
    };

    // Listen for commission payments from vendors
    useEffect(() => {
        const unsubscribe = onSnapshot(
            query(
                collection(db, 'commission_payments')
                // Removed orderBy to avoid index error
            ),
            (snapshot) => {
                const payments: CommissionPaymentRecord[] = [];
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    payments.push({
                        id: docSnap.id,
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
    }, []);

    const getFilteredVendors = (): VendorCommissionRecord[] => {
        let filtered = [...vendors];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(v =>
                v.vendorName.toLowerCase().includes(q) ||
                v.storeName.toLowerCase().includes(q) ||
                v.email.toLowerCase().includes(q)
            );
        }

        switch (filter) {
            case 'unpaid': return filtered.filter(v => v.payments.some(p => p.status !== 'paid'));
            case 'overdue': return filtered.filter(v => v.payments.some(p => p.status === 'overdue'));
            case 'blocked': return filtered.filter(v => v.status === 'blocked');
            case 'pending_verification': return filtered; // handled separately
            default: return filtered;
        }
    };

    const handleBlockVendor = (vendor: VendorCommissionRecord) => {
        Alert.alert(
            'Block Vendor',
            `Block ${vendor.storeName} for unpaid commission?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await blockVendor(vendor.vendorId);
                            Alert.alert('Vendor Blocked', `${vendor.storeName} has been blocked.`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to block vendor.');
                        }
                    }
                }
            ]
        );
    };

    const handleUnblockVendor = (vendor: VendorCommissionRecord) => {
        Alert.alert(
            'Unblock Vendor',
            `Unblock ${vendor.storeName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    onPress: async () => {
                        try {
                            await unblockVendor(vendor.vendorId);
                            Alert.alert('Vendor Unblocked', `${vendor.storeName} has been unblocked.`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to unblock vendor.');
                        }
                    }
                }
            ]
        );
    };

    const handleSendReminder = (vendor: VendorCommissionRecord) => {
        Alert.alert(
            'Send Reminder',
            `Send commission payment reminder to ${vendor.storeName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        try {
                            await sendReminder(vendor.vendorId);
                            Alert.alert('Reminder Sent', `Reminder sent to ${vendor.storeName}.`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to send reminder.');
                        }
                    }
                }
            ]
        );
    };

    const handleVerifyPayment = (vendor: VendorCommissionRecord, paymentId: string) => {
        Alert.alert(
            'Verify Payment',
            'Confirm this payment has been received?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Verify',
                    onPress: async () => {
                        try {
                            await markPaymentPaid(vendor.vendorId, paymentId, 'ADMIN-VERIFIED');
                            Alert.alert(
                                'Payment Verified',
                                'Payment has been verified and marked as paid successfully.',
                                [{ text: 'OK' }]
                            );
                        } catch (error) {
                            Alert.alert(
                                'Error',
                                'Failed to verify payment. Please try again.',
                                [{ text: 'OK' }]
                            );
                        }
                    }
                }
            ]
        );
    };

    // Confirm or reject a commission payment with screenshot
    const handleConfirmCommissionPayment = async (payment: CommissionPaymentRecord) => {
        setVerifyingId(payment.id);
        try {
            // Update status to verified
            await updateDoc(doc(db, 'commission_payments', payment.id), {
                status: 'verified',
                verifiedAt: serverTimestamp(),
            });

            // Notify vendor
            await notifyVendor(
                payment.vendorId,
                'Payment Verified ✅',
                `Your commission payment of ${formatPrice(payment.amount)} has been verified and confirmed by admin.`,
                'commission',
                payment.id
            );

            Alert.alert('Payment Confirmed', 'Commission payment has been verified.');
        } catch (error) {
            console.error('Error confirming payment:', error);
            Alert.alert('Error', 'Failed to confirm payment.');
        }
        setVerifyingId(null);
    };

    const handleRejectCommissionPayment = async (payment: CommissionPaymentRecord, reason?: string) => {
        Alert.alert(
            'Reject Payment',
            `Are you sure you want to reject this payment?${reason ? ` Reason: ${reason}` : ''}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        setVerifyingId(payment.id);
                        try {
                            await updateDoc(doc(db, 'commission_payments', payment.id), {
                                status: 'rejected',
                                rejectionReason: reason || 'General Rejection',
                                rejectedAt: serverTimestamp(),
                            });

                            // Notify vendor
                            await notifyVendor(
                                payment.vendorId,
                                'Payment Rejected ❌',
                                `Your commission payment of ${formatPrice(payment.amount)} was rejected.${reason ? ` Reason: ${reason}` : ''} Please submit a valid payment screenshot.`,
                                'commission',
                                payment.id
                            );

                            Alert.alert('Payment Rejected', 'The vendor has been notified.');
                        } catch (error) {
                            console.error('Error rejecting payment:', error);
                            Alert.alert('Error', 'Failed to reject payment.');
                        }
                        setVerifyingId(null);
                    }
                }
            ]
        );
    };

    const getVendorUnpaidAmount = (vendor: VendorCommissionRecord) => {
        // Unpaid = CommissionDue (from vendor doc) - CommissionPaid (calculated from payments)
        // Ensure we don't show negative
        return Math.max(0, vendor.totalCommissionDue - vendor.totalCommissionPaid);
    };

    const getVendorNameById = (vendorId: string) => {
        const vendor = vendors.find(v => v.vendorId === vendorId);
        return vendor?.storeName || vendorId.slice(-6);
    };

    const filteredVendors = getFilteredVendors();
    const totalUnpaid = vendors.reduce((sum, v) => sum + getVendorUnpaidAmount(v), 0);
    const overdueCount = vendors.filter(v => v.payments.some(p => p.status === 'overdue')).length;
    const pendingVerificationCount = commissionPayments.filter(p => p.status === 'pending_verification').length;

    const filterOptions: { key: FilterType; label: string; count?: number }[] = [
        { key: 'all', label: 'All' },
        { key: 'pending_verification', label: 'Pending', count: pendingVerificationCount },
        { key: 'unpaid', label: 'Unpaid' },
        { key: 'overdue', label: 'Overdue', count: overdueCount },
        { key: 'blocked', label: 'Blocked' },
    ];

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Vendor Commissions</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Summary Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{vendors.length}</Text>
                    <Text style={styles.statLabel}>Total Vendors</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{formatPrice(totalUnpaid)}</Text>
                    <Text style={styles.statLabel}>Unpaid</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Text style={[styles.statValue, { color: '#ef4444' }]}>{pendingVerificationCount}</Text>
                    <Text style={styles.statLabel}>To Verify</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Feather name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search vendors..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
                {filterOptions.map(opt => (
                    <TouchableOpacity
                        key={opt.key}
                        style={[styles.filterChip, filter === opt.key && styles.filterChipActive]}
                        onPress={() => setFilter(opt.key)}
                    >
                        <Text style={[styles.filterText, filter === opt.key && styles.filterTextActive]}>
                            {opt.label}
                        </Text>
                        {opt.count !== undefined && opt.count > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{opt.count}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>

                {/* Pending Verification Section */}
                {filter === 'pending_verification' && (
                    <>
                        {commissionPayments.filter(p => p.status === 'pending_verification').length > 0 ? (
                            commissionPayments.filter(p => p.status === 'pending_verification').map(payment => (
                                <View key={payment.id} style={styles.verificationCard}>
                                    <View style={styles.verificationHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.verificationVendor}>
                                                {getVendorNameById(payment.vendorId)}
                                            </Text>
                                            <Text style={styles.verificationDate}>
                                                {payment.createdAt.toLocaleDateString()} • {payment.createdAt.toLocaleTimeString()}
                                            </Text>
                                        </View>
                                        <Text style={styles.verificationAmount}>{formatPrice(payment.amount)}</Text>
                                    </View>

                                    {/* Screenshot Preview */}
                                    <TouchableOpacity
                                        onPress={() => setPreviewImage(payment.screenshotUrl)}
                                        style={styles.screenshotContainer}
                                    >
                                        <Image
                                            source={{ uri: payment.screenshotUrl }}
                                            style={styles.screenshotThumb}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.screenshotOverlay}>
                                            <Feather name="maximize-2" size={20} color="#fff" />
                                            <Text style={styles.screenshotText}>Tap to view full screenshot</Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Verify / Reject Buttons */}
                                    <View style={styles.verificationActions}>
                                        <TouchableOpacity
                                            style={[styles.verifyBtn, styles.rejectBtn]}
                                            onPress={() => {
                                                Alert.alert(
                                                    'Reject Payment',
                                                    'Select rejection reason:',
                                                    [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        {
                                                            text: 'Wrong Screenshot',
                                                            onPress: () => handleRejectCommissionPayment(payment, 'Invalid/Wrong Screenshot')
                                                        },
                                                        {
                                                            text: 'Other',
                                                            onPress: () => {
                                                                Alert.prompt(
                                                                    'Reject Reason',
                                                                    'Enter reason for rejection:',
                                                                    [
                                                                        { text: 'Cancel', style: 'cancel' },
                                                                        { text: 'Reject', onPress: (text: string) => handleRejectCommissionPayment(payment, text || 'Unspecified') }
                                                                    ],
                                                                    'plain-text'
                                                                );
                                                            }
                                                        },
                                                    ]
                                                );
                                            }}
                                            disabled={verifyingId === payment.id}
                                        >
                                            <Feather name="x-circle" size={16} color="#ef4444" />
                                            <Text style={[styles.verifyBtnText, { color: '#ef4444' }]}>Reject</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.verifyBtn, styles.confirmBtn]}
                                            onPress={() => handleConfirmCommissionPayment(payment)}
                                            disabled={verifyingId === payment.id}
                                        >
                                            {verifyingId === payment.id ? (
                                                <ActivityIndicator size="small" color="#10b981" />
                                            ) : (
                                                <>
                                                    <Feather name="check-circle" size={16} color="#10b981" />
                                                    <Text style={[styles.verifyBtnText, { color: '#10b981' }]}>Confirm Paid</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Feather name="check-circle" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No payments pending verification</Text>
                            </View>
                        )}

                        {/* Recently Verified/Rejected */}
                        {commissionPayments.filter(p => p.status !== 'pending_verification').length > 0 && (
                            <>
                                <Text style={[styles.sectionSubTitle, { marginTop: spacing.md }]}>Recent History</Text>
                                {commissionPayments.filter(p => p.status !== 'pending_verification').slice(0, 5).map(payment => {
                                    const isVerified = payment.status === 'verified';
                                    return (
                                        <TouchableOpacity
                                            key={payment.id}
                                            style={styles.historyCard}
                                            onPress={() => payment.screenshotUrl && setPreviewImage(payment.screenshotUrl)}
                                        >
                                            <View style={[styles.historyIcon, { backgroundColor: isVerified ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                                                <Feather
                                                    name={isVerified ? 'check-circle' : 'x-circle'}
                                                    size={18}
                                                    color={isVerified ? '#10b981' : '#ef4444'}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.historyVendor}>{getVendorNameById(payment.vendorId)}</Text>
                                                <Text style={styles.historyDate}>{payment.createdAt.toLocaleDateString()}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.historyAmount}>{formatPrice(payment.amount)}</Text>
                                                <Text style={[styles.historyStatus, { color: isVerified ? '#10b981' : '#ef4444' }]}>
                                                    {isVerified ? 'Verified' : 'Rejected'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </>
                        )}
                    </>
                )}

                {/* Vendor List (non-pending_verification filters) */}
                {filter !== 'pending_verification' && (
                    <>
                        {filteredVendors.map(vendor => {
                            const unpaidAmount = getVendorUnpaidAmount(vendor);
                            const hasOverdue = vendor.payments.some(p => p.status === 'overdue');
                            const pendingPayments = vendor.payments.filter(p => p.status !== 'paid');

                            return (
                                <View key={vendor.vendorId} style={styles.vendorCard}>
                                    <TouchableOpacity
                                        style={styles.vendorHeader}
                                        onPress={() => handleViewStore(vendor)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.vendorInfo}>
                                            <View style={styles.vendorAvatar}>
                                                <Text style={styles.avatarText}>{vendor.vendorName ? vendor.vendorName[0] : 'V'}</Text>
                                            </View>
                                            <View>
                                                <Text style={styles.vendorName}>{vendor.storeName}</Text>
                                                <Text style={styles.vendorEmail}>{vendor.vendorName} • {vendor.vendorId.slice(-4)}</Text>
                                            </View>
                                        </View>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: vendor.status === 'blocked' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }
                                        ]}>
                                            <Text style={[
                                                styles.statusText,
                                                { color: vendor.status === 'blocked' ? '#ef4444' : '#10b981' }
                                            ]}>
                                                {vendor.status === 'blocked' ? 'Blocked' : 'Active'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.vendorStats}>
                                        <View style={styles.vendorStat}>
                                            <Text style={styles.vendorStatLabel}>Total Sales</Text>
                                            <Text style={styles.vendorStatValue}>{formatPrice(vendor.totalSales)}</Text>
                                        </View>
                                        <View style={styles.vendorStat}>
                                            <Text style={styles.vendorStatLabel}>Commission Paid</Text>
                                            <Text style={[styles.vendorStatValue, { color: '#10b981' }]}>{formatPrice(vendor.totalCommissionPaid)}</Text>
                                        </View>
                                        <View style={styles.vendorStat}>
                                            <Text style={styles.vendorStatLabel}>Unpaid</Text>
                                            <Text style={[styles.vendorStatValue, { color: hasOverdue ? '#ef4444' : '#f59e0b' }]}>
                                                {formatPrice(unpaidAmount)}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Pending Payments */}
                                    {pendingPayments.length > 0 && (
                                        <View style={styles.pendingSection}>
                                            <Text style={styles.pendingTitle}>Pending Payments</Text>
                                            {pendingPayments.map(payment => {
                                                const status = statusConfig[payment.status];
                                                return (
                                                    <View key={payment.id} style={styles.pendingItem}>
                                                        <View>
                                                            <Text style={styles.pendingMonth}>{payment.month} {payment.year}</Text>
                                                            <Text style={styles.pendingDue}>Due: {payment.dueDate}</Text>
                                                        </View>
                                                        <View style={styles.pendingRight}>
                                                            <View style={[styles.miniStatusBadge, { backgroundColor: status.bgColor }]}>
                                                                <Text style={[styles.miniStatusText, { color: status.color }]}>{status.label}</Text>
                                                            </View>
                                                            <Text style={styles.pendingAmount}>{formatPrice(payment.commissionAmount)}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {/* Actions */}
                                    <View style={styles.vendorActions}>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleViewStore(vendor)}>
                                            <Feather name="eye" size={16} color={colors.primary} />
                                            <Text style={[styles.actionText, { color: colors.primary }]}>View Store</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleSendReminder(vendor)}>
                                            <Feather name="bell" size={16} color="#3b82f6" />
                                            <Text style={[styles.actionText, { color: '#3b82f6' }]}>Remind</Text>
                                        </TouchableOpacity>
                                        {vendor.status === 'blocked' ? (
                                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleUnblockVendor(vendor)}>
                                                <Feather name="unlock" size={16} color="#10b981" />
                                                <Text style={[styles.actionText, { color: '#10b981' }]}>Unblock</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleBlockVendor(vendor)}>
                                                <Feather name="slash" size={16} color="#ef4444" />
                                                <Text style={[styles.actionText, { color: '#ef4444' }]}>Block</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}

                        {filteredVendors.length === 0 && (
                            <View style={styles.emptyState}>
                                <Feather name="users" size={48} color={colors.textMuted} />
                                <Text style={styles.emptyText}>No vendors found</Text>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Store Details Modal */}
            <Modal visible={!!selectedVendor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedVendor(null)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Store Details</Text>
                        <TouchableOpacity onPress={() => setSelectedVendor(null)}>
                            <Feather name="x" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    {selectedVendor && (
                        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Store Name</Text>
                                <Text style={styles.detailValue}>{selectedVendor.storeName}</Text>
                            </View>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Vendor Name</Text>
                                <Text style={styles.detailValue}>{selectedVendor.vendorName}</Text>
                            </View>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Email</Text>
                                <Text style={styles.detailValue}>{selectedVendor.email}</Text>
                            </View>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Phone</Text>
                                <Text style={styles.detailValue}>{selectedVendor.phone}</Text>
                            </View>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Address</Text>
                                <Text style={styles.detailValue}>{selectedVendor.nurseryAddress}</Text>
                            </View>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>CNIC</Text>
                                <Text style={styles.detailValue}>{selectedVendor.cnic}</Text>
                            </View>

                            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Registration Documents</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
                                {selectedVendor.registrationDocs && selectedVendor.registrationDocs.map((doc, index) => (
                                    <Image key={index} source={{ uri: doc }} style={styles.docImage} />
                                ))}
                            </ScrollView>

                            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Nursery Photos</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
                                {selectedVendor.nurseryPhotos && selectedVendor.nurseryPhotos.map((photo, index) => (
                                    <Image key={index} source={{ uri: photo }} style={styles.docImage} />
                                ))}
                            </ScrollView>
                        </ScrollView>
                    )}
                </View>
            </Modal>

            {/* Screenshot Preview Modal (existing) */}
            <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Payment Screenshot</Text>
                            <TouchableOpacity onPress={() => setPreviewImage(null)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {previewImage && (
                            <Image
                                source={{ uri: previewImage }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    statValue: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: spacing.lg, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    searchInput: { flex: 1, padding: spacing.md, fontSize: fontSize.base, color: colors.text },
    filtersContainer: { paddingHorizontal: spacing.lg, height: 56, paddingTop: spacing.sm },
    filterChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, height: 36, borderRadius: borderRadius.md, backgroundColor: '#fff', marginRight: spacing.sm, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: fontSize.sm, color: colors.textMuted },
    filterTextActive: { color: '#fff', fontWeight: '500' },
    filterBadge: { marginLeft: 4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    listContent: { padding: spacing.lg },

    // Verification Card
    verificationCard: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
    verificationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    verificationVendor: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    verificationDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    verificationAmount: { fontSize: fontSize.lg, fontWeight: 'bold', color: '#059669' },
    screenshotContainer: { borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md, position: 'relative' },
    screenshotThumb: { width: '100%', height: 200, borderRadius: borderRadius.lg },
    screenshotOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    screenshotText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '500' },
    verificationActions: { flexDirection: 'row', gap: spacing.sm },
    verifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: borderRadius.md, gap: 6 },
    verifyBtnText: { fontSize: fontSize.sm, fontWeight: '600' },
    confirmBtn: { backgroundColor: 'rgba(16,185,129,0.1)' },
    rejectBtn: { backgroundColor: 'rgba(239,68,68,0.1)' },

    // History cards
    sectionSubTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
    historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    historyIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    historyVendor: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    historyDate: { fontSize: 10, color: colors.textMuted },
    historyAmount: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    historyStatus: { fontSize: 10, fontWeight: '600' },

    // Vendor Card
    vendorCard: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    vendorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    vendorInfo: { flexDirection: 'row', alignItems: 'center' },
    vendorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    avatarText: { color: '#fff', fontSize: fontSize.lg, fontWeight: 'bold' },
    vendorName: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    vendorEmail: { fontSize: fontSize.xs, color: colors.textMuted },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
    statusText: { fontSize: fontSize.xs, fontWeight: '600' },
    vendorStats: { flexDirection: 'row', backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
    vendorStat: { flex: 1, alignItems: 'center' },
    vendorStatLabel: { fontSize: 10, color: colors.textMuted },
    vendorStatValue: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    pendingSection: { marginBottom: spacing.md },
    pendingTitle: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
    pendingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    pendingMonth: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    pendingDue: { fontSize: 10, color: colors.textMuted },
    pendingRight: { alignItems: 'flex-end' },
    miniStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 2 },
    miniStatusText: { fontSize: 9, fontWeight: '600' },
    pendingAmount: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    vendorActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(229,231,235,0.5)', paddingTop: spacing.md, gap: spacing.md },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.5)', gap: 4 },
    actionText: { fontSize: fontSize.sm, fontWeight: '500' },
    emptyState: { alignItems: 'center', padding: spacing.xl },
    emptyText: { marginTop: spacing.md, color: colors.textMuted },

    // Screenshot Preview Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', borderRadius: borderRadius.xl, width: '90%', maxHeight: '80%', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.5)' },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    previewImage: { width: '100%', height: '100%' },

    // Store Modal
    modalContainer: { flex: 1, backgroundColor: '#fff' },
    detailSection: { marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
    detailLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
    detailValue: { fontSize: fontSize.base, color: colors.text, fontWeight: '500' },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    docImage: { width: 120, height: 120, borderRadius: borderRadius.md, marginRight: spacing.md, backgroundColor: '#f3f4f6' },
});
