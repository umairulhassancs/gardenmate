import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Linking, Share, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../theme';

export default function SettingsScreen({ navigation }: any) {

    const APP_VERSION = '1.0.0';
    const BUILD_NUMBER = '1';
    const ANDROID_PACKAGE = 'com.ghanwa.gardenmateexpo';
    const IOS_BUNDLE = 'com.ghanwa.gardenmateexpo';

    const handleRateApp = () => {
        const storeUrl = Platform.select({
            android: `market://details?id=${ANDROID_PACKAGE}`,
            ios: `itms-apps://itunes.apple.com/app/${IOS_BUNDLE}`,
        });
        const webUrl = Platform.select({
            android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
            ios: `https://apps.apple.com/app/${IOS_BUNDLE}`,
        });

        if (storeUrl) {
            Linking.openURL(storeUrl).catch(() => {
                if (webUrl) {
                    Linking.openURL(webUrl).catch(() => {
                        Alert.alert('Error', 'Unable to open the app store. Please try again later.');
                    });
                }
            });
        }
    };

    const handleShareApp = async () => {
        try {
            await Share.share({
                title: 'GardenMate - Your Plant Companion',
                message: `🌿 Check out GardenMate - the ultimate plant care companion!\n\nIdentify plants, get care tips, shop from nurseries, and connect with a community of plant lovers.\n\nDownload now: https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
            });
        } catch (error: any) {
            Alert.alert('Error', 'Something went wrong while sharing. Please try again.');
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone. All your data will be lost.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Confirm Deletion',
                            'Please type DELETE to confirm account deletion.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'I Understand',
                                    style: 'destructive',
                                    onPress: async () => {
                                        await AsyncStorage.clear();
                                        navigation.replace('Auth');
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };



    const SettingItem = ({ icon, title, subtitle, onPress, rightElement, danger }: any) => (
        <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress && !rightElement}>
            <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
                <Feather name={icon} size={20} color={danger ? '#ef4444' : colors.primary} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>{title}</Text>
                {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
            </View>
            {rightElement || (onPress && <Feather name="chevron-right" size={20} color={colors.textMuted} />)}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Privacy & Security */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy & Security</Text>
                    <View style={styles.card}>
                        <SettingItem icon="lock" title="Change Password" subtitle="Update your account password" onPress={() => navigation.navigate('ChangePassword')} />
                        <SettingItem icon="eye" title="Privacy Policy" subtitle="How we protect your data" onPress={() => navigation.navigate('PrivacyPolicy')} />
                        <SettingItem icon="file-text" title="Terms of Service" subtitle="Usage terms and conditions" onPress={() => navigation.navigate('TermsOfService')} />
                    </View>
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.card}>
                        <SettingItem icon="info" title="App Version" subtitle={`v${APP_VERSION} (Build ${BUILD_NUMBER})`} />
                        <SettingItem icon="star" title="Rate the App" subtitle="Love GardenMate? Rate us on the store!" onPress={handleRateApp} />
                        <SettingItem icon="share-2" title="Share GardenMate" subtitle="Share with friends and family" onPress={handleShareApp} />
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
                    <View style={styles.card}>
                        <SettingItem
                            icon="trash"
                            title="Delete Account"
                            subtitle="Permanently delete your account"
                            onPress={handleDeleteAccount}
                            danger
                        />
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm, marginLeft: spacing.sm },
    card: { backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    settingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    settingIconDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
    settingContent: { flex: 1 },
    settingTitle: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    settingTitleDanger: { color: '#ef4444' },
    settingSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
});
