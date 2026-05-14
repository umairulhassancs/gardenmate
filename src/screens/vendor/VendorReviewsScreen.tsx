import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TextInput, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { auth, db } from '../../services/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';

interface Review {
    id: string;
    userId: string;
    userName: string;
    productId: string;
    productName: string;
    rating: number;
    comment: string;
    reply?: string;
    createdAt: Date;
    repliedAt?: Date;
    source?: 'review' | 'feedback';
    feedbackTypes?: string[];
}

export default function VendorReviewsScreen({ navigation }: any) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [feedbacks, setFeedbacks] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [averageRating, setAverageRating] = useState(0);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [replyText, setReplyText] = useState('');

    const vendorId = auth.currentUser?.uid;

    // Merge reviews + order ratings (feedbacks), sort by createdAt desc
    const merged = React.useMemo(() => {
        const list = [...reviews, ...feedbacks];
        list.sort((a, b) => {
            const ta = (a.createdAt && (a.createdAt as Date).getTime) ? (a.createdAt as Date).getTime() : 0;
            const tb = (b.createdAt && (b.createdAt as Date).getTime) ? (b.createdAt as Date).getTime() : 0;
            return tb - ta;
        });
        return list;
    }, [reviews, feedbacks]);

    // Recompute average from merged
    const displayRating = React.useMemo(() => {
        if (merged.length === 0) return 0;
        return merged.reduce((s, r) => s + (r.rating || 0), 0) / merged.length;
    }, [merged]);

    // 1) reviews (product-level from OrderHistory "Leave Review")
    // 2) feedbacks (order ratings from Order Confirmation "Rate Order")
    useEffect(() => {
        if (!vendorId) {
            setLoading(false);
            return;
        }

        let unsubReviews: (() => void) | undefined;
        let unsubFeedbacks: (() => void) | undefined;

        try {
            setLoading(true);

            unsubReviews = onSnapshot(
                query(
                    collection(db, 'reviews'),
                    where('vendorId', '==', vendorId),
                    orderBy('createdAt', 'desc')
                ),
                (snapshot) => {
                    const arr: Review[] = snapshot.docs.map((d) => {
                        const data = d.data();
                        return {
                            id: d.id,
                            userId: data.userId || '',
                            userName: data.userName || 'Anonymous',
                            productId: data.productId || '',
                            productName: data.productName || 'Product',
                            rating: data.rating || 0,
                            comment: data.comment || '',
                            reply: data.reply,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            repliedAt: data.repliedAt?.toDate ? data.repliedAt.toDate() : undefined,
                            source: 'review'
                        };
                    });
                    setReviews(arr);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error loading reviews:', error);
                    setLoading(false);
                }
            );

            // Order ratings from feedbacks (Order Confirmation "Rate Order")
            unsubFeedbacks = onSnapshot(
                query(collection(db, 'feedbacks'), where('vendorId', '==', vendorId)),
                (snapshot) => {
                    const arr: Review[] = snapshot.docs.map((d) => {
                        const data = d.data() as any;
                        const oid = data.orderId || d.id;
                        const feedbackTypes: string[] =
                            Array.isArray(data.feedbackTypes) && data.feedbackTypes.length > 0
                                ? data.feedbackTypes
                                : data.feedbackType
                                    ? [data.feedbackType]
                                    : [];

                        return {
                            id: d.id,
                            userId: data.userId || '',
                            userName: data.userName || 'Anonymous',
                            productId: oid,
                            productName: `Order #${String(oid).slice(-8).toUpperCase()}`,
                            rating: data.rating || 0,
                            comment: data.comment || (feedbackTypes.length ? feedbackTypes.join(', ') : '—'),
                            reply: data.reply,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                            repliedAt: data.repliedAt?.toDate ? data.repliedAt.toDate() : undefined,
                            source: 'feedback',
                            feedbackTypes,
                        };
                    });
                    setFeedbacks(arr);
                },
                (error) => {
                    console.warn('Error loading feedbacks (order ratings):', error);
                }
            );

            return () => {
                unsubReviews?.();
                unsubFeedbacks?.();
            };
        } catch (error) {
            console.error('Error setting up listeners:', error);
            setLoading(false);
        }
    }, [vendorId]);

    const handleReply = (review: Review) => {
        setSelectedReview(review);
        setReplyText(review.reply || '');
        setShowReplyModal(true);
    };

    const handleSubmitReply = async () => {
        if (!selectedReview || !replyText.trim()) {
            Alert.alert('Error', 'Please write a reply');
            return;
        }

        try {
            const col = selectedReview.source === 'feedback' ? 'feedbacks' : 'reviews';
            const ref = doc(db, col, selectedReview.id);
            await updateDoc(ref, {
                reply: replyText.trim(),
                repliedAt: selectedReview.source === 'feedback' ? serverTimestamp() : new Date()
            });

            Alert.alert('Success', 'Reply posted successfully');
            setShowReplyModal(false);
            setReplyText('');
            setSelectedReview(null);
        } catch (error) {
            console.error('Error posting reply:', error);
            Alert.alert('Error', 'Failed to post reply. Please try again.');
        }
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Reviews</Text>
                    <View style={{ width: 80 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading reviews...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Reviews</Text>
                <View style={styles.ratingBadge}>
                    <Feather name="star" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
                    <Text style={styles.ratingText}>{displayRating.toFixed(1)}</Text>
                </View>
            </View>

            <FlatList
                data={merged}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Feather name="star" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No reviews yet</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{item.userName.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={styles.reviewMeta}>
                                <Text style={styles.customerName}>{item.userName}</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (item.source === 'feedback' && item.productId) {
                                            navigation.navigate('VendorOrders', { orderId: item.productId });
                                        }
                                    }}
                                    disabled={item.source !== 'feedback'}
                                >
                                    <Text style={[styles.productName, item.source === 'feedback' && { color: colors.primary, textDecorationLine: 'underline' }]}>
                                        {item.productName}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                        </View>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <Feather
                                    key={i}
                                    name="star"
                                    size={14}
                                    color={i <= item.rating ? '#f59e0b' : '#d1d5db'}
                                    style={{ marginRight: 2 }}
                                />
                            ))}
                        </View>
                        <Text style={styles.comment}>{item.comment}</Text>

                        {item.source === 'feedback' && item.feedbackTypes && item.feedbackTypes.length > 0 && (
                            <View style={styles.feedbackTypesRow}>
                                <Text style={styles.feedbackTypesLabel}>Feedback on:</Text>
                                <View style={styles.feedbackTypesChips}>
                                    {item.feedbackTypes.map((ft) => (
                                        <View key={ft} style={styles.feedbackTypeChip}>
                                            <Text style={styles.feedbackTypeChipText}>
                                                {ft.charAt(0).toUpperCase() + ft.slice(1)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {item.reply && (
                            <View style={styles.replyContainer}>
                                <View style={styles.replyHeader}>
                                    <Feather name="corner-down-right" size={14} color={colors.primary} />
                                    <Text style={styles.replyLabel}>Your Reply</Text>
                                </View>
                                <Text style={styles.replyText}>{item.reply}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.replyBtn}
                            onPress={() => handleReply(item)}
                        >
                            <Feather name="message-circle" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                            <Text style={styles.replyBtnText}>{item.reply ? 'Edit Reply' : 'Reply'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />

            {/* Reply Modal */}
            <Modal
                visible={showReplyModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowReplyModal(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowReplyModal(false)}>
                            <Feather name="x" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Reply to Review</Text>
                        <TouchableOpacity onPress={handleSubmitReply}>
                            <Text style={styles.submitBtn}>Post</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalContent}>
                        {selectedReview && (
                            <View style={styles.reviewPreview}>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Feather
                                            key={i}
                                            name="star"
                                            size={12}
                                            color={i <= selectedReview.rating ? '#f59e0b' : '#d1d5db'}
                                            style={{ marginRight: 2 }}
                                        />
                                    ))}
                                </View>
                                <Text style={styles.previewComment}>{selectedReview.comment}</Text>
                            </View>
                        )}

                        <Text style={styles.inputLabel}>Your Reply</Text>
                        <TextInput
                            style={styles.replyInput}
                            placeholder="Write your reply..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            value={replyText}
                            onChangeText={setReplyText}
                            autoFocus
                        />
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    ratingText: { color: '#f59e0b', fontWeight: 'bold', fontSize: fontSize.sm },
    list: { padding: spacing.lg },
    reviewCard: { backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    avatarText: { color: '#fff', fontWeight: 'bold' },
    reviewMeta: { flex: 1 },
    customerName: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    productName: { fontSize: fontSize.xs, color: colors.textMuted },
    dateText: { fontSize: fontSize.xs, color: colors.textMuted },
    starsRow: { flexDirection: 'row', marginBottom: spacing.sm },
    comment: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20, marginBottom: spacing.sm },
    feedbackTypesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.sm },
    feedbackTypesLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginRight: spacing.xs },
    feedbackTypesChips: { flexDirection: 'row', flexWrap: 'wrap' },
    feedbackTypeChip: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2, marginRight: spacing.xs, marginTop: 2 },
    feedbackTypeChipText: { fontSize: fontSize.xs, color: colors.text },
    replyContainer: { backgroundColor: 'rgba(16,185,129,0.05)', padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
    replyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
    replyLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary, marginLeft: spacing.xs },
    replyText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
    replyBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
    replyBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '500' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    loadingText: { marginTop: spacing.md, color: colors.textMuted },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl * 2, marginTop: spacing.xl * 2 },
    emptyText: { marginTop: spacing.md, color: colors.textMuted, fontSize: fontSize.base },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    submitBtn: { color: colors.primary, fontSize: fontSize.base, fontWeight: 'bold' },
    modalContent: { flex: 1, padding: spacing.lg },
    reviewPreview: { backgroundColor: 'rgba(243,244,246,0.8)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg },
    previewComment: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing.xs },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    replyInput: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.base, color: colors.text, minHeight: 150, textAlignVertical: 'top' },
});
