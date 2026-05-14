import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Image, TextInput, Modal, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';

const STORE_INFO = {
    name: 'Green Thumb Gardens',
    avatar: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100',
    isVerified: true,
};

const posts = [
    {
        id: '1',
        content: '🌿 New batch of Monstera Deliciosa just arrived! Limited stock available. These beauties have incredible fenestration and are ready for their new homes!',
        image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400',
        likes: 145,
        comments: 32,
        shares: 12,
        date: '2 hours ago',
        isOwn: true,
    },
    {
        id: '2',
        content: '💡 Pro tip: Water your snake plants only when the soil is completely dry! Overwatering is the #1 killer of these gorgeous plants.',
        image: '',
        likes: 289,
        comments: 56,
        shares: 45,
        date: '1 day ago',
        isOwn: true,
    },
    {
        id: '3',
        content: '🎉 Weekend Sale Alert! Get 20% off ALL indoor plants this Saturday and Sunday. Use code WEEKEND20 at checkout!',
        image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400',
        likes: 456,
        comments: 78,
        shares: 89,
        date: '3 days ago',
        isOwn: true,
    },
    {
        id: '4',
        content: 'Customer spotlight! Look at this amazing plant corner setup by @PlantLover2024 featuring our Fiddle Leaf Fig and Pothos. Tag us in your photos!',
        image: 'https://images.unsplash.com/photo-1495908333425-29a1e0918c5f?w=400',
        likes: 367,
        comments: 45,
        shares: 34,
        date: '5 days ago',
        isOwn: true,
    },
];

const communityPosts = [
    {
        id: 'c1',
        author: 'Sarah Green',
        avatar: '',
        content: 'Just got my Monstera from Green Thumb Gardens and it\'s absolutely gorgeous! 🌿',
        image: '',
        likes: 45,
        comments: 8,
        shares: 5,
        date: '4 hours ago',
        isOwn: false,
    },
    {
        id: 'c2',
        author: 'Mike Chen',
        avatar: '',
        content: 'Can anyone recommend a good fertilizer for fiddle leaf figs?',
        image: '',
        likes: 23,
        comments: 15,
        shares: 2,
        date: '6 hours ago',
        isOwn: false,
    },
];

