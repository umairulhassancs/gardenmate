import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
    TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { auth } from '../services/firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

// ✅ MOVED OUTSIDE: Prevents keyboard from dismissing on each keystroke
const PasswordInput = ({
    label,
    value,
    onChangeText,
    placeholder,
    showPassword,
    toggleShow,
    hint
}: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    showPassword: boolean;
    toggleShow: () => void;
    hint?: string;
}) => (
    <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.inputContainer}>
            <Feather name="lock" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
            />
            <TouchableOpacity onPress={toggleShow} style={styles.eyeButton}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
        </View>
        {hint && <Text style={styles.inputHint}>{hint}</Text>}
    </View>
);

export default function ChangePasswordScreen({ navigation }: any) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password strength checker
    const getPasswordStrength = (password: string) => {
        if (!password) return { level: 0, text: '', color: '#e5e7eb' };

        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 1) return { level: 1, text: 'Weak', color: '#ef4444' };
        if (score <= 2) return { level: 2, text: 'Fair', color: '#f59e0b' };
        if (score <= 3) return { level: 3, text: 'Good', color: '#10b981' };
        return { level: 4, text: 'Strong', color: '#059669' };
    };

    const passwordStrength = getPasswordStrength(newPassword);

    const handleChangePassword = async () => {
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Missing Fields', 'Please fill in all password fields.');
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert('Weak Password', 'New password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Password Mismatch', 'New password and confirm password do not match.');
            return;
        }

        if (currentPassword === newPassword) {
            Alert.alert('Same Password', 'New password must be different from current password.');
            return;
        }

        setLoading(true);

        try {
            const user = auth.currentUser;
            if (!user || !user.email) {
                Alert.alert('Error', 'No user is currently signed in.');
                setLoading(false);
                return;
            }

            // Re-authenticate user
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, newPassword);

            Alert.alert(
                'Password Updated! 🔐',
                'Your password has been changed successfully. Please use your new password for future logins.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            console.error('Password change error:', error);

            if (error.code === 'auth/wrong-password') {
                Alert.alert('Incorrect Password', 'Your current password is incorrect. Please try again.');
            } else if (error.code === 'auth/too-many-requests') {
                Alert.alert('Too Many Attempts', 'Account temporarily locked. Please try again later.');
            } else if (error.code === 'auth/requires-recent-login') {
                Alert.alert('Session Expired', 'Please log out and log in again before changing your password.');
            } else {
                Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Change Password</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                >
                    {/* Security Icon */}
                    <View style={styles.securityIconContainer}>
                        <View style={styles.securityIcon}>
                            <Feather name="shield" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.securityTitle}>Secure Your Account</Text>
                        <Text style={styles.securitySubtitle}>
                            Create a strong password to protect your account
                        </Text>
                    </View>

                    {/* Password Form */}
                    <View style={styles.formCard}>
                        <PasswordInput
                            label="Current Password"
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            showPassword={showCurrentPassword}
                            toggleShow={() => setShowCurrentPassword(!showCurrentPassword)}
                        />

                        <PasswordInput
                            label="New Password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter new password"
                            showPassword={showNewPassword}
                            toggleShow={() => setShowNewPassword(!showNewPassword)}
                            hint="Minimum 8 characters with uppercase, lowercase, and numbers"
                        />

                        {/* Password Strength Indicator */}
                        {newPassword.length > 0 && (
                            <View style={styles.strengthContainer}>
                                <View style={styles.strengthBars}>
                                    {[1, 2, 3, 4].map((level) => (
                                        <View
                                            key={level}
                                            style={[
                                                styles.strengthBar,
                                                { backgroundColor: level <= passwordStrength.level ? passwordStrength.color : '#e5e7eb' }
                                            ]}
                                        />
                                    ))}
                                </View>
                                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                                    {passwordStrength.text}
                                </Text>
                            </View>
                        )}

                        <PasswordInput
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            showPassword={showConfirmPassword}
                            toggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
                        />

                        {/* Password Match Indicator */}
                        {confirmPassword.length > 0 && (
                            <View style={styles.matchContainer}>
                                <Feather
                                    name={newPassword === confirmPassword ? 'check-circle' : 'x-circle'}
                                    size={16}
                                    color={newPassword === confirmPassword ? '#10b981' : '#ef4444'}
                                />
                                <Text style={[
                                    styles.matchText,
                                    { color: newPassword === confirmPassword ? '#10b981' : '#ef4444' }
                                ]}>
                                    {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Password Tips */}
                    <View style={styles.tipsCard}>
                        <Text style={styles.tipsTitle}>Password Tips</Text>
                        <View style={styles.tipItem}>
                            <Feather name="check" size={14} color={colors.primary} />
                            <Text style={styles.tipText}>Use at least 8 characters</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Feather name="check" size={14} color={colors.primary} />
                            <Text style={styles.tipText}>Include uppercase and lowercase letters</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Feather name="check" size={14} color={colors.primary} />
                            <Text style={styles.tipText}>Add numbers and special characters</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Feather name="check" size={14} color={colors.primary} />
                            <Text style={styles.tipText}>Avoid common words or personal info</Text>
                        </View>
                    </View>

                    {/* Update Button */}
                    <TouchableOpacity
                        style={[styles.updateButton, loading && styles.updateButtonDisabled]}
                        onPress={handleChangePassword}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.updateButtonText}>Update Password</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.5)',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    content: { padding: spacing.lg },

    // Security Icon
    securityIconContainer: { alignItems: 'center', marginBottom: spacing.xl },
    securityIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    securityTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs },
    securitySubtitle: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },

    // Form
    formCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    inputGroup: { marginBottom: spacing.lg },
    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(243,244,246,0.5)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputIcon: { marginLeft: spacing.md },
    input: {
        flex: 1,
        padding: spacing.md,
        fontSize: fontSize.base,
        color: colors.text,
    },
    eyeButton: { padding: spacing.md },
    inputHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },

    // Strength Indicator
    strengthContainer: { flexDirection: 'row', alignItems: 'center', marginTop: -spacing.sm, marginBottom: spacing.lg },
    strengthBars: { flexDirection: 'row', flex: 1, gap: 4 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthText: { fontSize: fontSize.xs, fontWeight: '600', marginLeft: spacing.sm },

    // Match Indicator
    matchContainer: { flexDirection: 'row', alignItems: 'center', marginTop: -spacing.sm },
    matchText: { fontSize: fontSize.xs, marginLeft: spacing.xs },

    // Tips
    tipsCard: {
        backgroundColor: 'rgba(16,185,129,0.05)',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.1)',
    },
    tipsTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    tipText: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: spacing.sm },

    // Button
    updateButton: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        paddingVertical: spacing.md + 4,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    updateButtonDisabled: { opacity: 0.7 },
    updateButtonText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },
});
