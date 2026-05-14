import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Image, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, FlatList, Dimensions, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { useCart } from '../contexts/CartContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.md * 3) / 2;

interface VendorData {
    storeName?: string;
    name?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    description?: string;
    address?: string;
    city?: string;
    isVerified?: boolean;
    createdAt?: any;
    [key: string]: any;
}

interface ProductItem {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    image?: string;
    category?: string;
    description?: string;
    stock?: number;
    vendorId?: string;
    [key: string]: any;
}

interface VendorStats {
    totalSales: number;
    rating: number;
    reviewsCount: number;
    totalProducts: number;
}

export default function VendorPublicStoreScreen({ route, navigation }: any) {
    const { vendorId, vendorName } = route.params || {};
    const { addToCart } = useCart();

    const [vendorData, setVendorData] = useState<VendorData | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [stats, setStats] = useState<VendorStats>({ totalSales: 0, rating: 0, reviewsCount: 0, totalProducts: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [categories, setCategories] = useState<string[]>(['All']);

    useEffect(() => {
        if (!vendorId) return;
        fetchStoreData();
    }, [vendorId]);

    const fetchStoreData = async () => {
        try {
            setLoading(true);

            // Fetch vendor details
            const vendorRef = doc(db, 'vendors', vendorId);
            const vendorSnap = await getDoc(vendorRef);
            if (vendorSnap.exists()) {
                setVendorData(vendorSnap.data() as VendorData);
            }

            // Also fetch from users collection for location/createdAt
            const userRef = doc(db, 'users', vendorId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setUserData(userSnap.data());
            }

            // Fetch products
            const productsRef = collection(db, 'products');
            const q = query(productsRef, where('vendorId', '==', vendorId));
            const productsSnap = await getDocs(q);
            const productsList: ProductItem[] = productsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                name: d.data().name || 'Product',
                price: d.data().price || 0,
            }));
            setProducts(productsList);

            // Extract categories
            const cats = new Set<string>();
            productsList.forEach(p => { if (p.category) cats.add(p.category); });
            setCategories(['All', ...Array.from(cats)]);

            // Fetch stats (orders + feedbacks)
            const [ordersSnap, feedbacksSnap] = await Promise.all([
                getDocs(query(collection(db, 'orders'), where('vendorId', '==', vendorId))),
                getDocs(query(collection(db, 'feedbacks'), where('vendorId', '==', vendorId))),
            ]);
            const totalSales = ordersSnap.size;
            const feedbacks = feedbacksSnap.docs.map(d => d.data().rating || 0);
            const reviewsCount = feedbacks.length;
            const rating = reviewsCount > 0
                ? feedbacks.reduce((s, r) => s + r, 0) / reviewsCount
                : 0;

            setStats({ totalSales, rating, reviewsCount, totalProducts: productsList.length });

        } catch (error) {
            console.error('Error loading store:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter(p => p.category === selectedCategory);

    const handleAddToCart = useCallback((product: ProductItem) => {
        try {
            addToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrl || product.image || '',
                vendorId: vendorId,
            } as any);
            Alert.alert('Added to Cart', `${product.name} added successfully!`);
        } catch {
            Alert.alert('Error', 'Failed to add to cart');
        }
    }, [addToCart, vendorId]);

    const renderStars = (rating: number) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalf = rating - fullStars >= 0.5;
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(<Feather key={i} name="star" size={14} color="#f59e0b" />);
            } else if (i === fullStars && hasHalf) {
                stars.push(<Feather key={i} name="star" size={14} color="#fbbf24" />);
            } else {
                stars.push(<Feather key={i} name="star" size={14} color="#e2e8f0" />);
            }
        }
        return stars;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading store...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const storeName = vendorData?.storeName || vendorName || 'Store';
    const location = userData?.location || userData?.city || userData?.address || vendorData?.city || vendorData?.address || '';
    const memberSince = (userData?.createdAt?.toDate?.() || vendorData?.createdAt?.toDate?.())
        ? new Date((userData?.createdAt?.toDate?.() || vendorData?.createdAt?.toDate?.())).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : vendorData?.updatedAt
            ? new Date(vendorData.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{storeName}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Store Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroTop}>
                        {vendorData?.logoUrl ? (
                            <Image source={{ uri: vendorData.logoUrl }} style={styles.storeLogo} />
                        ) : (
                            <View style={[styles.storeLogo, styles.logoPlaceholder]}>
                                <Feather name="shopping-bag" size={32} color={colors.primary} />
                            </View>
                        )}
                        <View style={styles.heroInfo}>
                            <View style={styles.nameRow}>
                                <Text style={styles.storeName}>{storeName}</Text>
                                {vendorData?.isVerified && (
                                    <View style={styles.verifiedBadge}>
                                        <Feather name="check-circle" size={14} color="#fff" />
                                    </View>
                                )}
                            </View>
                            {vendorData?.email && (
                                <Text style={styles.storeEmail}>{vendorData.email}</Text>
                            )}
                            {location ? (
                                <View style={styles.locationRow}>
                                    <Feather name="map-pin" size={12} color="#94a3b8" />
                                    <Text style={styles.locationText}>
                                        {location}
                                    </Text>
                                </View>
                            ) : null}
                            {memberSince && (
                                <Text style={styles.memberSince}>Member since {memberSince}</Text>
                            )}
                        </View>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.totalProducts}</Text>
                            <Text style={styles.statLabel}>Products</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Feather name="star" size={14} color="#f59e0b" />
                                <Text style={styles.statValue}>
                                    {stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
                                </Text>
                            </View>
                            <Text style={styles.statLabel}>
                                {stats.reviewsCount > 0 ? `${stats.reviewsCount} reviews` : 'No reviews'}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.totalSales}</Text>
                            <Text style={styles.statLabel}>Orders</Text>
                        </View>
                    </View>
                </View>

                {/* Description */}
                {vendorData?.description && (
                    <View style={styles.descriptionCard}>
                        <Text style={styles.sectionTitle}>About This Store</Text>
                        <Text style={styles.descriptionText}>{vendorData.description}</Text>
                    </View>
                )}

                {/* Contact Info */}
                {vendorData?.phone && (
                    <View style={styles.contactCard}>
                        <View style={styles.contactRow}>
                            <Feather name="phone" size={16} color={colors.primary} />
                            <Text style={styles.contactText}>{vendorData.phone}</Text>
                        </View>
                        {vendorData?.email && (
                            <View style={styles.contactRow}>
                                <Feather name="mail" size={16} color={colors.primary} />
                                <Text style={styles.contactText}>{vendorData.email}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Category Filter */}
                {categories.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryScroll}
                        contentContainerStyle={styles.categoryContainer}
                    >
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.categoryChip,
                                    selectedCategory === cat && styles.categoryChipActive,
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[
                                    styles.categoryChipText,
                                    selectedCategory === cat && styles.categoryChipTextActive,
                                ]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Products Section */}
                <View style={styles.productsSection}>
                    <View style={styles.productsSectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {selectedCategory === 'All' ? 'All Products' : selectedCategory}
                        </Text>
                        <Text style={styles.productCount}>{filteredProducts.length} items</Text>
                    </View>

                    {filteredProducts.length > 0 ? (
                        <View style={styles.productsGrid}>
                            {filteredProducts.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.productCard}
                                    onPress={() => navigation.navigate('ProductDetail', { product: item })}
                                    activeOpacity={0.8}
                                >
                                    <Image
                                        source={{ uri: item.imageUrl || item.image || 'https://via.placeholder.com/150' }}
                                        style={styles.productImage}
                                    />
                                    {item.stock !== undefined && item.stock <= 0 && (
                                        <View style={styles.outOfStockBadge}>
                                            <Text style={styles.outOfStockText}>Out of Stock</Text>
                                        </View>
                                    )}
                                    <View style={styles.productInfo}>
                                        <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                                        {item.category && (
                                            <Text style={styles.productCategory}>{item.category}</Text>
                                        )}
                                        <View style={styles.priceRow}>
                                            <Text style={styles.productPrice}>Rs. {Number(item.price).toFixed(0)}</Text>
                                            <TouchableOpacity
                                                style={[
                                                    styles.addToCartBtn,
                                                    item.stock !== undefined && item.stock <= 0 && styles.addToCartBtnDisabled,
                                                ]}
                                                onPress={() => handleAddToCart(item)}
                                                disabled={item.stock !== undefined && item.stock <= 0}
                                            >
                                                <Feather name="shopping-cart" size={14} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyProducts}>
                            <Feather name="package" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyProductsTitle}>No Products Found</Text>
                            <Text style={styles.emptyProductsText}>
                                {selectedCategory !== 'All'
                                    ? `No products in "${selectedCategory}" category`
                                    : 'This store has no products yet'
                                }
                            </Text>
                        </View>
                    )}
                </View>

                {/* Bottom Spacing */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#94a3b8', fontSize: 14 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: 14,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },

    // Hero
    heroSection: {
        backgroundColor: '#fff', paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    heroTop: { flexDirection: 'row', alignItems: 'center' },
    storeLogo: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9' },
    logoPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed' },
    heroInfo: { marginLeft: 16, flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    storeName: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    verifiedBadge: {
        backgroundColor: colors.primary, borderRadius: 10, width: 20, height: 20,
        justifyContent: 'center', alignItems: 'center',
    },
    storeEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    locationText: { fontSize: 12, color: '#94a3b8' },
    memberSince: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' },

    // Stats
    statsRow: {
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        marginTop: 18, paddingTop: 16,
        borderTopWidth: 1, borderTopColor: '#f1f5f9',
    },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: '#f1f5f9' },

    // Description
    descriptionCard: {
        backgroundColor: '#fff', marginHorizontal: spacing.md, marginTop: 12,
        borderRadius: 12, padding: spacing.lg,
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
    },
    descriptionText: { fontSize: 14, color: '#64748b', lineHeight: 22 },

    // Contact
    contactCard: {
        backgroundColor: '#fff', marginHorizontal: spacing.md, marginTop: 12,
        borderRadius: 12, padding: spacing.lg,
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
    },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    contactText: { fontSize: 14, color: '#475569' },

    // Categories
    categoryScroll: { marginTop: 16 },
    categoryContainer: { paddingHorizontal: spacing.md, gap: 8 },
    categoryChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    },
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryChipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
    categoryChipTextActive: { color: '#fff' },

    // Section
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },

    // Products
    productsSection: { paddingHorizontal: spacing.md, marginTop: 16 },
    productsSectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
    },
    productCount: { fontSize: 13, color: '#94a3b8' },
    productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    productCard: {
        width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 12,
        marginBottom: 14, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    productImage: { width: '100%', height: CARD_WIDTH * 0.85, backgroundColor: '#f1f5f9' },
    outOfStockBadge: {
        position: 'absolute', top: 8, right: 8,
        backgroundColor: 'rgba(239,68,68,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    outOfStockText: { fontSize: 10, fontWeight: '600', color: '#fff' },
    productInfo: { padding: 10 },
    productName: { fontSize: 13, fontWeight: '600', color: '#1e293b', lineHeight: 18, marginBottom: 4 },
    productCategory: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    productPrice: { fontSize: 15, fontWeight: '700', color: colors.primary },
    addToCartBtn: {
        backgroundColor: colors.primary, width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
    },
    addToCartBtnDisabled: { backgroundColor: '#cbd5e1' },

    // Empty state
    emptyProducts: { alignItems: 'center', paddingVertical: 48 },
    emptyProductsTitle: { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 12 },
    emptyProductsText: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
});