import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, Dimensions, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { doc, setDoc, collection, getDoc, deleteDoc, query, where, getDocs, onSnapshot, addDoc, updateDoc, increment } from "firebase/firestore";
import { db, auth } from '../services/firebaseConfig';
import { Product } from '../data/marketplaceData';
import { useCart } from '../contexts/CartContext';
// Wishlist operations are handled directly via Firebase for real-time sync

const { width } = Dimensions.get('window');

interface Vendor {
    id: string;
    // Database fields
    storeName: string;
    logoUrl: string;
    email: string;
    description?: string;
    updatedAt?: string;

    // UI Compatibility fields (mapped during fetch)
    name: string;
    logo: string;

    // Stats fields
    rating: number;
    reviewsCount: number;
    totalSales?: number;
    responseTime?: string;
    isVerified: boolean;
}
// Review Type Definition
interface ProductReview {
    id: string;
    productId: string;
    customerName: string;
    customerAvatar: string;
    rating: number;
    title: string;
    text: string;
    date: string;
    verified: boolean;
    helpful: number;
    feedbackTypes?: string[];
}

export default function ProductDetailScreen({ navigation, route }: any) {
    const [product, setProduct] = useState<Product | null>(route.params?.product || null);
    const [loading, setLoading] = useState(!route.params?.product);
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [inCart, setInCart] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const { vendorId } = route.params;
    // VendorPublicStore screen ke andar
    const { vendorName } = route.params;

    useEffect(() => {
        console.log("Received Vendor ID:", vendorId); // Check karein console mein ID aa rahi hai ya nahi
        if (vendorId) {
            // Yahan aapka fetching logic hona chahiye
        }
    }, [vendorId]);
    // ✅ NEW STATES for Firebase data
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [vendorStats, setVendorStats] = useState<{ totalSales: number; rating: number; reviewsCount: number; responseTime: string } | null>(null);
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loadingVendor, setLoadingVendor] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);

    const { addToCart, isInCart } = useCart();

    const productId = route.params?.productId;

    // Fetch Product Data
    useEffect(() => {
        if (!product && productId) {
            const fetchProduct = async () => {
                try {
                    const docRef = doc(db, 'products', productId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
                    } else {
                        Alert.alert("Error", "Product not found in database");
                    }
                } catch (error) {
                    console.error("Firebase Fetch Error:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchProduct();
        }
    }, [productId]);

    useEffect(() => {
        if (!product?.vendorId) {
            setVendor(null);
            setLoadingVendor(false);
            return;
        }

        setLoadingVendor(true);
        const vendorRef = doc(db, 'vendors', product.vendorId);

        const unsubscribe = onSnapshot(vendorRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();

                // Database fields ko UI fields ke saath map kar rahe hain
                const formattedVendor: Vendor = {
                    id: snapshot.id,
                    ...data,
                    // Mapping DB fields to UI naming convention
                    name: data.storeName || 'Green Garden',
                    logo: data.logoUrl || 'https://via.placeholder.com/56',
                    storeName: data.storeName || 'Green Garden',
                    logoUrl: data.logoUrl || 'https://via.placeholder.com/56',
                    rating: data.rating || 0,
                    reviewsCount: data.reviewsCount || 0,
                    isVerified: data.isVerified || false,
                } as Vendor;

                setVendor(formattedVendor);
            } else {
                console.warn('Vendor Document Not Found:', product.vendorId);
                setVendor(null);
            }
            setLoadingVendor(false);
        }, (error) => {
            console.error('Vendor Listener Error:', error);
            setLoadingVendor(false);
        });

        return () => unsubscribe();
    }, [product?.vendorId]);

    // Fetch vendor stats (sales, rating, reviews, response time) from orders + feedbacks
    useEffect(() => {
        const vid = product?.vendorId || vendor?.id;
        if (!vid) {
            setVendorStats(null);
            return;
        }
        const fetchVendorStats = async () => {
            try {
                const [ordersSnap, feedbacksSnap] = await Promise.all([
                    getDocs(query(collection(db, 'orders'), where('vendorId', '==', vid))),
                    getDocs(query(collection(db, 'feedbacks'), where('vendorId', '==', vid))),
                ]);
                const totalSales = ordersSnap.size;
                const feedbacks = feedbacksSnap.docs.map((d) => d.data().rating || 0);
                const reviewsCount = feedbacks.length;
                const rating = reviewsCount > 0 ? feedbacks.reduce((s, r) => s + r, 0) / reviewsCount : 0;
                setVendorStats({
                    totalSales,
                    rating,
                    reviewsCount,
                    responseTime: vendor?.responseTime || (reviewsCount > 0 ? 'Within 24h' : '—'),
                });
            } catch {
                setVendorStats({ totalSales: 0, rating: 0, reviewsCount: 0, responseTime: '—' });
            }
        };
        fetchVendorStats();
    }, [product?.vendorId, vendor?.id, vendor?.responseTime]);

    // ✅ Fetch Reviews from Firebase
    useEffect(() => {
        if (!product?.id) {
            setLoadingReviews(false);
            return;
        }

        const fetchReviews = async () => {
            try {
                const reviewsQuery = query(
                    collection(db, 'reviews'),
                    where('productId', '==', product.id)
                );
                const reviewsSnap = await getDocs(reviewsQuery);

                const fetchedReviews: ProductReview[] = [];
                reviewsSnap.forEach((docSnap) => {
                    const data = docSnap.data() as any;
                    const feedbackTypes: string[] | undefined = Array.isArray(data.feedbackTypes)
                        ? data.feedbackTypes
                        : data.feedbackType
                            ? [data.feedbackType]
                            : undefined;

                    fetchedReviews.push({
                        id: docSnap.id,
                        ...(data as any),
                        feedbackTypes,
                    } as ProductReview);
                });

                setReviews(fetchedReviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
            } finally {
                setLoadingReviews(false);
            }
        };

        fetchReviews();
    }, [product?.id]);

    // ✅ REAL-TIME CART STATUS LISTENER
    useEffect(() => {
        if (!auth.currentUser || !product?.id) return;

        const cartQuery = query(
            collection(db, 'cart'),
            where('userId', '==', auth.currentUser.uid),
            where('productId', '==', product.id)
        );

        const unsubscribe = onSnapshot(cartQuery, (snapshot) => {
            setInCart(!snapshot.empty);
            console.log('🛒 Cart Status:', snapshot.empty ? 'Not in cart' : 'In cart');
        });

        return () => unsubscribe();
    }, [product?.id]);

    // Wishlist Status Listener - uses flat 'wishlist' collection
    useEffect(() => {
        if (!auth.currentUser || !product?.id) return;

        const wishlistQuery = query(
            collection(db, 'wishlist'),
            where('userId', '==', auth.currentUser.uid),
            where('productId', '==', product.id)
        );
        const unsubscribe = onSnapshot(wishlistQuery, (snapshot) => {
            setIsWishlisted(!snapshot.empty);
        });

        return () => unsubscribe();
    }, [product?.id]);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!product) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={48} color={colors.textMuted} />
                    <Text style={styles.errorText}>Product not found</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const isActuallyInStock = product.stock > 0;
    const currentStockCount = product.stock || 0;
    const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 2);
    const productRatingAvg = reviews.length > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
    const productReviewsCount = reviews.length;

    // ✅ ADD TO CART HANDLER
    const handleAddToCart = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Login Required", "Please login first");
            return;
        }

        try {
            const cartRef = collection(db, 'cart');
            const q = query(cartRef, where('userId', '==', user.uid), where('productId', '==', product.id));
            const snapshot = await getDocs(q);

            const imageUrl = product.image && product.image.startsWith('data:image')
                ? product.imageUrl || product.images?.[0] || 'https://via.placeholder.com/150'
                : product.image || product.images?.[0] || 'https://via.placeholder.com/150';

            if (snapshot.empty) {
                await addDoc(cartRef, {
                    userId: user.uid,
                    productId: product.id,
                    name: product.name,
                    price: parseFloat(String(product.price || 0)),
                    image: imageUrl,
                    vendorId: product.vendorId || 'default-vendor',
                    productType: product.productType || 'plant',
                    quantity: quantity,
                    addedAt: new Date()
                });
                Alert.alert("Success", "Added to cart!");
            } else {
                const existingDoc = snapshot.docs[0];
                await updateDoc(doc(db, 'cart', existingDoc.id), {
                    quantity: increment(quantity)
                });
                Alert.alert("Success", "Quantity increased!");
            }
        } catch (error) {
            console.error("Cart Error:", error);
            Alert.alert("Error", "Failed to add to cart");
        }
    };

    const handleToggleWishlist = async () => {
        if (!auth.currentUser) {
            Alert.alert("Login Required", "Please login to save items to your wishlist.");
            return;
        }

        const userId = auth.currentUser.uid;

        try {
            const wishlistRef = collection(db, 'wishlist');
            const q = query(wishlistRef, where('userId', '==', userId), where('productId', '==', product.id));
            const snapshot = await getDocs(q);

            if (isWishlisted && !snapshot.empty) {
                // Remove all matching docs
                snapshot.forEach(async (document) => {
                    await deleteDoc(doc(db, 'wishlist', document.id));
                });
                console.log("Removed from wishlist");
            } else if (!isWishlisted && snapshot.empty) {
                await addDoc(wishlistRef, {
                    userId: userId,
                    productId: product.id,
                    name: product.name,
                    price: Number(product.price || 0),
                    image: product.image || product.imageUrl,
                    rating: product.rating || '4.5',
                    addedAt: new Date()
                });
                console.log("Added to wishlist");
            }
        } catch (error) {
            console.error("Wishlist Error:", error);
        }
    };

    const handleVisitStore = () => {
        if (vendor?.id) {
            console.log("Sending ID:", vendor.id); // Check karein kya yahan ID hai?
            navigation.navigate('VendorPublicStore', {
                vendorId: vendor.id, // Key ka naam 'vendorId' hai
                vendorName: vendor.storeName
            });
        }
    };



    // ✅ Chat Handler
    const handleChat = () => {
        if (!auth.currentUser) {
            Alert.alert("Login Required", "Please login to chat with the vendor.");
            return;
        }
        if (vendor) {
            navigation.navigate('Chat', { vendor: vendor });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Image Section */}
                <View style={styles.imageSection}>
                    {product.images && Array.isArray(product.images) && product.images.filter(Boolean).length > 0 ? (
                        <>
                            <Image
                                source={{ uri: product.images.filter(Boolean)[activeImageIndex] || product.image || product.imageUrl }}
                                style={styles.productImage}
                                resizeMode="cover"
                            />
                            {product.images.filter(Boolean).length > 1 && (
                                <View style={styles.imageIndicators}>
                                    {product.images.filter(Boolean).map((_, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.indicator,
                                                activeImageIndex === index && styles.indicatorActive
                                            ]}
                                            onPress={() => setActiveImageIndex(index)}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (product.image || product.imageUrl || product.images?.[0]) ? (
                        <Image
                            source={{ uri: product.image || product.imageUrl || product.images?.[0] }}
                            style={styles.productImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={['#f3f4f6', '#e5e7eb']}
                            style={styles.imagePlaceholder}
                        >
                            <Feather name="image" size={60} color={colors.textMuted} />
                            <Text style={{ color: colors.textMuted, marginTop: 10 }}>No Image Available</Text>
                        </LinearGradient>
                    )}

                    {/* Top Controls */}
                    <View style={styles.topControls}>
                        <TouchableOpacity
                            style={styles.circleButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Feather name="arrow-left" size={20} color={colors.text} />
                        </TouchableOpacity>

                        <View style={styles.topRightButtons}>
                            <TouchableOpacity
                                style={styles.circleButton}
                                onPress={() => navigation.navigate('Cart')}
                            >
                                <Feather name="shopping-cart" size={20} color={colors.text} />
                                {inCart && <View style={styles.cartDot} />}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleButton} onPress={handleToggleWishlist}>
                                <Feather
                                    name="heart"
                                    size={22}
                                    color={isWishlisted ? "#ef4444" : colors.text}
                                    fill={isWishlisted ? "#ef4444" : "transparent"}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* AR Button */}
                    {Boolean(product.hasAR || product.arEnabled) && (
                        <TouchableOpacity
                            style={styles.arButton}
                            onPress={() => navigation.navigate('ARView', {
                                productId: product.id,
                                productName: product.name,
                                modelUrl: product.arModelUrl
                            })}
                        >
                            <Feather name="box" size={18} color={colors.text} style={{ marginRight: spacing.xs }} />
                            <Text style={styles.arText}>View in AR</Text>
                        </TouchableOpacity>
                    )}

                    {/* Sale Badge */}
                    {(product.originalPrice && Number(product.originalPrice) > Number(product.price)) ? (
                        <View style={styles.saleBadge}>
                            <Text style={styles.saleBadgeText}>
                                {Math.round((1 - (parseFloat(String(product.price)) / parseFloat(String(product.originalPrice)))) * 100)}% OFF
                            </Text>
                        </View>
                    ) : product.discountPercentage ? (
                        <View style={styles.saleBadge}>
                            <Text style={styles.saleBadgeText}>{product.discountPercentage}% OFF</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.content}>
                    {/* Title & Price */}
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.productName}>{product.name}</Text>
                            <View style={styles.ratingRow}>
                                <Feather name="star" size={14} color="#f59e0b" />
                                <Text style={styles.ratingValue}>{productRatingAvg.toFixed(1)}</Text>
                                <Text style={styles.reviewCount}>({productReviewsCount} reviews)</Text>
                            </View>
                            <View style={styles.tagsRow}>
                                {(product.tags || []).slice(0, 3).map((tag, index) => {
                                    const tagTheme = typeof getTagColor === 'function' ? getTagColor(tag) : { bg: '#f3f4f6', text: '#6b7280' };
                                    return (
                                        <View key={index} style={[styles.tag, { backgroundColor: tagTheme.bg }]}>
                                            <Text style={[styles.tagText, { color: tagTheme.text }]}>{tag}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                        <View>
                            <Text style={styles.price}>
                                Rs. {parseFloat(String(product.price || 0)).toFixed(0)}
                            </Text>
                            {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                                <Text style={styles.originalPrice}>
                                    Rs. {parseFloat(String(product.originalPrice)).toFixed(0)}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Stock & Shipping */}
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Feather
                                name={isActuallyInStock ? "check-circle" : "x-circle"}
                                size={16}
                                color={isActuallyInStock ? '#10b981' : '#ef4444'}
                            />
                            <Text style={[styles.infoText, { color: isActuallyInStock ? '#10b981' : '#ef4444' }]}>
                                {isActuallyInStock ? `${product.stock} in stock` : 'Out of stock'}
                            </Text>
                        </View>

                        <View style={styles.infoItem}>
                            <Feather name="truck" size={16} color={colors.textMuted} />
                            <Text style={styles.infoText}>
                                {product.freeShipping
                                    ? 'Free Shipping'
                                    : `Ships in ${product.shippingDays || '3-5'} days`}
                            </Text>
                        </View>
                    </View>

                    {/* Care Stats */}
                    {product.careInfo && (
                        <View style={styles.statsRow}>
                            <View style={[styles.statCard, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                <Feather name="droplet" size={24} color="#3b82f6" style={{ marginBottom: spacing.xs }} />
                                <Text style={styles.statLabel}>{product.careInfo.water || 'Moderate'}</Text>
                            </View>

                            <View style={[styles.statCard, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                                <Feather name="sun" size={24} color="#f97316" style={{ marginBottom: spacing.xs }} />
                                <Text style={styles.statLabel}>{product.careInfo.light || 'Indirect'}</Text>
                            </View>

                            <View style={[styles.statCard, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Feather name="thermometer" size={24} color="#ef4444" style={{ marginBottom: spacing.xs }} />
                                <Text style={styles.statLabel}>{product.careInfo.temperature || 'Room Temp'}</Text>
                            </View>
                        </View>
                    )}

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Description</Text>
                        <Text style={styles.description}>{product.description || 'No description available.'}</Text>
                    </View>

                    {/* ✅ VENDOR CARD - FROM FIREBASE WITH SAFE CHECKS */}
                    {vendor && !loadingVendor && (
                        <View style={styles.vendorCard}>
                            <TouchableOpacity style={styles.vendorHeader} onPress={handleVisitStore} activeOpacity={0.8}>
                                {/* Logo field updated to logoUrl */}
                                <Image
                                    source={{ uri: vendor.logoUrl || 'https://via.placeholder.com/56' }}
                                    style={styles.vendorLogo}
                                />

                                <View style={styles.vendorInfo}>
                                    <View style={styles.vendorNameRow}>
                                        {/* Name field updated to storeName */}
                                        <Text style={styles.vendorName}>{vendor.storeName || 'Green Garden'}</Text>

                                        {vendor.isVerified && (
                                            <View style={styles.verifiedBadge}>
                                                <Feather name="check" size={10} color="#fff" />
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.vendorStatsRow}>
                                        <Feather name="star" size={12} color="#f59e0b" />
                                        <Text style={styles.vendorRating}>{(vendorStats?.rating ?? vendor?.rating ?? 0).toFixed(1)}</Text>
                                        <Text style={styles.vendorReviews}>({vendorStats?.reviewsCount ?? vendor?.reviewsCount ?? 0} reviews)</Text>
                                    </View>
                                </View>
                                <Feather name="chevron-right" size={20} color={colors.textMuted} />
                            </TouchableOpacity>

                            <View style={styles.vendorMetaRow}>
                                <View style={styles.vendorMeta}>
                                    <Feather name="package" size={14} color={colors.textMuted} />
                                    <Text style={styles.vendorMetaText}>
                                        {(vendorStats?.totalSales ?? vendor?.totalSales ?? 0).toLocaleString()} sales
                                    </Text>
                                </View>
                                <View style={styles.vendorMeta}>
                                    <Feather name="clock" size={14} color={colors.textMuted} />
                                    <Text style={styles.vendorMetaText}>{vendorStats?.responseTime ?? vendor?.responseTime ?? '—'}</Text>
                                </View>
                            </View>

                            {/* Chat & Visit Store Buttons */}
                            <View style={styles.vendorActions}>
                                <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
                                    <Feather name="message-circle" size={18} color={colors.primary} />
                                    <Text style={styles.chatButtonText}>Chat with Seller</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.visitButton} onPress={handleVisitStore}>
                                    <Feather name="shopping-bag" size={18} color="#fff" />
                                    <Text style={styles.visitButtonText}>Visit Store</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ✅ CUSTOMER REVIEWS - FROM FIREBASE WITH SAFE CHECKS */}
                    {!loadingReviews && reviews.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.reviewsHeader}>
                                <Text style={styles.sectionTitle}>Customer Reviews</Text>
                                <View style={styles.reviewsSummary}>
                                    <Feather name="star" size={16} color="#f59e0b" />
                                    <Text style={styles.reviewsAvg}>{productRatingAvg.toFixed(1)}</Text>
                                    <Text style={styles.reviewsCount}>({productReviewsCount})</Text>
                                </View>
                            </View>

                            {displayedReviews.map(review => (
                                <View key={review.id} style={styles.reviewCard}>
                                    <View style={styles.reviewHeader}>
                                        <Image
                                            source={{ uri: review.customerAvatar || 'https://via.placeholder.com/40' }}
                                            style={styles.reviewerAvatar}
                                        />
                                        <View style={styles.reviewerInfo}>
                                            <View style={styles.reviewerNameRow}>
                                                <Text style={styles.reviewerName}>{review.customerName || 'Anonymous'}</Text>
                                                {review.verified && (
                                                    <View style={styles.verifiedPurchase}>
                                                        <Feather name="check" size={10} color="#10b981" />
                                                        <Text style={styles.verifiedText}>Verified</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.reviewDate}>{review.date || 'Recently'}</Text>
                                        </View>
                                        <View style={styles.reviewRating}>
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Feather
                                                    key={star}
                                                    name="star"
                                                    size={12}
                                                    color={star <= (review.rating || 0) ? '#f59e0b' : '#e5e7eb'}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={styles.reviewText}>{review.text || review.title || 'No review text'}</Text>

                                    {review.feedbackTypes && review.feedbackTypes.length > 0 && (
                                        <View style={styles.feedbackTypesRow}>
                                            <Text style={styles.feedbackTypesLabel}>Feedback on:</Text>
                                            <View style={styles.feedbackTypesChips}>
                                                {review.feedbackTypes.map((ft) => (
                                                    <View key={ft} style={styles.feedbackTypeChip}>
                                                        <Text style={styles.feedbackTypeChipText}>
                                                            {ft.charAt(0).toUpperCase() + ft.slice(1)}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                    
                                </View>
                            ))}

                            {reviews.length > 2 && (
                                <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowAllReviews(!showAllReviews)}>
                                    <Text style={styles.viewAllText}>{showAllReviews ? 'Show Less' : `View All ${reviews.length} Reviews`}</Text>
                                    <Feather name={showAllReviews ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Policy Card */}
                    <View style={styles.policyCard}>
                        <View style={styles.policyItem}>
                            <Feather name="refresh-cw" size={18} color={colors.primary} />
                            <View style={styles.policyInfo}>
                                <Text style={styles.policyTitle}>30-Day Returns</Text>
                                <Text style={styles.policyDesc}>Hassle-free return policy</Text>
                            </View>
                        </View>
                        <View style={styles.policyDivider} />
                        <View style={styles.policyItem}>
                            <Feather name="shield" size={18} color={colors.primary} />
                            <View style={styles.policyInfo}>
                                <Text style={styles.policyTitle}>Plant Guarantee</Text>
                                <Text style={styles.policyDesc}>Healthy arrival guaranteed</Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ height: 120 }} />
                </View>
            </ScrollView>

            {/* ✅ BOTTOM BAR */}
            <View style={styles.bottomBar}>
                {!inCart ? (
                    <>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity
                                style={styles.qtyButton}
                                onPress={() => quantity > 1 && setQuantity(q => q - 1)}
                            >
                                <Feather name="minus" size={18} color={colors.text} />
                            </TouchableOpacity>

                            <Text style={styles.qtyText}>{quantity}</Text>

                            <TouchableOpacity
                                style={[
                                    styles.qtyButton,
                                    styles.qtyButtonPlus,
                                    (!isActuallyInStock || quantity >= currentStockCount) && { opacity: 0.5 }
                                ]}
                                onPress={() => {
                                    if (quantity < currentStockCount || currentStockCount === 0) {
                                        setQuantity(q => q + 1);
                                    } else {
                                        Alert.alert("Limit Reached", `Only ${currentStockCount} items available in stock.`);
                                    }
                                }}
                                disabled={!isActuallyInStock || (currentStockCount > 0 && quantity >= currentStockCount)}
                            >
                                <Feather name="plus" size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.addToCartButton,
                                !isActuallyInStock && styles.addToCartDisabled
                            ]}
                            onPress={handleAddToCart}
                            disabled={!isActuallyInStock}
                        >
                            <Feather
                                name="shopping-cart"
                                size={18}
                                color="#fff"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.addToCartText}>
                                {isActuallyInStock
                                    ? `Add to Cart • Rs. ${(parseFloat(String(product.price || 0)) * quantity).toFixed(0)}`
                                    : 'Out of Stock'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.reviewRating}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Feather
                                    key={`product-star-${star}`}
                                    name="star"
                                    size={14}
                                    color={star <= productRatingAvg ? '#f59e0b' : '#e5e7eb'}
                                    fill={star <= productRatingAvg ? '#f59e0b' : 'transparent'}
                                />
                            ))}
                            <Text style={{ marginLeft: 8, color: colors.textMuted }}>
                                Item already in cart
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.addToCartButton, { flex: 1 }]}
                            onPress={() => navigation.navigate('Cart')}
                        >
                            <Feather name="shopping-bag" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.addToCartText}>View Cart</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

function getTagColor(tag: string) {
    const colors: Record<string, { bg: string; text: string }> = {
        'Indoor': { bg: 'rgba(16,185,129,0.1)', text: '#047857' },
        'Outdoor': { bg: 'rgba(59,130,246,0.1)', text: '#1d4ed8' },
        'Tropical': { bg: 'rgba(249,115,22,0.1)', text: '#c2410c' },
        'Flowering': { bg: 'rgba(236,72,153,0.1)', text: '#be185d' },
        'Rare': { bg: 'rgba(139,92,246,0.1)', text: '#7c3aed' },
        'Air Purifying': { bg: 'rgba(20,184,166,0.1)', text: '#0d9488' },
        'Beginner': { bg: 'rgba(34,197,94,0.1)', text: '#15803d' },
        'Low Maintenance': { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
        'Succulent': { bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
        'Cactus': { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' },
    };
    return colors[tag] || { bg: 'rgba(107,114,128,0.1)', text: '#4b5563' };
}

const styles = StyleSheet.create({
    reviewRating: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        marginRight: spacing.sm,
    },
    qtyButtonPlus: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: borderRadius.md,
        padding: 4,
        marginRight: spacing.md,
    },
    qtyButton: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.sm,
        backgroundColor: '#fff',
    },
    qtyText: {
        fontSize: fontSize.md,
        fontWeight: 'bold',
        paddingHorizontal: spacing.md,
        color: colors.text,
    },
    addToCartDisabled: {
        backgroundColor: colors.textMuted,
        opacity: 0.6,
    },
    container: { flex: 1, backgroundColor: '#fdfdfd' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    errorText: { fontSize: fontSize.lg, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xl },
    backButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    imageSection: { height: 380, position: 'relative', backgroundColor: '#f0f0f0' },
    productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
    imageIndicators: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    indicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
    indicatorActive: { backgroundColor: '#fff', width: 20 },
    topControls: { position: 'absolute', top: spacing.xl + 10, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
    topRightButtons: { flexDirection: 'row', gap: 10 },
    circleButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    cartDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#fff' },
    arButton: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 5 },
    arText: { fontSize: 12, fontWeight: 'bold', color: colors.text, marginLeft: 4 },
    saleBadge: { position: 'absolute', top: spacing.xl + 70, left: spacing.lg, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, zIndex: 5 },
    saleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    content: { padding: spacing.lg, marginTop: -30, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, alignItems: 'flex-start' },
    productName: { fontSize: 24, fontWeight: '800', color: colors.text, flex: 1, marginRight: 10 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    ratingValue: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginLeft: 4 },
    reviewCount: { fontSize: 14, color: colors.textMuted, marginLeft: 2 },
    tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    tagText: { fontSize: 11, fontWeight: '700' },
    price: { fontSize: 26, fontWeight: '900', color: colors.primary },
    originalPrice: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through', textAlign: 'right' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9fafb', padding: 16, borderRadius: 16, marginVertical: 20, borderWidth: 1, borderColor: '#f1f5f9' },
    infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    infoText: { fontSize: 13, fontWeight: '600' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    statLabel: { fontSize: 11, fontWeight: 'bold', color: colors.text, marginTop: 6, textAlign: 'center' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    description: { fontSize: 15, lineHeight: 24, color: '#4b5563' },

    // ✅ Vendor Card Styles
    vendorCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24, overflow: 'hidden' },
    vendorHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    vendorLogo: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f3f4f6' },
    vendorInfo: { flex: 1, marginLeft: 12 },
    vendorNameRow: { flexDirection: 'row', alignItems: 'center' },
    vendorName: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    verifiedBadge: { marginLeft: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    vendorStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    vendorRating: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginLeft: 4 },
    vendorReviews: { fontSize: 12, color: colors.textMuted, marginLeft: 4 },
    vendorMetaRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 16 },
    vendorMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    vendorMetaText: { fontSize: 12, color: colors.textMuted },
    vendorActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
    chatButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderRightWidth: 1, borderRightColor: '#e5e7eb' },
    chatButtonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    visitButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, backgroundColor: colors.primary },
    visitButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },

    // ✅ Reviews Styles
    reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    reviewsSummary: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    reviewsAvg: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    reviewsCount: { fontSize: 14, color: colors.textMuted },
    reviewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    reviewerAvatar: { width: 40, height: 40, borderRadius: 20 },
    reviewerInfo: { flex: 1, marginLeft: 12 },
    reviewerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reviewerName: { fontSize: 14, fontWeight: '600', color: colors.text },
    verifiedPurchase: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    verifiedText: { fontSize: 10, color: '#10b981', fontWeight: '500' },
    reviewDate: { fontSize: 12, color: colors.textMuted },
    reviewRating: { flexDirection: 'row' },
    reviewTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    reviewText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    feedbackTypesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
    feedbackTypesLabel: { fontSize: 11, color: colors.textMuted, marginRight: 6 },
    feedbackTypesChips: { flexDirection: 'row', flexWrap: 'wrap' },
    feedbackTypeChip: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginTop: 2 },
    feedbackTypeChipText: { fontSize: 11, color: colors.text },
    reviewFooter: { flexDirection: 'row', marginTop: 8 },
    helpfulBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    helpfulText: { fontSize: 12, color: colors.textMuted },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
    viewAllText: { fontSize: 14, fontWeight: '600', color: colors.primary },

    policyCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(229,231,235,0.5)',
        marginBottom: spacing.xl
    },
    policyItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm
    },
    policyDivider: {
        width: 1,
        backgroundColor: 'rgba(229,231,235,0.5)',
        marginHorizontal: spacing.md
    },
    policyInfo: { flex: 1 },
    policyTitle: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.text
    },
    policyDesc: {
        fontSize: fontSize.xs,
        color: colors.textMuted
    },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 34, flexDirection: 'row', gap: 12, borderTopLeftRadius: 30, borderTopRightRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 25 },
    addToCartButton: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center' },
    addToCartText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});