import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, ScrollView, Keyboard
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { searchAddress, type NominatimResult } from '../services/locationService';

interface AddressAutocompleteProps {
    placeholder?: string;
    onSelect: (result: NominatimResult) => void;
    initialValue?: string;
}

export default function AddressAutocomplete({
    placeholder = 'Search for an address...',
    onSelect,
    initialValue = '',
}: AddressAutocompleteProps) {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((text: string) => {
        setQuery(text);

        // Clear previous debounce
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (text.length < 3) {
            setResults([]);
            setShowResults(false);
            return;
        }

        // Debounce: wait 800ms after user stops typing (Nominatim rate limit: 1 req/sec)
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await searchAddress(text);
                setResults(data);
                setShowResults(data.length > 0);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }, 800);
    }, []);

    const handleSelect = (item: NominatimResult) => {
        setQuery(item.displayName.split(',').slice(0, 3).join(','));
        setShowResults(false);
        setResults([]);
        Keyboard.dismiss();
        onSelect(item);
    };

    const clearInput = () => {
        setQuery('');
        setResults([]);
        setShowResults(false);
    };

    return (
        <View style={styles.container}>
            {/* Search Input */}
            <View style={styles.searchBox}>
                <Feather name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={handleSearch}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="search"
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
                {query.length > 0 && !loading && (
                    <TouchableOpacity onPress={clearInput}>
                        <Feather name="x" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Results Dropdown */}
            {showResults && (
                <View style={styles.resultsContainer}>
                    <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        style={styles.resultsList}
                    >
                        {results.length > 0 ? results.map((item) => (
                            <TouchableOpacity
                                key={item.placeId}
                                style={styles.resultItem}
                                onPress={() => handleSelect(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.resultIcon}>
                                    <Feather name="map-pin" size={14} color="#3b82f6" />
                                </View>
                                <View style={styles.resultInfo}>
                                    <Text style={styles.resultTitle} numberOfLines={1}>
                                        {item.city || item.street || item.displayName.split(',')[0]}
                                    </Text>
                                    <Text style={styles.resultSubtitle} numberOfLines={2}>
                                        {item.displayName}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )) : (
                            <View style={styles.emptyResult}>
                                <Text style={styles.emptyText}>No results found</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Helper text */}
            {query.length > 0 && query.length < 3 && (
                <Text style={styles.helperText}>Type at least 3 characters to search</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 999,
        marginBottom: spacing.md,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        height: 48,
    },
    input: {
        flex: 1,
        fontSize: fontSize.base,
        color: colors.text,
        height: '100%',
    },
    resultsContainer: {
        position: 'absolute',
        top: 52,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        maxHeight: 250,
        zIndex: 1000,
    },
    resultsList: {
        maxHeight: 250,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        gap: spacing.sm,
    },
    resultIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(59,130,246,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultInfo: {
        flex: 1,
    },
    resultTitle: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text,
    },
    resultSubtitle: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
        lineHeight: 15,
    },
    emptyResult: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    helperText: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 4,
    },
});
