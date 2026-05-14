import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, TextInput, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const POSTS = [
    { id: '1', author: 'Sarah Green', avatar: 'SG', content: 'Just propagated my Monstera! Can\'t wait to see the roots grow', likes: 24, comments: 8, time: '2h ago' },
    { id: '2', author: 'Plant Dad Mike', avatar: 'PM', content: 'Finally got my hands on a Pink Princess! Such a beautiful plant', likes: 45, comments: 15, time: '4h ago' },
    { id: '3', author: 'Plant Mom', avatar: 'PM', content: 'Anyone else obsessed with variegated plants? Just got a beautiful Thai Constellation!', likes: 89, comments: 23, time: '6h ago' },
];

export default function CommunityScreen({ navigation }: any) {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Community</Text>
                    <TouchableOpacity style={styles.newPostButton}>
                        <Feather name="plus" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Posts */}
                {POSTS.map(post => (
                    <View key={post.id} style={styles.postCard}>
                        <View style={styles.postHeader}>
                            <View style={styles.avatar}><Text style={styles.avatarText}>{post.avatar}</Text></View>
                            <View style={styles.postMeta}>
                                <Text style={styles.authorName}>{post.author}</Text>
                                <Text style={styles.postTime}>{post.time}</Text>
                            </View>
                            <TouchableOpacity><Feather name="more-horizontal" size={20} color={colors.textMuted} /></TouchableOpacity>
                        </View>
                        <Text style={styles.postContent}>{post.content}</Text>
                        <View style={styles.postActions}>
                            <TouchableOpacity style={styles.actionButton}>
                                <Feather name="heart" size={18} color={colors.textMuted} />
                                <Text style={styles.actionText}>{post.likes}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton}>
                                <Feather name="message-circle" size={18} color={colors.textMuted} />
                                <Text style={styles.actionText}>{post.comments}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton}>
                                <Feather name="share" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    title: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text },
    newPostButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    postCard: { backgroundColor: '#fff', marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    postMeta: { flex: 1 },
    authorName: { fontWeight: 'bold', color: colors.text },
    postTime: { fontSize: fontSize.xs, color: colors.textMuted },
    postContent: { fontSize: fontSize.base, color: colors.text, lineHeight: 22, marginBottom: spacing.md },
    postActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(229,231,235,0.5)', paddingTop: spacing.md },
    actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg },
    actionText: { marginLeft: 4, color: colors.textMuted, fontSize: fontSize.sm },
});
