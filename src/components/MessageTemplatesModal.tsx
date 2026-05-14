import React, { useState } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity,
    FlatList, TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

interface TemplateItem {
    id: string;
    category: string;
    title: string;
    body: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (text: string) => void;
    variables: {
        customerName?: string;
        orderId?: string;
        ticketId?: string;
        storeName?: string;
    };
}

const TEMPLATES: TemplateItem[] = [
    // Greeting
    {
        id: 'greet1', category: 'Greeting', title: 'Welcome',
        body: 'Hello {customerName}! Thank you for reaching out. How can I assist you today?',
    },
    {
        id: 'greet2', category: 'Greeting', title: 'Order Greeting',
        body: 'Hi {customerName}, I can see your order #{orderId}. Let me help you with that.',
    },

    // Acknowledgment
    {
        id: 'ack1', category: 'Acknowledgment', title: 'Looking Into It',
        body: 'Thank you for your patience, {customerName}. I\'m currently looking into this issue and will update you shortly.',
    },
    {
        id: 'ack2', category: 'Acknowledgment', title: 'Issue Received',
        body: 'Hi {customerName}, I\'ve received your concern regarding order #{orderId}. I\'ll investigate and get back to you as soon as possible.',
    },
    {
        id: 'ack3', category: 'Acknowledgment', title: 'Need More Info',
        body: 'Hi {customerName}, to better assist you, could you please provide more details about the issue?',
    },

    // Resolution
    {
        id: 'res1', category: 'Resolution', title: 'Issue Fixed',
        body: 'Great news {customerName}! The issue with your order #{orderId} has been resolved. Please check and let me know if everything looks good.',
    },
    {
        id: 'res2', category: 'Resolution', title: 'Replacement Sent',
        body: 'Hi {customerName}, we\'ve processed a replacement for your order #{orderId}. You should receive it within 2-3 business days.',
    },
    {
        id: 'res3', category: 'Resolution', title: 'Refund Processed',
        body: 'Hi {customerName}, a refund for order #{orderId} has been initiated. Please allow 5-7 business days for it to reflect in your account.',
    },

    // Follow-up
    {
        id: 'follow1', category: 'Follow-up', title: 'Check In',
        body: 'Hi {customerName}, just following up on your recent issue. Is everything working fine now?',
    },
    {
        id: 'follow2', category: 'Follow-up', title: 'Closing Soon',
        body: 'Hi {customerName}, since we haven\'t heard back, we\'ll be closing this ticket. Feel free to reopen if you need further assistance.',
    },

    // Apology
    {
        id: 'apology1', category: 'Apology', title: 'Sincere Apology',
        body: 'I sincerely apologize for the inconvenience, {customerName}. We take this matter seriously and are working to resolve it immediately.',
    },
    {
        id: 'apology2', category: 'Apology', title: 'Delay Apology',
        body: 'I\'m sorry for the delayed response, {customerName}. Thank you for your patience. Let me look into this right away.',
    },
];

const CATEGORIES = ['All', 'Greeting', 'Acknowledgment', 'Resolution', 'Follow-up', 'Apology'];

const CATEGORY_ICONS: Record<string, string> = {
    'All': 'grid',
    'Greeting': 'smile',
    'Acknowledgment': 'check-circle',
    'Resolution': 'check-square',
    'Follow-up': 'clock',
    'Apology': 'heart',
};

export default function MessageTemplatesModal({ visible, onClose, onSelect, variables }: Props) {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    const substituteVariables = (text: string): string => {
        return text
            .replace(/\{customerName\}/g, variables.customerName || 'Customer')
            .replace(/\{orderId\}/g, variables.orderId || 'N/A')
            .replace(/\{ticketId\}/g, variables.ticketId || 'N/A')
            .replace(/\{storeName\}/g, variables.storeName || 'Store');
    };

    const filteredTemplates = TEMPLATES.filter(t => {
        const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
        const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
            || t.body.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleSelect = (template: TemplateItem) => {
        const substituted = substituteVariables(template.body);
        onSelect(substituted);
        onClose();
        setSearch('');
        setSelectedCategory('All');
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Feather name="zap" size={18} color={colors.primary} />
                            <Text style={styles.headerTitle}>Quick Replies</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Feather name="x" size={22} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchRow}>
                        <Feather name="search" size={16} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search templates..."
                            placeholderTextColor="#94a3b8"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {/* Category Chips */}
                    <FlatList
                        horizontal
                        data={CATEGORIES}
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryList}
                        contentContainerStyle={styles.categoryListContent}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.categoryChip, selectedCategory === item && styles.categoryChipActive]}
                                onPress={() => setSelectedCategory(item)}
                            >
                                <Feather
                                    name={CATEGORY_ICONS[item] as any || 'tag'}
                                    size={12}
                                    color={selectedCategory === item ? '#fff' : '#64748b'}
                                />
                                <Text style={[
                                    styles.categoryChipText,
                                    selectedCategory === item && styles.categoryChipTextActive,
                                ]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />

                    {/* Templates List */}
                    <FlatList
                        data={filteredTemplates}
                        keyExtractor={(item) => item.id}
                        style={styles.templateList}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyState}>
                                <Feather name="inbox" size={32} color="#cbd5e1" />
                                <Text style={styles.emptyText}>No matching templates</Text>
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.templateCard}
                                onPress={() => handleSelect(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.templateHeader}>
                                    <Text style={styles.templateTitle}>{item.title}</Text>
                                    <View style={styles.templateCategoryTag}>
                                        <Text style={styles.templateCategoryText}>{item.category}</Text>
                                    </View>
                                </View>
                                <Text style={styles.templateBody} numberOfLines={2}>
                                    {substituteVariables(item.body)}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    container: {
        backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '80%', paddingBottom: 20,
    },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
    closeBtn: { padding: 4 },

    // Search
    searchRow: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12,
        backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#334155', padding: 0 },

    // Categories
    categoryList: { marginTop: 12, maxHeight: 44 },
    categoryListContent: { paddingHorizontal: 16, gap: 8 },
    categoryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
        backgroundColor: '#f1f5f9',
    },
    categoryChipActive: { backgroundColor: colors.primary },
    categoryChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    categoryChipTextActive: { color: '#fff' },

    // Template
    templateList: { marginTop: 12 },
    templateCard: {
        marginHorizontal: 16, marginBottom: 10, padding: 14,
        backgroundColor: '#f8fafc', borderRadius: 12,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    templateHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
    },
    templateTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    templateCategoryTag: {
        backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    },
    templateCategoryText: { fontSize: 10, fontWeight: '600', color: colors.primary },
    templateBody: { fontSize: 13, color: '#64748b', lineHeight: 18 },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8', marginTop: 8, fontSize: 13 },
});
