import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const FAQ_DATA = [
    {
        id: '1',
        question: 'How do I track my order?',
        answer: 'You can track your order from the Order History section in your profile. Once your order is shipped, you\'ll receive tracking updates via email and push notifications.',
    },
    {
        id: '2',
        question: 'What is your return policy?',
        answer: 'We offer a 30-day hassle-free return policy for all plants. If your plant arrives damaged or unhealthy, we\'ll replace it or refund your purchase.',
    },
    {
        id: '3',
        question: 'How do I care for my new plant?',
        answer: 'Each plant comes with detailed care instructions. You can also use our AI Plant Care Assistant in the app for personalized advice based on your plant\'s needs.',
    },
    {
        id: '4',
        question: 'Can I change my shipping address?',
        answer: 'Yes! You can manage your shipping addresses from Profile > Shipping Addresses. You can add, edit, or delete addresses at any time.',
    },
    {
        id: '5',
        question: 'How does Cash on Delivery work?',
        answer: 'With Cash on Delivery, you pay when your order arrives. Please have the exact amount ready. Our delivery partner will collect the payment and hand over your plants.',
    },
];

export default function HelpSupportScreen({ navigation, route }: any) {
    const { mode } = route.params || {};
    const isVendor = mode === 'vendor';
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

    const toggleFaq = (id: string) => {
        setExpandedFaq(expandedFaq === id ? null : id);
    };


    const ContactOption = ({ icon, title, subtitle, onPress, color }: any) => (
        <TouchableOpacity style={styles.contactOption} onPress={onPress}>
            <View style={[styles.contactIcon, { backgroundColor: `${color}15` }]}>
                <Feather name={icon} size={22} color={color} />
            </View>
            <View style={styles.contactContent}>
                <Text style={styles.contactTitle}>{title}</Text>
                <Text style={styles.contactSubtitle}>{subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Help & Support</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Quick Contact */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Get in Touch</Text>
                    <View style={styles.contactGrid}>
                        {!isVendor && (
                            <TouchableOpacity style={styles.contactOption} onPress={() => navigation.navigate('MyTickets')}>
                                <View style={[styles.contactIcon, { backgroundColor: '#10b98115' }]}>
                                    <Feather name="inbox" size={22} color={colors.primary} />
                                </View>
                                <View style={styles.contactContent}>
                                    <Text style={styles.contactTitle}>My Complaints</Text>
                                    <Text style={styles.contactSubtitle}>View and reply to your complaints</Text>
                                </View>
                                <Feather name="chevron-right" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}

                        <ContactOption
                            icon="mail"
                            title="Email"
                            subtitle="support@gardenmate.app"
                            color={colors.primary}
                            onPress={() => Linking.openURL('mailto:support@gardenmate.app')}
                        />
                        <ContactOption
                            icon="phone"
                            title="Call Us"
                            subtitle="+1 (800) 123-4567"
                            color="#f59e0b"
                            onPress={() => Linking.openURL('tel:+18001234567')}
                        />
                    </View>
                </View>

                {/* FAQ - Hide for Vendors */}
                {!isVendor && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                        <View style={styles.faqContainer}>
                            {FAQ_DATA.map(faq => (
                                <TouchableOpacity
                                    key={faq.id}
                                    style={styles.faqItem}
                                    onPress={() => toggleFaq(faq.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.faqHeader}>
                                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                                        <Feather
                                            name={expandedFaq === faq.id ? 'chevron-up' : 'chevron-down'}
                                            size={20}
                                            color={colors.textMuted}
                                        />
                                    </View>
                                    {expandedFaq === faq.id && (
                                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}


                {/* Resources - Hide for Vendors */}
                {!isVendor && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Resources</Text>
                        <View style={styles.resourcesCard}>
                            <TouchableOpacity style={styles.resourceItem} onPress={() => Linking.openURL('https://gardenmate.app/guide')}>
                                <Feather name="book-open" size={18} color={colors.primary} />
                                <Text style={styles.resourceText}>Plant Care Guide</Text>
                                <Feather name="external-link" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.resourceItem} onPress={() => Linking.openURL('https://gardenmate.app/tutorials')}>
                                <Feather name="play-circle" size={18} color={colors.primary} />
                                <Text style={styles.resourceText}>Video Tutorials</Text>
                                <Feather name="external-link" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.resourceItem} onPress={() => Linking.openURL('https://gardenmate.app/community')}>
                                <Feather name="users" size={18} color={colors.primary} />
                                <Text style={styles.resourceText}>Community Forum</Text>
                                <Feather name="external-link" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    sectionTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
    contactGrid: { gap: spacing.sm },
    contactOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    contactIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    contactContent: { flex: 1 },
    contactTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
    contactSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    faqContainer: { backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    faqItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)' },
    faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    faqQuestion: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
    faqAnswer: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 22, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(229,231,235,0.3)' },
    messageCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    messageInput: { minHeight: 120, backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.md },
    sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
    sendButtonText: { color: '#fff', fontWeight: 'bold' },
    resourcesCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    resourceItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(229,231,235,0.3)', gap: spacing.md },
    resourceText: { flex: 1, fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
});
