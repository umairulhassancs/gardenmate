import React from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const TERMS_SECTIONS = [
    {
        title: 'Acceptance of Terms',
        icon: 'check-circle',
        content: `By downloading, installing, or using the GardenMate application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the App.

These Terms constitute a legally binding agreement between you and GardenMate Technologies ("Company", "we", "us", or "our"). We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting.`
    },
    {
        title: 'Eligibility',
        icon: 'user-check',
        content: `You must be at least 13 years of age to use GardenMate. By using the App, you represent and warrant that you meet this age requirement.

If you are using the App on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.`
    },
    {
        title: 'Account Registration',
        icon: 'user-plus',
        content: `To access certain features of the App, you must create an account. You agree to:

• Provide accurate, current, and complete information during registration
• Maintain and promptly update your account information
• Keep your password secure and confidential
• Accept responsibility for all activities under your account
• Notify us immediately of any unauthorized use of your account

We reserve the right to suspend or terminate accounts that violate these Terms.`
    },
    {
        title: 'User Conduct',
        icon: 'alert-triangle',
        content: `When using GardenMate, you agree NOT to:

• Post false, misleading, or fraudulent content
• Harass, abuse, or harm other users
• Upload malware, viruses, or harmful code
• Attempt to gain unauthorized access to our systems
• Use the App for any illegal purpose
• Scrape, copy, or redistribute content without permission
• Impersonate another person or entity
• Interfere with the proper functioning of the App
• Violate any applicable laws or regulations

Violation of these rules may result in immediate account termination.`
    },
    {
        title: 'Marketplace Terms',
        icon: 'shopping-bag',
        content: `GardenMate provides a marketplace connecting plant buyers and vendors. By using the marketplace:

FOR BUYERS:
• You acknowledge that products are sold by independent vendors
• GardenMate is not responsible for product quality or fulfillment
• Disputes should be resolved directly with vendors first
• Refund policies are set by individual vendors

FOR VENDORS:
• You must provide accurate product descriptions and images
• You are responsible for fulfilling orders and customer service
• You agree to GardenMate's commission structure
• You must comply with all applicable business laws
• Misleading listings may result in account suspension`
    },
    {
        title: 'Intellectual Property',
        icon: 'award',
        content: `All content, features, and functionality of the App—including but not limited to text, graphics, logos, icons, images, audio clips, and software—are owned by GardenMate or its licensors and are protected by intellectual property laws.

USER CONTENT:
• You retain ownership of content you post
• You grant us a non-exclusive license to use, display, and distribute your content within the App
• You represent that you have the right to share any content you post

You may not reproduce, distribute, or create derivative works from any App content without our express written permission.`
    },
    {
        title: 'Plant Care Information',
        icon: 'feather',
        content: `GardenMate provides plant care advice, tips, and recommendations. This information is for general guidance only.

DISCLAIMER:
• Plant care advice may not apply to all situations
• Results may vary based on local conditions
• We are not liable for plant damage or loss based on our recommendations
• Always consult local experts for specialized advice

The App uses AI and machine learning for plant identification and care suggestions. These features are not 100% accurate and should be used as guidance only.`
    },
    {
        title: 'Third-Party Services',
        icon: 'external-link',
        content: `GardenMate may integrate with or link to third-party services, including:

• Payment processors (for marketplace transactions)
• Weather data providers
• Social media platforms
• Analytics services

We are not responsible for the content, policies, or practices of third-party services. Your use of these services is governed by their respective terms and policies.`
    },
    {
        title: 'Payments & Billing',
        icon: 'credit-card',
        content: `Marketplace transactions are processed through secure third-party payment providers. By making a purchase:

• You agree to provide valid payment information
• You authorize charges to your payment method
• All transactions are in Pakistani Rupees (PKR) unless otherwise specified
• Fees and commissions are non-refundable unless required by law

Vendors receive payments according to GardenMate's payout schedule, minus applicable commissions and fees.`
    },
    {
        title: 'Limitation of Liability',
        icon: 'shield-off',
        content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW:

• GardenMate is provided "AS IS" without warranties of any kind
• We do not guarantee uninterrupted or error-free service
• We are not liable for any indirect, incidental, or consequential damages
• Our total liability shall not exceed the amount you paid us in the past 12 months

Some jurisdictions do not allow limitation of liability, so these limitations may not apply to you.`
    },
    {
        title: 'Indemnification',
        icon: 'shield',
        content: `You agree to indemnify and hold harmless GardenMate, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:

• Your use of the App
• Your violation of these Terms
• Your violation of any third-party rights
• Any content you submit to the App`
    },
    {
        title: 'Termination',
        icon: 'x-circle',
        content: `We may terminate or suspend your account at any time, with or without cause, with or without notice. Upon termination:

• Your right to use the App will immediately cease
• We may delete your account data
• Any pending transactions may be canceled
• Provisions that by nature should survive will remain in effect

You may terminate your account at any time through Settings > Delete Account.`
    },
    {
        title: 'Dispute Resolution',
        icon: 'message-circle',
        content: `Any disputes arising from these Terms or your use of GardenMate shall be resolved through:

1. INFORMAL NEGOTIATION: Contact us first at support@gardenmate.app
2. MEDIATION: If unresolved, disputes will be submitted to mediation
3. ARBITRATION: Final disputes will be resolved through binding arbitration

These Terms shall be governed by the laws of Pakistan. Any legal action must be brought in the courts of Lahore, Pakistan.`
    },
    {
        title: 'Contact Information',
        icon: 'mail',
        content: `For questions about these Terms of Service, please contact us:

GardenMate Technologies
Lahore, Pakistan

Email: legal@gardenmate.app
Support: support@gardenmate.app

Response time: 2-3 business days`
    }
];

export default function TermsOfServiceScreen({ navigation }: any) {
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Terms of Service</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroIcon}>
                        <Feather name="file-text" size={40} color={colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>Terms of Service</Text>
                    <Text style={styles.heroSubtitle}>
                        Please read these terms carefully before using GardenMate
                    </Text>
                    <View style={styles.lastUpdated}>
                        <Feather name="calendar" size={14} color={colors.textMuted} />
                        <Text style={styles.lastUpdatedText}>Effective: January 15, 2026</Text>
                    </View>
                </View>

                {/* Quick Summary */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <Feather name="zap" size={18} color="#f59e0b" />
                        <Text style={styles.summaryTitle}>Quick Summary</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Feather name="check" size={14} color={colors.primary} />
                        <Text style={styles.summaryText}>Create an account to access all features</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Feather name="check" size={14} color={colors.primary} />
                        <Text style={styles.summaryText}>Be respectful to other community members</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Feather name="check" size={14} color={colors.primary} />
                        <Text style={styles.summaryText}>Marketplace vendors are independent sellers</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Feather name="check" size={14} color={colors.primary} />
                        <Text style={styles.summaryText}>Plant care advice is general guidance only</Text>
                    </View>
                </View>

                {/* Terms Sections */}
                {TERMS_SECTIONS.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionNumber}>
                                <Text style={styles.sectionNumberText}>{index + 1}</Text>
                            </View>
                            <View style={styles.sectionIcon}>
                                <Feather name={section.icon as any} size={18} color={colors.primary} />
                            </View>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>
                        <View style={styles.sectionContent}>
                            <Text style={styles.contentText}>{section.content}</Text>
                        </View>
                    </View>
                ))}

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerCard}>
                        <View style={styles.footerIconBox}>
                            <Feather name="info" size={20} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.footerTitle}>Questions?</Text>
                            <Text style={styles.footerText}>
                                If you have any questions about these Terms, please contact us at legal@gardenmate.app
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Agreement */}
                <View style={styles.agreementBox}>
                    <Feather name="check-circle" size={24} color={colors.primary} />
                    <Text style={styles.agreementText}>
                        By using GardenMate, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                    </Text>
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

    // Summary
    summaryCard: {
        backgroundColor: 'rgba(245,158,11,0.05)',
        margin: spacing.lg,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.2)',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    summaryTitle: {
        fontSize: fontSize.base,
        fontWeight: '600',
        color: '#b45309',
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    summaryText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.text,
        lineHeight: 20,
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
    sectionNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    sectionNumberText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: '#fff',
    },
    sectionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    sectionTitle: {
        fontSize: fontSize.base,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
    },
    sectionContent: {
        padding: spacing.lg,
    },
    contentText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 22,
    },

    // Footer
    footer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
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
    footerIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(59,130,246,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerTitle: {
        fontSize: fontSize.base,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    footerText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        lineHeight: 20,
    },

    // Agreement
    agreementBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        backgroundColor: 'rgba(16,185,129,0.05)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.15)',
        gap: spacing.md,
    },
    agreementText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.text,
        lineHeight: 22,
        fontWeight: '500',
    },
});
