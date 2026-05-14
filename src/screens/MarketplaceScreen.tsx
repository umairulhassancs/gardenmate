import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, TextInput, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { useCart } from '../contexts/CartContext';
// Firebase Imports
import { db, auth } from '../services/firebaseConfig';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, getDocs, doc, updateDoc, increment } from 'firebase/firestore';

export default function MarketplaceScreen({ navigation }: any) {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [products, setProducts] = useState<any[]>([]);
    const [productRatings, setProductRatings] = useState<Record<string, { avg: number; count: number }>>({});
    const [wishlistIds, setWishlistIds] = useState<string[]>([]);
    const [cartItems, setCartItems] = useState<any[]>([]); // Firebase cart items
    const [loading, setLoading] = useState(true);

    const { getItemCount } = useCart();

    // Category mapping for broader filters
    const categoryMapping: Record<string, string[]> = {
        'Pots': ['Pots', 'Pots & Planters'],
        'Tools': ['Gardening Tools', 'Watering Tools'],
        'Flowers': ['Flowers', 'Flowering'],  // backward compat with old 'Flowering' category
    };

    // 1. Fetch Products from Firestore
    useEffect(() => {
        setLoading(true);
        const productsRef = collection(db, 'products');

        let q;
        if (activeCategory === 'All') {
            q = query(productsRef);
        } else if (activeCategory === 'AR') {
            q = query(productsRef, where('hasAR', '==', true));
        } else if (activeCategory === 'Deals') {
            q = query(productsRef, where('discount', '>', 0));
        } else if (activeCategory === 'Accessories') {
            q = query(productsRef, where('productType', '==', 'accessory'));
        } else if (categoryMapping[activeCategory]) {
            q = query(productsRef, where('category', 'in', categoryMapping[activeCategory]));
        } else {
            q = query(productsRef, where('category', '==', activeCategory));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [activeCategory]);

    // 1b. Fetch product ratings from reviews collection
    useEffect(() => {
        const fetchRatings = async () => {
            try {
                const reviewsSnap = await getDocs(collection(db, 'reviews'));
                const map: Record<string, { sum: number; count: number }> = {};
                reviewsSnap.forEach((d) => {
                    const pId = d.data().productId;
                    const r = d.data().rating || 0;
                    if (!pId) return;
                    if (!map[pId]) map[pId] = { sum: 0, count: 0 };
                    map[pId].sum += r;
                    map[pId].count += 1;
                });
                const out: Record<string, { avg: number; count: number }> = {};
                Object.keys(map).forEach((pid) => {
                    const m = map[pid];
                    out[pid] = { avg: m.count > 0 ? m.sum / m.count : 0, count: m.count };
                });
                setProductRatings(out);
            } catch {
                setProductRatings({});
            }
        };
        fetchRatings();
    }, []);

    // 2. Real-time Wishlist Sync
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, 'wishlist'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ids = snapshot.docs.map(doc => doc.data().productId);
            setWishlistIds(ids);
        });
        return () => unsubscribe();
    }, []);

    // 3. Real-time Cart Sync (Firebase se cart items)
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, 'cart'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                docId: doc.id,
                ...doc.data()
            }));
            setCartItems(items);
            console.log('🛒 Firebase Cart Items:', items);
        });
        return () => unsubscribe();
    }, []);

    // 4. Toggle Wishlist Function
    const handleToggleWishlist = async (product: any) => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Login Required", "Please login to add items to wishlist");
            return;
        }

        try {
            const wishlistRef = collection(db, 'wishlist');
            const q = query(wishlistRef, where('userId', '==', user.uid), where('productId', '==', product.id));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                await addDoc(wishlistRef, {
                    userId: user.uid,
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image || product.imageUrl || product.images?.[0] || '',
                    rating: product.rating || '4.5',
                    addedAt: new Date()
                });
            } else {
                snapshot.forEach(async (document) => {
                    await deleteDoc(doc(db, 'wishlist', document.id));
                });
            }
        } catch (error) {
            console.error("Wishlist Error:", error);
        }
    };

    // 5. Add to Cart Function (Firebase)
    const handleAddToCart = async (product: any) => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Login Required", "Please login to add items to cart");
            return;
        }

        // Stock check - prevent adding out-of-stock products
        if (product.stock !== undefined && product.stock <= 0) {
            Alert.alert("Out of Stock", `${product.name} is currently out of stock.`);
            return;
        }

        try {
            const cartRef = collection(db, 'cart');
            const q = query(cartRef, where('userId', '==', user.uid), where('productId', '==', product.id));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Add new item to cart
                await addDoc(cartRef, {
                    userId: user.uid,
                    productId: product.id,
                    name: product.name,
                    price: parseFloat(String(product.price || 0)),
                    image: product.image || product.images?.[0] || product.imageUrl || 'https://via.placeholder.com/150',
                    vendorId: product.vendorId || 'default-vendor',
                    productType: product.productType || 'plant',
                    quantity: 1,
                    addedAt: new Date()
                });
                Alert.alert("Success", `${product.name} added to cart!`);
            } else {
                // Item already exists, increment quantity
                const existingDoc = snapshot.docs[0];
                await updateDoc(doc(db, 'cart', existingDoc.id), {
                    quantity: increment(1)
                });
                Alert.alert("Success", `${product.name} quantity increased!`);
            }
        } catch (error) {
            console.error("Add to Cart Error:", error);
            Alert.alert("Error", "Failed to add item to cart");
        }
    };

    // Check if product is in cart
    const isInCart = (productId: string) => {
        return cartItems.some(item => item.productId === productId);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Marketplace</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Wishlist')}>
                        <Feather name="heart" size={20} color={colors.text} />
                        {wishlistIds.length > 0 && (
                            <View style={styles.wishlistBadge}>
                                <Text style={styles.badgeText}>{wishlistIds.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Cart')}>
                        <Feather name="shopping-cart" size={20} color={colors.text} />
                        {cartItems.length > 0 && (
                            <View style={styles.cartBadge}>
                                <Text style={styles.badgeText}>{cartItems.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Search Row */}
                <View style={styles.searchRow}>
                    <View style={styles.searchContainer}>
                        <Feather name="search" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity style={styles.imageSearchButton} onPress={() => navigation.navigate('ImageSearch')}>
                        <Feather name="camera" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
                    {['All', 'AR', 'Deals', 'Indoor', 'Flowers', 'Fruits', 'Vegetables', 'Herbs', 'Climbers', 'Seeds', 'Pots', 'Fertilizers', 'Accessories'].map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
                            onPress={() => setActiveCategory(cat)}
                        >
                            <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Products Grid */}
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
                ) : (
                    <View style={styles.productsGrid}>
                        {filteredProducts.map(product => {
                            const isFavorite = wishlistIds.includes(product.id);
                            const inCart = isInCart(product.id);
                            const isOutOfStock = product.stock !== undefined && product.stock <= 0;

                            return (
                                <View key={product.id} style={styles.productCard}>
                                    {/* Product Image - Clickable for Details */}
                                    <TouchableOpacity
                                        style={styles.productImageContainer}
                                        onPress={() => navigation.navigate('ProductDetail', {
                                            product: product
                                        })}
                                    >
                                        {/* Multi-image carousel or single image */}
                                        {(product.images && product.images.length > 1) ? (
                                            <View style={{ width: '100%', height: '100%' }}>
                                                <ScrollView
                                                    horizontal
                                                    pagingEnabled
                                                    showsHorizontalScrollIndicator={false}
                                                    style={{ width: '100%', height: '100%' }}
                                                >
                                                    {product.images.map((img: string, idx: number) => (
                                                        <Image
                                                            key={idx}
                                                            source={{ uri: img }}
                                                            style={[styles.productImage, isOutOfStock && { opacity: 0.5 }]}
                                                        />
                                                    ))}
                                                </ScrollView>
                                                {/* Dot indicators */}
                                                <View style={{ position: 'absolute', bottom: 6, alignSelf: 'center', flexDirection: 'row', gap: 4 }}>
                                                    {product.images.map((_: string, idx: number) => (
                                                        <View key={idx} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: idx === 0 ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                                                    ))}
                                                </View>
                                            </View>
                                        ) : (
                                            <Image
                                                source={{ uri: product.image || product.imageUrl || product.images?.[0] || 'https://via.placeholder.com/150' }}
                                                style={[styles.productImage, isOutOfStock && { opacity: 0.5 }]}
                                            />
                                        )}

                                        {/* AR Badge - Top Left */}
                                        {product.arModelUrl ? (
                                            <View style={styles.arBadge}>
                                                <Feather name="box" size={10} color="#fff" />
                                                <Text style={styles.arBadgeText}>AR</Text>
                                            </View>
                                        ) : null}

                                        {/* Discount Badge - Below AR or Top Left */}
                                        {product.discount && product.discount > 0 ? (
                                            <View style={[styles.discountBadge, { top: product.arModelUrl ? 36 : 8 }]}>
                                                <Text style={styles.discountBadgeText}>{product.discount}% OFF</Text>
                                            </View>
                                        ) : null}

                                        {/* Out of Stock Badge */}
                                        {isOutOfStock && (
                                            <View style={styles.outOfStockBadge}>
                                                <Text style={styles.outOfStockBadgeText}>Out of Stock</Text>
                                            </View>
                                        )}

                                        {/* Wishlist Heart Button */}
                                        <TouchableOpacity
                                            style={styles.heartButton}
                                            onPress={() => handleToggleWishlist(product)}
                                        >
                                            <Feather
                                                name="heart"
                                                size={16}
                                                color={isFavorite ? '#ef4444' : colors.textMuted}
                                                fill={isFavorite ? '#ef4444' : 'transparent'}
                                            />
                                        </TouchableOpacity>
                                    </TouchableOpacity>

                                    {/* Product Info */}
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productName} numberOfLines={1}>
                                            {product.name}
                                        </Text>
                                        <View style={styles.productMeta}>
                                            <View>
                                                <Text style={styles.productPrice}>
                                                    Rs. {product.discount && product.discount > 0
                                                        ? Math.round(product.price * (1 - product.discount / 100))
                                                        : product.price}
                                                </Text>
                                                {product.discount && product.discount > 0 ? (
                                                    <Text style={{ fontSize: 10, color: '#999', textDecorationLine: 'line-through' }}>
                                                        Rs. {product.price}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <View style={styles.ratingBadge}>
                                                <Feather name="star" size={10} color="#f59e0b" />
                                                <Text style={styles.ratingText}>
                                                    {productRatings[product.id] ? `${productRatings[product.id].avg.toFixed(1)} (${productRatings[product.id].count})` : '0.0 (0)'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Add to Cart Button */}
                                        <TouchableOpacity
                                            style={[
                                                styles.addToCartBtn,
                                                inCart && styles.addToCartBtnActive,
                                                isOutOfStock && styles.addToCartBtnDisabled
                                            ]}
                                            onPress={() => !isOutOfStock && handleAddToCart(product)}
                                            disabled={isOutOfStock}
                                        >
                                            <Feather
                                                name={isOutOfStock ? "x-circle" : inCart ? "check" : "shopping-cart"}
                                                size={14}
                                                color={isOutOfStock ? '#999' : inCart ? colors.primary : '#fff'}
                                            />
                                            <Text style={[
                                                styles.addToCartText,
                                                inCart && styles.addToCartTextActive,
                                                isOutOfStock && styles.addToCartTextDisabled
                                            ]}>
                                                {isOutOfStock ? 'Out of Stock' : inCart ? 'In Cart' : 'Add to Cart'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    title: { fontSize: fontSize['2xl'], fontWeight: 'bold', color: colors.text },
    headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerBtn: { position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    wishlistBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    cartBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    searchInput: { flex: 1, height: 48, fontSize: fontSize.base, color: colors.text },
    imageSearchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: spacing.sm, borderWidth: 1, borderColor: colors.primary },
    categoriesContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: 'rgba(243,244,246,0.8)', marginRight: spacing.sm },
    categoryChipActive: { backgroundColor: colors.primary },
    categoryText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textMuted },
    categoryTextActive: { color: '#fff' },
    productsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
    productCard: { width: '48%', margin: '1%', backgroundColor: '#fff', borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    productImageContainer: { aspectRatio: 1, backgroundColor: 'rgba(243,244,246,0.5)', position: 'relative' },
    productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heartButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
    productInfo: { padding: spacing.md },
    productName: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    productPrice: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.primary },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(243,244,246,0.8)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    ratingText: { fontSize: fontSize.xs, fontWeight: '500', color: colors.text, marginLeft: 2 },

    // Add to Cart Button Styles
    addToCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        marginTop: spacing.xs,
        gap: 6,
    },
    addToCartBtnActive: {
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    addToCartText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    addToCartTextActive: {
        color: colors.primary,
    },
    addToCartBtnDisabled: {
        backgroundColor: '#f0f0f0',
    },
    addToCartTextDisabled: {
        color: '#999',
    },
    outOfStockBadge: {
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        backgroundColor: 'rgba(239,68,68,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    outOfStockBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    arBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 3,
    },
    arBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    discountBadge: {
        position: 'absolute',
        left: 8,
        backgroundColor: 'rgba(239,68,68,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    discountBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
    },
});