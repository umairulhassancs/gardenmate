import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StyleSheet,
    SafeAreaView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function CartScreen({ navigation }: any) {
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [productStocks, setProductStocks] = useState<Record<string, number>>({});

    // ✅ Vendor Shipping States
    const [vendorShipping, setVendorShipping] = useState<any>(null);
    const [loadingShipping, setLoadingShipping] = useState(true);

    // Fetch real-time stock for all cart products
    const fetchProductStocks = async (items: any[]) => {
        const stocks: Record<string, number> = {};
        await Promise.all(
            items.map(async (item) => {
                try {
                    const productRef = doc(db, 'products', item.productId);
                    const productSnap = await getDoc(productRef);
                    if (productSnap.exists()) {
                        stocks[item.productId] = productSnap.data().stock ?? 0;
                    } else {
                        stocks[item.productId] = 0;
                    }
                } catch (error) {
                    console.error('Error fetching stock for', item.productId, error);
                    stocks[item.productId] = 0;
                }
            })
        );
        setProductStocks(stocks);
    };

    // Real-time Cart Fetch from Firebase
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'cart'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                docId: doc.id,
                id: doc.data().productId,
                productId: doc.data().productId,
                name: doc.data().name,
                price: parseFloat(doc.data().price) || 0,
                quantity: doc.data().quantity || 1,
                image: doc.data().image,
                vendorId: doc.data().vendorId || 'default-vendor',
            }));

            setCartItems(items);
            await fetchProductStocks(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // ✅ Fetch Vendor Shipping when cart items change
    useEffect(() => {
        fetchVendorShipping();
    }, [cartItems]);

    const fetchVendorShipping = async () => {
        try {
            if (cartItems.length === 0) {
                setVendorShipping(null);
                setLoadingShipping(false);
                return;
            }

            const vendorId = cartItems[0]?.vendorId;
            if (!vendorId) {
                setLoadingShipping(false);
                return;
            }

            const shippingRef = doc(db, 'vendorShipping', vendorId);
            const shippingSnap = await getDoc(shippingRef);

            if (shippingSnap.exists()) {
                setVendorShipping(shippingSnap.data());
                console.log('✅ Vendor shipping loaded in cart:', shippingSnap.data());
            } else {
                // Default shipping if vendor hasn't set up
                setVendorShipping({
                    standardRate: 150,
                    outsideCityRate: 300,
                    freeShippingThreshold: 2000,
                    freeShippingEnabled: true,
                    vendorCity: ''
                });
            }
        } catch (error) {
            console.error('Error fetching vendor shipping:', error);
        } finally {
            setLoadingShipping(false);
        }
    };

    // Remove Item from Cart
    const handleRemoveItem = async (docId: string, productName: string) => {
        Alert.alert(
            'Remove Item',
            `Remove ${productName} from cart?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'cart', docId));
                            console.log('✅ Item removed from cart');
                        } catch (error) {
                            console.error('❌ Remove Error:', error);
                            Alert.alert('Error', 'Failed to remove item');
                        }
                    },
                },
            ]
        );
    };

    // Clear All Cart Items
    const handleClearCart = () => {
        Alert.alert(
            'Clear Cart',
            'Are you sure you want to remove all items?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const deletePromises = cartItems.map(item =>
                                deleteDoc(doc(db, 'cart', item.docId))
                            );
                            await Promise.all(deletePromises);
                            console.log('✅ Cart cleared');
                        } catch (error) {
                            console.error('❌ Clear Cart Error:', error);
                            Alert.alert('Error', 'Failed to clear cart');
                        }
                    },
                },
            ]
        );
    };

    // Update Quantity
    const updateQuantity = async (docId: string, newQuantity: number) => {
        if (newQuantity < 1) return;
        
        try {
            await updateDoc(doc(db, 'cart', docId), {
                quantity: newQuantity
            });
        } catch (error) {
            console.error('❌ Update Quantity Error:', error);
            Alert.alert('Error', 'Failed to update quantity');
        }
    };

    const incrementQuantity = (docId: string, currentQuantity: number, productId: string) => {
        const availableStock = productStocks[productId];
        if (availableStock !== undefined && currentQuantity >= availableStock) {
            Alert.alert('Limit Reached', `Only ${availableStock} items available in stock.`);
            return;
        }
        updateQuantity(docId, currentQuantity + 1);
    };

    const decrementQuantity = (docId: string, currentQuantity: number, productName: string) => {
        if (currentQuantity > 1) {
            updateQuantity(docId, currentQuantity - 1);
        } else {
            handleRemoveItem(docId, productName);
        }
    };

    // Calculate Totals
    const getItemCount = () => cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const getSubtotal = () => cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // ✅ Dynamic Shipping based on vendor settings
    const getShipping = () => {
        const subtotal = getSubtotal();

        if (!vendorShipping) {
            // Default shipping if no vendor settings
            return subtotal >= 2000 ? 0 : 150;
        }

        // Check for free shipping
        if (vendorShipping.freeShippingEnabled && subtotal >= vendorShipping.freeShippingThreshold) {
            return 0;
        }

        // Default to standard rate (actual city comparison happens in checkout)
        return vendorShipping.standardRate || 150;
    };

    const getTotal = () => getSubtotal() + getShipping();

    // ✅ Check if free shipping is available
    const isFreeShipping = () => {
        if (!vendorShipping?.freeShippingEnabled) return false;
        return getSubtotal() >= vendorShipping.freeShippingThreshold;
    };

    // ✅ Amount needed for free shipping
    const getAmountForFreeShipping = () => {
        if (!vendorShipping?.freeShippingEnabled) return 0;
        const remaining = vendorShipping.freeShippingThreshold - getSubtotal();
        return remaining > 0 ? remaining : 0;
    };

    // Checkout Handler
    const handleCheckout = () => {
        if (cartItems.length === 0) {
            Alert.alert('Cart Empty', 'Please add items to cart first');
            return;
        }

        // Check if any items are out of stock
        const outOfStockItems = cartItems.filter(item => {
            const stock = productStocks[item.productId];
            return stock !== undefined && stock <= 0;
        });

        if (outOfStockItems.length > 0) {
            const names = outOfStockItems.map(item => item.name).join(', ');
            Alert.alert(
                'Out of Stock Items',
                `Please remove out-of-stock items before checkout: ${names}`
            );
            return;
        }

        const checkoutData = {
            items: cartItems.map(item => ({
                id: item.productId,
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                vendorId: item.vendorId,
            })),
            subtotal: getSubtotal(),
            shipping: getShipping(),
            total: getTotal(),
        };

        console.log('🛒 Proceeding to checkout with:', checkoutData);
        navigation.navigate('Checkout', checkoutData);
    };

    // Loading State
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Shopping Cart</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading cart...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Empty Cart UI
    if (cartItems.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Shopping Cart</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.emptyContainer}>
                    <Feather name="shopping-cart" size={80} color="#ccc" />
                    <Text style={styles.emptyTitle}>Your cart is empty</Text>
                    <Text style={styles.emptyText}>
                        Add items to your cart to get started
                    </Text>
                    <TouchableOpacity
                        style={styles.shopNowBtn}
                        onPress={() => navigation.navigate('MainTabs', { screen: 'Shop' })}
                    >
                        <Text style={styles.shopNowBtnText}>Shop Now</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    

    // Cart with Items
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    Shopping Cart ({getItemCount()})
                </Text>
                <TouchableOpacity onPress={handleClearCart}>
                    <Feather name="trash-2" size={20} color="#ff4444" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Cart Items */}
                <View style={styles.itemsContainer}>
                {cartItems.map((item, index) => {
                    const uniqueKey = `cart-${item.docId}-${item.productId}-${index}`;
                    const stock = productStocks[item.productId];
                    const isOutOfStock = stock !== undefined && stock <= 0;

                    return (
                        <View key={uniqueKey} style={[styles.cartItem, isOutOfStock && { opacity: 0.6 }]}>
                                {/* Product Image */}
                                <Image
                                    source={{ uri: item.image || 'https://via.placeholder.com/150' }}
                                    style={styles.productImage}
                                    resizeMode="cover"
                                />

                                {/* Product Details */}
                                <View style={styles.productDetails}>
                                    <Text style={styles.productName} numberOfLines={2}>
                                        {item.name}
                                    </Text>

                                    {isOutOfStock && (
                                        <View style={styles.outOfStockLabel}>
                                            <Feather name="alert-circle" size={12} color="#ef4444" />
                                            <Text style={styles.outOfStockText}>Out of Stock</Text>
                                        </View>
                                    )}

                                    <Text style={styles.productPrice}>
                                        Rs. {item.price.toFixed(2)}
                                    </Text>

                                    {/* Quantity Controls */}
                                    <View style={styles.quantityContainer}>
                                        <TouchableOpacity
                                            style={styles.quantityBtn}
                                            onPress={() =>
                                                decrementQuantity(
                                                    item.docId,
                                                    item.quantity,
                                                    item.name
                                                )
                                            }
                                        >
                                            <Feather name="minus" size={16} color={colors.text} />
                                        </TouchableOpacity>

                                        <Text style={styles.quantityText}>
                                            {item.quantity}
                                        </Text>

                                        <TouchableOpacity
                                            style={[styles.quantityBtn, isOutOfStock && { opacity: 0.3 }]}
                                            onPress={() =>
                                                incrementQuantity(item.docId, item.quantity, item.productId)
                                            }
                                            disabled={isOutOfStock}
                                        >
                                            <Feather name="plus" size={16} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Item Total & Remove */}
                                <View style={styles.itemActions}>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveItem(item.docId, item.name)}
                                        style={styles.removeBtn}
                                    >
                                        <Feather name="x" size={20} color="#999" />
                                    </TouchableOpacity>

                                    <Text style={styles.itemTotal}>
                                        Rs. {(item.price * item.quantity).toFixed(2)}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Price Summary */}
                <View style={styles.summaryContainer}>
                    <Text style={styles.summaryTitle}>Order Summary</Text>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>
                            Subtotal ({getItemCount()} items)
                        </Text>
                        <Text style={styles.summaryValue}>
                            Rs. {getSubtotal().toFixed(2)}
                        </Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.summaryLabel}>Shipping</Text>
                            {isFreeShipping() && (
                                <View style={styles.freeBadge}>
                                    <Text style={styles.freeBadgeText}>FREE</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.summaryValue, isFreeShipping() && { color: '#10b981' }]}>
                            {isFreeShipping() ? 'FREE' : `Rs. ${getShipping().toFixed(0)}`}
                        </Text>
                    </View>

                    {/* ✅ Free Shipping Progress */}
                    {vendorShipping?.freeShippingEnabled && !isFreeShipping() && getSubtotal() > 0 && (
                        <View style={styles.freeShippingNotice}>
                            <Feather name="gift" size={16} color={colors.primary} />
                            <Text style={styles.freeShippingText}>
                                Add Rs. {getAmountForFreeShipping().toFixed(0)} more for FREE delivery!
                            </Text>
                        </View>
                    )}

                    {/* ✅ Shipping Info Note */}
                    {vendorShipping && (
                        <View style={styles.shippingNote}>
                            <Feather name="info" size={14} color="#8b5cf6" />
                            <Text style={styles.shippingNoteText}>
                                Standard: Rs. {vendorShipping.standardRate || 150} | Outside City: Rs. {vendorShipping.outsideCityRate || 300}
                            </Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.summaryRow}>
                        <Text style={styles.totalLabel}>Estimated Total</Text>
                        <Text style={styles.totalValue}>
                            Rs. {getTotal().toFixed(2)}
                        </Text>
                    </View>

                    <Text style={styles.estimateNote}>
                        * Final shipping will be calculated at checkout based on your delivery address
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Checkout Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.checkoutBtn}
                    onPress={handleCheckout}
                    activeOpacity={0.8}
                >
                    <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                    <Text style={styles.checkoutBtnPrice}>Rs. {getTotal().toFixed(2)}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    itemsContainer: { backgroundColor: '#fff', marginTop: 12 },
    cartItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fff' },
    productImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f5f5f5' },
    productDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
    productName: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 4 },
    productPrice: { fontSize: 16, fontWeight: '600', color: colors.primary, marginBottom: 8 },
    quantityContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 6, overflow: 'hidden' },
    quantityBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
    quantityText: { paddingHorizontal: 16, fontSize: 15, fontWeight: '500', color: colors.text },
    itemActions: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 8 },
    removeBtn: { padding: 4 },
    itemTotal: { fontSize: 16, fontWeight: '600', color: colors.text },
    summaryContainer: { backgroundColor: '#fff', marginTop: 12, padding: 20 },
    summaryTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 16 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    summaryLabel: { fontSize: 15, color: '#666' },
    summaryValue: { fontSize: 15, fontWeight: '500', color: colors.text },
    freeShippingNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f8ff', padding: 12, borderRadius: 8, marginVertical: 8, gap: 8 },
    freeShippingText: { fontSize: 13, color: colors.primary, flex: 1 },
    divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
    totalLabel: { fontSize: 17, fontWeight: '600', color: colors.text },
    totalValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#f0f0f0', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
    checkoutBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    checkoutBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    checkoutBtnPrice: { fontSize: 18, fontWeight: '700', color: '#fff' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    emptyTitle: { fontSize: 22, fontWeight: '600', color: colors.text, marginTop: 24, marginBottom: 8 },
    emptyText: { fontSize: 15, color: '#999', textAlign: 'center', marginBottom: 32 },
    shopNowBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
    shopNowBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

    // Out of stock styles
    outOfStockLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    outOfStockText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },

    // ✅ Shipping styles
    freeBadge: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
    freeBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#10b981' },
    shippingNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.08)', padding: 10, borderRadius: 8, marginTop: 8, gap: 8 },
    shippingNoteText: { fontSize: 11, color: '#8b5cf6', flex: 1 },
    estimateNote: { fontSize: 11, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' },
});