export default function VendorCommunityScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<'my-posts' | 'community'>('my-posts');
    const [showNewPostModal, setShowNewPostModal] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');

    const handleCreatePost = () => {
        if (!newPostContent.trim()) {
            Alert.alert('Error', 'Please write something to post');
            return;
        }
        Alert.alert('Success', 'Your post has been published!');
        setNewPostContent('');
        setShowNewPostModal(false);
    };

    const renderPost = ({ item }: any) => (
        <View style={styles.postCard}>
            {/* Post Header */}
            <View style={styles.postHeader}>
                {item.isOwn ? (
                    <Image source={{ uri: STORE_INFO.avatar }} style={styles.storeAvatar} />
                ) : (
                    <View style={styles.userAvatar}>
                        <Feather name="user" size={18} color={colors.textMuted} />
                    </View>
                )}
                <View style={styles.postMeta}>
                    <View style={styles.authorRow}>
                        <Text style={styles.authorName}>{item.isOwn ? STORE_INFO.name : item.author}</Text>
                        {item.isOwn && (
                            <View style={styles.vendorBadge}>
                                <Feather name="check" size={10} color="#fff" />
                                <Text style={styles.vendorBadgeText}>Vendor</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.postDate}>{item.date}</Text>
                </View>
                {item.isOwn && (
                    <TouchableOpacity style={styles.moreBtn}>
                        <Feather name="more-horizontal" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Post Content */}
            <Text style={styles.postContent}>{item.content}</Text>

            {/* Post Image */}
            {item.image ? (
                <Image source={{ uri: item.image }} style={styles.postImage} />
            ) : null}

            {/* Post Stats */}
            <View style={styles.statsRow}>
                <Text style={styles.statsText}>{item.likes} likes</Text>
                <Text style={styles.statsText}>{item.comments} comments</Text>
                {item.shares && <Text style={styles.statsText}>{item.shares} shares</Text>}
            </View>

            {/* Post Actions */}
            <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Feather name="heart" size={18} color={colors.textMuted} />
                    <Text style={styles.actionText}>Like</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <Feather name="message-circle" size={18} color={colors.textMuted} />
                    <Text style={styles.actionText}>Comment</Text>
                </TouchableOpacity>
                {item.isOwn ? (
                    <TouchableOpacity style={styles.actionBtn}>
                        <Feather name="edit-2" size={18} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.actionBtn}>
                        <Feather name="share-2" size={18} color={colors.textMuted} />
                        <Text style={styles.actionText}>Share</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderNewPostModal = () => (
        <Modal visible={showNewPostModal} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowNewPostModal(false)}>
                        <Feather name="x" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Create Post</Text>
                    <TouchableOpacity onPress={handleCreatePost}>
                        <Text style={styles.postBtn}>Post</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                    {/* Author Info */}
                    <View style={styles.authorInfo}>
                        <Image source={{ uri: STORE_INFO.avatar }} style={styles.storeAvatar} />
                        <View>
                            <View style={styles.authorRow}>
                                <Text style={styles.authorName}>{STORE_INFO.name}</Text>
                                <View style={styles.vendorBadge}>
                                    <Feather name="check" size={10} color="#fff" />
                                    <Text style={styles.vendorBadgeText}>Vendor</Text>
                                </View>
                            </View>
                            <Text style={styles.postVisibility}>Public post</Text>
                        </View>
                    </View>

                    {/* Post Input */}
                    <TextInput
                        style={styles.postInput}
                        placeholder="Share plant tips, new arrivals, or promotions..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        value={newPostContent}
                        onChangeText={setNewPostContent}
                        autoFocus
                    />

                    {/* Media Options */}
                    <View style={styles.mediaOptions}>
                        <TouchableOpacity style={styles.mediaBtn}>
                            <Feather name="image" size={20} color={colors.primary} />
                            <Text style={styles.mediaBtnText}>Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mediaBtn}>
                            <Feather name="video" size={20} color="#ef4444} " />
                            <Text style={styles.mediaBtnText}>Video</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mediaBtn}>
                            <Feather name="tag" size={20} color="#f59e0b" />
                            <Text style={styles.mediaBtnText}>Tag Product</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Community</Text>
                <TouchableOpacity style={styles.newPostBtn} onPress={() => setShowNewPostModal(true)}>
                    <Feather name="plus" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.newPostText}>Post</Text>
                </TouchableOpacity>
            </View>

            {/* Engagement Stats */}
            <View style={styles.engagementRow}>
                <View style={styles.engagementCard}>
                    <Text style={styles.engagementValue}>1.2K</Text>
                    <Text style={styles.engagementLabel}>Followers</Text>
                </View>
                <View style={styles.engagementCard}>
                    <Text style={styles.engagementValue}>24</Text>
                    <Text style={styles.engagementLabel}>Posts</Text>
                </View>
                <View style={styles.engagementCard}>
                    <Text style={styles.engagementValue}>4.5K</Text>
                    <Text style={styles.engagementLabel}>Likes</Text>
                </View>
                <View style={styles.engagementCard}>
                    <Text style={styles.engagementValue}>89%</Text>
                    <Text style={styles.engagementLabel}>Engagement</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'my-posts' && styles.tabActive]}
                    onPress={() => setActiveTab('my-posts')}
                >
                    <Feather name="grid" size={16} color={activeTab === 'my-posts' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'my-posts' && styles.tabTextActive]}>My Posts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'community' && styles.tabActive]}
                    onPress={() => setActiveTab('community')}
                >
                    <Feather name="users" size={16} color={activeTab === 'community' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>Community</Text>
                </TouchableOpacity>
            </View>

            {/* Posts List */}
            <FlatList
                data={activeTab === 'my-posts' ? posts : communityPosts}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                renderItem={renderPost}
            />

            {renderNewPostModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md },
    newPostBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    newPostText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.sm },

    engagementRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
    engagementCard: { flex: 1, backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    engagementValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    engagementLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

    tabRow: { flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: '#fff', borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md },
    tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.sm, gap: spacing.xs },
    tabActive: { backgroundColor: 'rgba(16,185,129,0.1)' },
    tabText: { fontSize: fontSize.sm, color: colors.textMuted },
    tabTextActive: { color: colors.primary, fontWeight: '600' },

    list: { padding: spacing.lg, paddingTop: 0 },
    postCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)', overflow: 'hidden' },
    postHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    storeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border },
    userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(243,244,246,0.8)', justifyContent: 'center', alignItems: 'center' },
    postMeta: { flex: 1, marginLeft: spacing.sm },
    authorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    authorName: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text },
    vendorBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
    vendorBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 2 },
    postDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    moreBtn: { padding: spacing.xs },
    postContent: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    postImage: { width: '100%', height: 200, backgroundColor: colors.border },
    statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    statsText: { fontSize: fontSize.xs, color: colors.textMuted, marginRight: spacing.md },
    actionsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
    actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.xs },
    actionText: { fontSize: fontSize.sm, color: colors.textMuted },

    // Modal styles
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    postBtn: { color: colors.primary, fontSize: fontSize.base, fontWeight: 'bold' },
    modalContent: { flex: 1, padding: spacing.lg },
    authorInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    postVisibility: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    postInput: { fontSize: fontSize.base, color: colors.text, lineHeight: 24, minHeight: 150, textAlignVertical: 'top' },
    mediaOptions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: 'auto' },
    mediaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
    mediaBtnText: { fontSize: fontSize.sm, color: colors.text },
});
