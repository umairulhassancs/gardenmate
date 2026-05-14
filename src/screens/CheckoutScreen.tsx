import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import { useUser } from '../contexts/UserContext';
import { useOrders } from '../contexts/OrderContext';
import { useCart } from '../contexts/CartContext';
import { serverTimestamp, increment, runTransaction, writeBatch, collection, addDoc, query, where, getDocs, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebaseConfig';
import { calculateShippingRate, type Coordinates } from '../services/locationService';
import { notifyVendor } from '../services/notifyHelper';

// Generate professional order ID: GM-YYYYMMDD-XXXX
const generateOrderId = (): string => {
    const now = new Date();
    const date = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `GM-${date}-${code}`;
};

export default function CheckoutScreen({ navigation, route }: any) {
    const {
        items: navItems = [],
        subtotal: navSubtotal = 0,
        shipping: navShipping = 0,
        total: navTotal = 0
    } = route.params || {};

    const { clearCart } = useCart();
    const { addresses: contextAddresses, addAddress, profile, loading: userLoading } = useUser();
    const { addOrder } = useOrders();

    const [addresses, setAddresses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    const [saveNewAddress, setSaveNewAddress] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [placingOrder, setPlacingOrder] = useState(false);

    // ✅ Shipping calculation states
    const [vendorShipping, setVendorShipping] = useState<any>(null);
    const [calculatedShipping, setCalculatedShipping] = useState(navShipping);
    const [shippingType, setShippingType] = useState<'standard' | 'outside' | 'free'>('standard');
    const [loadingShipping, setLoadingShipping] = useState(true);
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [customerCoords, setCustomerCoords] = useState<Coordinates | null>(null);

    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        notes: '',
    });

    // Addresses fetch karein Firebase se
    useEffect(() => {
        fetchAddresses();
        fetchVendorShipping();
    }, []);

    // ✅ Fetch vendor's shipping settings
    const fetchVendorShipping = async () => {
        try {
            if (!navItems || navItems.length === 0) return;

            const vendorId = navItems[0].vendorId;
            if (!vendorId) return;

            const shippingRef = doc(db, 'vendorShipping', vendorId);
            const shippingSnap = await getDoc(shippingRef);

            if (shippingSnap.exists()) {
                setVendorShipping(shippingSnap.data());
                console.log('✅ Vendor shipping settings loaded:', shippingSnap.data());
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

    // ✅ Calculate shipping when address/coords change or vendor shipping loads
    useEffect(() => {
        doCalculateShipping();
    }, [formData.city, vendorShipping, navSubtotal, customerCoords]);

    const doCalculateShipping = () => {
        if (!vendorShipping) return;

        // Use the distance-based shipping calculator from locationService
        const result = calculateShippingRate(
            {
                latitude: vendorShipping.latitude,
                longitude: vendorShipping.longitude,
                radiusKm: vendorShipping.radiusKm || 10,
                standardRate: vendorShipping.standardRate || 150,
                outsideCityRate: vendorShipping.outsideCityRate || 300,
                freeShippingThreshold: vendorShipping.freeShippingThreshold || 2000,
                freeShippingEnabled: vendorShipping.freeShippingEnabled,
                vendorCity: vendorShipping.vendorCity,
            },
            customerCoords,
            navSubtotal
        );

        // If no coordinates available, fallback to city-name matching
        if (!result.distanceKm && result.type !== 'free') {
            const customerCity = formData.city.trim().toLowerCase();
            const vendorCity = (vendorShipping.vendorCity || '').trim().toLowerCase();

            if (customerCity && vendorCity && customerCity === vendorCity) {
                setCalculatedShipping(vendorShipping.standardRate || 150);
                setShippingType('standard');
                setDistanceKm(null);
                console.log('🚚 Fallback: Standard shipping (same city)');
                return;
            } else if (customerCity) {
                setCalculatedShipping(vendorShipping.outsideCityRate || 300);
                setShippingType('outside');
                setDistanceKm(null);
                console.log('🚀 Fallback: Outside city shipping');
                return;
            }
        }

        setCalculatedShipping(result.rate);
        setShippingType(result.type);
        setDistanceKm(result.distanceKm);
        console.log(`📏 Shipping: ${result.description} → Rs. ${result.rate}`);
    };

    const fetchAddresses = async () => {
        try {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }

            const addressesRef = collection(db, 'addresses');
            const q = query(addressesRef, where('userId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);

            const fetchedAddresses: any[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('Fetched Addresses:', fetchedAddresses);
            setAddresses(fetchedAddresses);

            if (fetchedAddresses.length === 0) {
                setShowNewAddressForm(true);
            } else {
                const firstAddr = fetchedAddresses[0];
                setSelectedAddressId(firstAddr.id);
                const newFormData = {
                    fullName: firstAddr.fullName || '',
                    phone: firstAddr.phone || '',
                    address: firstAddr.street || '',
                    city: firstAddr.city || '',
                    state: firstAddr.state || '',
                    postalCode: firstAddr.postalCode || '',
                    notes: ''
                };
                setFormData(newFormData);

                // ✅ Set customer coordinates for distance calculation
                if (firstAddr.latitude && firstAddr.longitude) {
                    setCustomerCoords({ latitude: firstAddr.latitude, longitude: firstAddr.longitude });
                    console.log('📍 Address loaded with GPS:', firstAddr.latitude, firstAddr.longitude);
                } else {
                    setCustomerCoords(null);
                    console.log('📍 Address loaded (no GPS), city:', firstAddr.city);
                }
            }
        } catch (error) {
            console.error('Error fetching addresses:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const handlePlaceOrder = async () => {
        if (placingOrder) return; // Prevent double-tap

        try {
            setPlacingOrder(true);

            if (!navItems || navItems.length === 0) {
                Alert.alert("Error", "Your cart is empty");
                setPlacingOrder(false);
                return;
            }

            // Validation
            if (!formData.address || !formData.city || !formData.fullName) {
                Alert.alert("Error", "Please fill all required delivery fields");
                setPlacingOrder(false);
                return;
            }

            if (!auth.currentUser) {
                Alert.alert("Error", "Please login to place order");
                setPlacingOrder(false);
                return;
            }

            const currentVendorId = navItems[0].vendorId;

            // Agar naya address save karna hai
            if (showNewAddressForm && saveNewAddress) {
                const newAddr = {
                    userId: auth.currentUser.uid,
                    fullName: formData.fullName,
                    phone: formData.phone,
                    street: formData.address,
                    city: formData.city,
                    state: formData.state || '',
                    postalCode: formData.postalCode,
                    label: 'Home',
                    createdAt: serverTimestamp(),
                };

                const docRef = await addDoc(collection(db, 'addresses'), newAddr);
                console.log('New address saved with ID:', docRef.id);

                // Refresh addresses
                await fetchAddresses();
            }

            // Generate professional order ID
            const orderId = generateOrderId();

            // Order Payload with calculated shipping
            const finalTotal = navSubtotal + calculatedShipping;
            const orderPayload = {
                orderId,
                vendorId: currentVendorId,
                status: 'pending',
                createdAt: serverTimestamp(),
                total: finalTotal,
                customerName: formData.fullName,
                customerEmail: auth.currentUser.email || 'Guest',
                customerPhone: formData.phone || '',
                shippingAddress: `${formData.address}, ${formData.city}, ${formData.state} ${formData.postalCode}`,
                addressDetails: {
                    street: formData.address,
                    city: formData.city,
                    state: formData.state || '',
                    postalCode: formData.postalCode,
                },
                paymentMethod: 'cod',
                items: navItems.map((item: any) => ({
                    id: item.id || item.productId,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image || '',
                    vendorId: item.vendorId,
                })),
                subtotal: navSubtotal,
                shipping: calculatedShipping,
                shippingType: shippingType,
                userId: auth.currentUser.uid
            };

            const orderRef = await addDoc(collection(db, 'orders'), orderPayload);

            if (orderRef.id) {
                // ✅ Notify Vendor
                try {
                    const finalTotalStr = finalTotal.toFixed(2);
                    await notifyVendor(
                        currentVendorId,
                        'New Order! 🚀',
                        `You have a new order from ${formData.fullName} worth Rs. ${finalTotalStr}`,
                        'order',
                        orderRef.id,
                        {
                            orderId: orderId,
                            orderTotal: finalTotal
                        }
                    );
                } catch (notifyError) {
                    console.error('Failed to notify vendor:', notifyError);
                }
            }
            // ✅ 1. Update stock for each product in the order
            console.log('📦 Updating stock for ordered items...');
            for (const item of navItems) {
                const productId = item.id || item.productId;
                if (productId) {
                    try {
                        const productRef = doc(db, 'products', productId);
                        const productSnap = await getDoc(productRef);

                        if (productSnap.exists()) {
                            const currentStock = productSnap.data().stock || 0;
                            const currentSold = productSnap.data().sold || 0;
                            const newStock = Math.max(0, currentStock - item.quantity);

                            // Calculate new status based on stock
                            let newStatus = 'active';
                            if (newStock === 0) {
                                newStatus = 'out-of-stock';
                            } else if (newStock <= 20) {
                                newStatus = 'low-stock';
                            }

                            await updateDoc(productRef, {
                                stock: newStock,
                                sold: currentSold + item.quantity,
                                status: newStatus
                            });

                            // Low Stock Alert
                            if (newStock <= 5) {
                                await notifyVendor(
                                    currentVendorId,
                                    'Low Stock Alert ⚠️',
                                    `Product "${item.name}" is running low (${newStock} left).`,
                                    'inventory',
                                    productId
                                );
                            }

                            console.log(`✅ Stock updated for ${item.name}: ${currentStock} -> ${newStock}, Sold: ${currentSold} -> ${currentSold + item.quantity}`);
                        }
                    } catch (stockError) {
                        console.error(`❌ Failed to update stock for product ${productId}:`, stockError);
                    }
                }
            }

            // ✅ 2. Clear cart from Firebase (not just local state)
            console.log('🛒 Clearing cart from Firebase...');
            try {
                const cartQuery = query(
                    collection(db, 'cart'),
                    where('userId', '==', auth.currentUser.uid)
                );
                const cartSnapshot = await getDocs(cartQuery);

                const deletePromises = cartSnapshot.docs.map(cartDoc =>
                    deleteDoc(doc(db, 'cart', cartDoc.id))
                );
                await Promise.all(deletePromises);
                console.log(`✅ Cleared ${cartSnapshot.docs.length} items from Firebase cart`);
            } catch (cartError) {
                console.error('❌ Failed to clear Firebase cart:', cartError);
            }

            // Also clear local cart state
            clearCart();

            Alert.alert("Success", "Order placed successfully!");
            navigation.navigate('OrderConfirmation', {
                orderNumber: orderId,
                total: finalTotal,
                items: navItems.length,
                address: `${formData.address}, ${formData.city}, ${formData.state} ${formData.postalCode}`,
                phone: formData.phone || '',
            });
        } catch (error) {
            console.error("Order Placement Error:", error);
            Alert.alert("Error", "Failed to place order. Please try again.");
            setPlacingOrder(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10 }}>Loading addresses...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Checkout</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Saved Addresses */}
                {addresses.length > 0 && !showNewAddressForm && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIcon}>
                                <Feather name="map-pin" size={18} color={colors.primary} />
                            </View>
                            <Text style={styles.sectionTitle}>Delivery Address</Text>
                        </View>

                        {addresses.map(addr => (
                            <TouchableOpacity
                                key={addr.id}
                                style={[styles.addressCard, selectedAddressId === addr.id && styles.addressCardSelected]}
                                onPress={() => {
                                    setSelectedAddressId(addr.id);
                                    setFormData({
                                        fullName: addr.fullName || '',
                                        phone: addr.phone || '',
                                        address: addr.street || '',
                                        city: addr.city || '',
                                        state: addr.state || '',
                                        postalCode: addr.postalCode || '',
                                        notes: ''
                                    });
                                    // ✅ Update customer coordinates
                                    if (addr.latitude && addr.longitude) {
                                        setCustomerCoords({ latitude: addr.latitude, longitude: addr.longitude });
                                    } else {
                                        setCustomerCoords(null);
                                    }
                                }}
                            >
                                <View style={selectedAddressId === addr.id ? styles.radioSelected : styles.radio}>
                                    {selectedAddressId === addr.id && <View style={styles.radioDot} />}
                                </View>
                                <View style={styles.addressInfo}>
                                    <Text style={styles.addressLabel}>{addr.label || 'Home'}</Text>
                                    <Text style={styles.addressName}>{addr.fullName}</Text>
                                    <Text style={styles.addressText}>{addr.street}</Text>
                                    <Text style={styles.addressText}>
                                        {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postalCode}
                                    </Text>
                                    {addr.phone && <Text style={styles.addressPhone}>{addr.phone}</Text>}
                                </View>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={styles.addNewBtn}
                            onPress={() => {
                                setShowNewAddressForm(true);
                                setSelectedAddressId(null);
                                setFormData({
                                    fullName: '',
                                    phone: '',
                                    address: '',
                                    city: '',
                                    state: '',
                                    postalCode: '',
                                    notes: ''
                                });
                            }}
                        >
                            <Feather name="plus" size={18} color={colors.primary} />
                            <Text style={styles.addNewText}>Use a different address</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* New Address Form */}
                {(showNewAddressForm || addresses.length === 0) && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIcon}>
                                <Feather name="map-pin" size={18} color={colors.primary} />
                            </View>
                            <Text style={styles.sectionTitle}>Delivery Information</Text>
                            {addresses.length > 0 && (
                                <TouchableOpacity onPress={() => {
                                    setShowNewAddressForm(false);
                                    // Pehla address dobara select karein
                                    if (addresses.length > 0) {
                                        const firstAddr = addresses[0];
                                        setSelectedAddressId(firstAddr.id);
                                        setFormData({
                                            fullName: firstAddr.fullName || '',
                                            phone: firstAddr.phone || '',
                                            address: firstAddr.street || '',
                                            city: firstAddr.city || '',
                                            state: firstAddr.state || '',
                                            postalCode: firstAddr.postalCode || '',
                                            notes: ''
                                        });
                                    }
                                }}>
                                    <Text style={{ color: 'red', fontSize: 14 }}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TextInput
                            style={[styles.input, errors.fullName && styles.inputError]}
                            placeholder="Full Name *"
                            value={formData.fullName}
                            onChangeText={v => updateField('fullName', v)}
                        />
                        <TextInput
                            style={[styles.input, { marginTop: 12 }, errors.phone && styles.inputError]}
                            placeholder="Phone Number"
                            value={formData.phone}
                            onChangeText={v => updateField('phone', v)}
                            keyboardType="phone-pad"
                        />
                        <TextInput
                            style={[styles.input, { marginTop: 12 }, errors.address && styles.inputError]}
                            placeholder="Street Address *"
                            value={formData.address}
                            onChangeText={v => updateField('address', v)}
                        />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <TextInput
                                style={[styles.input, { flex: 1 }, errors.city && styles.inputError]}
                                placeholder="City *"
                                value={formData.city}
                                onChangeText={v => updateField('city', v)}
                            />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Zip Code"
                                value={formData.postalCode}
                                onChangeText={v => updateField('postalCode', v)}
                                keyboardType="number-pad"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.saveAddressToggle}
                            onPress={() => setSaveNewAddress(!saveNewAddress)}
                        >
                            <View style={[styles.checkbox, saveNewAddress && styles.checkboxActive]}>
                                {saveNewAddress && <Feather name="check" size={14} color="#fff" />}
                            </View>
                            <Text style={styles.saveAddressText}>Save this address for future orders</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Payment Method */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIcon}>
                            <Feather name="credit-card" size={18} color={colors.primary} />
                        </View>
                        <Text style={styles.sectionTitle}>Payment Method</Text>
                    </View>
                    <View style={styles.paymentCard}>
                        <Feather name="dollar-sign" size={20} color={colors.primary} />
                        <Text style={styles.paymentText}>Cash on Delivery (COD)</Text>
                        <Feather name="check-circle" size={20} color={colors.primary} />
                    </View>
                </View>

                {/* ✅ Shipping Information */}
                {vendorShipping && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                                <Feather name="truck" size={18} color="#8b5cf6" />
                            </View>
                            <Text style={styles.sectionTitle}>Delivery Information</Text>
                        </View>

                        <View style={styles.shippingInfoCard}>
                            {/* Distance info (if GPS available) */}
                            {distanceKm !== null && (
                                <View style={[styles.shippingInfoRow, styles.distanceHighlight]}>
                                    <Feather name="navigation" size={16} color="#3b82f6" />
                                    <Text style={styles.distanceText}>
                                        {distanceKm} km from vendor
                                    </Text>
                                    <View style={[styles.distanceBadge, distanceKm <= (vendorShipping.radiusKm || 10) ? styles.distanceBadgeNear : styles.distanceBadgeFar]}>
                                        <Text style={styles.distanceBadgeText}>
                                            {distanceKm <= (vendorShipping.radiusKm || 10) ? 'Within Range' : 'Outside Range'}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.shippingInfoRow}>
                                <Feather name="map-pin" size={14} color="#8b5cf6" />
                                <Text style={styles.shippingInfoText}>
                                    Vendor: <Text style={styles.shippingInfoHighlight}>{vendorShipping.vendorCity || 'Not set'}</Text>
                                    {vendorShipping.latitude ? ' 📍' : ''}
                                </Text>
                            </View>

                            <View style={[styles.shippingInfoRow, { marginTop: 8 }]}>
                                <Feather name="home" size={14} color="#8b5cf6" />
                                <Text style={styles.shippingInfoText}>
                                    You: <Text style={styles.shippingInfoHighlight}>{formData.city || 'Enter above'}</Text>
                                    {customerCoords ? ' 📍' : ''}
                                </Text>
                            </View>

                            <View style={[styles.shippingInfoRow, { marginTop: 8 }]}>
                                <Feather name="tag" size={14} color="#8b5cf6" />
                                <Text style={styles.shippingInfoText}>
                                    Type: <Text style={styles.shippingInfoHighlight}>
                                        {shippingType === 'free' ? '🎁 FREE Delivery' :
                                            shippingType === 'standard'
                                                ? `Standard (within ${vendorShipping.radiusKm || 10} km)`
                                                : `Outside (beyond ${vendorShipping.radiusKm || 10} km)`}
                                    </Text>
                                </Text>
                            </View>

                            <View style={[styles.shippingInfoRow, { marginTop: 8 }]}>
                                <Feather name="dollar-sign" size={14} color="#8b5cf6" />
                                <Text style={styles.shippingInfoText}>
                                    Charges: <Text style={[styles.shippingInfoHighlight, shippingType === 'free' && { color: '#10b981' }]}>
                                        {shippingType === 'free' ? 'FREE' : `Rs. ${calculatedShipping}`}
                                    </Text>
                                </Text>
                            </View>
                        </View>

                        {/* Shipping rates info */}
                        <View style={{ marginTop: 10, paddingHorizontal: 4 }}>
                            <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                                Within {vendorShipping.radiusKm || 10}km: Rs. {vendorShipping.standardRate || 150} | Beyond: Rs. {vendorShipping.outsideCityRate || 300}
                                {vendorShipping.freeShippingEnabled && ` | Free above Rs. ${vendorShipping.freeShippingThreshold}`}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Order Summary */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Order Summary</Text>
                    {navItems && navItems.map((item: any, idx: number) => {
                        const cleanPrice = typeof item.price === 'string'
                            ? parseFloat(item.price.replace(/[^\d.]/g, ''))
                            : item.price;

                        const lineTotal = cleanPrice * item.quantity;

                        // ✅ FIXED: Compound unique key
                        const uniqueKey = `checkout-${item.productId || item.id}-${idx}-${Date.now()}-${Math.random()}`;

                        return (
                            <View key={uniqueKey} style={styles.itemRow}>
                                <Text style={styles.itemText}>{item.quantity}x {item.name}</Text>
                                <Text style={styles.itemPrice}>Rs. {lineTotal.toFixed(2)}</Text>
                            </View>
                        );
                    })}

                    <View style={styles.divider} />

                    <View style={styles.summaryRow}>
                        <Text>Subtotal</Text>
                        <Text>Rs. {navSubtotal.toFixed(2)}</Text>
                    </View>

                    {/* ✅ Shipping with type indicator */}
                    <View style={styles.summaryRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text>Shipping</Text>
                            {shippingType === 'free' && (
                                <View style={styles.freeBadge}>
                                    <Text style={styles.freeBadgeText}>FREE</Text>
                                </View>
                            )}
                            {shippingType === 'outside' && (
                                <View style={styles.outsideBadge}>
                                    <Text style={styles.outsideBadgeText}>Outside City</Text>
                                </View>
                            )}
                        </View>
                        <Text style={shippingType === 'free' ? styles.freeShippingText : undefined}>
                            {shippingType === 'free' ? 'Rs. 0' : `Rs. ${calculatedShipping.toFixed(2)}`}
                        </Text>
                    </View>

                    {/* ✅ Free shipping progress hint */}
                    {vendorShipping?.freeShippingEnabled && shippingType !== 'free' && (
                        <View style={styles.freeShippingHint}>
                            <Feather name="gift" size={14} color={colors.primary} />
                            <Text style={styles.freeShippingHintText}>
                                Add Rs. {(vendorShipping.freeShippingThreshold - navSubtotal).toFixed(0)} more for FREE delivery!
                            </Text>
                        </View>
                    )}

                    <View style={[styles.summaryRow, { marginTop: 10 }]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>Rs. {(navSubtotal + calculatedShipping).toFixed(2)}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.placeOrderBtn, placingOrder && styles.placeOrderBtnDisabled]}
                    onPress={handlePlaceOrder}
                    disabled={placingOrder}
                    activeOpacity={0.8}
                >
                    {placingOrder ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.placeOrderBtnText}>Placing Order...</Text>
                        </View>
                    ) : (
                        <Text style={styles.placeOrderBtnText}>Confirm Order • Rs. {(navSubtotal + calculatedShipping).toFixed(2)}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9f9f9' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    section: { padding: 16, backgroundColor: '#fff', marginHorizontal: 15, borderRadius: 15, marginTop: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    sectionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
    addressCard: { flexDirection: 'row', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
    addressCardSelected: { borderColor: colors.primary, backgroundColor: '#f0fdf4' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ddd', marginRight: 12 },
    radioSelected: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    addressInfo: { flex: 1 },
    addressLabel: { fontWeight: 'bold', fontSize: 13, color: colors.primary, marginBottom: 2 },
    addressName: { fontSize: 14, fontWeight: '600' },
    addressText: { fontSize: 13, color: '#666' },
    addressPhone: { fontSize: 13, color: '#666' },
    addNewBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    addNewText: { color: colors.primary, fontWeight: '600', marginLeft: 8 },
    input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12 },
    inputError: { borderColor: '#ef4444' },
    saveAddressToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#ddd', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    saveAddressText: { fontSize: 13, color: '#666' },
    paymentCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: colors.primary },
    paymentText: { flex: 1, marginLeft: 12, fontWeight: '600' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    itemText: { color: '#666' },
    itemPrice: { fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalValue: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
    placeOrderBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    placeOrderBtnDisabled: { opacity: 0.6 },
    placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // ✅ Shipping badge styles
    freeBadge: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
    freeBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#10b981' },
    outsideBadge: { backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
    outsideBadgeText: { fontSize: 10, fontWeight: '600', color: '#8b5cf6' },
    freeShippingText: { color: '#10b981', fontWeight: '600' },
    freeShippingHint: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', padding: 10, borderRadius: 8, marginTop: 8, gap: 8 },
    freeShippingHintText: { fontSize: 12, color: colors.primary, flex: 1 },

    // ✅ Shipping info section
    shippingInfoCard: { backgroundColor: 'rgba(139,92,246,0.05)', padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' },
    shippingInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    shippingInfoText: { fontSize: 12, color: '#6b7280' },
    shippingInfoHighlight: { fontSize: 12, fontWeight: '600', color: '#8b5cf6' },

    // ✅ Distance-based shipping styles
    distanceHighlight: { backgroundColor: 'rgba(59,130,246,0.08)', padding: 10, borderRadius: 8, marginBottom: 10 },
    distanceText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e40af' },
    distanceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    distanceBadgeNear: { backgroundColor: 'rgba(16,185,129,0.15)' },
    distanceBadgeFar: { backgroundColor: 'rgba(239,68,68,0.12)' },
    distanceBadgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
});