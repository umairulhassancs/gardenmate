import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, Modal, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../../theme';
import { db } from '../../services/firebaseConfig';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';

interface Comment {
    id: string;
    author: string;
    content: string;
    time: string;
}

interface Post {
    id: string;
    author: string;
    authorEmail: string;
    userId: string;
    avatar: string;
    content: string;
    image?: string;
    likes: number;
    comments: Comment[];
    shares: number;
    time: string;
    createdAt: Date;
    isBlocked: boolean;
}

export default function AdminCommunityScreen({ navigation }: any) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showPostModal, setShowPostModal] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch real-time posts from Firebase
        const q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts: Post[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
                const now = new Date();
                const diff = now.getTime() - createdAt.getTime();
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                let timeAgo = 'Just now';
                if (minutes >= 1 && minutes < 60) timeAgo = `${minutes}m ago`;
                else if (hours >= 1 && hours < 24) timeAgo = `${hours}h ago`;
                else if (days >= 1 && days < 7) timeAgo = `${days}d ago`;
                else if (days >= 7) timeAgo = createdAt.toLocaleDateString();

                fetchedPosts.push({
                    id: doc.id,
                    author: data.author || 'Anonymous',
                    authorEmail: data.authorEmail || '',
                    userId: data.userId || '',
                    avatar: data.avatar || 'U',
                    content: data.content || '',
                    image: data.image,
                    likes: data.likes || 0,
                    comments: data.comments || [],
                    shares: data.shares || 0,
                    time: timeAgo,
                    createdAt,
                    isBlocked: data.isBlocked || false,
                });
            });
            setPosts(fetchedPosts);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching posts:', error);
            Alert.alert('Error', 'Failed to load posts');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDeletePost = async (postId: string) => {
        Alert.alert(
            'Delete Post',
            'Are you sure you want to delete this post? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'posts', postId));
                            setShowPostModal(false);
                            Alert.alert('Post Deleted', 'The post has been removed.');
                        } catch (error) {
                            console.error('Error deleting post:', error);
                            Alert.alert('Error', 'Failed to delete post');
                        }
                    }
                },
            ]
        );
    };

    const handleBlockUser = (post: Post) => {
        setSelectedPost(post);
        setShowBlockModal(true);
    };

    const confirmBlockUser = async () => {
        if (selectedPost) {
            try {
                // Update all posts from this user to blocked status
                const q = query(collection(db, 'posts'));
                const unsubscribe = onSnapshot(q, async (snapshot) => {
                    const updatePromises: Promise<void>[] = [];
                    snapshot.forEach((document) => {
                        const data = document.data();
                        if (data.userId === selectedPost.userId || data.authorEmail === selectedPost.authorEmail) {
                            updatePromises.push(
                                updateDoc(doc(db, 'posts', document.id), {
                                    isBlocked: true,
                                    updatedAt: Timestamp.fromDate(new Date()),
                                })
                            );
                        }
                    });
                    await Promise.all(updatePromises);
                    unsubscribe();
                });
                setShowBlockModal(false);
                Alert.alert('User Blocked', `${selectedPost.author} has been blocked from posting.`);
            } catch (error) {
                console.error('Error blocking user:', error);
                Alert.alert('Error', 'Failed to block user');
            }
        }
    };

    const handleDeleteComment = async (postId: string, commentId: string) => {
        Alert.alert(
            'Delete Comment',
            'Are you sure you want to delete this comment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            const postRef = doc(db, 'posts', postId);
                            const post = posts.find(p => p.id === postId);
                            if (post) {
                                const updatedComments = post.comments.filter(c => c.id !== commentId);
                                await updateDoc(postRef, {
                                    comments: updatedComments,
                                    updatedAt: Timestamp.fromDate(new Date()),
                                });
                            }
                        } catch (error) {
                            console.error('Error deleting comment:', error);
                            Alert.alert('Error', 'Failed to delete comment');
                        }
                    }
                },
            ]
        );
    };

    const openPostDetail = (post: Post) => {
        setSelectedPost(post);
        setShowPostModal(true);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Community</Text>
                    <View style={styles.adminBadge}>
                        <Feather name="shield" size={14} color="#fff" />
                        <Text style={styles.adminBadgeText}>Admin View</Text>
                    </View>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading posts...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Community</Text>
                <View style={styles.adminBadge}>
                    <Feather name="shield" size={14} color="#fff" />
                    <Text style={styles.adminBadgeText}>Admin View</Text>
                </View>
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
                <Feather name="info" size={16} color="#3b82f6" />
                <Text style={styles.infoBannerText}>You're viewing as admin. You can moderate posts and comments but cannot post or comment.</Text>
            </View>

            {/* Posts Feed */}
            {posts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Feather name="message-circle" size={64} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No posts yet</Text>
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <View style={[styles.postCard, item.isBlocked && styles.blockedPost]}>
                            {item.isBlocked && (
                                <View style={styles.blockedBanner}>
                                    <Feather name="user-x" size={12} color="#ef4444" />
                                    <Text style={styles.blockedText}>User Blocked</Text>
                                </View>
                            )}
                            <View style={styles.postHeader}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{item.avatar}</Text>
                                </View>
                                <View style={styles.postMeta}>
                                    <Text style={styles.authorName}>{item.author}</Text>
                                    <Text style={styles.postTime}>{item.time}</Text>
                                </View>
                                <TouchableOpacity style={styles.moreBtn} onPress={() => openPostDetail(item)}>
                                    <Feather name="more-horizontal" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.postContent}>{item.content}</Text>
                            {item.image && (
                                <Image source={{ uri: item.image }} style={styles.postImage} />
                            )}
                            <View style={styles.postStats}>
                                <View style={styles.statItem}>
                                    <Feather name="heart" size={16} color={colors.textMuted} />
                                    <Text style={styles.statText}>{item.likes}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Feather name="message-circle" size={16} color={colors.textMuted} />
                                    <Text style={styles.statText}>{item.comments.length}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Feather name="share" size={16} color={colors.textMuted} />
                                    <Text style={styles.statText}>{item.shares}</Text>
                                </View>
                            </View>
                            {/* Admin Actions */}
                            <View style={styles.adminActions}>
                                <TouchableOpacity style={styles.adminActionBtn} onPress={() => openPostDetail(item)}>
                                    <Feather name="eye" size={14} color={colors.primary} />
                                    <Text style={styles.viewBtnText}>View</Text>
                                </TouchableOpacity>
                                {!item.isBlocked && (
                                    <TouchableOpacity style={styles.adminActionBtn} onPress={() => handleBlockUser(item)}>
                                        <Feather name="user-x" size={14} color="#f59e0b" />
                                        <Text style={styles.blockBtnText}>Block User</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.adminActionBtn} onPress={() => handleDeletePost(item.id)}>
                                    <Feather name="trash-2" size={14} color="#ef4444" />
                                    <Text style={styles.deleteBtnText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Post Detail Modal */}
            <Modal visible={showPostModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Post Details</Text>
                            <TouchableOpacity onPress={() => setShowPostModal(false)}>
                                <Feather name="x" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {selectedPost && (
                            <ScrollView style={styles.modalScroll}>
                                <View style={styles.detailPostHeader}>
                                    <View style={styles.detailAvatar}>
                                        <Text style={styles.detailAvatarText}>{selectedPost.avatar}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.detailAuthor}>{selectedPost.author}</Text>
                                        <Text style={styles.detailEmail}>{selectedPost.authorEmail}</Text>
                                        <Text style={styles.detailTime}>{selectedPost.time}</Text>
                                    </View>
                                </View>

                                <Text style={styles.detailContent}>{selectedPost.content}</Text>

                                {selectedPost.image && (
                                    <Image source={{ uri: selectedPost.image }} style={styles.detailImage} />
                                )}

                                <View style={styles.detailStats}>
                                    <View style={styles.detailStatItem}>
                                        <Feather name="heart" size={18} color={colors.primary} />
                                        <Text style={styles.detailStatValue}>{selectedPost.likes}</Text>
                                        <Text style={styles.detailStatLabel}>likes</Text>
                                    </View>
                                    <View style={styles.detailStatItem}>
                                        <Feather name="message-circle" size={18} color={colors.primary} />
                                        <Text style={styles.detailStatValue}>{selectedPost.comments.length}</Text>
                                        <Text style={styles.detailStatLabel}>comments</Text>
                                    </View>
                                    <View style={styles.detailStatItem}>
                                        <Feather name="share" size={18} color={colors.primary} />
                                        <Text style={styles.detailStatValue}>{selectedPost.shares}</Text>
                                        <Text style={styles.detailStatLabel}>shares</Text>
                                    </View>
                                </View>

                                {/* Comments Section */}
                                <View style={styles.commentsSection}>
                                    <Text style={styles.commentsTitle}>Comments ({selectedPost.comments.length})</Text>
                                    {selectedPost.comments.length === 0 ? (
                                        <Text style={styles.noComments}>No comments yet</Text>
                                    ) : (
                                        selectedPost.comments.map(comment => (
                                            <View key={comment.id} style={styles.commentItem}>
                                                <View style={styles.commentHeader}>
                                                    <Text style={styles.commentAuthor}>{comment.author}</Text>
                                                    <Text style={styles.commentTime}>{comment.time}</Text>
                                                </View>
                                                <Text style={styles.commentContent}>{comment.content}</Text>
                                                <TouchableOpacity
                                                    style={styles.deleteCommentBtn}
                                                    onPress={() => handleDeleteComment(selectedPost.id, comment.id)}
                                                >
                                                    <Feather name="trash-2" size={12} color="#ef4444" />
                                                    <Text style={styles.deleteCommentText}>Delete Comment</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}
                                </View>

                                {/* Admin Actions */}
                                <View style={styles.modalActions}>
                                    {!selectedPost.isBlocked && (
                                        <TouchableOpacity style={styles.blockUserBtn} onPress={() => { setShowPostModal(false); handleBlockUser(selectedPost); }}>
                                            <Feather name="user-x" size={16} color="#f59e0b" />
                                            <Text style={styles.blockUserBtnText}>Block User from Posting</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity style={styles.deletePostBtn} onPress={() => handleDeletePost(selectedPost.id)}>
                                        <Feather name="trash-2" size={16} color="#fff" />
                                        <Text style={styles.deletePostBtnText}>Delete Post</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Block User Confirmation Modal */}
            <Modal visible={showBlockModal} transparent animationType="fade">
                <View style={styles.confirmModalOverlay}>
                    <View style={styles.confirmModalContent}>
                        <View style={styles.confirmIcon}>
                            <Feather name="user-x" size={32} color="#f59e0b" />
                        </View>
                        <Text style={styles.confirmTitle}>Block User</Text>
                        <Text style={styles.confirmText}>
                            Are you sure you want to block <Text style={{ fontWeight: 'bold' }}>{selectedPost?.author}</Text> from posting?
                            They will no longer be able to create posts or comments.
                        </Text>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBlockModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBlockBtn} onPress={confirmBlockUser}>
                                <Text style={styles.confirmBlockBtnText}>Block User</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full, gap: 4 },
    adminBadgeText: { fontSize: fontSize.xs, color: '#fff', fontWeight: '600' },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loadingText: { fontSize: fontSize.base, color: colors.textMuted },

    infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.1)', marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm, marginBottom: spacing.md },
    infoBannerText: { flex: 1, fontSize: fontSize.xs, color: '#3b82f6', lineHeight: 16 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    emptyText: { fontSize: fontSize.base, color: colors.textMuted },

    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

    postCard: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    blockedPost: { opacity: 0.7, borderColor: 'rgba(239,68,68,0.3)' },
    blockedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm, marginBottom: spacing.sm, gap: 4, alignSelf: 'flex-start' },
    blockedText: { fontSize: 10, color: '#ef4444', fontWeight: '600' },

    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    postMeta: { flex: 1 },
    authorName: { fontWeight: 'bold', color: colors.text },
    postTime: { fontSize: fontSize.xs, color: colors.textMuted },
    moreBtn: { padding: spacing.xs },

    postContent: { fontSize: fontSize.base, color: colors.text, lineHeight: 22, marginBottom: spacing.sm },
    postImage: { width: '100%', height: 200, borderRadius: borderRadius.md, marginBottom: spacing.sm },

    postStats: { flexDirection: 'row', paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(229,231,235,0.5)', marginBottom: spacing.sm },
    statItem: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg, gap: 4 },
    statText: { color: colors.textMuted, fontSize: fontSize.sm },

    adminActions: { flexDirection: 'row', gap: spacing.sm },
    adminActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.8)', gap: 4 },
    viewBtnText: { fontSize: fontSize.xs, fontWeight: '500', color: colors.primary },
    blockBtnText: { fontSize: fontSize.xs, fontWeight: '500', color: '#f59e0b' },
    deleteBtnText: { fontSize: fontSize.xs, fontWeight: '500', color: '#ef4444' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    modalScroll: { padding: spacing.lg },

    detailPostHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    detailAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    detailAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    detailAuthor: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    detailEmail: { fontSize: fontSize.xs, color: colors.textMuted },
    detailTime: { fontSize: fontSize.xs, color: colors.textMuted },

    detailContent: { fontSize: fontSize.base, color: colors.text, lineHeight: 22, marginBottom: spacing.md },
    detailImage: { width: '100%', height: 200, borderRadius: borderRadius.lg, marginBottom: spacing.md },

    detailStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md, backgroundColor: 'rgba(243,244,246,0.5)', borderRadius: borderRadius.md, marginBottom: spacing.lg },
    detailStatItem: { alignItems: 'center' },
    detailStatValue: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginTop: 4 },
    detailStatLabel: { fontSize: fontSize.xs, color: colors.textMuted },

    commentsSection: { marginBottom: spacing.lg },
    commentsTitle: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    noComments: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' },
    commentItem: { backgroundColor: 'rgba(243,244,246,0.5)', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm },
    commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    commentAuthor: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
    commentTime: { fontSize: fontSize.xs, color: colors.textMuted },
    commentContent: { fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
    deleteCommentBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
    deleteCommentText: { fontSize: fontSize.xs, color: '#ef4444' },

    modalActions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
    blockUserBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: 'rgba(245,158,11,0.1)', gap: spacing.sm },
    blockUserBtnText: { fontSize: fontSize.base, fontWeight: '500', color: '#f59e0b' },
    deletePostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#ef4444', gap: spacing.sm },
    deletePostBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },

    confirmModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    confirmModalContent: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.lg, width: '100%', maxWidth: 340, alignItems: 'center' },
    confirmIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(245,158,11,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    confirmTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    confirmText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
    confirmActions: { flexDirection: 'row', gap: spacing.md, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: 'rgba(243,244,246,0.8)', alignItems: 'center' },
    cancelBtnText: { fontSize: fontSize.base, fontWeight: '500', color: colors.text },
    confirmBlockBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#f59e0b', alignItems: 'center' },
    confirmBlockBtnText: { fontSize: fontSize.base, fontWeight: 'bold', color: '#fff' },
});
