import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Alert, Modal, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { getCurrentLocation, reverseGeocode } from '../services/locationService';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { type NominatimResult } from '../services/locationService';

interface ShippingAddress {
    id: string;
    label: string;
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    isDefault: boolean;
    userId: string;
    latitude?: number;
    longitude?: number;
    createdAt?: any;
}

export default function ShippingAddressesScreen({ navigation }: any) {
    const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);
    const [locating, setLocating] = useState(false);

    // Form state
    const [label, setLabel] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    // ✅ Real-time Fetch Addresses from Firebase
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        const addressesQuery = query(
            collection(db, 'addresses'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(addressesQuery, (snapshot) => {
            const fetchedAddresses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ShippingAddress));

            console.log('📍 Addresses fetched:', fetchedAddresses.length);
            setAddresses(fetchedAddresses);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setLabel('');
        setFullName('');
        setPhone('');
        setStreet('');
        setCity('');
        setState('');
        setPostalCode('');
        setIsDefault(false);
        setLatitude(null);
        setLongitude(null);
        setEditingAddress(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (address: ShippingAddress) => {
        setEditingAddress(address);
        setLabel(address.label);
        setFullName(address.fullName);
        setPhone(address.phone);
        setStreet(address.street);
        setCity(address.city);
        setState(address.state);
        setPostalCode(address.postalCode);
        setIsDefault(address.isDefault);
        setLatitude(address.latitude || null);
        setLongitude(address.longitude || null);
        setShowModal(true);
    };

    // 📍 USE CURRENT LOCATION
    const handleUseMyLocation = async () => {
        setLocating(true);
        try {
            const coords = await getCurrentLocation();
            if (!coords) {
                setLocating(false);
                return;
            }

            setLatitude(coords.latitude);
            setLongitude(coords.longitude);

            // Reverse geocode to auto-fill address fields
            const address = await reverseGeocode(coords.latitude, coords.longitude);
            if (address) {
                if (address.street) setStreet(address.street);
                if (address.city) setCity(address.city);
                if (address.state) setState(address.state);
                if (address.postalCode) setPostalCode(address.postalCode);
                console.log('📍 Address auto-filled:', address.formattedAddress);
            }
        } catch (error) {
            console.error('Location error:', error);
            Alert.alert('Error', 'Could not get your location');
        } finally {
            setLocating(false);
        }
    };

    // ✅ Save Address to Firebase
    const handleSave = async () => {
        if (!label || !fullName || !phone || !street || !city || !state || !postalCode) {
            Alert.alert('Missing Fields', 'Please fill in all required fields.');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'Please login first');
            return;
        }

        try {
            // Auto-geocode if no GPS coordinates set
            let finalLat = latitude;
            let finalLng = longitude;

            if (!finalLat || !finalLng) {
                const { geocodeAddress } = require('../services/locationService');
                const fullAddress = `${street}, ${city}, ${state}, Pakistan`;
                console.log('🔍 Auto-geocoding address:', fullAddress);
                const coords = await geocodeAddress(fullAddress);
                if (coords) {
                    finalLat = coords.latitude;
                    finalLng = coords.longitude;
                    console.log('✅ Geocoded:', coords.latitude, coords.longitude);
                } else {
                    console.log('⚠️ Geocoding failed, saving without coordinates');
                }
            }

            const addressData: any = {
                label,
                fullName,
                phone,
                street,
                city,
                state,
                postalCode,
                isDefault,
                userId: user.uid,
            };

            // Add coordinates if available
            if (finalLat && finalLng) {
                addressData.latitude = finalLat;
                addressData.longitude = finalLng;
            }

            if (editingAddress) {
                await updateDoc(doc(db, 'addresses', editingAddress.id), addressData);

                if (isDefault) {
                    await setDefaultAddress(editingAddress.id);
                }

                Alert.alert('Success', 'Address updated successfully!');
            } else {
                await addDoc(collection(db, 'addresses'), {
                    ...addressData,
                    createdAt: serverTimestamp(),
                });

                if (isDefault) {
                    const addressesSnapshot = await getDocs(
                        query(collection(db, 'addresses'), where('userId', '==', user.uid))
                    );
                    const updatePromises = addressesSnapshot.docs.map(docSnap => {
                        if (docSnap.data().isDefault) {
                            return updateDoc(doc(db, 'addresses', docSnap.id), { isDefault: false });
                        }
                        return Promise.resolve();
                    });
                    await Promise.all(updatePromises);
                }

                Alert.alert('Success', 'Address added successfully!');
            }

            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error('Save Address Error:', error);
            Alert.alert('Error', 'Failed to save address');
        }
    };

    // ✅ Delete Address from Firebase
    const handleDelete = (address: ShippingAddress) => {
        Alert.alert(
            'Delete Address',
            `Are you sure you want to delete "${address.label}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'addresses', address.id));
                            Alert.alert('Deleted', 'Address has been removed.');
                        } catch (error) {
                            console.error('Delete Error:', error);
                            Alert.alert('Error', 'Failed to delete address');
                        }
                    }
                },
            ]
        );
    };

    // ✅ Set Default Address
    const setDefaultAddress = async (addressId: string) => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const addressesSnapshot = await getDocs(
                query(collection(db, 'addresses'), where('userId', '==', user.uid))
            );

            const updatePromises = addressesSnapshot.docs.map(docSnap => {
                if (docSnap.id === addressId) {
                    return updateDoc(doc(db, 'addresses', docSnap.id), { isDefault: true });
                } else if (docSnap.data().isDefault) {
                    return updateDoc(doc(db, 'addresses', docSnap.id), { isDefault: false });
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            console.log('✅ Default address updated');
        } catch (error) {
            console.error('Set Default Error:', error);
            Alert.alert('Error', 'Failed to set default address');
        }
    };

    const handleSetDefault = async (address: ShippingAddress) => {
        if (address.isDefault) return;
        await setDefaultAddress(address.id);
    };

    // Loading State
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Shipping Addresses</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading addresses...</Text>
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
                <Text style={styles.title}>Shipping Addresses</Text>
                <TouchableOpacity onPress={openAddModal}>
                    <Feather name="plus" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {addresses.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIcon}>
                        <Feather name="map-pin" size={48} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No addresses saved</Text>
                    <Text style={styles.emptyText}>Add a shipping address to make checkout faster.</Text>
                    <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                        <Feather name="plus" size={18} color="#fff" />
                        <Text style={styles.addButtonText}>Add Address</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                    {addresses.map(address => (
                        <View key={address.id} style={[styles.addressCard, address.isDefault && styles.addressCardDefault]}>
                            <View style={styles.addressHeader}>
                                <View style={styles.labelBadge}>
                                    <Feather
                                        name={address.label === 'Home' ? 'home' : address.label === 'Office' ? 'briefcase' : 'map-pin'}
                                        size={14}
                                        color={colors.primary}
                                    />
                                    <Text style={styles.labelText}>{address.label}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {address.latitude && address.longitude && (
                                        <View style={styles.gpsBadge}>
                                            <Feather name="crosshair" size={10} color="#3b82f6" />
                                            <Text style={styles.gpsBadgeText}>GPS</Text>
                                        </View>
                                    )}
                                    {address.isDefault && (
                                        <View style={styles.defaultBadge}>
                                            <Feather name="check" size={10} color="#fff" />
                                            <Text style={styles.defaultText}>Default</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <Text style={styles.addressName}>{address.fullName}</Text>
                            <Text style={styles.addressText}>{address.street}</Text>
                            <Text style={styles.addressText}>{address.city}, {address.state} {address.postalCode}</Text>
                            <Text style={styles.addressPhone}>{address.phone}</Text>

                            <View style={styles.addressActions}>
                                {!address.isDefault && (
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleSetDefault(address)}>
                                        <Feather name="star" size={16} color={colors.textMuted} />
                                        <Text style={styles.actionText}>Set Default</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(address)}>
                                    <Feather name="edit-2" size={16} color={colors.primary} />
                                    <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(address)}>
                                    <Feather name="trash-2" size={16} color="#ef4444" />
                                    <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Add/Edit Modal */}
            <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{editingAddress ? 'Edit Address' : 'Add Address'}</Text>
                        <TouchableOpacity onPress={handleSave}>
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        {/* 📍 Use My Location Button */}
                        <TouchableOpacity
                            style={styles.useLocationBtn}
                            onPress={handleUseMyLocation}
                            disabled={locating}
                            activeOpacity={0.7}
                        >
                            {locating ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Feather name="crosshair" size={18} color="#fff" />
                            )}
                            <Text style={styles.useLocationBtnText}>
                                {locating ? 'Getting Location...' : '📍 Use My Current Location'}
                            </Text>
                        </TouchableOpacity>

                        {/* Location status */}
                        {latitude && longitude && (
                            <View style={styles.locationPinned}>
                                <View style={styles.locationDot} />
                                <Text style={styles.locationPinnedText}>
                                    Location pinned ({latitude.toFixed(4)}, {longitude.toFixed(4)})
                                </Text>
                                <TouchableOpacity onPress={() => { setLatitude(null); setLongitude(null); }}>
                                    <Feather name="x" size={14} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.orDivider}>
                            <View style={styles.orLine} />
                            <Text style={styles.orText}>or search address</Text>
                            <View style={styles.orLine} />
                        </View>

                        {/* 🔍 Address Autocomplete */}
                        <AddressAutocomplete
                            placeholder="Search for your address..."
                            onSelect={(result: NominatimResult) => {
                                if (result.street) setStreet(result.street);
                                if (result.city) setCity(result.city);
                                if (result.state) setState(result.state);
                                if (result.postalCode) setPostalCode(result.postalCode);
                                setLatitude(result.latitude);
                                setLongitude(result.longitude);
                                console.log('📍 Address selected:', result.displayName);
                            }}
                        />

                        <Text style={styles.inputLabel}>Address Label *</Text>
                        <View style={styles.labelOptions}>
                            {['Home', 'Office', 'Other'].map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[styles.labelOption, label === opt && styles.labelOptionActive]}
                                    onPress={() => setLabel(opt)}
                                >
                                    <Feather
                                        name={opt === 'Home' ? 'home' : opt === 'Office' ? 'briefcase' : 'map-pin'}
                                        size={16}
                                        color={label === opt ? '#fff' : colors.textMuted}
                                    />
                                    <Text style={[styles.labelOptionText, label === opt && styles.labelOptionTextActive]}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="John Doe"
                            placeholderTextColor={colors.textMuted}
                        />

                        <Text style={styles.inputLabel}>Phone Number *</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="+92 300 1234567"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                        />

                        <Text style={styles.inputLabel}>Street Address *</Text>
                        <TextInput
                            style={styles.input}
                            value={street}
                            onChangeText={setStreet}
                            placeholder="123 Main Street"
                            placeholderTextColor={colors.textMuted}
                        />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: spacing.sm }}>
                                <Text style={styles.inputLabel}>City *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={city}
                                    onChangeText={setCity}
                                    placeholder="Lahore"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                <Text style={styles.inputLabel}>State *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={state}
                                    onChangeText={setState}
                                    placeholder="Punjab"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>

                        <Text style={styles.inputLabel}>Postal Code *</Text>
                        <TextInput
                            style={styles.input}
                            value={postalCode}
                            onChangeText={setPostalCode}
                            placeholder="54000"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                        />

                        <TouchableOpacity style={styles.defaultToggle} onPress={() => setIsDefault(!isDefault)}>
                            <View style={[styles.checkbox, isDefault && styles.checkboxActive]}>
                                {isDefault && <Feather name="check" size={14} color="#fff" />}
                            </View>
                            <Text style={styles.defaultToggleText}>Set as default shipping address</Text>
                        </TouchableOpacity>

                        <View style={{ height: 50 }} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    title: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
    emptyTitle: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
    addButtonText: { color: '#fff', fontWeight: 'bold' },
    listContent: { padding: spacing.lg, paddingBottom: 100 },
    addressCard: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(229,231,235,0.5)' },
    addressCardDefault: { borderColor: colors.primary, borderWidth: 2 },
    addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    labelBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, gap: 4 },
    labelText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
    gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: borderRadius.sm, gap: 3 },
    gpsBadgeText: { fontSize: 9, fontWeight: '700', color: '#3b82f6' },
    defaultBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, gap: 4 },
    defaultText: { fontSize: fontSize.xs, fontWeight: '600', color: '#fff' },
    addressName: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    addressText: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
    addressPhone: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing.sm },
    addressActions: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(229,231,235,0.5)', gap: spacing.md },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionText: { fontSize: fontSize.sm, color: colors.textMuted },
    modalContainer: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 30 : 0 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: fontSize.lg, fontWeight: 'bold', color: colors.text },
    cancelText: { color: colors.textMuted, fontWeight: '500' },
    saveText: { color: colors.primary, fontWeight: 'bold' },
    modalContent: { flex: 1, padding: spacing.lg },

    // Use Location Button
    useLocationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 14,
        borderRadius: borderRadius.md,
        gap: 8,
    },
    useLocationBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: fontSize.base,
    },
    locationPinned: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.08)',
        padding: 10,
        borderRadius: borderRadius.md,
        marginTop: spacing.sm,
        gap: 8,
    },
    locationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    locationPinnedText: {
        flex: 1,
        fontSize: fontSize.xs,
        color: '#10b981',
        fontWeight: '500',
    },
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
        gap: spacing.sm,
    },
    orLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    orText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        fontWeight: '500',
    },

    inputLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
    input: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.base, color: colors.text },
    labelOptions: { flexDirection: 'row', gap: spacing.sm },
    labelOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
    labelOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    labelOptionText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
    labelOptionTextActive: { color: '#fff' },
    row: { flexDirection: 'row' },
    defaultToggle: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: spacing.md },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    defaultToggleText: { fontSize: fontSize.sm, color: colors.text },
});