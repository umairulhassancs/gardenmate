import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const PRIVACY_SECTIONS = [
    {
        title: 'Information We Collect',
        icon: 'database',
        content: [
            {
                subtitle: 'Personal Information',
                text: 'When you create an account, we collect your name, email address, phone number, and location. This information is essential for providing our plant care services and connecting you with local vendors.'
            },
            {
                subtitle: 'Usage Data',
                text: 'We automatically collect information about how you interact with our app, including pages visited, features used, and time spent on different sections. This helps us improve your experience.'
            },
            {
                subtitle: 'Device Information',
                text: 'We collect device-specific information such as your device model, operating system version, and unique device identifiers for security and optimization purposes.'
            },
            {
                subtitle: 'Location Data',
                text: 'With your permission, we collect precise location data to provide weather information, locate nearby nurseries, and offer location-based plant care recommendations.'
            }
        ]
    },
    {
        title: 'How We Use Your Information',
        icon: 'settings',
        content: [
            {
                subtitle: 'Service Delivery',
                text: 'We use your information to provide personalized plant care recommendations, process orders, and facilitate communication between buyers and vendors.'
            },
            {
                subtitle: 'Communication',
                text: 'We may send you notifications about your orders, plant care reminders, and important account updates. You can manage your notification preferences in Settings.'
            },
            {
                subtitle: 'Improvement & Analytics',
                text: 'We analyze usage patterns to improve our app features, fix bugs, and develop new services that better meet your gardening needs.'
            }
        ]
    },
    {
        title: 'Data Sharing',
        icon: 'share-2',
        content: [
            {
                subtitle: 'With Vendors',
                text: 'When you place an order, we share necessary information (name, delivery address, contact details) with the vendor to fulfill your order.'
            },
            {
                subtitle: 'Service Providers',
                text: 'We work with trusted third-party services for payment processing, analytics, and cloud storage. These providers are bound by strict confidentiality agreements.'
            },
            {
                subtitle: 'Legal Requirements',
                text: 'We may disclose your information when required by law, to protect our rights, or to prevent fraud and security threats.'
            }
        ]
    },
    {
        title: 'Data Security',
        icon: 'shield',
        content: [
            {
                subtitle: 'Encryption',
                text: 'All data transmitted between your device and our servers is encrypted using industry-standard TLS/SSL protocols.'
            },
            {
                subtitle: 'Access Controls',
                text: 'We implement strict access controls and authentication measures. Only authorized personnel can access user data, and all access is logged and monitored.'
            },
            {
                subtitle: 'Regular Audits',
                text: 'We conduct regular security audits and vulnerability assessments to ensure your data remains protected against emerging threats.'
            }
        ]
    },
    {
        title: 'Your Rights',
        icon: 'user-check',
        content: [
            {
                subtitle: 'Access & Portability',
                text: 'You can request a copy of your personal data at any time. We will provide your data in a commonly used format within 30 days.'
            },
            {
                subtitle: 'Correction',
                text: 'You can update or correct your personal information through your account settings or by contacting our support team.'
            },
            {
                subtitle: 'Deletion',
                text: 'You can request deletion of your account and associated data. Some information may be retained for legal compliance purposes.'
            },
            {
                subtitle: 'Opt-Out',
                text: 'You can opt out of marketing communications at any time while still receiving essential service notifications.'
            }
        ]
    },
    {
        title: 'Cookies & Tracking',
        icon: 'eye',
        content: [
            {
                subtitle: 'Analytics',
                text: 'We use analytics tools to understand app usage patterns. This data is aggregated and anonymized.'
            },
            {
                subtitle: 'Personalization',
                text: 'We use local storage to remember your preferences and provide a personalized experience.'
            }
        ]
    },
    {
        title: 'Children\'s Privacy',
        icon: 'users',
        content: [
            {
                subtitle: 'Age Requirement',
                text: 'GardenMate is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13.'
            }
        ]
    },
    {
        title: 'Contact Us',
        icon: 'mail',
        content: [
            {
                subtitle: 'Privacy Inquiries',
                text: 'For any questions about this Privacy Policy or your data, please contact our Privacy Team at privacy@gardenmate.app'
            },
            {
                subtitle: 'Data Protection Officer',
                text: 'GardenMate Technologies\nLahore, Pakistan\ndpo@gardenmate.app'
            }
        ]
    }
];

export default function PrivacyPolicyScreen({ navigation }: any) {
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Privacy Policy</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroIcon}>
                        <Feather name="shield" size={40} color={colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>Your Privacy Matters</Text>
                    <Text style={styles.heroSubtitle}>
                        We are committed to protecting your personal information and being transparent about how we use it.
                    </Text>
                    <View style={styles.lastUpdated}>
                        <Feather name="calendar" size={14} color={colors.textMuted} />
                        <Text style={styles.lastUpdatedText}>Last Updated: January 15, 2026</Text>
                    </View>
                </View>

                {/* Introduction */}
                <View style={styles.introCard}>
                    <Text style={styles.introText}>
                        This Privacy Policy describes how GardenMate ("we", "us", or "our") collects, uses, and protects your information when you use our mobile application and services. By using GardenMate, you agree to the collection and use of information in accordance with this policy.
                    </Text>
                </View>

                {/* Policy Sections */}
                {PRIVACY_SECTIONS.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIcon}>
                                <Feather name={section.icon as any} size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>
                        <View style={styles.sectionContent}>
                            {section.content.map((item, idx) => (
                                <View key={idx} style={styles.contentItem}>
                                    <Text style={styles.contentSubtitle}>{item.subtitle}</Text>
                                    <Text style={styles.contentText}>{item.text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerCard}>
                        <Feather name="info" size={20} color={colors.primary} />
                        <Text style={styles.footerText}>
                            This Privacy Policy is effective as of January 15, 2026. We reserve the right to update this policy at any time. We will notify you of any changes by posting the new policy on this page.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
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
        backgroundColor: '#fff',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(243,244,246,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },

    // Hero
    heroSection: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.5)',
    },
    heroIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    heroTitle: {
        fontSize: fontSize['2xl'],
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    heroSubtitle: {
        fontSize: fontSize.base,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: spacing.lg,
    },
    lastUpdated: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    lastUpdatedText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },

    // Introduction
    introCard: {
        backgroundColor: 'rgba(16,185,129,0.05)',
        margin: spacing.lg,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.1)',
    },
    introText: {
        fontSize: fontSize.sm,
        color: colors.text,
        lineHeight: 22,
    },

    // Sections
    section: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        backgroundColor: '#fff',
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,231,235,0.5)',
        backgroundColor: 'rgba(243,244,246,0.3)',
    },
    sectionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
    },
    sectionContent: {
        padding: spacing.lg,
    },
    contentItem: {
        marginBottom: spacing.md,
    },
    contentSubtitle: {
        fontSize: fontSize.base,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    contentText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 20,
    },

    // Footer
    footer: {
        padding: spacing.lg,
    },
    footerCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(59,130,246,0.05)',
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.1)',
        gap: spacing.md,
    },
    footerText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 20,
    },
});
