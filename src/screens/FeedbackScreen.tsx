import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { feedbackApi } from '../api/feedbackApi';
import { ticketApi } from '../api/ticketApi';
import { auth, db } from '../services/firebaseConfig';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { notifyAdmins, notifyVendor } from '../services/notifyHelper';
import { TicketCategory } from '../types/ticket';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';


export default function FeedbackScreen({ navigation, route }: any) {
    const { orderId, vendorId, vendorName, initialMode } = route.params || {};

    const [rating, setRating] = useState(0);
    const [selectedFeedbackTypes, setSelectedFeedbackTypes] = useState<Array<'delivery' | 'quality' | 'service' | 'packaging'>>([]);
    const [comment, setComment] = useState('');
    const [isComplaint, setIsComplaint] = useState(initialMode === 'complaint');
    const [complaintIssue, setComplaintIssue] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const feedbackOptions = [
        { type: 'delivery', label: 'Delivery', icon: 'truck' },
        { type: 'quality', label: 'Product Quality', icon: 'star' },
        { type: 'service', label: 'Customer Service', icon: 'users' },
        { type: 'packaging', label: 'Packaging', icon: 'package' },
    ];

    // Enhanced complaint categories (10 options)
    const complaintCategories = [
        { id: 'damaged_product', label: 'Damaged Product', icon: 'alert-octagon', color: '#ef4444' },
        { id: 'wrong_item', label: 'Wrong Item', icon: 'x-circle', color: '#f59e0b' },
        { id: 'missing_parts', label: 'Missing Parts', icon: 'box', color: '#f59e0b' },
        { id: 'delivery_issue', label: 'Delivery Issue', icon: 'truck', color: '#f59e0b' },
        { id: 'product_issue', label: 'Product Quality', icon: 'package', color: '#f59e0b' },
        { id: 'general', label: 'Other', icon: 'message-circle', color: '#10b981' },
    ];

    const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);

    const handleSubmitFeedback = async () => {
        if (!orderId) {
            Alert.alert('Error', 'Order ID is missing');
            return;
        }
        if (rating === 0) {
            Alert.alert('Required', 'Please select a rating');
            return;
        }
        if (!selectedFeedbackTypes || selectedFeedbackTypes.length === 0) {
            Alert.alert('Required', 'Please select at least one feedback type');
            return;
        }
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'You must be logged in to submit feedback');
            return;
        }

        setSubmitting(true);

        // Resolve vendorId and check if already rated (one rate per order)
        let vendorIdToUse = vendorId || '';
        if (orderId) {
            try {
                const orderSnap = await getDoc(doc(db, 'orders', orderId));
                const od = orderSnap.exists() ? orderSnap.data() : null;
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/ee9aaf58-c8b1-4cac-81b0-e2a279757819', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        location: 'src/screens/FeedbackScreen.tsx:handleSubmitFeedback',
                        message: 'Submitting feedback for order',
                        data: {
                            orderId,
                            status: od?.status || 'unknown',
                            initialMode,
                            isComplaint,
                        },
                        runId: 'pre-fix',
                        hypothesisId: 'H2',
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion agent log
                // Prevent feedback submission if order is not delivered
                if (od?.status && od.status !== 'delivered') {
                    setSubmitting(false);
                    Alert.alert(
                        'Feedback not allowed yet',
                        'You can only submit feedback after your order has been delivered.'
                    );
                    return;
                }
                if (od?.orderFeedback === true) {
                    setSubmitting(false);
                    Alert.alert('Already Rated', 'You have already rated this order. Only one rating per order is allowed.');
                    return;
                }
                if (od?.vendorId) vendorIdToUse = od.vendorId;
            } catch (_) { /* keep from params */ }
        }
        if (!vendorIdToUse) {
            setSubmitting(false);
            Alert.alert('Error', 'Order or vendor information is missing. Please submit from your order history.');
            return;
        }


        try {
            // Get order data to extract products
            let orderItems: any[] = [];
            try {
                const orderSnap = await getDoc(doc(db, 'orders', orderId));
                if (orderSnap.exists()) {
                    const orderData = orderSnap.data();
                    orderItems = orderData.items || [];
                }
            } catch (error) {
                console.error('Error fetching order:', error);
            }

            // Submit vendor feedback
            await feedbackApi.submitFeedback({
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                orderId,
                vendorId: vendorIdToUse,
                vendorName: vendorName || 'Vendor',
                rating,
                category: 'Other',
                targetType: 'vendor',
                feedbackTypes: selectedFeedbackTypes,
                comment: comment.trim() || '',
            } as any);

            // Create product reviews for each item in the order
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const customerName = user.displayName || userData.name || 'Anonymous';
            const customerAvatar = user.photoURL || userData.avatar || userData.profilePicture || '';


            let reviewsCreated = 0;
            let reviewsFailed = 0;
            for (const item of orderItems) {
                const productId = item.id || item.productId;
                if (!productId) {
                    continue;
                }

                try {
                    await addDoc(collection(db, 'reviews'), {
                        productId: productId,
                        orderId: orderId,
                        userId: user.uid,
                        rating: rating,
                        title: comment.trim() || `${customerName}'s Review`,
                        text: comment.trim() || `Rated ${rating} stars`,
                        customerName: customerName,
                        customerAvatar: customerAvatar,
                        date: new Date().toISOString().split('T')[0],
                        verified: true,
                        helpful: 0,
                        createdAt: serverTimestamp(),
                        feedbackTypes: selectedFeedbackTypes,
                    });
                    reviewsCreated++;
                } catch (reviewError) {
                    reviewsFailed++;
                    console.error('Error creating review for product:', productId, reviewError);
                }
            }

            await updateDoc(doc(db, 'orders', orderId), { orderFeedback: true });

            // ✅ Notify Vendor about Feedback
            try {
                const stars = '⭐'.repeat(rating);
                const categoryLabel =
                    selectedFeedbackTypes && selectedFeedbackTypes.length > 0
                        ? selectedFeedbackTypes
                            .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
                            .join(', ')
                        : 'General';

                await notifyVendor(
                    vendorIdToUse,
                    `New Feedback ${stars}`,
                    `${customerName} rated your order: ${categoryLabel}${comment.trim() ? ' — "' + comment.trim().slice(0, 80) + '"' : ''}`,
                    'review',
                    orderId
                );
            } catch (notifyError) {
                console.error('Failed to notify vendor about feedback:', notifyError);
            }

            // ✅ Notify Admins
            try {
                await notifyAdmins(
                    'New Feedback Received ⭐',
                    `${customerName} rated order #${orderId}: ${'⭐'.repeat(rating)} (${rating}/5)`,
                    orderId,
                    'review'
                );
            } catch (adminErr) {
                console.error('Failed to notify admins:', adminErr);
            }


            Alert.alert(
                'Success',
                'Thank you for your feedback!',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitComplaint = async () => {
        if (!orderId) {
            Alert.alert('Error', 'Order ID is required to submit a complaint');
            return;
        }
        if (!selectedCategory) {
            Alert.alert('Required', 'Please select a category');
            return;
        }
        if (!complaintIssue.trim()) {
            Alert.alert('Required', 'Please describe your issue');
            return;
        }
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'You must be logged in to submit a complaint');
            return;
        }

        setSubmitting(true);

        // Resolve vendorId and vendor store name from order
        let vendorIdToUse = vendorId || '';
        let vendorStoreName = vendorName || 'Vendor Store';
        let orderSnapshot: any = null;

        if (orderId) {
            try {
                const orderSnap = await getDoc(doc(db, 'orders', orderId));
                if (orderSnap.exists()) {
                    const orderData = orderSnap.data();
                    if (orderData?.vendorId) vendorIdToUse = orderData.vendorId;
                    orderSnapshot = {
                        orderNumber: orderData.orderNumber || orderId,
                        total: orderData.total || 0,
                        status: orderData.status || 'unknown',
                        items: orderData.items || [],
                    };

                    // Get vendor store name
                    if (orderData.vendorId) {
                        try {
                            const vendorDoc = await getDoc(doc(db, 'users', orderData.vendorId));
                            if (vendorDoc.exists()) {
                                const vendorData = vendorDoc.data();
                                vendorStoreName = vendorData.storeName || vendorData.businessName || vendorData.name || 'Vendor Store';
                            }
                        } catch (err) {
                            console.warn('Could not fetch vendor store name:', err);
                        }
                    }
                }
            } catch (_) { /* keep defaults */ }
        }

        if (!vendorIdToUse) {
            setSubmitting(false);
            Alert.alert('Error', 'Order or vendor information is missing. Please submit from your order history.');
            return;
        }


        try {
            // Get user data
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};

            // Get device info
            const deviceOS = Platform.OS === 'ios' ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`;

            // Create ticket using new API
            const result = await ticketApi.createTicket({
                customerId: user.uid,
                customerName: user.displayName || userData.name || 'Customer',
                customerEmail: user.email || userData.email || '',
                customerPhone: userData.phone || userData.phoneNumber,
                vendorId: vendorIdToUse,
                vendorName: vendorName || 'Vendor',
                vendorStoreName: vendorStoreName, // ← Store name for display
                orderId,
                category: selectedCategory,
                subject: TICKET_CATEGORIES[selectedCategory]?.label || 'Complaint',
                description: complaintIssue.trim(),
                tags: [],
                metadata: {
                    appVersion: '2.1.0', // You can get this from app.json
                    deviceOS,
                    deviceModel: 'Mobile',
                    orderSnapshot,
                    source: 'in-app',
                },
            });

            // ✅ Notify Vendor about new ticket
            try {
                const ticketNumber = result.ticketId.split('-').pop();
                await notifyVendor(
                    vendorIdToUse,
                    'New Support Ticket ⚠️',
                    `Ticket #${ticketNumber} from ${user.displayName || 'Customer'}: ${TICKET_CATEGORIES[selectedCategory]?.label}`,
                    'complaint',
                    result.ticketId
                );
            } catch (notifyError) {
                console.error('Failed to notify vendor:', notifyError);
            }

            // ✅ Notify Admins
            try {
                await notifyAdmins(
                    'New Support Ticket ⚠️',
                    `Ticket #${result.ticketId} filed by ${user.displayName} — ${TICKET_CATEGORIES[selectedCategory]?.label}`,
                    result.ticketId,
                    'complaint'
                );
            } catch (adminErr) {
                console.error('Failed to notify admins:', adminErr);
            }

            const slaHours = TICKET_CATEGORIES[selectedCategory]?.suggestedPriority === 'critical' ? '1 hour' : '4 hours';
            Alert.alert(
                'Ticket Submitted!',
                `Your ticket #${result.ticketId.split('-').pop()} has been created. We'll respond within ${slaHours}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to submit complaint. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>{isComplaint ? 'File a Complaint' : 'Rate Your Order'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Toggle between Feedback and Complaint */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, !isComplaint && styles.toggleBtnActive]}
                        onPress={() => setIsComplaint(false)}
                    >
                        <Feather name="star" size={18} color={!isComplaint ? '#fff' : colors.primary} />
                        <Text style={[styles.toggleText, !isComplaint && styles.toggleTextActive]}>Feedback</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, isComplaint && styles.toggleBtnActive]}
                        onPress={() => setIsComplaint(true)}
                    >
                        <Feather name="alert-circle" size={18} color={isComplaint ? '#fff' : colors.primary} />
                        <Text style={[styles.toggleText, isComplaint && styles.toggleTextActive]}>Complaint</Text>
                    </TouchableOpacity>
                </View>

                {!isComplaint ? (
                    <>
                        {/* Rating Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>How would you rate your order?</Text>
                            <View style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => setRating(star)}
                                        style={styles.starBtn}
                                    >
                                        <Feather
                                            name={star <= rating ? 'star' : 'star'}
                                            size={36}
                                            color={star <= rating ? '#fbbf24' : '#e5e7eb'}
                                            style={{
                                                ...(star <= rating && { fill: '#fbbf24' })
                                            }}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {rating > 0 && (
                                <Text style={styles.ratingText}>
                                    {rating === 1 && 'Poor'}
                                    {rating === 2 && 'Fair'}
                                    {rating === 3 && 'Good'}
                                    {rating === 4 && 'Very Good'}
                                    {rating === 5 && 'Excellent'}
                                </Text>
                            )}
                        </View>

                        {/* Feedback Type Selection */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>What would you like to rate?</Text>
                            <View style={styles.optionsGrid}>
                                {feedbackOptions.map((option) => {
                                    const isSelected = selectedFeedbackTypes.includes(option.type as any);
                                    return (
                                        <TouchableOpacity
                                            key={option.type}
                                            style={[
                                                styles.option,
                                                isSelected && styles.optionActive,
                                            ]}
                                            onPress={() => {
                                                setSelectedFeedbackTypes((prev) =>
                                                    prev.includes(option.type as any)
                                                        ? prev.filter((t) => t !== (option.type as any))
                                                        : [...prev, option.type as any]
                                                );
                                            }}
                                        >
                                            <Feather
                                                name={option.icon as any}
                                                size={24}
                                                color={isSelected ? colors.primary : colors.textMuted}
                                            />
                                            <Text
                                                style={[
                                                    styles.optionText,
                                                    isSelected && styles.optionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Comment Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Additional Comments (Optional)</Text>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Share more details about your experience..."
                                placeholderTextColor={colors.textMuted}
                                value={comment}
                                onChangeText={setComment}
                                multiline
                                numberOfLines={4}
                                maxLength={500}
                            />
                            <Text style={styles.charCount}>{comment.length}/500</Text>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleSubmitFeedback}
                            disabled={submitting}
                        >
                            <Feather name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.submitBtnText}>
                                {submitting ? 'Submitting...' : 'Submit Feedback'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        {/* Complaint Section - Enhanced 10 Categories */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Select Issue Category</Text>
                            <View style={styles.optionsGrid}>
                                {complaintCategories.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.option,
                                            selectedCategory === cat.id && styles.optionActive,
                                        ]}
                                        onPress={() => setSelectedCategory(cat.id as TicketCategory)}
                                        activeOpacity={0.7}
                                    >
                                        <Feather
                                            name={cat.icon as any}
                                            size={20}
                                            color={selectedCategory === cat.id ? cat.color : colors.textMuted}
                                        />
                                        <Text
                                            style={[
                                                styles.optionText,
                                                selectedCategory === cat.id && styles.optionTextActive,
                                            ]}
                                        >
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Complaint Description */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Describe Your Issue</Text>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Please provide details about your complaint..."
                                placeholderTextColor={colors.textMuted}
                                value={complaintIssue}
                                onChangeText={setComplaintIssue}
                                multiline
                                numberOfLines={6}
                                maxLength={1000}
                            />
                            <Text style={styles.charCount}>{complaintIssue.length}/1000</Text>
                        </View>

                        {/* Submit Complaint Button */}
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleSubmitComplaint}
                            disabled={submitting}
                        >
                            <Feather name="alert-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.submitBtnText}>
                                {submitting ? 'Submitting...' : 'Submit Complaint'}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.5)' },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    toggleContainer: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: borderRadius.lg, padding: 4, marginBottom: spacing.xl },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.xs },
    toggleBtnActive: { backgroundColor: colors.primary },
    toggleText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
    toggleTextActive: { color: '#fff' },
    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    starsContainer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    starBtn: { padding: spacing.xs },
    ratingText: { fontSize: fontSize.base, fontWeight: '600', color: colors.primary, textAlign: 'center', marginTop: spacing.sm },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    option: { width: '30%', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(229,231,235,0.5)' },
    optionActive: { borderColor: colors.primary, backgroundColor: 'rgba(16,185,129,0.06)' },
    optionText: { fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 14 },
    optionTextActive: { color: colors.text, fontWeight: '600' },
    textArea: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, fontSize: fontSize.base, color: colors.text, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', textAlignVertical: 'top', minHeight: 120 },
    charCount: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, marginTop: spacing.lg },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },
});
