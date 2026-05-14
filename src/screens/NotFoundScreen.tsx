import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize } from '../theme';

export default function NotFoundScreen({ navigation }: any) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.iconRow}>
                        <Text style={styles.icon}>⚠️</Text>
                        <Text style={styles.title}>404 Page Not Found</Text>
                    </View>
                    <Text style={styles.description}>
                        The page you're looking for doesn't exist or has been moved.
                    </Text>
                    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MainTabs')}>
                        <Text style={styles.buttonText}>Go to Home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    card: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    icon: { fontSize: 28, marginRight: spacing.sm },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    description: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xl, lineHeight: 20 },
    button: { backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
});
