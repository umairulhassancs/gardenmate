import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export default function AdminLoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAdminAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            const success = await login(email, password);
            if (success) {
                navigation.replace('AdminTabs');
            } else {
                Alert.alert('Error', 'Invalid admin credentials');
            }
        } catch (error) {
            Alert.alert('Error', 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.logoSection}>
                    <LinearGradient colors={[colors.primary, '#047857']} style={styles.logoBox}>
                        <Feather name="shield" size={36} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.title}>Admin Portal</Text>
                    <Text style={styles.subtitle}>GardenMate Administration</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputWrapper}>
                            <Feather name="mail" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                            <TextInput style={styles.input} placeholder="admin@example.com" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Feather name="lock" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Feather name="log-in" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.loginBtnText}>Sign In</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={styles.backText}>Back to App</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, justifyContent: 'center', padding: spacing.lg },
    logoSection: { alignItems: 'center', marginBottom: spacing.xl * 2 },
    logoBox: { width: 80, height: 80, borderRadius: borderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    title: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text },
    subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
    form: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    inputGroup: { marginBottom: spacing.lg },
    label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, paddingHorizontal: spacing.md },
    input: { flex: 1, height: 48, fontSize: fontSize.base, color: colors.text },
    loginBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.md, height: 48, marginTop: spacing.md },
    loginBtnText: { color: '#fff', fontSize: fontSize.base, fontWeight: 'bold' },
    backLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
    backText: { color: colors.textMuted, fontSize: fontSize.sm },
});
