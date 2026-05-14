import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { useCart } from '../contexts/CartContext';
// FIREBASE IMPORTS
import { db, auth } from '../services/firebaseConfig'; 
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';

export default function WishlistScreen({ navigation }: any) {
    const [wishlistItems, setWishlistItems] = useState<any[]>([]);
    const [productRatings, setProductRatings] = useState<Record<string, { avg: number; count: number }>>({});
    const [loading, setLoading] = useState(true);
    const { addToCart, isInCart } = useCart();

    // 1. Fetch Wishlist from Firebase
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Wishlist collection mein se sirf is user ki items uthao
        const q = query(
            collection(db, 'wishlist'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items: any[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            setWishlistItems(items);
            setLoading(false);
        }, (error) => {
            console.error("Wishlist fetch error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Remove from Firebase logic
    const handleRemoveFromWishlist = (item: any) => {
        Alert.alert(
            'Remove from Wishlist',
            `Remove "${item.name}" from your wishlist?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Remove', 
                    style: 'destructive', 
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'wishlist', item.id));
                        } catch (error) {
                            Alert.alert("Error", "Could not remove item");
                        }
                    } 
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    if (wishlistItems.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Wishlist</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIcon}>
                        <Feather name="heart" size={48} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
                    <Text style={styles.emptyText}>Save your favorite plants by tapping the heart icon while browsing.</Text>
                    <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Shop' })}>
                        <Feather name="shopping-bag" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.shopBtnText}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Wishlist ({wishlistItems.length})</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.productsGrid}>
                    {wishlistItems.map(product => {
                        const inCart = isInCart(product.productId); // Check using original product ID

                        return (
                            <TouchableOpacity
                                key={product.id}
                                style={styles.productCard}
                                activeOpacity={0.9}
                                onPress={() => navigation.navigate('ProductDetail', { product })}
                            >
                                <View style={styles.productImageContainer}>
                                    {/* Base64 Support */}
                                    <Image 
                                        source={{ uri: product.image || 'https://via.placeholder.com/150' }} 
                                        style={styles.productImage} 
                                    />
                                    
                                    <TouchableOpacity
                                        style={styles.heartButton}
                                        onPress={() => handleRemoveFromWishlist(product)}
                                    >
                                        <Feather name="heart" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.productInfo}>
                                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                                    
                                    <View style={styles.productMeta}>
                                        <Text style={styles.productPrice}>${product.price}</Text>
                                        <View style={styles.ratingBadge}>
                                            <Feather name="star" size={10} color="#f59e0b" style={{ marginRight: 2 }} />
                                            <Text style={styles.ratingText}>
                                                {productRatings[product.productId] ? productRatings[product.productId].avg.toFixed(1) : (product.rating || '0')}
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.addToCartBtn, inCart && styles.addToCartBtnDisabled]}
                                        onPress={() => !inCart && addToCart(product, 1)}
                                        disabled={inCart}
                                    >
                                        <Feather name={inCart ? 'check' : 'shopping-cart'} size={14} color={inCart ? colors.primary : '#fff'} />
                                        <Text style={[styles.addToCartText, inCart && styles.addToCartTextDisabled]}>
                                            {inCart ? 'In Cart' : 'Add to Cart'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    scrollContent: { paddingHorizontal: spacing.md },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
    emptyTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
    shopBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
    shopBtnText: { color: '#fff', fontWeight: 'bold', fontSize: fontSize.base },
    productsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    productCard: { width: '48%', margin: '1%', backgroundColor: '#fff', borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    productImageContainer: { aspectRatio: 1, backgroundColor: 'rgba(243,244,246,0.5)', position: 'relative' },
    productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heartButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
    arBadge: { position: 'absolute', bottom: spacing.sm, right: spacing.sm, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    saleBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: '#ef4444', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    saleBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    productInfo: { padding: spacing.sm },
    productName: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.text, marginBottom: 2 },
    vendorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: 4 },
    vendorName: { fontSize: fontSize.xs, color: colors.textMuted, flex: 1 },
    productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    productPrice: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.primary },
    originalPrice: { fontSize: fontSize.xs, color: colors.textMuted, textDecorationLine: 'line-through' },
    ratingBadge: { flexDirection: 'row', alignItems: 'center' },
    ratingText: { fontSize: fontSize.xs, fontWeight: '500', color: colors.text },
    addToCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm, gap: 4 },
    addToCartBtnDisabled: { backgroundColor: 'rgba(16,185,129,0.1)' },
    addToCartText: { fontSize: fontSize.xs, fontWeight: 'bold', color: '#fff' },
    addToCartTextDisabled: { color: colors.primary },
});
