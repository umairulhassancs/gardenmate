import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { KB_ARTICLES, searchKB, getArticlesForCategory, KBArticle } from '../constants/knowledgeBase';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface KnowledgeBasePanelProps {
    category?: string;          // Pre-filter by ticket category
    onDismiss: () => void;      // "Still need help" / close
    visible: boolean;
}

export default function KnowledgeBasePanel({ category, onDismiss, visible }: KnowledgeBasePanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const articles = useMemo(() => {
        if (searchQuery.length >= 2) {
            return searchKB(searchQuery);
        }
        if (category) {
            return getArticlesForCategory(category);
        }
        return KB_ARTICLES;
    }, [searchQuery, category]);

    const toggleArticle = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(prev => prev === id ? null : id);
    };

    if (!visible) return null;

    const categoryLabel = category && TICKET_CATEGORIES[category]
        ? TICKET_CATEGORIES[category].label
        : null;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                        <Feather name="book-open" size={18} color="#7c3aed" />
                    </View>
                    <View>
                        <Text style={styles.title}>Help Center</Text>
                        <Text style={styles.subtitle}>
                            {categoryLabel
                                ? `FAQs for "${categoryLabel}"`
                                : 'Find answers to common questions'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
                    <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Feather name="search" size={16} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search for help..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Feather name="x-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Articles */}
            <ScrollView
                style={styles.scrollArea}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >
                {articles.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="inbox" size={36} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>No articles found</Text>
                        <Text style={styles.emptySubtext}>
                            Try a different search term or create a ticket below
                        </Text>
                    </View>
                ) : (
                    articles.map((article) => (
                        <TouchableOpacity
                            key={article.id}
                            style={[
                                styles.articleCard,
                                expandedId === article.id && styles.articleCardExpanded,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => toggleArticle(article.id)}
                        >
                            <View style={styles.articleHeader}>
                                <View style={[
                                    styles.articleIcon,
                                    expandedId === article.id && styles.articleIconExpanded,
                                ]}>
                                    <Feather
                                        name={article.icon as any}
                                        size={14}
                                        color={expandedId === article.id ? '#fff' : '#7c3aed'}
                                    />
                                </View>
                                <Text style={styles.articleTitle} numberOfLines={expandedId === article.id ? undefined : 2}>
                                    {article.title}
                                </Text>
                                <Feather
                                    name={expandedId === article.id ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color={colors.textMuted}
                                />
                            </View>

                            {expandedId === article.id && (
                                <View style={styles.articleBody}>
                                    <Text style={styles.articleContent}>
                                        {article.content}
                                    </Text>
                                    <View style={styles.helpfulRow}>
                                        <Text style={styles.helpfulLabel}>Did this solve your issue?</Text>
                                        <TouchableOpacity
                                            style={styles.helpfulBtnYes}
                                            onPress={onDismiss}
                                        >
                                            <Feather name="check" size={14} color="#fff" />
                                            <Text style={styles.helpfulBtnYesText}>Yes</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Still need help */}
            <TouchableOpacity style={styles.needHelpBtn} onPress={onDismiss}>
                <Feather name="message-circle" size={16} color="#fff" />
                <Text style={styles.needHelpText}>Still need help? Create a ticket</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.15)',
        overflow: 'hidden',
        maxHeight: 520,
        marginBottom: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
        backgroundColor: 'rgba(124, 58, 237, 0.04)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    subtitle: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 1,
    },
    closeBtn: {
        padding: 6,
    },

    // Search
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        margin: spacing.md,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: colors.text,
        padding: 0,
    },

    // Articles
    scrollArea: {
        maxHeight: 320,
        paddingHorizontal: spacing.md,
    },
    articleCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 8,
        overflow: 'hidden',
    },
    articleCardExpanded: {
        borderColor: 'rgba(124, 58, 237, 0.2)',
        backgroundColor: '#faf8ff',
    },
    articleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
    },
    articleIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    articleIconExpanded: {
        backgroundColor: '#7c3aed',
    },
    articleTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 18,
    },
    articleBody: {
        paddingHorizontal: 12,
        paddingBottom: 14,
        paddingTop: 0,
    },
    articleContent: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 20,
        marginBottom: 12,
    },
    helpfulRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    helpfulLabel: {
        fontSize: 12,
        color: colors.textMuted,
    },
    helpfulBtnYes: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10b981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    helpfulBtnYesText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },

    // Empty
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginTop: 10,
    },
    emptySubtext: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },

    // Bottom CTA
    needHelpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#7c3aed',
        margin: spacing.md,
        marginTop: 8,
        paddingVertical: 12,
        borderRadius: 12,
    },
    needHelpText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
