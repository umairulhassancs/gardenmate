import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    TextInput, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { logCSATSubmission } from '../services/auditService';

interface Props {
    visible: boolean;
    onClose: () => void;
    ticketId: string;
    collectionName: 'complaints' | 'tickets';
    vendorId: string;
}

const STAR_LABELS = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];

export default function CSATSurveyModal({ visible, onClose, ticketId, collectionName, vendorId }: Props) {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Animated scale for each star
    const starAnims = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

    const animateStar = (index: number) => {
        Animated.sequence([
            Animated.timing(starAnims[index], { toValue: 1.4, duration: 120, useNativeDriver: true }),
            Animated.timing(starAnims[index], { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
    };

    const handleStarPress = (star: number) => {
        setRating(star);
        animateStar(star - 1);
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Please Rate', 'Tap a star to rate your experience.');
            return;
        }

        setSubmitting(true);
        try {
            const userId = auth.currentUser?.uid || '';
            const userName = auth.currentUser?.displayName || 'Customer';

            // Save to ticketRatings collection
            await addDoc(collection(db, 'ticketRatings'), {
                ticketId,
                collectionName,
                userId,
                vendorId,
                rating,
                feedback: feedback.trim(),
                createdAt: serverTimestamp(),
            });

            // Update ticket with rating
            await updateDoc(doc(db, collectionName, ticketId), {
                csatRating: rating,
                csatFeedback: feedback.trim(),
                csatSubmittedAt: serverTimestamp(),
            });

            // Log audit event
            logCSATSubmission(ticketId, collectionName, rating, userName);

            setSubmitted(true);
        } catch (error) {
            console.error('CSAT submit error:', error);
            Alert.alert('Error', 'Failed to submit rating. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setRating(0);
        setFeedback('');
        setSubmitted(false);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {submitted ? (
                        /* Thank You View */
                        <View style={styles.thankYouContainer}>
                            <View style={styles.thankYouIcon}>
                                <Feather name="heart" size={32} color="#ec4899" />
                            </View>
                            <Text style={styles.thankYouTitle}>Thank You! 🎉</Text>
                            <Text style={styles.thankYouText}>
                                Your feedback helps us improve our service.
                            </Text>
                            <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                                <Text style={styles.doneBtnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* Rating View */
                        <>
                            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                                <Feather name="x" size={20} color="#94a3b8" />
                            </TouchableOpacity>

                            <View style={styles.headerIcon}>
                                <Feather name="message-square" size={28} color={colors.primary} />
                            </View>
                            <Text style={styles.title}>How was your experience?</Text>
                            <Text style={styles.subtitle}>
                                Your ticket has been resolved. Please rate the support you received.
                            </Text>

                            {/* Stars */}
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity
                                        key={star}
                                        onPress={() => handleStarPress(star)}
                                        activeOpacity={0.7}
                                    >
                                        <Animated.View style={{ transform: [{ scale: starAnims[star - 1] }] }}>
                                            <Feather
                                                name="star"
                                                size={36}
                                                color={star <= rating ? '#f59e0b' : '#e2e8f0'}
                                                style={star <= rating ? { textShadowColor: '#fbbf24', textShadowRadius: 6 } : {}}
                                            />
                                        </Animated.View>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {rating > 0 && (
                                <Text style={styles.ratingLabel}>{STAR_LABELS[rating]}</Text>
                            )}

                            {/* Feedback */}
                            <TextInput
                                style={styles.feedbackInput}
                                placeholder="Share your feedback (optional)..."
                                placeholderTextColor="#94a3b8"
                                value={feedback}
                                onChangeText={setFeedback}
                                multiline
                                numberOfLines={3}
                                maxLength={500}
                            />

                            {/* Submit */}
                            <TouchableOpacity
                                style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={submitting || rating === 0}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Submit Rating</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleClose}>
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    container: {
        width: '100%', backgroundColor: '#fff', borderRadius: 20,
        padding: 28, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    closeBtn: { position: 'absolute', top: 14, right: 14, padding: 4 },
    headerIcon: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '15',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
    subtitle: {
        fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20,
        marginTop: 8, marginBottom: 24, paddingHorizontal: 10,
    },

    // Stars
    starsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    ratingLabel: {
        fontSize: 14, fontWeight: '600', color: '#f59e0b', marginTop: 4, marginBottom: 16,
    },

    // Feedback
    feedbackInput: {
        width: '100%', minHeight: 80, borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12, padding: 14, fontSize: 14, color: '#334155',
        textAlignVertical: 'top', marginBottom: 20, backgroundColor: '#f8fafc',
    },

    // Submit
    submitBtn: {
        width: '100%', backgroundColor: colors.primary, paddingVertical: 14,
        borderRadius: 12, alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    skipText: { color: '#94a3b8', fontSize: 13, marginTop: 14 },

    // Thank you
    thankYouContainer: { alignItems: 'center', paddingVertical: 20 },
    thankYouIcon: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: '#fdf2f8',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    thankYouTitle: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
    thankYouText: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
    doneBtn: {
        backgroundColor: colors.primary, paddingHorizontal: 40, paddingVertical: 12,
        borderRadius: 12, marginTop: 24,
    },
    doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
